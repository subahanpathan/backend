import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  isDeveloperOrAbove,
  isProjectAdmin,
  canEditTicket,
  canDeleteTicket,
  canAssignTicket
} from '../middleware/permissionMiddleware.js';
import emailService from '../services/emailService.mock.js'; // Using mock for testing - swap to emailService.js for real SendGrid
import activityService from '../services/activityService.js';
import emailPreferenceService from '../services/emailPreferenceService.js';

// Use admin client to bypass RLS for all server-side operations
const supabase = supabaseAdmin;

const router = express.Router();

// ====================================
// TICKET/BUG ROUTES
// ====================================

// Get All Tickets (with filters)
router.get('/', authMiddleware, isDeveloperOrAbove, asyncHandler(async (req, res) => {
  const { projectId, status, priority, assigneeId, isUnassigned, search } = req.query;

  if (!projectId) {
    return res.status(400).json({
      status: 'error',
      message: 'Project ID is required'
    });
  }

  let query = supabase
    .from('bugs')
    .select(`
      *,
      reporter:reporter_id(id, first_name, last_name, email, avatar_url),
      assignee:assignee_id(id, first_name, last_name, email, avatar_url)
    `)
    .eq('project_id', projectId);

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  
  // Handle assigneeId filter
  if (assigneeId) {
    query = query.eq('assignee_id', assigneeId);
  } else if (isUnassigned === 'true') {
    // Filter for unassigned tickets
    query = query.is('assignee_id', null);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }

  // Filter by search keyword on the server side
  let filteredData = data || [];
  if (search && search.trim()) {
    const searchLower = search.toLowerCase().trim();
    filteredData = filteredData.filter((bug) =>
      bug.title.toLowerCase().includes(searchLower) ||
      bug.description?.toLowerCase().includes(searchLower) ||
      bug.id.toLowerCase().includes(searchLower)
    );
  }

  res.status(200).json({
    status: 'success',
    data: filteredData
  });
}));

