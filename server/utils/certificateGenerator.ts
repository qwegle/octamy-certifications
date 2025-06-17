import puppeteer from 'puppeteer';

interface CertificateData {
  certificateId: string;
  userName: string;
  courseTitle: string;
  issueDate: Date;
  completionDate: Date;
  passingScore: number;
  userScore: number;
  badge?: string;
}

function getBadgeImage(badge: string): string {
  const badgeLower = badge.toLowerCase();
  if (badgeLower.includes('gold')) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9IiNEQUFGMzciIHN0cm9rZT0iI0I4OTMzMCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iNTAiIHk9IjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMDAwIj5HT0xEPC90ZXh0Pjx0ZXh0IHg9IjUwIiB5PSI2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZpbGw9IiMwMDAiPkFXQVJEPC90ZXh0Pjwvdmc+';
  } else if (badgeLower.includes('silver')) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9IiNDMEM0Q0EiIHN0cm9rZT0iIzk5QTNBRCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iNTAiIHk9IjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMDAwIj5TSUxWRVI8L3RleHQ+PHRleHQgeD0iNTAiIHk9IjYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzAwMCI+QVdBUkQ8L3RleHQ+PC9zdmc+';
  } else if (badgeLower.includes('bronze')) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9IiNDRDdGMzIiIHN0cm9rZT0iI0E2NkQyQiIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iNTAiIHk9IjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMDAwIj5CUk9OWkU8L3RleHQ+PHRleHQgeD0iNTAiIHk9IjYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzAwMCI+QVdBUkQ8L3RleHQ+PC9zdmc+';
  } else if (badgeLower.includes('platinum')) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9IiNFNUU1RTUiIHN0cm9rZT0iI0JCQkJCQiIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iNTAiIHk9IjM1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiMwMDAiPlBMQVRJTlVNPC90ZXh0Pjx0ZXh0IHg9IjUwIiB5PSI2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZpbGw9IiMwMDAiPkFXQVJEPC90ZXh0Pjwvdmc+';
  }
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9IiNEQUFGMzciIHN0cm9rZT0iI0I4OTMzMCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iNTAiIHk9IjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMDAwIj5HR09MRDwvdGV4dD48dGV4dCB4PSI1MCIgeT0iNjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI4IiBmaWxsPSIjMDAwIj5BV0FSRDI8L3RleHQ+PC9zdmc+';
}

