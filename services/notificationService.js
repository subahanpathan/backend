// Notification service for managing in-app notifications
import supabase from '../config/supabase.js';

class NotificationService {
  // Create a notification
  async createNotification(userId, data) {
    const { type, title, message, projectId, ticketId, relatedUserId } = data;

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type, // 'ticket_created', 'comment_added', 'ticket_assigned', 'ticket_updated'
        title,
        message,
        project_id: projectId,
        ticket_id: ticketId,
        related_user_id: relatedUserId,
        is_read: false,
      })
      .select('*')
      .single();

    if (error) throw error;
    return notification;
  }

  // Get user notifications with pagination
  async getUserNotifications(userId, limit = 20, offset = 0) {
    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { notifications: data, total: count };
  }

  // Get unread notification count
  async getUnreadCount(userId) {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count;
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return data;
  }

  // Delete notification
  async deleteNotification(notificationId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  }

  // Delete all notifications for user
  async deleteAllNotifications(userId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // Get notifications by type
  async getNotificationsByType(userId, type, limit = 20) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Get notifications for a specific ticket
  async getTicketNotifications(ticketId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // Bulk create notifications for team members
  async notifyTeam(projectId, excludeUserId, data) {
    const { title, message, type, ticketId } = data;

    // Get all project members
    const { data: members, error: membersError } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId);

    if (membersError) throw membersError;

    // Filter out the triggering user
    const memberIds = members
      .map((m) => m.user_id)
      .filter((uid) => uid !== excludeUserId);

    if (memberIds.length === 0) return [];

    // Create notifications
    const notifications = memberIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      message,
      project_id: projectId,
      ticket_id: ticketId,
      related_user_id: excludeUserId,
      is_read: false,
    }));

    const { data: created, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (error) throw error;
    return created;
  }
}

export default new NotificationService();
