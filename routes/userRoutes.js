import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const supabase = supabaseAdmin;

const router = express.Router();

// Get All Users
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
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

// Get User Profile
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
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

// Update User Profile
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { firstName, lastName, role } = req.body;

  const { data, error } = await supabase
    .from('users')
    .update({
      first_name: firstName,
      last_name: lastName,
      role
    })
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

// Delete User
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
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
