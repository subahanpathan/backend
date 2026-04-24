// Notification API routes
import express from 'express';
import { authMiddleware } from '../utils/auth.js';
import notificationService from '../services/notificationService.js';

const router = express.Router();

// Get all user notifications (paginated)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 20, offset = 0 } = req.query;

    const { notifications, total } = await notificationService.getUserNotifications(
      userId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      notifications,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread notification count
router.get('/unread/count', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const count = await notificationService.getUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notifications by type
router.get('/type/:type', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { type } = req.params;
    const { limit = 20 } = req.query;

    const notifications = await notificationService.getNotificationsByType(
      userId,
      type,
      parseInt(limit)
    );

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;
    const notification = await notificationService.markAsRead(notificationId, userId);
    res.json(notification);
  } catch (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({ 
      error: error.message || 'Notification not found or access denied' 
    });
  }
});

// Mark all notifications as read
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const notifications = await notificationService.markAllAsRead(userId);
    res.json({ marked: notifications?.length || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete notification
router.delete('/:notificationId', authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;
    await notificationService.deleteNotification(notificationId, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all notifications
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    await notificationService.deleteAllNotifications(userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
