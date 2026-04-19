// Email preferences service
import supabase from '../config/supabase.js';

class EmailPreferenceService {
  // Get user email preferences
  async getPreferences(userId) {
    const { data, error } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found, return defaults
        return this.getDefaultPreferences(userId);
      }
      throw error;
    }

    return data;
  }

  // Get default preferences
  getDefaultPreferences(userId) {
    return {
      user_id: userId,
      ticket_created: true,
      ticket_assigned: true,
      ticket_updated: true,
      comment_added: true,
      team_updates: true,
      daily_digest: false,
      weekly_summary: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Create default preferences for new user
  async createDefaultPreferences(userId) {
    const defaults = this.getDefaultPreferences(userId);

    const { data, error } = await supabase
      .from('email_preferences')
      .insert(defaults)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update preferences
  async updatePreferences(userId, updates) {
    const { data, error } = await supabase
      .from('email_preferences')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update single preference
  async updatePreference(userId, key, value) {
    const updateData = {
      [key]: value,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('email_preferences')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Disable all emails
  async disableAllEmails(userId) {
    const updates = {
      ticket_created: false,
      ticket_assigned: false,
      ticket_updated: false,
      comment_added: false,
      team_updates: false,
      daily_digest: false,
      weekly_summary: false,
    };

    return this.updatePreferences(userId, updates);
  }

  // Enable all emails
  async enableAllEmails(userId) {
    const updates = {
      ticket_created: true,
      ticket_assigned: true,
      ticket_updated: true,
      comment_added: true,
      team_updates: true,
    };

    return this.updatePreferences(userId, updates);
  }

  // Check if user wants email for action
  async shouldSendEmail(userId, emailType) {
    const prefs = await this.getPreferences(userId);
    return prefs[emailType] === true;
  }
}

export default new EmailPreferenceService();
