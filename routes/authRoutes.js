import express from 'express';
import { hashPassword, comparePassword, generateToken, authMiddleware } from '../utils/auth.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import validator from 'validator';

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

  if (!validator.isEmail(email)) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide a valid email address'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      status: 'error',
      message: 'Password must be at least 6 characters'
    });
  }

  // Check if user already exists
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    return res.status(400).json({
      status: 'error',
      message: 'User with this email already exists'
    });
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Insert user profile into public users table directly
  const { data: user, error: profileError } = await supabaseAdmin
    .from('users')
    .insert([{
      email,
      password_hash: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      role: 'developer'
    }])
    .select()
    .single();

  if (profileError || !user) {
    return res.status(400).json({
      status: 'error',
      message: profileError?.message || 'Failed to create user'
    });
  }

  const token = generateToken(user.id);

  res.status(201).json({
    status: 'success',
    message: 'User registered successfully',
    data: {
      userId: user.id,
      email,
      firstName,
      lastName,
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

  // Get user profile
  const { data: profile, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !profile) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid email or password'
    });
  }

  // Check if they registered via old supabase auth or lack password hash
  if (!profile.password_hash) {
    return res.status(401).json({
      status: 'error',
      message: 'Account not configured for local login. Please contact support.'
    });
  }

  const isMatch = await comparePassword(password, profile.password_hash);

  if (!isMatch) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid email or password'
    });
  }

  const token = generateToken(profile.id);

  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    data: {
      userId: profile.id,
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
  // Simply acknowledge logout for client-side token deletion
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
}));

// Change Password
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

  // Get user profile
  const { data: userProfile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, password_hash')
    .eq('id', req.userId)
    .single();

  if (profileError || !userProfile || !userProfile.password_hash) {
    return res.status(404).json({
      status: 'error',
      message: 'User not found or misconfigured'
    });
  }

  // Verify current password
  const isMatch = await comparePassword(currentPassword, userProfile.password_hash);
  if (!isMatch) {
    return res.status(401).json({
      status: 'error',
      message: 'Current password is incorrect'
    });
  }

  // Update password
  const hashedNewPassword = await hashPassword(newPassword);

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ password_hash: hashedNewPassword })
    .eq('id', req.userId);

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


