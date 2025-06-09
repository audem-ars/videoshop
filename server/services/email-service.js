// server/services/email-service.js
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({  // FIXED: createTransport
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }

  async sendPasswordResetEmail(email, resetLink) {
    try {
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'VideoShop - Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>You requested a password reset for your VideoShop account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background: #d4af37; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Reset My Password
              </a>
            </div>
            <p><strong>This link expires in 1 hour.</strong></p>
            <p>If you didn't request this reset, ignore this email.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">VideoShop Team</p>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent:', result.messageId);
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return false;
    }
  }
}

module.exports = new EmailService();