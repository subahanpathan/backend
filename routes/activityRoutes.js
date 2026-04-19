// Activity log routes
import express from 'express';
import activityService from '../services/activityService.js';

const router = express.Router();

// Get project activity
router.get('/projects/:projectId/activity', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const { activities, total } = await activityService.getProjectActivity(
      projectId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      activities,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ticket activity
router.get('/tickets/:ticketId/activity', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { limit = 20 } = req.query;

    const activities = await activityService.getTicketActivity(ticketId, parseInt(limit));
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user activity
router.get('/user/activity', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 30, offset = 0 } = req.query;

    const { activities, total } = await activityService.getUserActivity(
      userId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      activities,
      total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get activity summary for project
router.get('/projects/:projectId/activity/summary', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days = 7 } = req.query;

    const summary = await activityService.getActivitySummary(projectId, parseInt(days));
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get most active users in project
router.get('/projects/:projectId/activity/active-users', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days = 30, limit = 10 } = req.query;

    const users = await activityService.getMostActiveUsers(
      projectId,
      parseInt(days),
      parseInt(limit)
    );

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
