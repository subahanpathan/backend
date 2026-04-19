// Mock Email Service - Logs to Console Instead of SendGrid
// Use this for development/testing without SendGrid API key
// Replace with real emailService.js when ready to send actual emails

class MockEmailService {
  // Email templates (for reference)
  emailTemplates = {
    TICKET_CREATED: 'ticket_created',
    TICKET_ASSIGNED: 'ticket_assigned',
    TICKET_UPDATED: 'ticket_updated',
    COMMENT_ADDED: 'comment_added',
    TEAM_INVITATION: 'team_invitation'
  };

  // Send single email (mock - logs to console)
  async sendEmail(to, emailType, templateData) {
    console.log('📧 [MOCK EMAIL SERVICE] Email would be sent:');
    console.log(`  To: ${to}`);
    console.log(`  Type: ${emailType}`);
    console.log(`  Data:`, templateData);
    
    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      message: `Mock email logged to console (not sent to SendGrid)`
    };
  }

  // Send bulk emails (mock)
  async sendBulkEmail(recipients, emailType, templateData) {
    console.log(`📧 [MOCK EMAIL SERVICE] Bulk emails would be sent to ${recipients.length} recipients:`);
    recipients.forEach(recipient => {
      console.log(`  To: ${recipient}`);
    });
    console.log(`  Type: ${emailType}`);
    console.log(`  Data:`, templateData);

    return {
      success: true,
      count: recipients.length,
      message: `Mock bulk emails logged to console (${recipients.length} recipients)`
    };
  }

  // Send ticket created email (mock)
  async sendTicketCreatedEmail(user, ticket, project) {
    console.log('📧 [MOCK EMAIL] Ticket Created Notification');
    console.log(`  Recipient: ${user.first_name} ${user.last_name} <${user.email}>`);
    console.log(`  Ticket: "${ticket.title}" (${ticket.id})`);
    console.log(`  Project: ${project.name}`);
    console.log(`  Priority: ${ticket.priority}`);
    console.log(`  Description: ${ticket.description || '(none)'}`);
    
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  // Send ticket assigned email (mock)
  async sendTicketAssignedEmail(user, ticket, project) {
    console.log('📧 [MOCK EMAIL] Ticket Assigned Notification');
    console.log(`  Assignee: ${user.first_name} ${user.last_name} <${user.email}>`);
    console.log(`  Ticket: "${ticket.title}" (${ticket.id})`);
    console.log(`  Project: ${project.name}`);
    console.log(`  Status: ${ticket.status}`);
    
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  // Send ticket updated email (mock)
  async sendTicketUpdatedEmail(user, ticket, changes) {
    console.log('📧 [MOCK EMAIL] Ticket Updated Notification');
    console.log(`  Recipient: ${user.first_name} ${user.last_name} <${user.email}>`);
    console.log(`  Ticket: "${ticket.title}" (${ticket.id})`);
    console.log(`  Changes:`, changes);
    
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  // Send comment email (mock)
  async sendCommentEmail(user, comment, ticket, project) {
    console.log('📧 [MOCK EMAIL] New Comment Notification');
    console.log(`  Recipient: ${user.first_name} ${user.last_name} <${user.email}>`);
    console.log(`  Ticket: "${ticket.title}" (${ticket.id})`);
    console.log(`  Project: ${project.name}`);
    console.log(`  Comment: "${comment.content}"`);
    
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  // Send team invitation email (mock)
  async sendTeamInvitationEmail(user, project) {
    console.log('📧 [MOCK EMAIL] Team Invitation');
    console.log(`  Recipient: ${user.first_name} ${user.last_name} <${user.email}>`);
    console.log(`  Project: ${project.name}`);
    
    return { success: true, messageId: `mock-${Date.now()}` };
  }
}

export default new MockEmailService();
