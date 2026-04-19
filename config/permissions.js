/**
 * Permission Matrix & Constants
 * Defines role-based access control for the application
 */

// User Roles
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
  MEMBER: 'member' // Legacy - treat as developer
};

// Permission Levels (for hierarchical comparison)
export const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  developer: 2,
  viewer: 1,
  member: 2 // Treat as developer
};

/**
 * Permission Matrix
 * Defines what each role can do
 */
export const PERMISSIONS = {
  // Ticket Permissions
  'ticket:create': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER],
  'ticket:read': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.VIEWER],
  'ticket:update': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER], // Developers can only update own/assigned
  'ticket:delete': [ROLES.OWNER, ROLES.ADMIN], // Only owner/admin can delete
  'ticket:assign': [ROLES.OWNER, ROLES.ADMIN],
  'ticket:change_status': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER],

  // Comment Permissions
  'comment:create': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.VIEWER],
  'comment:read': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.VIEWER],
  'comment:update': [ROLES.OWNER, ROLES.ADMIN], // Can only update own comments
  'comment:delete': [ROLES.OWNER, ROLES.ADMIN], // Can only delete own comments

  // Attachment Permissions
  'attachment:upload': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER],
  'attachment:download': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.VIEWER],
  'attachment:delete': [ROLES.OWNER, ROLES.ADMIN],

  // Project Permissions
  'project:read': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.VIEWER],
  'project:update': [ROLES.OWNER, ROLES.ADMIN],
  'project:delete': [ROLES.OWNER],
  'project:manage_members': [ROLES.OWNER, ROLES.ADMIN],
  'project:export': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER],

  // Team Permissions
  'team:add_member': [ROLES.OWNER, ROLES.ADMIN],
  'team:remove_member': [ROLES.OWNER, ROLES.ADMIN],
  'team:change_role': [ROLES.OWNER, ROLES.ADMIN],
  'team:view_members': [ROLES.OWNER, ROLES.ADMIN, ROLES.DEVELOPER, ROLES.VIEWER]
};

/**
 * Check if a role has permission
 * @param {string} role - User role
 * @param {string} permission - Permission string (e.g., 'ticket:create')
 * @returns {boolean}
 */
export const hasPermission = (role, permission) => {
  if (!role || !permission) return false;
  const allowedRoles = PERMISSIONS[permission] || [];
  return allowedRoles.includes(role);
};

/**
 * Check if user's role is at least the required level
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role
 * @returns {boolean}
 */
export const isRoleAtLeast = (userRole, requiredRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
};

export default {
  ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS,
  hasPermission,
  isRoleAtLeast
};
