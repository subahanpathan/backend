import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isAdmin, isSelfOrAdmin } from '../middleware/permissionMiddleware.js';

const supabase = supabaseAdmin;

const router = express.Router();

// Get All Users (Admin Only)
router.get('/', authMiddleware, isAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, role, created_at')
    .order('created_at', { ascending: false });

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

// Get User Profile (Self or Admin)
router.get('/:id', authMiddleware, isSelfOrAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, role, created_at')
    .eq('id', req.params.id)
    .single();

  if (error) {
    return res.status(404).json({
      status: 'error',
      message: 'User not found'
    });
  }

  res.status(200).json({
    status: 'success',
    data
  });
}));

// Update User Profile (Self or Admin)
router.put('/:id', authMiddleware, isSelfOrAdmin, asyncHandler(async (req, res) => {
  const { firstName, lastName, role } = req.body;

  // Security: Only admins can change roles
  const updateData = {
    first_name: firstName,
    last_name: lastName
  };

  // Check if current user is admin before allowing role update
  const { data: currentUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.userId)
    .single();

  if (role && currentUser?.role === 'admin') {
    updateData.role = role;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', req.params.id)
    .select();

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'User updated successfully',
    data: data[0]
  });
}));

// Delete User (Self or Admin)
router.delete('/:id', authMiddleware, isSelfOrAdmin, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('users')
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
    message: 'User deleted successfully'
  });
}));

export default router;
