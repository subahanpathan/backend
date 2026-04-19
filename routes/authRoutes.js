import express from 'express';
import { hashPassword, comparePassword, generateToken, authMiddleware } from '../utils/auth.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Register
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  // Validation
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({
      status: 'error',
      message: 'All fields are required'
    });
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user in Supabase
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  // Insert user profile
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert([{
      id: data.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'developer'
    }]);

  if (profileError) {
    return res.status(400).json({
      status: 'error',
      message: profileError.message
    });
  }

  const token = generateToken(data.user.id);

  res.status(201).json({
    status: 'success',
    message: 'User registered successfully',
    data: {
      userId: data.user.id,
      email,
      token
    }
  });
}));

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Email and password are required'
    });
  }

  // Authenticate with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid email or password'
    });
  }

  // Get user profile
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  const token = generateToken(data.user.id);

  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    data: {
      userId: data.user.id,
      email,
      profile,
      token
    }
  });
}));

// Get Current User
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', req.userId)
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

// Logout
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
  await supabase.auth.signOut();

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
}));

// Change Password (with current password verification)
router.post('/change-password', authMiddleware, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      status: 'error',
      message: 'Current password and new password are required'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      status: 'error',
      message: 'New password must be at least 6 characters'
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      status: 'error',
      message: 'New password must be different from the current password'
    });
  }

  // Step 1: Get the user's email from the database
  const { data: userProfile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', req.userId)
    .single();

  if (profileError || !userProfile) {
    return res.status(404).json({
      status: 'error',
      message: 'User not found'
    });
  }

  // Step 2: Verify current password by attempting a sign-in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: userProfile.email,
    password: currentPassword,
  });

  if (signInError || !signInData?.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Current password is incorrect'
    });
  }

  // Step 3: Current password verified — update to new password
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(req.userId, {
    password: newPassword
  });

  if (updateError) {
    return res.status(400).json({
      status: 'error',
      message: updateError.message
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully'
  });
}));

export default router;