function generateCertificateHTML(data: CertificateData): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Professional Certificate</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        @page {
          size: A4 landscape;
          margin: 0;
        }
        
        body {
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }
        
        .certificate-container {
          width: 1100px;
          height: 750px;
          background: white;
          position: relative;
          border: 8px solid #000;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        
        .certificate-border {
          position: absolute;
          top: 20px;
          left: 20px;
          right: 20px;
          bottom: 20px;
          border: 3px solid #d4af37;
          background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
        }
        
        .decorative-corners {
          position: absolute;
          width: 60px;
          height: 60px;
          background: linear-gradient(45deg, #d4af37, #f4d03f);
          clip-path: polygon(0 0, 100% 0, 0 100%);
        }
        
        .decorative-corners.top-left {
          top: 30px;
          left: 30px;
        }
        
        .decorative-corners.top-right {
          top: 30px;
          right: 30px;
          transform: rotate(90deg);
        }
        
        .decorative-corners.bottom-left {
          bottom: 30px;
          left: 30px;
          transform: rotate(-90deg);
        }
        
        .decorative-corners.bottom-right {
          bottom: 30px;
          right: 30px;
          transform: rotate(180deg);
        }
        
        .certificate-content {
          position: absolute;
          top: 50px;
          left: 50px;
          right: 50px;
          bottom: 50px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
          z-index: 2;
        }
        
        .certificate-header {
          margin-bottom: 20px;
        }
        
        .certificate-title {
          font-family: 'Playfair Display', serif;
          font-size: 48px;
          font-weight: 700;
          color: #000;
          margin-bottom: 10px;
          letter-spacing: 2px;
        }
        
        .certificate-subtitle {
          font-size: 18px;
          color: #666;
          font-weight: 300;
          letter-spacing: 1px;
        }
        
        .certificate-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 40px 0;
        }
        
        .recipient-text {
          font-size: 20px;
          color: #333;
          margin-bottom: 20px;
          font-weight: 300;
        }
        
        .recipient-name {
          font-family: 'Playfair Display', serif;
          font-size: 42px;
          font-weight: 700;
          color: #000;
          margin: 20px 0;
          padding: 0 20px;
          border-bottom: 3px solid #d4af37;
          display: inline-block;
          letter-spacing: 1px;
        }
        
        .course-text {
          font-size: 18px;
          color: #333;
          margin: 30px 0;
          line-height: 1.6;
          font-weight: 400;
        }
        
        .course-title {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 600;
          color: #000;
          margin: 10px 0;
          letter-spacing: 0.5px;
        }
        
        .performance-section {
          margin: 25px 0;
          padding: 20px;
          background: rgba(212, 175, 55, 0.1);
          border-radius: 10px;
          border: 1px solid #d4af37;
        }
        
        .score-text {
          font-size: 16px;
          color: #333;
          font-weight: 500;
        }
        
        .certificate-footer {
          display: flex;
          justify-content: space-between;
          align-items: end;
          margin-top: 40px;
        }
        
        .signature-section {
          text-align: center;
          flex: 1;
        }
        
        .signature-line {
          width: 200px;
          height: 1px;
          background: #000;
          margin: 40px auto 10px;
        }
        
        .signature-title {
          font-size: 14px;
          color: #666;
          font-weight: 500;
        }
        
        .signature-name {
          font-size: 16px;
          color: #000;
          font-weight: 600;
          margin-top: 5px;
        }
        
        .certificate-details {
          text-align: right;
          font-size: 12px;
          color: #666;
          line-height: 1.5;
        }
        
        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 120px;
          color: rgba(212, 175, 55, 0.05);
          font-weight: 700;
          z-index: 1;
          pointer-events: none;
        }
        
        .logo-section {
          position: absolute;
          top: 80px;
          left: 80px;
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .company-logo {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        
        .company-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        
        .badge-container {
          display: flex;
          justify-content: center;
          margin: 20px 0;
        }
        
        .achievement-badge {
          width: 80px;
          height: 80px;
          object-fit: contain;
        }
        
        .certification-logos {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 30px;
          margin-top: 20px;
          padding: 20px;
          border-top: 2px solid #d4af37;
        }
        
        .cert-logo {
          height: 40px;
          width: auto;
          object-fit: contain;
        }
        
        .company-info {
          text-align: left;
        }
        
        .company-name {
          font-size: 18px;
          font-weight: 700;
          color: #000;
          margin-bottom: 2px;
        }
        
        .company-tagline {
          font-size: 12px;
          color: #666;
          font-weight: 400;
        }
        
        .verification-qr {
          position: absolute;
          top: 80px;
          right: 80px;
          text-align: center;
        }
        
        .qr-code {
          width: 80px;
          height: 80px;
          background: #f0f0f0;
          border: 2px solid #d4af37;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 8px;
          font-size: 10px;
          color: #666;
        }
        
        .qr-text {
          font-size: 10px;
          color: #666;
          font-weight: 500;
        }
        
        .iso-badges {
          position: absolute;
          bottom: 80px;
          left: 80px;
          display: flex;
          gap: 10px;
        }
        
        .iso-badge {
          width: 50px;
          height: 50px;
          background: #000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 8px;
          font-weight: 600;
          text-align: center;
          line-height: 1.1;
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
          
          <div class="logo-section">
            <div class="company-logo">
              <img src="https://octamy.com/storage/optionbuilder/uploads/554402-14-2025_0143pmoctamy_logo_black.png" alt="Octamy Logo" />
            </div>
            <div class="company-info">
              <div class="company-name">Octamy Solutions</div>
              <div class="company-tagline">Professional Excellence</div>
            </div>
          </div>
          
          <div class="verification-qr">
            <div class="qr-code">QR CODE</div>
            <div class="qr-text">Verify Online</div>
          </div>
          
          <div class="certificate-content">
            <div class="certificate-header">
              <div class="certificate-title">CERTIFICATE</div>
              <div class="certificate-subtitle">OF PROFESSIONAL ACHIEVEMENT</div>
            </div>
            
            <div class="certificate-body">
              <div class="recipient-text">This is to certify that</div>
              <div class="recipient-name">${data.userName}</div>
              
              <div class="course-text">
                has successfully completed the professional certification program
              </div>
              <div class="course-title">${data.courseTitle}</div>
              
              <div class="performance-section">
                <div class="badge-container">
                  <img src="${getBadgeImage(data.badge || 'gold')}" alt="${data.badge || 'Gold'} Badge" class="achievement-badge" />
                </div>
                <div class="score-text">
                  Score Achieved: ${data.userScore}% | Passing Score: ${data.passingScore}%
                </div>
              </div>
            </div>
            
            <div class="certificate-footer">
              <div class="signature-section">
                <div class="signature-line"></div>
                <div class="signature-title">Director</div>
                <div class="signature-name">Octamy Solutions</div>
              </div>
              
              <div class="certificate-details">
                <div>Certificate ID: ${data.certificateId}</div>
                <div>Issue Date: ${data.issueDate.toLocaleDateString()}</div>
                <div>Completion Date: ${data.completionDate.toLocaleDateString()}</div>
                <div>Valid Internationally</div>
              </div>
            </div>
          </div>
          
          <div class="certification-logos">
            <img src="https://images.seeklogo.com/logo-png/55/2/iso-certified-company-stamp-logo-png_seeklogo-556487.png" alt="ISO Certified" class="cert-logo" />
            <img src="https://static.vecteezy.com/system/resources/previews/019/909/405/non_2x/make-in-india-transparent-make-in-india-free-free-png.png" alt="Make in India" class="cert-logo" />
            <img src="https://sudikshya.com/wp-content/uploads/2024/08/startup-and-odisha-combo.png" alt="Startup Odisha" class="cert-logo" />
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
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
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
          font-size: 28px;
          font-weight: bold;
          margin: 0 0 5px 0;
          color: #000;
        }
        
        .company-info p {
          margin: 2px 0;
          color: #666;
          font-size: 14px;
        }
        
        .invoice-details {
          text-align: right;
        }
        
        .invoice-number {
          font-size: 24px;
          font-weight: bold;
          color: #000;
          margin-bottom: 10px;
        }
        
        .invoice-date {
          color: #666;
          font-size: 14px;
        }
        
        .billing-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }
        
        .billing-info h3 {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #000;
        }
        
        .billing-info p {
          margin: 5px 0;
          color: #333;
          font-size: 14px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        
        .items-table th {
          background: #000;
          color: white;
          padding: 15px;
          text-align: left;
          font-weight: bold;
        }
        
        .items-table td {
          padding: 15px;
          border-bottom: 1px solid #eee;
        }
        
        .items-table .amount {
          text-align: right;
          font-weight: bold;
        }
        
        .total-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 40px;
        }
        
        .total-table {
          min-width: 300px;
        }
        
        .total-table tr td {
          padding: 8px 15px;
          text-align: right;
        }
        
        .total-table .total-label {
          font-weight: bold;
          text-align: left;
        }
        
        .total-table .grand-total {
          background: #000;
          color: white;
          font-weight: bold;
          font-size: 18px;
        }
        
        .payment-info {
          background: #f8f9fa;
          padding: 20px;
          border-left: 4px solid #000;
          margin-bottom: 30px;
        }
        
        .payment-info h3 {
          margin-top: 0;
          color: #000;
        }
        
        .footer {
          text-align: center;
          color: #666;
          font-size: 12px;
          border-top: 1px solid #eee;
          padding-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="invoice-header">
          <div class="company-info">
            <h1>Octamy Solutions</h1>
            <p>Professional Excellence in Certification</p>
            <p>support@octamy.com</p>
            <p>www.octamy.com</p>
          </div>
          <div class="invoice-details">
            <div class="invoice-number">INVOICE</div>
            <div class="invoice-date">${data.date.toLocaleDateString()}</div>
          </div>
        </div>
        
        <div class="billing-section">
          <div class="billing-info">
            <h3>Bill To:</h3>
            <p><strong>${data.customerName}</strong></p>
            <p>${data.customerEmail}</p>
          </div>
          <div class="billing-info">
            <h3>Payment Details:</h3>
            <p>Transaction ID: ${data.transactionId}</p>
            <p>Payment Method: ${data.paymentMethod}</p>
            <p>Status: Completed</p>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Course</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Digital Certificate</td>
              <td>${data.courseTitle}</td>
              <td class="amount">₹${data.certificateAmount}</td>
            </tr>
            ${data.includesPhysicalCopy ? `
            <tr>
              <td>Physical Certificate Shipping</td>
              <td>Premium Paper & Delivery</td>
              <td class="amount">₹${data.shippingAmount}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>
        
        <div class="total-section">
          <table class="total-table">
            <tr>
              <td class="total-label">Subtotal:</td>
              <td>₹${data.certificateAmount}</td>
            </tr>
            ${data.includesPhysicalCopy ? `
            <tr>
              <td class="total-label">Shipping:</td>
              <td>₹${data.shippingAmount}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="total-label">Tax:</td>
              <td>₹0.00</td>
            </tr>
            <tr class="grand-total">
              <td class="total-label">Total:</td>
              <td>₹${data.amount}</td>
            </tr>
          </table>
        </div>
        
        <div class="payment-info">
          <h3>Payment Information</h3>
          <p><strong>Status:</strong> Payment Completed Successfully</p>
          <p><strong>Certificate:</strong> Available for immediate download</p>
          ${data.includesPhysicalCopy ? '<p><strong>Physical Copy:</strong> Will be shipped within 7-10 business days</p>' : ''}
          <p><strong>Verification:</strong> Certificate can be verified online using the certificate ID</p>
        </div>
        
        <div class="footer">
          <p>© 2025 Octamy Solutions. All rights reserved.</p>
          <p>This is a computer-generated invoice. No signature required.</p>
          <p>For queries, contact support@octamy.com</p>
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