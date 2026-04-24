import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isProjectOwner, isProjectAdmin, canViewProject } from '../middleware/permissionMiddleware.js';

// Use admin client to bypass RLS for all server-side operations
const supabase = supabaseAdmin;

const router = express.Router();

// ====================================
// PROJECT ROUTES
// ====================================

// Get All Projects (user is member of or owns)
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  // 1. Get project IDs where user is member
  const { data: memberProjects } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', req.userId);

  const memberProjectIds = memberProjects?.map(mp => mp.project_id) || [];

  let query = supabase
    .from('projects')
    .select(`
      *,
      owner:owner_id(id, first_name, last_name, email),
      members:project_members(id, user_id, role, user:user_id(id, first_name, last_name, email))
    `);

  if (memberProjectIds.length > 0) {
    query = query.or(`owner_id.eq.${req.userId},id.in.(${memberProjectIds.join(',')})`);
  } else {
    query = query.eq('owner_id', req.userId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }

  res.status(200).json({
    status: 'success',
    data
  });
}));

// Get Single Project
router.get('/:id', authMiddleware, canViewProject, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      owner:owner_id(id, first_name, last_name, email),
      members:project_members(id, user_id, role, user:user_id(id, first_name, last_name, email))
    `)
    .eq('id', req.params.id)
    .single();

  if (error) {
    return res.status(404).json({
      status: 'error',
      message: 'Project not found'
    });
  }

  res.status(200).json({
    status: 'success',
    data
  });
}));

// Create Project
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { name, description, key } = req.body;

  // Validation
  if (!name || !key) {
    return res.status(400).json({
      status: 'error',
      message: 'Project name and key are required'
    });
  }

  // Create project
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .insert([{
      name,
      description,
      key: key.toUpperCase(),
      owner_id: req.userId,
      status: 'active'
    }])
    .select();

  if (projectError) {
    return res.status(400).json({
      status: 'error',
      message: projectError.message
    });
  }

  const projectId = projectData[0].id;

  // Add owner as project member (admin role)
  const { error: memberError } = await supabase
    .from('project_members')
    .insert([{
      project_id: projectId,
      user_id: req.userId,
      role: 'admin'
    }]);

  if (memberError) {
    return res.status(400).json({
      status: 'error',
      message: memberError.message
    });
  }

  // Fetch with members
  const { data: fullProject, error: fetchError } = await supabase
    .from('projects')
    .select(`
      *,
      owner:owner_id(id, first_name, last_name, email),
      members:project_members(id, user_id, role, user:user_id(id, first_name, last_name, email))
    `)
    .eq('id', projectId)
    .single();

  res.status(201).json({
    status: 'success',
    message: 'Project created successfully',
    data: fullProject
  });
}));

// Update Project
router.put('/:id', authMiddleware, isProjectOwner, asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const { data, error } = await supabase
    .from('projects')
    .update({
      name,
      description,
      updated_at: new Date()
    })
    .eq('id', req.params.id)
    .select(`
      *,
      owner:owner_id(id, first_name, last_name, email),
      members:project_members(id, user_id, role, user:user_id(id, first_name, last_name, email))
    `);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Project updated successfully',
    data: data[0]
  });
}));

// Delete Project
router.delete('/:id', authMiddleware, isProjectOwner, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Project deleted successfully'
  });
}));

// ====================================
// PROJECT MEMBERS ROUTES
// ====================================

// Get Project Members
router.get('/:id/members', authMiddleware, canViewProject, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('project_members')
    .select(`
      id,
      user_id,
      role,
      joined_at,
      user:user_id(id, first_name, last_name, email, avatar_url)
    `)
    .eq('project_id', req.params.id)
    .order('joined_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }

  res.status(200).json({
    status: 'success',
    data
  });
}));

// Add Member to Project
router.post('/:id/members', authMiddleware, isProjectOwner, asyncHandler(async (req, res) => {
  const { userId, email, role = 'member' } = req.body;

  if (!userId && !email) {
    return res.status(400).json({
      status: 'error',
      message: 'Either userId or email is required'
    });
  }

  let targetUserId = userId;

  // If email provided, find user
  if (!userId && email) {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    targetUserId = user.id;
  }

  // Check if already member
  const { data: existingMember, error: checkError } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', req.params.id)
    .eq('user_id', targetUserId)
    .single();

  if (existingMember) {
    return res.status(400).json({
      status: 'error',
      message: 'User is already a member of this project'
    });
  }

  // Add member
  const { data, error } = await supabase
    .from('project_members')
    .insert([{
      project_id: req.params.id,
      user_id: targetUserId,
      role
    }])
    .select(`
      id,
      user_id,
      role,
      joined_at,
      user:user_id(id, first_name, last_name, email, avatar_url)
    `);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  res.status(201).json({
    status: 'success',
    message: 'Member added successfully',
    data: data[0]
  });
}));

// Remove Member from Project
router.delete('/:id/members/:memberId', authMiddleware, isProjectOwner, asyncHandler(async (req, res) => {
  // Check if member exists
  const { data: member, error: memberError } = await supabase
    .from('project_members')
    .select('id, user_id')
    .eq('id', req.params.memberId)
    .single();

  if (memberError || !member) {
    return res.status(404).json({
      status: 'error',
      message: 'Member not found'
    });
  }

  // Get project owner to prevent owner removal
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', req.params.id)
    .single();

  // Cannot remove owner
  if (member.user_id === project.owner_id) {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot remove project owner'
    });
  }

  // Remove member
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', req.params.memberId);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Member removed successfully'
  });
}));

// Update Member Role
router.put('/:id/members/:memberId', authMiddleware, isProjectOwner, asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({
      status: 'error',
      message: 'Role is required'
    });
  }

  const { data, error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('id', req.params.memberId)
    .select(`
      id,
      user_id,
      role,
      joined_at,
      user:user_id(id, first_name, last_name, email, avatar_url)
    `);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Member role updated successfully',
    data: data[0]
  });
}));

export default router;
