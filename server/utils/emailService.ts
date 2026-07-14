import nodemailer from 'nodemailer';

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
  private transporter: nodemailer.Transporter | null;
  private fromAddress: string;

  constructor() {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const usable = Boolean(
      host &&
      user &&
      pass &&
      Number.isInteger(port) &&
      port > 0 &&
      !/(your_|change[_-]?me|placeholder|example)/i.test(`${user} ${pass}`),
    );

    this.fromAddress = process.env.SMTP_FROM?.trim() || user || 'support@octamy.com';
    this.transporter = usable
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        })
      : null;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.warn('Email delivery is disabled because SMTP is not configured.');
      return false;
    }
    try {
      const mailOptions = {
        from: `"Octamy Solutions" <${this.fromAddress}>`,
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
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendCertificateEmail(
    userEmail: string,
    userName: string,
    courseName: string,
    certificateId: string,
    certificateBuffer: Buffer,
    invoiceBuffer: Buffer,
    includesPhysical: boolean = false
  ): Promise<boolean> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Certificate Delivered - Octamy Solutions</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #000; color: #fff; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .certificate-info { background: #fff; padding: 15px; margin: 15px 0; border-left: 4px solid #000; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .btn { display: inline-block; background: #000; color: #fff; padding: 10px 20px; text-decoration: none; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Certificate Delivered</h1>
            <p>Octamy Solutions</p>
          </div>
          
          <div class="content">
            <h2>Congratulations, ${userName}!</h2>
            <p>Your certificate has been successfully generated and is ready for download.</p>
            
            <div class="certificate-info">
              <h3>Certificate Details:</h3>
              <p><strong>Course:</strong> ${courseName}</p>
              <p><strong>Certificate ID:</strong> ${certificateId}</p>
              <p><strong>Issue Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <p>Your certificate and invoice are attached to this email as PDF files. You can also:</p>
            <ul>
              <li>Download them anytime from your dashboard</li>
              <li>Verify certificate authenticity using the certificate ID</li>
              <li>Share your certificate on professional networks</li>
            </ul>
            
            ${includesPhysical ? '<p><strong>Physical Certificate:</strong> Your certificate will be printed on premium paper and shipped to your registered address within 7-10 business days.</p>' : ''}
            
            <p>Thank you for choosing Octamy Solutions for your professional development!</p>
          </div>
          
          <div class="footer">
            <p>© 2025 Octamy Solutions. All rights reserved.</p>
            <p>This certificate is digitally signed and verified.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: `🎓 Your ${courseName} Certificate is Ready - Octamy Solutions`,
      html: htmlContent,
      attachments: [
        {
          filename: `${certificateId}-certificate.pdf`,
          content: certificateBuffer,
          contentType: 'application/pdf',
        },
        {
          filename: `${certificateId}-invoice.pdf`,
          content: invoiceBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  async sendInvoiceEmail(
    userEmail: string,
    userName: string,
    courseName: string,
    amount: string,
    transactionId: string,
    includesPhysical: boolean = false
  ): Promise<boolean> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Invoice - Octamy Solutions</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #000; color: #fff; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .invoice { background: #fff; padding: 20px; margin: 15px 0; border: 1px solid #ddd; }
          .invoice-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
          .total { font-weight: bold; font-size: 18px; color: #000; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💳 Payment Confirmation</h1>
            <p>Octamy Solutions</p>
          </div>
          
          <div class="content">
            <h2>Thank you for your purchase, ${userName}!</h2>
            <p>Your payment has been successfully processed.</p>
            
            <div class="invoice">
              <h3>Invoice Details</h3>
              <div class="invoice-row">
                <span>Transaction ID:</span>
                <span>${transactionId}</span>
              </div>
              <div class="invoice-row">
                <span>Course:</span>
                <span>${courseName}</span>
              </div>
              <div class="invoice-row">
                <span>Digital Certificate:</span>
                <span>₹99</span>
              </div>
              ${includesPhysical ? '<div class="invoice-row"><span>Physical Certificate Shipping:</span><span>₹50</span></div>' : ''}
              <div class="invoice-row total">
                <span>Total Amount:</span>
                <span>₹${amount}</span>
              </div>
              <div class="invoice-row">
                <span>Payment Date:</span>
                <span>${new Date().toLocaleDateString()}</span>
              </div>
              <div class="invoice-row">
                <span>Payment Status:</span>
                <span style="color: green;">✅ Completed</span>
              </div>
            </div>
            
            ${includesPhysical ? '<p><strong>Physical Certificate:</strong> Your certificate will be printed on premium paper and shipped to your registered address within 7-10 business days.</p>' : ''}
            
            <p>Your certificate is being generated and will be delivered shortly via email.</p>
          </div>
          
          <div class="footer">
            <p>© 2025 Octamy Solutions. All rights reserved.</p>
            <p>For support, contact us at support@octamy.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: `💳 Payment Confirmed - ₹${amount} for ${courseName} Certificate`,
      html: htmlContent,
    });
  }

  async sendPasswordResetEmail(userEmail: string, userName: string, resetLink: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#111;background:#f6f6f6;padding:24px">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
          <div style="background:#000;color:#fff;padding:20px 24px"><h2 style="margin:0">Reset your Octamy password</h2></div>
          <div style="padding:24px">
            <p>Hi ${userName},</p>
            <p>We received a request to reset the password for your Octamy account. Click the button below to set a new password. This link expires in 1 hour.</p>
            <p style="text-align:center;margin:24px 0">
              <a href="${resetLink}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600">Reset password</a>
            </p>
            <p style="font-size:13px;color:#666">If the button doesn't work, copy this link into your browser:<br><a href="${resetLink}" style="color:#000">${resetLink}</a></p>
            <p style="font-size:13px;color:#666">If you didn't request this, you can safely ignore this email — your password won't change.</p>
          </div>
          <div style="background:#fafafa;padding:16px 24px;font-size:12px;color:#888;text-align:center;border-top:1px solid #eee">© Octamy Solutions Pvt. Ltd. · support@octamy.com</div>
        </div>
      </body></html>`;
    return this.sendEmail({
      to: userEmail,
      subject: 'Reset your Octamy password',
      html,
    });
  }
}

export const emailService = new EmailService();
