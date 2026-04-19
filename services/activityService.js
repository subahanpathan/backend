// Activity logging service
import supabase from '../config/supabase.js';

class ActivityService {
  // Log an activity/action
  async logActivity(userId, projectId, data) {
    const { action, entity_type, entity_id, details, changes } = data;

    const { data: activity, error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        project_id: projectId,
        action, // 'created', 'updated', 'deleted', 'commented', 'assigned'
        entity_type, // 'ticket', 'comment', 'project_member'
        entity_id,
        details, // Human-readable action description
        changes, // JSON of field changes
        ip_address: null, // Can be added from request
        user_agent: null, // Can be added from request
      })
      .select('*')
      .single();

    if (error) throw error;
    return activity;
  }

  // Get activity log for a project
  async getProjectActivity(projectId, limit = 50, offset = 0) {
    const { data, error, count } = await supabase
      .from('activity_logs')
      .select(
        `*,
         user:user_id(id, first_name, last_name, email, avatar_url)`,
        { count: 'exact' }
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { activities: data, total: count };
  }

  // Get activity for a specific ticket
  async getTicketActivity(ticketId, limit = 20) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(
        `*,
         user:user_id(id, first_name, last_name, email, avatar_url)`
      )
      .eq('entity_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Get user's activities
  async getUserActivity(userId, limit = 30, offset = 0) {
    const { data, error, count } = await supabase
      .from('activity_logs')
      .select(
        `*,
         project:project_id(id, name)`,
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { activities: data, total: count };
  }

  // Get activity for a date range
  async getActivityByDateRange(projectId, startDate, endDate, limit = 100) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(
        `*,
         user:user_id(id, first_name, last_name, email)`
      )
      .eq('project_id', projectId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Get specific type of activities
  async getActivityByType(projectId, action, limit = 30) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(
        `*,
         user:user_id(id, first_name, last_name, email)`
      )
      .eq('project_id', projectId)
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Generate activity summary
  async getActivitySummary(projectId, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('activity_logs')
      .select('action, count(*) as count', { count: 'exact' })
      .eq('project_id', projectId)
      .gte('created_at', startDate.toISOString())
      .group_by('action');

    if (error) throw error;

    // Format summary
    const summary = {
      period_days: days,
      start_date: startDate.toISOString(),
      total_activities: 0,
      by_action: {},
    };

    data.forEach((row) => {
      summary.by_action[row.action] = row.count;
      summary.total_activities += row.count;
    });

    return summary;
  }

  // Get most active users
  async getMostActiveUsers(projectId, days = 30, limit = 10) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('activity_logs')
      .select(
        `user_id, count(*) as activity_count,
         user:user_id(id, first_name, last_name, email)`,
        { count: 'exact' }
      )
      .eq('project_id', projectId)
      .gte('created_at', startDate.toISOString())
      .group_by('user_id')
      .order('activity_count', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Delete old activity logs (for cleanup)
  async deleteOldActivities(projectId, daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error } = await supabase
      .from('activity_logs')
      .delete()
      .eq('project_id', projectId)
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;
    return { success: true };
  }
}

export default new ActivityService();
