import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { canViewTicket, canManageAttachment } from '../middleware/permissionMiddleware.js';

const supabase = supabaseAdmin;

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File Upload Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Upload Attachment
router.post('/', authMiddleware, canViewTicket, upload.single('file'), asyncHandler(async (req, res) => {
  const { bugId } = req.body;

  if (!bugId || !req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'Bug ID and file are required'
    });
  }

  const { data, error } = await supabase
    .from('attachments')
    .insert([{
      bug_id: bugId,
      file_name: req.file.filename,
      original_name: req.file.originalname,
      file_size: req.file.size,
      file_path: `/uploads/${req.file.filename}`,
      uploaded_by: req.userId,
      created_at: new Date()
    }])
    .select();

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  res.status(201).json({
    status: 'success',
    message: 'File uploaded successfully',
    data: data[0]
  });
}));

// Get Bug Attachments
router.get('/bug/:bugId', authMiddleware, canViewTicket, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('bug_id', req.params.bugId)
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

// Delete Attachment
router.delete('/:id', authMiddleware, canManageAttachment, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('attachments')
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
    message: 'Attachment deleted successfully'
  });
}));

// Securely stream attachment
router.get('/stream/:filename', authMiddleware, asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Find attachment record to verify access
  const { data: attachment, error } = await supabase
    .from('attachments')
    .select('*, bug:bug_id(id, project_id)')
    .eq('file_name', filename)
    .single();

  if (error || !attachment) {
    return res.status(404).json({ message: 'File not found' });
  }

  // Verify project membership
  const projectId = attachment.bug.project_id;
  const userId = req.userId;

  // Check owner
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single();

  let hasAccess = project?.owner_id === userId;

  if (!hasAccess) {
    // Check member
    const { data: membership } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();
    
    if (membership) hasAccess = true;
  }

  if (!hasAccess) {
    return res.status(403).json({ message: 'Forbidden - You do not have access to this file' });
  }

  // Stream file
  const filePath = path.join(__dirname, '../uploads', filename);
  res.sendFile(filePath);
}));

export default router;
