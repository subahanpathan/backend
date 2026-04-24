// Email preferences routes
import express from 'express';
import { authMiddleware } from '../utils/auth.js';
import emailPreferenceService from '../services/emailPreferenceService.js';

const router = express.Router();

// Get user email preferences
router.get('/user/email-preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const preferences = await emailPreferenceService.getPreferences(userId);
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user email preferences
router.put('/user/email-preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const updates = req.body;

    const preferences = await emailPreferenceService.updatePreferences(userId, updates);
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update single preference
router.patch('/user/email-preferences/:key', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { key } = req.params;
    const { value } = req.body;

    if (typeof value !== 'boolean') {
      return res.status(400).json({ error: 'Value must be boolean' });
    }

    const preferences = await emailPreferenceService.updatePreference(userId, key, value);
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disable all emails
router.post('/user/email-preferences/disable-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const preferences = await emailPreferenceService.disableAllEmails(userId);
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enable all emails
router.post('/user/email-preferences/enable-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const preferences = await emailPreferenceService.enableAllEmails(userId);
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
