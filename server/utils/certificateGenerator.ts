import puppeteer from 'puppeteer';

interface CertificateData {
  certificateId: string;
  userName: string;
  courseTitle: string;
  issueDate: Date;
  completionDate: Date;
  passingScore: number;
  userScore: number;
}

export async function generateCertificatePDF(certificateData: CertificateData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700;800&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body { 
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #000 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px;
          }
          
          .certificate-container {
            width: 1400px;
            height: 990px;
            background: linear-gradient(145deg, #fefefe 0%, #f8f9fa 50%, #ffffff 100%);
            position: relative;
            border: 2px solid #d4af37;
            box-shadow: 
              0 0 0 8px #ffffff,
              0 0 0 10px #d4af37,
              0 0 0 16px #ffffff,
              0 0 0 18px #c9a635,
              0 40px 80px rgba(0,0,0,0.4),
              0 20px 40px rgba(212,175,55,0.2);
            overflow: hidden;
          }
          
          .ornate-corner {
            position: absolute;
            width: 180px;
            height: 180px;
            background: linear-gradient(45deg, #d4af37 0%, #f4e09d 50%, #d4af37 100%);
            opacity: 0.15;
          }
          
          .corner-top-left {
            top: 0;
            left: 0;
            clip-path: polygon(0 0, 100% 0, 0 100%);
          }
          
          .corner-top-right {
            top: 0;
            right: 0;
            clip-path: polygon(100% 0, 100% 100%, 0 0);
          }
          
          .corner-bottom-left {
            bottom: 0;
            left: 0;
            clip-path: polygon(0 0, 100% 100%, 0 100%);
          }
          
          .corner-bottom-right {
            bottom: 0;
            right: 0;
            clip-path: polygon(100% 0, 100% 100%, 0 100%);
          }
          
          .certificate-border {
            position: absolute;
            top: 40px;
            left: 40px;
            right: 40px;
            bottom: 40px;
            border: 3px solid #1a1a1a;
            border-radius: 2px;
          }
          
          .inner-border {
            position: absolute;
            top: 8px;
            left: 8px;
            right: 8px;
            bottom: 8px;
            border: 1px solid #d4af37;
            border-radius: 1px;
          }
          
          .header {
            text-align: center;
            padding: 80px 80px 40px 80px;
            position: relative;
          }
          
          .company-logo {
            font-family: 'Cormorant Garamond', serif;
            font-size: 36px;
            font-weight: 600;
            color: #1a1a1a;
            letter-spacing: 8px;
            text-transform: uppercase;
            margin-bottom: 15px;
            position: relative;
          }
          
          .company-logo::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 200px;
            height: 2px;
            background: linear-gradient(90deg, transparent, #d4af37, transparent);
          }
          
          .company-subtitle {
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 300;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: 50px;
          }
          
          .certificate-title {
            font-family: 'Cormorant Garamond', serif;
            font-size: 84px;
            font-weight: 400;
            color: #1a1a1a;
            text-transform: uppercase;
            letter-spacing: 12px;
            margin-bottom: 30px;
            position: relative;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
          }
          
          .certificate-subtitle {
            font-family: 'Inter', sans-serif;
            font-size: 18px;
            font-weight: 300;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 6px;
            margin-bottom: 60px;
          }
          
          .recipient-section {
            text-align: center;
            padding: 0 120px;
            margin-bottom: 80px;
          }
          
          .recipient-intro {
            font-family: 'Crimson Text', serif;
            font-size: 28px;
            color: #333;
            margin-bottom: 25px;
            font-style: italic;
            font-weight: 400;
          }
          
          .recipient-name {
            font-family: 'Cormorant Garamond', serif;
            font-size: 68px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 35px;
            position: relative;
            letter-spacing: 3px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
          }
          
          .recipient-name::after {
            content: '';
            position: absolute;
            bottom: -15px;
            left: 50%;
            transform: translateX(-50%);
            width: 400px;
            height: 3px;
            background: linear-gradient(90deg, #d4af37 0%, #f4e09d 50%, #d4af37 100%);
            border-radius: 2px;
          }
          
          .completion-text {
            font-family: 'Crimson Text', serif;
            font-size: 24px;
            color: #333;
            line-height: 1.6;
            margin-bottom: 30px;
            font-weight: 400;
          }
          
          .course-name {
            font-family: 'Cormorant Garamond', serif;
            font-size: 42px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 40px;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          
          .achievement-details {
            display: flex;
            justify-content: center;
            gap: 100px;
            margin: 60px 0;
            padding: 0 80px;
          }
          
          .detail-group {
            text-align: center;
          }
          
          .detail-label {
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 8px;
            font-weight: 600;
          }
          
          .detail-value {
            font-family: 'Crimson Text', serif;
            font-size: 18px;
            font-weight: 600;
            color: #333;
            letter-spacing: 1px;
          }
          
          .footer-credentials {
            position: absolute;
            bottom: 50px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            align-items: end;
            padding: 0 80px;
          }
          
          .signature-area {
            text-align: left;
          }
          
          .signature-line {
            width: 250px;
            height: 1px;
            background: linear-gradient(90deg, #d4af37, transparent);
            margin-bottom: 12px;
            position: relative;
          }
          
          .signature-line::after {
            content: '';
            position: absolute;
            left: 0;
            top: -1px;
            width: 60px;
            height: 3px;
            background: #d4af37;
          }
          
          .signature-title {
            font-family: 'Inter', sans-serif;
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 5px;
            font-weight: 600;
          }
          
          .signature-name {
            font-family: 'Crimson Text', serif;
            font-size: 16px;
            color: #333;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          
          .signature-designation {
            font-family: 'Inter', sans-serif;
            font-size: 9px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 2px;
          }
          
          .verification-area {
            text-align: right;
          }
          
          .verification-seal {
            width: 90px;
            height: 90px;
            background: linear-gradient(145deg, #d4af37 0%, #f4e09d 50%, #d4af37 100%);
            border: 3px solid #1a1a1a;
            border-radius: 50%;
            margin: 0 auto 15px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-shadow: 0 4px 8px rgba(212,175,55,0.3);
          }
          
          .verification-seal::before {
            content: 'VERIFIED';
            font-family: 'Inter', sans-serif;
            font-size: 8px;
            font-weight: 800;
            color: #1a1a1a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: center;
            line-height: 1.2;
          }
          
          .verification-text {
            font-family: 'Inter', sans-serif;
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            font-weight: 500;
          }
          
          .certificate-id {
            font-family: 'Crimson Text', serif;
            font-size: 12px;
            color: #333;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          
          .validity-note {
            position: absolute;
            bottom: 15px;
            left: 50%;
            transform: translateX(-50%);
            font-family: 'Inter', sans-serif;
            font-size: 9px;
            color: #999;
            text-align: center;
            letter-spacing: 1px;
          }
          
          @media print {
            body { 
              margin: 0; 
              padding: 0; 
              background: white; 
            }
            .certificate-container {
              box-shadow: none;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          <!-- Ornate Corners -->
          <div class="ornate-corner corner-top-left"></div>
          <div class="ornate-corner corner-top-right"></div>
          <div class="ornate-corner corner-bottom-left"></div>
          <div class="ornate-corner corner-bottom-right"></div>
          
          <!-- Certificate Border -->
          <div class="certificate-border">
            <div class="inner-border"></div>
          </div>
          
          <!-- Header Section -->
          <div class="header">
            <div class="company-logo">OCTAMY</div>
            <div class="company-subtitle">Professional Certification Authority</div>
            <div class="certificate-title">Certificate</div>
            <div class="certificate-subtitle">of Achievement</div>
          </div>
          
          <!-- Recipient Section -->
          <div class="recipient-section">
            <div class="recipient-intro">This certifies that</div>
            <div class="recipient-name">${certificateData.userName}</div>
            <div class="completion-text">
              has successfully completed the comprehensive assessment and 
              demonstrated mastery of the competencies required for
            </div>
            <div class="course-name">${certificateData.courseTitle}</div>
          </div>
          
          <!-- Achievement Details -->
          <div class="achievement-details">
            <div class="detail-group">
              <div class="detail-label">Issue Date</div>
              <div class="detail-value">${certificateData.issueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Completion Date</div>
              <div class="detail-value">${certificateData.completionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Score Achieved</div>
              <div class="detail-value">${certificateData.userScore}% (Pass: ${certificateData.passingScore}%)</div>
            </div>
          </div>
          
          <!-- Footer Credentials -->
          <div class="footer-credentials">
            <div class="signature-area">
              <div class="signature-line"></div>
              <div class="signature-title">Authorized Signature</div>
              <div class="signature-name">Dr. Sarah Mitchell</div>
              <div class="signature-designation">Chief Academic Officer</div>
            </div>
            
            <div class="verification-area">
              <div class="verification-seal"></div>
              <div class="verification-text">Certificate ID</div>
              <div class="certificate-id">${certificateData.certificateId}</div>
            </div>
          </div>
          
          <!-- Validity Note -->
          <div class="validity-note">
            This certificate is valid for 2 years from the issue date • Verify at octamy.com/verify/${certificateData.certificateId}
          </div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(html);
    
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      },
      printBackground: true
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}