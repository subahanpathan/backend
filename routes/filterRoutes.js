// Filter preferences API routes
import express from 'express';
import { authMiddleware } from '../utils/auth.js';
import { canViewProject } from '../middleware/permissionMiddleware.js';
import supabase from '../config/supabase.js';

const router = express.Router();

// Save a new filter
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { project_id, name, config } = req.body;

    if (!project_id || !name || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify access to project
    // (We could use canViewProject middleware here by wrapping req.params, 
    // but a manual check or using the middleware style is better)
    
    const { data, error } = await supabase
      .from('filters')
      .insert({
        user_id: userId,
        project_id,
        name,
        config,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all filters for a project
router.get('/project/:projectId', authMiddleware, canViewProject, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('filters')
      .select('*')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific filter
router.get('/:filterId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { filterId } = req.params;

    const { data, error } = await supabase
      .from('filters')
      .select('*')
      .eq('id', filterId)
      .eq('user_id', userId) // Security: Filter by user_id ensures isolation
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Filter not found' });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update filter
router.put('/:filterId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { filterId } = req.params;
    const { config, name } = req.body;

    const updateData = {};
    if (config) updateData.config = config;
    if (name) updateData.name = name;

    const { data, error } = await supabase
      .from('filters')
      .update(updateData)
      .eq('id', filterId)
      .eq('user_id', userId) // Security: Ensure ownership
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete filter
router.delete('/:filterId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { filterId } = req.params;

    const { error } = await supabase
      .from('filters')
      .delete()
      .eq('id', filterId)
      .eq('user_id', userId); // Security: Ensure ownership

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set default filter for project
router.put('/project/:projectId/default', authMiddleware, canViewProject, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;
    const { filter_id } = req.body;

    // Clear previous default
    await supabase
      .from('filters')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .eq('is_default', true);

    // Set new default
    const { data, error } = await supabase
      .from('filters')
      .update({ is_default: true })
      .eq('id', filter_id)
      .eq('user_id', userId) // Security: Ensure ownership
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get default filter for project
router.get('/project/:projectId/default', authMiddleware, canViewProject, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('filters')
      .select('*')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .eq('is_default', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'No default filter set' });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
