import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authMiddleware } from '../utils/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import emailService from '../services/emailService.mock.js'; // Using mock for testing - swap to emailService.js for real SendGrid
import activityService from '../services/activityService.js';
import emailPreferenceService from '../services/emailPreferenceService.js';

const supabase = supabaseAdmin;

const router = express.Router();

// Get Bug Comments with Author Info
router.get('/bug/:bugId', authMiddleware, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:author_id(id, first_name, last_name, email, avatar_url)
    `)
    .eq('bug_id', req.params.bugId)
    .order('created_at', { ascending: true });

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

// Add Comment
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { bugId, content } = req.body;

  if (!bugId || !content) {
    return res.status(400).json({
      status: 'error',
      message: 'Bug ID and content are required'
    });
  }

  const { data, error } = await supabase
    .from('comments')
    .insert([{
      bug_id: bugId,
      author_id: req.userId,
      content,
      created_at: new Date()
    }])
    .select();

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }

  const comment = data[0];

  // Get ticket and project info for activity and email
  try {
    const { data: ticket } = await supabase
      .from('bugs')
      .select(`
        id, title, project_id, reporter_id, assignee_id,
        project:project_id(id, name)
      `)
      .eq('id', bugId)
      .single();

    if (ticket) {
      // Log activity
      await activityService.logActivity({
        userId: req.userId,
        projectId: ticket.project_id,
        action: 'commented',
        entityType: 'comment',
        entityId: comment.id,
        details: `Commented on ticket: ${ticket.title}`,
        changes: null
      });

      // Send emails to ticket owner and assignee
      const notifyUsers = new Set();
      if (ticket.reporter_id) notifyUsers.add(ticket.reporter_id);
      if (ticket.assignee_id) notifyUsers.add(ticket.assignee_id);

      for (const userId of notifyUsers) {
        const shouldSend = await emailPreferenceService.shouldSendEmail(userId, 'comment_added');
        
        if (shouldSend) {
          const { data: user } = await supabase
            .from('users')
            .select('id, email, first_name, last_name')
            .eq('id', userId)
            .single();

          if (user?.email) {
            await emailService.sendCommentEmail(user, comment, ticket, { id: ticket.project_id, name: ticket.project.name });
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to log activity or send emails:', error);
  }

  res.status(201).json({
    status: 'success',
    message: 'Comment added successfully',
    data: comment
  });
}));

// Update Comment
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { content } = req.body;

  const { data, error } = await supabase
    .from('comments')
    .update({
      content,
      updated_at: new Date()
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
    message: 'Comment updated successfully',
    data: data[0]
  });
}));

// Delete Comment
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  // Get comment info before deletion
  const { data: comment, error: commentError } = await supabase
    .from('comments')
    .select(`
      id, bug_id, author_id, content,
      bug:bug_id(id, title, project_id)
    `)
    .eq('id', req.params.id)
    .single();

  if (commentError || !comment) {
    return res.status(404).json({
      status: 'error',
      message: 'Comment not found'
    });
  }

  const { error } = await supabase
    .from('comments')
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
    if (comment.bug) {
      await activityService.logActivity({
        userId: req.userId,
        projectId: comment.bug.project_id,
        action: 'deleted',
        entityType: 'comment',
        entityId: comment.id,
        details: `Deleted comment on ticket: ${comment.bug.title}`,
        changes: null
      });
    }
  } catch (activityError) {
    console.error('Failed to log activity:', activityError);
  }

  res.status(200).json({
    status: 'success',
    message: 'Comment deleted successfully'
  });
}));

export default router;
