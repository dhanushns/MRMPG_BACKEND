import nodemailer from 'nodemailer';
import { ENV } from '../config/env';

// Email configuration interface
interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  isHTML?: boolean;
}

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: ENV.EMAIL_HOST,
    port: ENV.EMAIL_PORT,
    secure: ENV.EMAIL_SECURE,
    auth: {
      user: ENV.EMAIL_USER,
      pass: ENV.EMAIL_PASS,
    },
  });
};

// Professional email template wrapper
const createEmailTemplate = (content: string, subject: string) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f4f4f4;
            }
            .email-container {
                background-color: #ffffff;
                border-radius: 10px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 300;
            }
            .content {
                padding: 40px 30px;
            }
            .content h2 {
                color: #667eea;
                border-bottom: 2px solid #f0f0f0;
                padding-bottom: 10px;
                margin-bottom: 25px;
            }
            .highlight-box {
                background-color: #f8f9ff;
                border-left: 4px solid #667eea;
                padding: 15px 20px;
                margin: 20px 0;
                border-radius: 0 5px 5px 0;
            }
            .button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 25px;
                margin: 20px 0;
                font-weight: bold;
                text-align: center;
            }
            .footer {
                background-color: #f8f9fa;
                padding: 30px;
                text-align: center;
                font-size: 12px;
                color: #666;
                border-top: 1px solid #e9ecef;
            }
            .footer p {
                margin: 5px 0;
            }
            .divider {
                height: 1px;
                background-color: #e9ecef;
                margin: 30px 0;
            }
            .contact-info {
                background-color: #f8f9ff;
                padding: 20px;
                border-radius: 5px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>${ENV.COMPANY_NAME}</h1>
                <p>PG Management System</p>
            </div>
            
            <div class="content">
                ${content}
                
                <div class="divider"></div>
                
                <div class="contact-info">
                    <h3 style="margin-top: 0; color: #667eea;">Need Help?</h3>
                    <p>If you have any questions or concerns, please don't hesitate to contact our support team.</p>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>This is an automated email. Please do not reply to this message.</strong></p>
                <p>© ${new Date().getFullYear()} ${ENV.COMPANY_NAME}. All rights reserved.</p>
                <p>Visit us at: <a href="${ENV.COMPANY_WEBSITE}" style="color: #667eea;">${ENV.COMPANY_WEBSITE}</a></p>
                
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p style="font-size: 11px; color: #888;">
                        <strong>Terms and Conditions:</strong><br>
                        By using our services, you agree to our terms and conditions. 
                        This email contains confidential information intended solely for the recipient. 
                        If you have received this email in error, please notify us immediately and delete this email.
                    </p>
                </div>
                
                <div style="margin-top: 15px;">
                    <p style="font-size: 11px; color: #888;">
                        <strong>Privacy Notice:</strong><br>
                        We respect your privacy and handle your personal information in accordance with our privacy policy. 
                        Your data is secure and will not be shared with third parties without your consent.
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Main email sending function
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    // Validate email configuration
    if (!ENV.EMAIL_USER || !ENV.EMAIL_PASS) {
      console.error('Email configuration missing: EMAIL_USER and EMAIL_PASS must be set');
      return false;
    }

    const transporter = createTransporter();

    // Create email content
    const htmlContent = options.isHTML !== false 
      ? createEmailTemplate(options.body, options.subject)
      : undefined;

    const mailOptions = {
      from: `"${ENV.COMPANY_NAME}" <${ENV.EMAIL_FROM}>`,
      to: options.to,
      subject: options.subject,
      text: options.isHTML !== false ? undefined : options.body,
      html: htmlContent,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
};

// Predefined email templates for member approval/rejection
export const createApprovalEmailContent = (memberName: string, memberId: string, pgName: string, pgLocation: string, roomNo?: string, rentAmount?: number, advanceAmount?: number, dateOfJoining?: Date) => {
  // Format the date of joining
  const formatDate = (date?: Date) => {
    if (!date) return new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Format currency
  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return `
    <h2>🎉 Congratulations! Your Application Has Been Approved</h2>
    
    <p>Dear ${memberName},</p>
    
    <p>We are pleased to inform you that your application for accommodation has been <strong>approved</strong>!</p>
    
    <div class="highlight-box">
        <h3 style="margin-top: 0; color: #28a745;">✅ Application Details:</h3>
        <p><strong>Member ID:</strong> ${memberId}</p>
        <p><strong>PG Name:</strong> ${pgName}</p>
        <p><strong>PG Location:</strong> ${pgLocation}</p>
        ${roomNo ? `<p><strong>Room Number:</strong> ${roomNo}</p>` : '<p><strong>Room:</strong> Will be assigned soon</p>'}
        ${roomNo && rentAmount ? `<p><strong>Monthly Rent:</strong> ${formatCurrency(rentAmount)}</p>` : ''}
        ${advanceAmount ? `<p><strong>Advance Amount:</strong> ${formatCurrency(advanceAmount)}</p>` : ''}
        <p><strong>Date of Joining:</strong> ${formatDate(dateOfJoining)}</p>
        <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">Approved ✅</span></p>
    </div>
    
    <p>Your journey with us begins now! Please keep your Member ID safe as you'll need it for all future communications and transactions.</p>
    
    <div class="highlight-box" style="background-color: #fff3cd; border-left-color: #ffc107;">
        <h4 style="margin-top: 0; color: #856404;">� Payment Information:</h4>
        <ul style="margin-bottom: 0;">
            ${advanceAmount ? `<li><strong>Advance Payment:</strong> ${formatCurrency(advanceAmount)} (to be paid before check-in)</li>` : ''}
            ${roomNo && rentAmount ? `<li><strong>Monthly Rent:</strong> ${formatCurrency(rentAmount)} (due on the 1st of each month)</li>` : ''}
            <li>Payment details and preferred methods will be shared separately</li>
            <li>Please keep all payment receipts for future reference</li>
        </ul>
    </div>
    
    <div class="highlight-box" style="background-color: #e7f3ff; border-left-color: #007bff;">
        <h4 style="margin-top: 0; color: #004085;">📋 Next Steps:</h4>
        <ul style="margin-bottom: 0;">
            <li><strong>Check-in Date:</strong> ${formatDate(dateOfJoining)}</li>
            <li>You will receive further instructions about check-in procedures</li>
            <li>Please bring all required documents during check-in</li>
            <li>Contact our support team for any immediate questions</li>
            <li>Complete the advance payment before your joining date</li>
        </ul>
    </div>
    
    <p>Welcome to the ${ENV.COMPANY_NAME} family! We look forward to providing you with a comfortable and safe living experience.</p>
    
    <p>Best regards,<br>
    <strong>The ${ENV.COMPANY_NAME} Team</strong></p>
  `;
};

export const createRejectionEmailContent = (memberName: string, pgType: string) => {
  return `
    <h2>Application Update</h2>
    
    <p>Dear ${memberName},</p>
    
    <p>Thank you for your interest in our ${pgType.toLowerCase()} PG accommodation services.</p>
    
    <p>After careful consideration of your application, we regret to inform you that we are unable to offer you accommodation at this time.</p>
    
    <div class="highlight-box" style="background-color: #f8d7da; border-left-color: #dc3545;">
        <h4 style="margin-top: 0; color: #721c24;">📝 Application Status: Not Approved</h4>
        <p style="margin-bottom: 0;">Unfortunately, your application does not meet our current requirements or all available spaces have been filled.</p>
    </div>
    
    <div class="highlight-box">
        <h4 style="margin-top: 0; color: #667eea;">🔄 What's Next?</h4>
        <ul style="margin-bottom: 0;">
            <li>You may reapply in the future when new openings become available</li>
            <li>Consider exploring our other PG locations that might suit your needs</li>
            <li>Contact us if you'd like feedback on your application</li>
            <li>We'll keep your details on file for future opportunities (if desired)</li>
        </ul>
    </div>
    
    <p>We appreciate the time you took to apply and wish you the best in finding suitable accommodation.</p>
    
    <p>If you have any questions about this decision or would like to discuss alternative options, please feel free to contact our support team.</p>
    
    <p>Thank you for considering ${ENV.COMPANY_NAME}.</p>
    
    <p>Best regards,<br>
    <strong>The ${ENV.COMPANY_NAME} Team</strong></p>
  `;
};
