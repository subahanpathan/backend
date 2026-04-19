// Socket.io event manager for real-time collaboration
// Handles notifications, live updates, and user presence

export const socketEvents = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',

  // Ticket events
  TICKET_CREATED: 'ticket_created',
  TICKET_UPDATED: 'ticket_updated',
  TICKET_DELETED: 'ticket_deleted',
  TICKET_STATUS_CHANGED: 'ticket_status_changed',

  // Comment events
  COMMENT_ADDED: 'comment_added',
  COMMENT_DELETED: 'comment_deleted',

  // Project events
  PROJECT_UPDATED: 'project_updated',
  TEAM_MEMBER_ADDED: 'team_member_added',
  TEAM_MEMBER_REMOVED: 'team_member_removed',

  // Notification events
  NOTIFICATION_CREATED: 'notification_created',
  NOTIFICATION_READ: 'notification_read',
  NOTIFICATION_DELETED: 'notification_deleted',

  // User presence
  USERS_IN_PROJECT: 'users_in_project',
  TYPING_INDICATOR: 'typing_indicator',
};

export const initializeSocketHandlers = (io) => {
  const userProjects = new Map(); // Track which users are in which projects
  const userSockets = new Map(); // Track user ID to socket ID mapping

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Store user socket mapping
    socket.on('set_user_id', (userId) => {
      userSockets.set(userId, socket.id);
      socket.userId = userId;
      console.log(`Socket ${socket.id} mapped to user ${userId}`);
    });

    // User joins a project room
    socket.on('join_project', (projectId) => {
      const roomName = `project_${projectId}`;
      socket.join(roomName);

      if (!userProjects.has(projectId)) {
        userProjects.set(projectId, new Set());
      }
      userProjects.get(projectId).add(socket.userId);

      // Broadcast active users in project
      const activeUsers = Array.from(userProjects.get(projectId));
      io.to(roomName).emit(socketEvents.USERS_IN_PROJECT, {
        projectId,
        activeUsers,
        count: activeUsers.length,
      });

      console.log(`User ${socket.userId} joined project ${projectId}`);
    });

    // User leaves a project room
    socket.on('leave_project', (projectId) => {
      const roomName = `project_${projectId}`;
      socket.leave(roomName);

      if (userProjects.has(projectId)) {
        userProjects.get(projectId).delete(socket.userId);
        if (userProjects.get(projectId).size === 0) {
          userProjects.delete(projectId);
        }
      }

      // Broadcast updated active users
      if (userProjects.has(projectId)) {
        const activeUsers = Array.from(userProjects.get(projectId));
        io.to(roomName).emit(socketEvents.USERS_IN_PROJECT, {
          projectId,
          activeUsers,
          count: activeUsers.length,
        });
      }

      console.log(`User ${socket.userId} left project ${projectId}`);
    });

    // Typing indicator
    socket.on(socketEvents.TYPING_INDICATOR, ({ projectId, ticketId, userName }) => {
      const roomName = `project_${projectId}`;
      socket.to(roomName).emit(socketEvents.TYPING_INDICATOR, {
        userId: socket.userId,
        userName,
        ticketId,
        isTyping: true,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      userSockets.delete(socket.userId);

      // Clean up project memberships
      for (const [projectId, users] of userProjects.entries()) {
        if (users.has(socket.userId)) {
          users.delete(socket.userId);
          if (users.size === 0) {
            userProjects.delete(projectId);
          } else {
            const activeUsers = Array.from(users);
            io.to(`project_${projectId}`).emit(socketEvents.USERS_IN_PROJECT, {
              projectId,
              activeUsers,
              count: activeUsers.length,
            });
          }
        }
      }
    });
  });

  return {
    userSockets,
    userProjects,
    // Helper to emit to a specific project
    emitToProject: (io, projectId, event, data) => {
      io.to(`project_${projectId}`).emit(event, {
        projectId,
        ...data,
        timestamp: new Date().toISOString(),
      });
    },
    // Helper to emit to a specific user
    emitToUser: (io, userId, event, data) => {
      const socketId = userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit(event, {
          ...data,
          timestamp: new Date().toISOString(),
        });
      }
    },
  };
};
