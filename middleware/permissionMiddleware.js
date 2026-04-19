import { hasPermission, isRoleAtLeast, ROLES } from '../config/permissions.js';
import supabase from '../config/supabase.js';

/**
 * Permission Middleware Factory
 * Creates middleware to check permissions for specific actions
 */

/**
 * Check if user has permission for an action
 * @param {string} permission - Permission string (e.g., 'ticket:create')
 * @returns {Function} Express middleware
 */
export const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      const projectId = req.params.projectId || req.body.projectId;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized - No user found' });
      }

      if (!projectId) {
        return res.status(400).json({ message: 'Bad Request - Project ID required' });
      }

      // Get user's role in the project
      const { data: membership, error } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return res.status(500).json({ message: 'Error checking permissions' });
      }

      // Check if user is project owner (owner role supersedes project_members entry)
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();

      let userRole = ROLES.VIEWER;

      if (project?.owner_id === userId) {
        userRole = ROLES.OWNER;
      } else if (membership?.role) {
        userRole = membership.role;
      }

      // Check if role has permission
      if (!hasPermission(userRole, permission)) {
        return res.status(403).json({
          message: `Forbidden - You do not have permission to perform this action. Required role: ${permission}`
        });
      }

      // Attach role to request for later use
      req.userRole = userRole;
      req.projectId = projectId;

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  };
};

/**
 * Check if user is project owner
 */
export const isProjectOwner = async (req, res, next) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId || req.params.id;

    if (!userId || !projectId) {
      return res.status(400).json({ message: 'Bad Request' });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (error) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner_id !== userId) {
      return res.status(403).json({ message: 'Forbidden - Only project owner can perform this action' });
    }

    next();
  } catch (error) {
    console.error('Owner check error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Check if user has admin role in project
 */
export const isProjectAdmin = async (req, res, next) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId || req.params.id;

    if (!userId || !projectId) {
      return res.status(400).json({ message: 'Bad Request' });
    }

    // Get project owner
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Owner is admin by default
    if (project.owner_id === userId) {
      return next();
    }

    // Check if user is admin member
    const { data: membership, error: memberError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (memberError || membership?.role !== ROLES.ADMIN) {
      return res.status(403).json({ message: 'Forbidden - Admin role required' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Check if user is developer or above
 */
export const isDeveloperOrAbove = async (req, res, next) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId || req.params.id;

    if (!userId || !projectId) {
      return res.status(400).json({ message: 'Bad Request' });
    }

    // Get project owner
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Owner and admin are always allowed
    if ([project.owner_id].includes(userId)) {
      return next();
    }

    // Check if user is member with developer role or above
    const { data: membership, error: memberError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (memberError) {
      return res.status(403).json({ message: 'Forbidden - You are not a member of this project' });
    }

    const allowedRoles = [ROLES.ADMIN, ROLES.DEVELOPER];
    if (!allowedRoles.includes(membership?.role)) {
      return res.status(403).json({ message: 'Forbidden - Developer role or above required' });
    }

    next();
  } catch (error) {
    console.error('Developer check error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Check if user can edit ticket
 * Developers can only edit their own or assigned tickets
 */
export const canEditTicket = async (req, res, next) => {
  try {
    const userId = req.userId;
    const ticketId = req.params.id;

    if (!userId || !ticketId) {
      return res.status(400).json({ message: 'Bad Request' });
    }

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('bugs')
      .select('id, project_id, created_by, assigned_to')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Get user's role in project
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', ticket.project_id)
      .single();

    if (project.owner_id === userId) {
      return next(); // Owner can edit anything
    }

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', ticket.project_id)
      .eq('user_id', userId)
      .single();

    const role = membership?.role || ROLES.VIEWER;

    // Admins can edit anything
    if (role === ROLES.ADMIN) {
      return next();
    }

    // Developers can only edit own or assigned tickets
    if (role === ROLES.DEVELOPER) {
      const isCreator = ticket.created_by === userId;
      const isAssigned = ticket.assigned_to?.includes(userId);

      if (isCreator || isAssigned) {
        return next();
      }

      return res.status(403).json({
        message: 'Forbidden - You can only edit tickets you created or are assigned to'
      });
    }

    // Viewers cannot edit
    res.status(403).json({ message: 'Forbidden - Your role does not permit editing tickets' });
  } catch (error) {
    console.error('Edit ticket check error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Check if user can delete ticket
 */
export const canDeleteTicket = async (req, res, next) => {
  try {
    const userId = req.userId;
    const ticketId = req.params.id;

    if (!userId || !ticketId) {
      return res.status(400).json({ message: 'Bad Request' });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('bugs')
      .select('project_id')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Only owner/admin can delete
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', ticket.project_id)
      .single();

    if (project.owner_id === userId) {
      return next();
    }

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', ticket.project_id)
      .eq('user_id', userId)
      .single();

    if (membership?.role === ROLES.ADMIN) {
      return next();
    }

    res.status(403).json({ message: 'Forbidden - Only admins can delete tickets' });
  } catch (error) {
    console.error('Delete ticket check error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Check if user can assign ticket
 */
export const canAssignTicket = async (req, res, next) => {
  try {
    const userId = req.userId;
    const ticketId = req.params.id;

    if (!userId || !ticketId) {
      return res.status(400).json({ message: 'Bad Request' });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('bugs')
      .select('project_id')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Get user's role in project
    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', ticket.project_id)
      .single();

    if (project.owner_id === userId) {
      return next();
    }

    const { data: membership } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', ticket.project_id)
      .eq('user_id', userId)
      .single();

    if (membership?.role === ROLES.ADMIN) {
      return next();
    }

    res.status(403).json({ message: 'Forbidden - Only admins can assign tickets' });
  } catch (error) {
    console.error('Assign ticket check error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export default {
  checkPermission,
  isProjectOwner,
  isProjectAdmin,
  isDeveloperOrAbove,
  canEditTicket,
  canDeleteTicket,
  canAssignTicket
};
