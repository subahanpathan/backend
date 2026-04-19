// Notification API routes
import express from 'express';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import notificationService from '../services/notificationService.js';

const router = express.Router();

// Get all user notifications (paginated)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
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
router.get('/unread/count', async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await notificationService.getUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notifications by type
router.get('/type/:type', async (req, res) => {
  try {
    const userId = req.user.id;
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
router.put('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await notificationService.markAsRead(notificationId);
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.put('/read-all', async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await notificationService.markAllAsRead(userId);
    res.json({ marked: notifications.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete notification
router.delete('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    await notificationService.deleteNotification(notificationId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all notifications
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    await notificationService.deleteAllNotifications(userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
