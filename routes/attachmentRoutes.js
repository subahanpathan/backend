import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

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
router.post('/', authMiddleware, upload.single('file'), asyncHandler(async (req, res) => {
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
router.get('/bug/:bugId', authMiddleware, asyncHandler(async (req, res) => {
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
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
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

export default router;