// Get Single Ticket
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('bugs')
    .select(`
      *,
      reporter:reporter_id(id, first_name, last_name, email, avatar_url),
      assignee:assignee_id(id, first_name, last_name, email, avatar_url),
      project:project_id(id, name, key)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) {
    return res.status(404).json({
      status: 'error',
      message: 'Ticket not found'
    });
  }

  res.status(200).json({
    status: 'success',
    data
  });
}));

// Create Ticket
router.post('/', authMiddleware, isDeveloperOrAbove, asyncHandler(async (req, res) => {
  const { title, description, projectId, priority = 'medium', issueType = 'bug', assigneeId } = req.body;

  // Validation
  if (!title || !projectId) {
    return res.status(400).json({
      status: 'error',
      message: 'Title and project ID are required'
    });
  }

  if (title.trim().length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Title cannot be empty'
    });
  }

  // Validate issue type
  const validIssueTypes = ['bug', 'feature', 'task'];
  if (!validIssueTypes.includes(issueType)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid issue type. Must be: bug, feature, task'
    });
  }

  // Verify project exists
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return res.status(404).json({
      status: 'error',
      message: 'Project not found'
    });
  }

  // Verify assignee exists if provided
  if (assigneeId) {
    const { data: assignee, error: assigneeError } = await supabase
      .from('users')
      .select('id')
      .eq('id', assigneeId)
      .single();

    if (assigneeError || !assignee) {
      return res.status(404).json({
        status: 'error',
        message: 'Assignee not found'
      });
    }

    // Verify assignee is a member of the project
    const { data: isMember, error: memberError } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', assigneeId)
      .single();

    if (!isMember) {
      return res.status(403).json({
        status: 'error',
        message: 'Assignee is not a member of this project'
      });
    }
  }

  // Valid priorities
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  if (!validPriorities.includes(priority)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid priority. Must be: low, medium, high, critical'
    });
  }

  // Create ticket
  const { data, error } = await supabase
    .from('bugs')
    .insert([{
      title: title.trim(),
      description: description?.trim() || null,
      project_id: projectId,
      priority,
      issue_type: issueType,
      status: 'open',
      assignee_id: assigneeId || null,
      reporter_id: req.userId
    }])
    .select(`
      *,
      reporter:reporter_id(id, first_name, last_name, email, avatar_url),
      assignee:assignee_id(id, first_name, last_name, email, avatar_url)
    `);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  const ticket = data[0];

  // Log activity
  try {
    await activityService.logActivity({
      userId: req.userId,
      projectId,
      action: 'created',
      entityType: 'ticket',
      entityId: ticket.id,
      details: `Created ticket: ${ticket.title}`,
      changes: null
    });
  } catch (activityError) {
    console.error('Failed to log activity:', activityError);
  }

  // Send emails to project members
  try {
    const { data: projectData } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();

    const { data: projectMembers } = await supabase
      .from('project_members')
      .select(`
        user_id,
        users(id, email, first_name, last_name)
      `)
      .eq('project_id', projectId);

    if (projectMembers) {
      for (const member of projectMembers) {
        const shouldSend = await emailPreferenceService.shouldSendEmail(
          member.user_id,
          'ticket_created'
        );

        if (shouldSend && member.users?.email) {
          await emailService.sendTicketCreatedEmail(
            member.users,
            ticket,
            { id: projectId, name: projectData?.name || 'Project' }
          );
        }
      }
    }
  } catch (emailError) {
    console.error('Failed to send emails:', emailError);
  }

  res.status(201).json({
    status: 'success',
    message: 'Ticket created successfully',
    data: ticket
  });
}));

// Update Ticket
router.put('/:id', authMiddleware, canEditTicket, asyncHandler(async (req, res) => {
  const { title, description, priority, status, issueType } = req.body;

  // Verify ticket exists and get old data for comparison
  const { data: oldTicket, error: ticketError } = await supabase
    .from('bugs')
    .select(`
      *,
      project:project_id(id, name)
    `)
    .eq('id', req.params.id)
    .single();

  if (ticketError || !ticket) {
    return res.status(404).json({
      status: 'error',
      message: 'Ticket not found'
    });
  }

  // Build update object with only provided fields and track changes
  const updateData = {};
  const changes = {};

  if (title !== undefined) {
    updateData.title = title.trim();
    if (oldTicket.title !== updateData.title) changes.title = { old: oldTicket.title, new: updateData.title };
  }
  if (description !== undefined) {
    updateData.description = description?.trim() || null;
    if (oldTicket.description !== updateData.description) changes.description = 'Updated description';
  }
  if (priority !== undefined) {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid priority'
      });
    }
    updateData.priority = priority;
    if (oldTicket.priority !== updateData.priority) changes.priority = { old: oldTicket.priority, new: updateData.priority };
  }
  if (status !== undefined) {
    const validStatuses = ['open', 'in-progress', 'in-review', 'closed', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status'
      });
    }
    updateData.status = status;
    if (oldTicket.status !== updateData.status) changes.status = { old: oldTicket.status, new: updateData.status };
  }
  if (issueType !== undefined) {
    const validIssueTypes = ['bug', 'feature', 'task'];
    if (!validIssueTypes.includes(issueType)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid issue type. Must be: bug, feature, task'
      });
    }
    updateData.issue_type = issueType;
    if (oldTicket.issue_type !== updateData.issue_type) changes.issueType = { old: oldTicket.issue_type, new: updateData.issue_type };
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'No fields to update'
    });
  }

  const { data, error } = await supabase
    .from('bugs')
    .update(updateData)
    .eq('id', req.params.id)
    .select(`
      *,
      reporter:reporter_id(id, first_name, last_name, email, avatar_url),
      assignee:assignee_id(id, first_name, last_name, email, avatar_url)
    `);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  const ticket = data[0];

  // Log activity with changes
  try {
    const changesSummary = Object.entries(changes)
      .map(([key, val]) => {
        if (typeof val === 'object') {
          return `${key}: ${val.old} → ${val.new}`;
        }
        return `${key}: ${val}`;
      })
      .join(', ');

    await activityService.logActivity({
      userId: req.userId,
      projectId: oldTicket.project_id,
      action: 'updated',
      entityType: 'ticket',
      entityId: ticket.id,
      details: `Updated ticket: ${ticket.title} (${changesSummary})`,
      changes: changes
    });
  } catch (activityError) {
    console.error('Failed to log activity:', activityError);
  }

  // Send emails to watchers/assignee
  try {
    const notifyUsers = new Set();
    if (oldTicket.reporter_id) notifyUsers.add(oldTicket.reporter_id);
    if (oldTicket.assignee_id) notifyUsers.add(oldTicket.assignee_id);

    for (const userId of notifyUsers) {
      const shouldSend = await emailPreferenceService.shouldSendEmail(userId, 'ticket_updated');
      
      if (shouldSend) {
        const { data: user } = await supabase
          .from('users')
          .select('id, email, first_name, last_name')
          .eq('id', userId)
          .single();

        if (user?.email) {
          await emailService.sendTicketUpdatedEmail(user, ticket, changes);
        }
      }
    }
  } catch (emailError) {
    console.error('Failed to send emails:', emailError);
  }

  res.status(200).json({
    status: 'success',
    message: 'Ticket updated successfully',
    data: ticket
  });
}));

// Delete Ticket
router.delete('/:id', authMiddleware, canDeleteTicket, asyncHandler(async (req, res) => {
  // Verify ticket exists and get data
  const { data: ticket, error: ticketError } = await supabase
    .from('bugs')
    .select(`
      *,
      project:project_id(id, name)
    `)
    .eq('id', req.params.id)
    .single();

  if (ticketError || !ticket) {
    return res.status(404).json({
      status: 'error',
      message: 'Ticket not found'
    });
  }

  const { error } = await supabase
    .from('bugs')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  // Log activity
  try {
    await activityService.logActivity({
      userId: req.userId,
      projectId: ticket.project_id,
      action: 'deleted',
      entityType: 'ticket',
      entityId: ticket.id,
      details: `Deleted ticket: ${ticket.title}`,
      changes: null
    });
  } catch (activityError) {
    console.error('Failed to log activity:', activityError);
  }

  res.status(200).json({
    status: 'success',
    message: 'Ticket deleted successfully'
  });
}));

// ====================================
// TICKET ASSIGNMENT
// ====================================

// Assign Ticket to User
router.post('/:id/assign', authMiddleware, canAssignTicket, asyncHandler(async (req, res) => {
  const { assigneeId } = req.body;

  if (!assigneeId) {
    return res.status(400).json({
      status: 'error',
      message: 'Assignee ID is required'
    });
  }

  // Verify ticket exists and get full data
  const { data: ticket, error: ticketError } = await supabase
    .from('bugs')
    .select(`
      *,
      project:project_id(id, name)
    `)
    .eq('id', req.params.id)
    .single();

  if (ticketError || !ticket) {
    return res.status(404).json({
      status: 'error',
      message: 'Ticket not found'
    });
  }

  // Verify assignee exists
  const { data: assignee, error: assigneeError } = await supabase
    .from('users')
    .select('id')
    .eq('id', assigneeId)
    .single();

  if (assigneeError || !assignee) {
    return res.status(404).json({
      status: 'error',
      message: 'Assignee not found'
    });
  }

  // Verify assignee is a member of the project
  const { data: isMember, error: memberError } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', ticket.project_id)
    .eq('user_id', assigneeId)
    .single();

  if (!isMember) {
    return res.status(403).json({
      status: 'error',
      message: 'Assignee is not a member of this project'
    });
  }

  // Update assignment
  const { data, error } = await supabase
    .from('bugs')
    .update({ assignee_id: assigneeId })
    .eq('id', req.params.id)
    .select(`
      *,
      reporter:reporter_id(id, first_name, last_name, email, avatar_url),
      assignee:assignee_id(id, first_name, last_name, email, avatar_url)
    `);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  const updatedTicket = data[0];

  // Log activity
  try {
    const { data: assigneeData } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', assigneeId)
      .single();

    const assigneeName = assigneeData ? `${assigneeData.first_name} ${assigneeData.last_name}` : 'Unknown';
    
    await activityService.logActivity({
      userId: req.userId,
      projectId: ticket.project_id,
      action: 'assigned',
      entityType: 'ticket',
      entityId: ticket.id,
      details: `Assigned ticket to ${assigneeName}: ${ticket.title}`,
      changes: { assignee: assigneeName }
    });
  } catch (activityError) {
    console.error('Failed to log activity:', activityError);
  }

  // Send email to assignee
  try {
    const { data: assignee } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('id', assigneeId)
      .single();

    if (assignee?.email) {
      const shouldSend = await emailPreferenceService.shouldSendEmail(assigneeId, 'ticket_assigned');
      
      if (shouldSend) {
        await emailService.sendTicketAssignedEmail(
          assignee,
          updatedTicket,
          { id: ticket.project_id, name: ticket.project.name }
        );
      }
    }
  } catch (emailError) {
    console.error('Failed to send email:', emailError);
  }

  res.status(200).json({
    status: 'success',
    message: 'Ticket assigned successfully',
    data: updatedTicket
  });
}));

// Unassign Ticket
router.post('/:id/unassign', authMiddleware, asyncHandler(async (req, res) => {
  // Verify ticket exists and get full data
  const { data: ticket, error: ticketError } = await supabase
    .from('bugs')
    .select(`
      *,
      project:project_id(id, name)
    `)
    .eq('id', req.params.id)
    .single();

  if (ticketError || !ticket) {
    return res.status(404).json({
      status: 'error',
      message: 'Ticket not found'
    });
  }

  const { data, error } = await supabase
    .from('bugs')
    .update({ assignee_id: null })
    .eq('id', req.params.id)
    .select(`
      *,
      reporter:reporter_id(id, first_name, last_name, email, avatar_url),
      assignee:assignee_id(id, first_name, last_name, email, avatar_url)
    `);

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  const updatedTicket = data[0];

  // Log activity
  try {
    await activityService.logActivity({
      userId: req.userId,
      projectId: ticket.project_id,
      action: 'assigned',
      entityType: 'ticket',
      entityId: ticket.id,
      details: `Unassigned ticket: ${ticket.title}`,
      changes: { assignee: 'Unassigned' }
    });
  } catch (activityError) {
    console.error('Failed to log activity:', activityError);
  }

  res.status(200).json({
    status: 'success',
    message: 'Ticket unassigned successfully',
    data: updatedTicket
  });
}));

export default router;
