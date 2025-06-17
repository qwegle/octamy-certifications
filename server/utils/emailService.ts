import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('Gmail credentials not provided. Please set GMAIL_EMAIL and GMAIL_APP_PASSWORD environment variables.');
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"Octamy Solutions" <${process.env.GMAIL_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async sendCertificateEmail(
    userEmail: string,
    userName: string,
    courseTitle: string,
    certificateId: string,
    certificatePdf: Buffer,
    invoicePdf?: Buffer,
    includesPhysicalCopy: boolean = false
  ): Promise<boolean> {
    const subject = `Your ${courseTitle} Certificate is Ready!`;
    
    const physicalCopyText = includesPhysicalCopy 
      ? `<p style="color: #059669; font-weight: 500;">📦 <strong>Physical Certificate:</strong> Your premium physical certificate will be shipped to your provided address within 7-10 business days.</p>`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #000 0%, #333 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
          .badge { background: #059669; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: 500; margin: 10px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
          .button { background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
          .certificate-details { background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🎓 Congratulations!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your professional certification is ready</p>
          </div>
          
          <div class="content">
            <h2 style="color: #111; margin-top: 0;">Dear ${userName},</h2>
            
            <p>Congratulations on successfully completing the <strong>${courseTitle}</strong> certification program!</p>
            
            <div class="certificate-details">
              <h3 style="margin-top: 0; color: #111;">📋 Certificate Details</h3>
              <p><strong>Certificate ID:</strong> ${certificateId}</p>
              <p><strong>Course:</strong> ${courseTitle}</p>
              <p><strong>Issued to:</strong> ${userName}</p>
              <p><strong>Issue Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <span class="badge">✓ Verified Certificate</span>
            </div>

            ${physicalCopyText}

            <p><strong>📎 Attachments:</strong></p>
            <ul>
              <li>✅ Professional Certificate (PDF)</li>
              ${invoicePdf ? '<li>📄 Payment Invoice (PDF)</li>' : ''}
            </ul>

            <p>Your certificate is digitally signed and can be verified at any time through our verification system. Share your achievement on LinkedIn and showcase your new skills!</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://octamy.com/verify/${certificateId}" class="button" style="color: white;">Verify Certificate Online</a>
            </div>

            <div class="footer">
              <p><strong>Octamy Solutions</strong><br>
              Professional Certification Platform<br>
              📧 Contact: support@octamy.com</p>
              
              <p style="font-size: 12px; margin-top: 20px;">
                This certificate is valid for 2 years from the issue date. 
                For any questions, please contact our support team.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const attachments: EmailAttachment[] = [
      {
        filename: `${courseTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Certificate_${certificateId}.pdf`,
        content: certificatePdf,
        contentType: 'application/pdf',
      },
    ];

    if (invoicePdf) {
      attachments.push({
        filename: `Invoice_${certificateId}.pdf`,
        content: invoicePdf,
        contentType: 'application/pdf',
      });
    }

    return this.sendEmail({
      to: userEmail,
      subject,
      html,
      attachments,
    });
  }

  async sendPaymentReceiptEmail(
    userEmail: string,
    userName: string,
    courseTitle: string,
    transactionId: string,
    amount: string,
    includesPhysicalCopy: boolean = false
  ): Promise<boolean> {
    const subject = `Payment Confirmation - ${courseTitle}`;
    
    const physicalCopyText = includesPhysicalCopy 
      ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Physical Certificate Shipping</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹50.00</td></tr>`
      : '';

    const totalAmount = parseFloat(amount);
    const certificateAmount = includesPhysicalCopy ? totalAmount - 50 : totalAmount;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #000; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
          .receipt-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .receipt-table th { background: #f9fafb; padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; }
          .receipt-table td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
          .total-row { font-weight: bold; background: #f9fafb; }
          .status-success { color: #059669; font-weight: 500; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">💳 Payment Confirmed</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your transaction was successful</p>
          </div>
          
          <div class="content">
            <h2 style="color: #111; margin-top: 0;">Dear ${userName},</h2>
            
            <p>Thank you for your purchase! Your payment has been successfully processed.</p>
            
            <table class="receipt-table">
              <thead>
                <tr>
                  <th colspan="2" style="text-align: center; font-size: 18px; padding: 16px;">Payment Receipt</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Transaction ID:</strong></td>
                  <td style="text-align: right;">${transactionId}</td>
                </tr>
                <tr>
                  <td><strong>Course:</strong></td>
                  <td style="text-align: right;">${courseTitle}</td>
                </tr>
                <tr>
                  <td><strong>Customer:</strong></td>
                  <td style="text-align: right;">${userName}</td>
                </tr>
                <tr>
                  <td><strong>Email:</strong></td>
                  <td style="text-align: right;">${userEmail}</td>
                </tr>
                <tr>
                  <td><strong>Date:</strong></td>
                  <td style="text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                <tr>
                  <td><strong>Status:</strong></td>
                  <td style="text-align: right;" class="status-success">✓ Completed</td>
                </tr>
              </tbody>
            </table>

            <table class="receipt-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Digital Certificate - ${courseTitle}</td>
                  <td style="text-align: right;">₹${certificateAmount.toFixed(2)}</td>
                </tr>
                ${physicalCopyText}
                <tr class="total-row">
                  <td><strong>Total Amount</strong></td>
                  <td style="text-align: right;"><strong>₹${totalAmount.toFixed(2)}</strong></td>
                </tr>
              </tbody>
            </table>

            ${includesPhysicalCopy ? 
              '<div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0;"><p style="margin: 0; color: #0369a1;"><strong>📦 Physical Certificate:</strong> Your premium certificate will be shipped within 7-10 business days to your provided address.</p></div>' 
              : ''
            }

            <p>Your certificate will be generated and sent to you via email shortly. You can also download it from your dashboard at any time.</p>

            <div class="footer">
              <p><strong>Octamy Solutions</strong><br>
              Professional Certification Platform<br>
              📧 Support: support@octamy.com</p>
              
              <p style="font-size: 12px; margin-top: 20px;">
                Keep this receipt for your records. For any payment-related queries, please contact our support team with your transaction ID.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject,
      html,
    });
  }
}

export const emailService = new EmailService();