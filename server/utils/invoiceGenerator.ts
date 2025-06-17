import puppeteer from 'puppeteer';

interface InvoiceData {
  transactionId: string;
  customerName: string;
  customerEmail: string;
  courseTitle: string;
  amount: string;
  certificateAmount: string;
  shippingAmount?: string;
  includesPhysicalCopy: boolean;
  date: Date;
  paymentMethod: string;
}

export async function generateInvoicePDF(invoiceData: InvoiceData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    const totalAmount = parseFloat(invoiceData.amount);
    const certificateAmount = parseFloat(invoiceData.certificateAmount);
    const shippingAmount = invoiceData.shippingAmount ? parseFloat(invoiceData.shippingAmount) : 0;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #fff; 
          }
          .invoice-container { 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 40px; 
            background: #fff; 
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            border-bottom: 3px solid #000; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
          }
          .company-info h1 { 
            font-size: 28px; 
            font-weight: 700; 
            color: #000; 
            margin-bottom: 5px; 
          }
          .company-info p { 
            color: #666; 
            font-size: 14px; 
          }
          .invoice-title { 
            text-align: right; 
          }
          .invoice-title h2 { 
            font-size: 32px; 
            color: #000; 
            margin-bottom: 5px; 
          }
          .invoice-number { 
            font-size: 14px; 
            color: #666; 
          }
          .billing-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 40px; 
          }
          .billing-section h3 { 
            font-size: 16px; 
            color: #000; 
            margin-bottom: 10px; 
            border-bottom: 1px solid #eee; 
            padding-bottom: 5px; 
          }
          .billing-section p { 
            margin-bottom: 5px; 
            font-size: 14px; 
          }
          .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 30px; 
          }
          .items-table th { 
            background: #000; 
            color: #fff; 
            padding: 12px; 
            text-align: left; 
            font-weight: 600; 
          }
          .items-table td { 
            padding: 12px; 
            border-bottom: 1px solid #eee; 
          }
          .items-table tr:nth-child(even) { 
            background: #f9f9f9; 
          }
          .total-section { 
            float: right; 
            width: 300px; 
          }
          .total-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 8px 0; 
            border-bottom: 1px solid #eee; 
          }
          .total-final { 
            display: flex; 
            justify-content: space-between; 
            padding: 12px 0; 
            font-weight: 700; 
            font-size: 18px; 
            border-top: 2px solid #000; 
            border-bottom: 2px solid #000; 
            margin-top: 10px; 
          }
          .payment-info { 
            clear: both; 
            margin-top: 40px; 
            padding: 20px; 
            background: #f9f9f9; 
            border-left: 4px solid #000; 
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #eee; 
            text-align: center; 
            font-size: 12px; 
            color: #666; 
          }
          .status-paid { 
            background: #059669; 
            color: white; 
            padding: 5px 10px; 
            border-radius: 4px; 
            font-size: 12px; 
            font-weight: 600; 
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="company-info">
              <h1>OCTAMY SOLUTIONS</h1>
              <p>Professional Certification Platform</p>
              <p>Email: support@octamy.com</p>
              <p>Website: www.octamy.com</p>
            </div>
            <div class="invoice-title">
              <h2>INVOICE</h2>
              <p class="invoice-number">#${invoiceData.transactionId}</p>
              <span class="status-paid">PAID</span>
            </div>
          </div>

          <div class="billing-info">
            <div class="billing-section">
              <h3>Bill To:</h3>
              <p><strong>${invoiceData.customerName}</strong></p>
              <p>${invoiceData.customerEmail}</p>
            </div>
            <div class="billing-section">
              <h3>Invoice Details:</h3>
              <p><strong>Date:</strong> ${invoiceData.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p><strong>Payment Method:</strong> ${invoiceData.paymentMethod.toUpperCase()}</p>
              <p><strong>Transaction ID:</strong> ${invoiceData.transactionId}</p>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Digital Certificate - ${invoiceData.courseTitle}</strong><br>
                  <small>Professional certification with digital verification</small>
                </td>
                <td>1</td>
                <td style="text-align: right;">₹${certificateAmount.toFixed(2)}</td>
              </tr>
              ${invoiceData.includesPhysicalCopy ? `
              <tr>
                <td>
                  <strong>Physical Certificate Shipping</strong><br>
                  <small>Premium paper certificate delivered to your address</small>
                </td>
                <td>1</td>
                <td style="text-align: right;">₹${shippingAmount.toFixed(2)}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>₹${certificateAmount.toFixed(2)}</span>
            </div>
            ${invoiceData.includesPhysicalCopy ? `
            <div class="total-row">
              <span>Shipping:</span>
              <span>₹${shippingAmount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="total-row">
              <span>Tax (0%):</span>
              <span>₹0.00</span>
            </div>
            <div class="total-final">
              <span>TOTAL:</span>
              <span>₹${totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div class="payment-info">
            <h3 style="margin-bottom: 10px;">Payment Information</h3>
            <p><strong>Status:</strong> <span style="color: #059669;">✓ Payment Successful</span></p>
            <p><strong>Transaction ID:</strong> ${invoiceData.transactionId}</p>
            <p><strong>Payment Gateway:</strong> PayUMoney</p>
            <p><strong>Date & Time:</strong> ${invoiceData.date.toLocaleString('en-US')}</p>
          </div>

          ${invoiceData.includesPhysicalCopy ? `
          <div style="margin-top: 30px; padding: 15px; background: #f0f9ff; border-radius: 6px;">
            <h4 style="color: #0369a1; margin-bottom: 10px;">📦 Physical Certificate Shipping</h4>
            <p style="margin: 0; color: #0369a1; font-size: 14px;">
              Your premium physical certificate will be printed on high-quality paper and shipped to your provided address within 7-10 business days.
            </p>
          </div>
          ` : ''}

          <div class="footer">
            <p><strong>Thank you for choosing Octamy Solutions!</strong></p>
            <p>This is a computer-generated invoice. No signature required.</p>
            <p>For support inquiries, please contact us at support@octamy.com with your transaction ID.</p>
            <p style="margin-top: 10px;">© ${new Date().getFullYear()} Octamy Solutions. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(html);
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      printBackground: true
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}