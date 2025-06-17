import puppeteer from 'puppeteer';

interface CertificateData {
  certificateId: string;
  userName: string;
  courseTitle: string;
  issueDate: Date;
  completionDate: Date;
  passingScore: number;
  userScore: number;
  courseLevel?: string;
}

function generateCertificateHTML(data: CertificateData): string {
  const courseLevel = data.courseLevel || 'Beginner';
  const issueDate = new Date(data.issueDate);
  const expiryDate = new Date(issueDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 3); // 3 years validity

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Professional Certificate</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Playfair Display', serif;
          background: #f8f9fa;
          padding: 20px;
          line-height: 1.6;
        }
        
        .certificate-container {
          width: 297mm;
          height: 210mm;
          margin: 0 auto;
          background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
          border: 8px solid #000;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        
        .certificate-border {
          position: absolute;
          inset: 20px;
          border: 2px solid #c0c0c0;
          border-radius: 8px;
          background: radial-gradient(circle at 0% 0%, #c0c0c0 2px, transparent 2px),
                      radial-gradient(circle at 100% 0%, #c0c0c0 2px, transparent 2px),
                      radial-gradient(circle at 0% 100%, #c0c0c0 2px, transparent 2px),
                      radial-gradient(circle at 100% 100%, #c0c0c0 2px, transparent 2px);
          background-size: 40px 40px;
          background-position: top left, top right, bottom left, bottom right;
          background-repeat: no-repeat;
        }
        
        .decorative-corners {
          position: absolute;
          width: 120px;
          height: 120px;
          background: linear-gradient(45deg, #c0c0c0 1px, transparent 1px 20px, transparent);
        }
        
        .decorative-corners.top-left {
          top: 30px;
          left: 30px;
          clip-path: polygon(0 0, 100% 0, 0 100%);
        }
        
        .decorative-corners.top-right {
          top: 30px;
          right: 30px;
          clip-path: polygon(100% 0, 100% 100%, 0 0);
        }
        
        .decorative-corners.bottom-left {
          bottom: 30px;
          left: 30px;
          clip-path: polygon(0 0, 100% 100%, 0 100%);
        }
        
        .decorative-corners.bottom-right {
          bottom: 30px;
          right: 30px;
          clip-path: polygon(100% 0, 100% 100%, 0 100%);
        }
        
        .certificate-content {
          position: relative;
          z-index: 10;
          padding: 60px;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
        }
        
        .company-header {
          margin-bottom: 40px;
        }
        
        .company-logo {
          display: inline-block;
          background: linear-gradient(145deg, #000000, #333333);
          color: white;
          padding: 20px 40px;
          margin-bottom: 20px;
          clip-path: polygon(10% 0%, 90% 0%, 100% 25%, 100% 75%, 90% 100%, 10% 100%, 0% 75%, 0% 25%);
        }
        
        .company-name {
          font-size: 48px;
          font-weight: 700;
          letter-spacing: 8px;
          font-family: 'Playfair Display', serif;
        }
        
        .company-tagline {
          font-size: 14px;
          font-weight: 500;
          color: #666;
          letter-spacing: 4px;
          text-transform: uppercase;
          font-family: 'Inter', sans-serif;
        }
        
        .certificate-title {
          font-size: 72px;
          font-weight: 600;
          color: #000;
          margin: 30px 0;
          letter-spacing: 12px;
          text-transform: uppercase;
          font-family: 'Playfair Display', serif;
          position: relative;
        }
        
        .certificate-title::before {
          content: '';
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 4px;
          background: linear-gradient(90deg, #000, #c0c0c0, #000);
        }
        
        .certificate-title::after {
          content: '';
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 120px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #c0c0c0, transparent);
        }
        
        .certificate-subtitle {
          font-size: 28px;
          color: #666;
          font-style: italic;
          margin-bottom: 40px;
          font-family: 'Playfair Display', serif;
        }
        
        .awarded-text {
          font-size: 20px;
          color: #666;
          margin-bottom: 30px;
          font-style: italic;
          font-family: 'Playfair Display', serif;
        }
        
        .recipient-name {
          font-size: 56px;
          font-weight: 600;
          color: #000;
          margin: 30px 0;
          font-family: 'Playfair Display', serif;
          position: relative;
          padding: 20px 0;
        }
        
        .recipient-name::before,
        .recipient-name::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 400px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #c0c0c0, transparent);
        }
        
        .recipient-name::before {
          top: 0;
        }
        
        .recipient-name::after {
          bottom: 0;
        }
        
        .completion-text {
          font-size: 18px;
          color: #666;
          margin: 30px 0;
          line-height: 1.8;
          font-family: 'Playfair Display', serif;
        }
        
        .course-name {
          font-size: 36px;
          font-weight: 600;
          color: #000;
          margin: 30px 0;
          padding: 20px 40px;
          border: 2px solid #c0c0c0;
          border-radius: 8px;
          background: linear-gradient(145deg, rgba(192,192,192,0.1) 0%, rgba(192,192,192,0.05) 100%);
          font-family: 'Playfair Display', serif;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        
        .achievement-section {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 40px;
          margin: 40px 0;
        }
        
        .badge-container {
          position: relative;
          width: 120px;
          height: 120px;
        }
        
        .badge-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        
        .badge-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 12px;
          font-weight: 700;
          text-align: center;
          font-family: 'Inter', sans-serif;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .achievement-details {
          background: linear-gradient(145deg, #000000, #333333);
          color: white;
          padding: 20px 40px;
          border-radius: 8px;
          box-shadow: 0 6px 12px rgba(0,0,0,0.3);
        }
        
        .achievement-score {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 5px;
          font-family: 'Playfair Display', serif;
        }
        
        .achievement-label {
          font-size: 12px;
          color: #ccc;
          font-family: 'Inter', sans-serif;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .certificate-footer {
          display: flex;
          justify-content: space-between;
          align-items: end;
          margin-top: 50px;
          padding-top: 30px;
          border-top: 2px solid #c0c0c0;
          background: linear-gradient(90deg, transparent, rgba(192,192,192,0.1), transparent);
        }
        
        .certificate-details {
          text-align: left;
          font-size: 14px;
          color: #666;
          line-height: 1.6;
          font-family: 'Inter', sans-serif;
        }
        
        .signature-section {
          text-align: center;
          flex: 1;
        }
        
        .signature-line {
          width: 200px;
          height: 1px;
          background: #000;
          margin: 0 auto 10px;
        }
        
        .signature-title {
          font-size: 14px;
          color: #666;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
        }
        
        .signature-name {
          font-size: 16px;
          color: #000;
          font-weight: 600;
          margin-top: 5px;
          font-family: 'Playfair Display', serif;
        }
        
        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 120px;
          color: rgba(192, 192, 192, 0.05);
          font-weight: 700;
          z-index: 1;
          pointer-events: none;
          font-family: 'Playfair Display', serif;
        }
        
        .certification-logos {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 20px;
          align-items: center;
          z-index: 10;
        }
        
        .certification-logos img {
          height: 40px;
          width: auto;
          object-fit: contain;
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div class="certificate-container">
        <div class="certificate-border">
          <div class="decorative-corners top-left"></div>
          <div class="decorative-corners top-right"></div>
          <div class="decorative-corners bottom-left"></div>
          <div class="decorative-corners bottom-right"></div>
          
          <div class="watermark">OCTAMY</div>
          
          <div class="certificate-content">
            <div class="company-header">
              <div class="company-logo">
                <div class="company-name">OCTAMY</div>
              </div>
              <div class="company-tagline">Solutions Private Limited</div>
              <div style="font-size: 12px; color: #999; font-style: italic; margin-top: 5px;">Authorized Certification Body</div>
            </div>
            
            <div class="certificate-title">Certificate</div>
            <div class="certificate-subtitle">of Professional Excellence</div>
            
            <div class="awarded-text">This is to certify that</div>
            
            <div class="recipient-name">${data.userName || 'Student Name'}</div>
            
            <div class="completion-text">
              has successfully demonstrated mastery and completed the comprehensive<br />
              professional certification program
            </div>
            
            <div class="course-name">${data.courseTitle || 'Course Title'}</div>
            
            <div class="achievement-section">
              <div class="badge-container">
                <svg width="120" height="120" viewBox="0 0 120 120" class="badge-image">
                  <defs>
                    <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#4a4a4a;stop-opacity:1" />
                      <stop offset="50%" style="stop-color:#2a2a2a;stop-opacity:1" />
                      <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
                    </linearGradient>
                    <linearGradient id="ribbonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#888;stop-opacity:1" />
                      <stop offset="50%" style="stop-color:#666;stop-opacity:1" />
                      <stop offset="100%" style="stop-color:#555;stop-opacity:1" />
                    </linearGradient>
                  </defs>
                  
                  <!-- Shield Shape -->
                  <path d="M60 10 L100 30 L100 60 Q100 80 85 95 Q70 105 60 110 Q50 105 35 95 Q20 80 20 60 L20 30 Z" 
                        fill="url(#shieldGradient)" stroke="#fff" stroke-width="2"/>
                  
                  <!-- Inner Circle -->
                  <circle cx="60" cy="45" r="15" fill="#fff" stroke="#333" stroke-width="1"/>
                  
                  <!-- Sunburst pattern around circle -->
                  <g transform="translate(60,45)">
                    <g stroke="#fff" stroke-width="1" fill="none">
                      <circle r="20" opacity="0.3"/>
                      <path d="M0,-25 L0,-20 M0,20 L0,25 M25,0 L20,0 M-20,0 L-25,0" stroke-width="2"/>
                      <path d="M17.6,-17.6 L14.1,-14.1 M-14.1,14.1 L-17.6,17.6 M17.6,17.6 L14.1,14.1 M-14.1,-14.1 L-17.6,-17.6" stroke-width="1.5"/>
                    </g>
                  </g>
                  
                  <!-- Ribbon banners -->
                  <path d="M20 70 Q35 65 50 70 Q60 72 70 70 Q85 65 100 70 L95 85 Q80 80 65 85 Q60 87 55 85 Q40 80 25 85 Z" 
                        fill="url(#ribbonGradient)" stroke="#333" stroke-width="1" opacity="0.8"/>
                  
                  <path d="M25 85 Q40 80 55 85 Q60 87 65 85 Q80 80 95 85 L90 95 Q75 90 60 95 Q45 90 30 95 Z" 
                        fill="url(#ribbonGradient)" stroke="#333" stroke-width="1" opacity="0.6"/>
                  
                  <!-- Ribbon ends -->
                  <path d="M20 70 L15 85 L25 80 Z" fill="url(#ribbonGradient)" opacity="0.9"/>
                  <path d="M100 70 L105 85 L95 80 Z" fill="url(#ribbonGradient)" opacity="0.9"/>
                </svg>
                <div class="badge-text">${courseLevel.toUpperCase()}</div>
              </div>
              
              <div class="achievement-details">
                <div class="achievement-score">Score Achieved: ${data.userScore || 0}%</div>
                <div class="achievement-label">Passing Score: ${data.passingScore || 70}%</div>
              </div>
            </div>
            
            <div class="certificate-footer">
              <div class="certificate-details">
                <div><strong>Certificate ID:</strong> ${data.certificateId}</div>
                <div><strong>Issue Date:</strong> ${new Date(data.issueDate).toLocaleDateString()}</div>
                <div><strong>Completion Date:</strong> ${new Date(data.completionDate).toLocaleDateString()}</div>
                <div><strong>Valid Until:</strong> ${expiryDate.toLocaleDateString()}</div>
                <div><strong>Status:</strong> Valid Internationally</div>
              </div>
              
              <div class="signature-section">
                <div class="signature-line"></div>
                <div class="signature-title">Director</div>
                <div class="signature-name">Octamy Solutions</div>
              </div>
            </div>
          </div>
          
          <div class="certification-logos">
            <img src="https://images.seeklogo.com/logo-png/55/2/iso-certified-company-stamp-logo-png_seeklogo-556487.png" alt="ISO Certified" />
            <img src="https://static.vecteezy.com/system/resources/previews/019/909/405/non_2x/make-in-india-transparent-make-in-india-free-free-png.png" alt="Make in India" />
            <img src="https://sudikshya.com/wp-content/uploads/2024/08/startup-and-odisha-combo.png" alt="Startup Odisha" />
            <img src="https://octamy.com/storage/optionbuilder/uploads/554402-14-2025_0143pmoctamy_logo_black.png" alt="Octamy Logo" />
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function generateCertificatePDF(data: CertificateData): Promise<Buffer> {
  const html = generateCertificateHTML(data);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export { generateCertificateHTML };

export async function generateInvoicePDF(data: {
  transactionId: string;
  customerName: string;
  customerEmail: string;
  courseTitle: string;
  amount: string;
  certificateAmount: string;
  shippingAmount: string;
  includesPhysicalCopy: boolean;
  date: Date;
  paymentMethod: string;
}): Promise<Buffer> {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice - Octamy Solutions</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f8f9fa;
        }
        
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 40px;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        
        .company-info h1 {
          margin: 0;
          font-size: 28px;
          color: #000;
        }
        
        .company-info p {
          margin: 5px 0;
          color: #666;
        }
        
        .invoice-info {
          text-align: right;
        }
        
        .invoice-info h2 {
          margin: 0;
          font-size: 24px;
          color: #000;
        }
        
        .customer-info {
          margin-bottom: 30px;
        }
        
        .invoice-details {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        
        .invoice-details th,
        .invoice-details td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }
        
        .invoice-details th {
          background: #f8f9fa;
          font-weight: bold;
        }
        
        .total-row {
          font-weight: bold;
          background: #f0f0f0;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="invoice-header">
          <div class="company-info">
            <h1>OCTAMY SOLUTIONS</h1>
            <p>Professional Certificate Provider</p>
            <p>Email: info@octamy.com</p>
          </div>
          <div class="invoice-info">
            <h2>INVOICE</h2>
            <p><strong>Invoice #:</strong> ${data.transactionId}</p>
            <p><strong>Date:</strong> ${data.date.toLocaleDateString()}</p>
          </div>
        </div>
        
        <div class="customer-info">
          <h3>Bill To:</h3>
          <p><strong>${data.customerName}</strong></p>
          <p>${data.customerEmail}</p>
        </div>
        
        <table class="invoice-details">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Digital Certificate - ${data.courseTitle}</td>
              <td>₹${data.certificateAmount}</td>
            </tr>
            ${data.includesPhysicalCopy ? `
            <tr>
              <td>Physical Certificate Shipping</td>
              <td>₹${data.shippingAmount}</td>
            </tr>
            ` : ''}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td><strong>Total Amount</strong></td>
              <td><strong>₹${data.amount}</strong></td>
            </tr>
          </tfoot>
        </table>
        
        <div class="footer">
          <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
          <p><strong>Payment Status:</strong> Completed</p>
          <p>Thank you for choosing Octamy Solutions for your professional certification needs.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}