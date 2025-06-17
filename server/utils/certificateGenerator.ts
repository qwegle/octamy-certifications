import puppeteer from 'puppeteer';

interface CertificateData {
  certificateId: string;
  studentName: string;
  courseName: string;
  completionDate: string;
  score: number;
  instructorName?: string;
  courseDuration?: string;
  issueDate: string;
}

export async function generateCertificatePDF(data: CertificateData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const html = generateCertificateHTML(data);
  
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 1200, height: 850 });
  
  const pdf = await page.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '10mm',
      right: '10mm'
    }
  });
  
  await browser.close();
  return Buffer.from(pdf);
}

export function generateCertificateHTML(data: CertificateData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Professional Certificate</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .certificate-container {
            width: 1050px;
            height: 750px;
            background: white;
            position: relative;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
            border-radius: 15px;
            overflow: hidden;
        }

        .certificate-border {
            position: absolute;
            top: 15px;
            left: 15px;
            right: 15px;
            bottom: 15px;
            border: 4px solid #1a202c;
            border-radius: 10px;
        }

        .decorative-border {
            position: absolute;
            top: 25px;
            left: 25px;
            right: 25px;
            bottom: 25px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
        }

        .corner-ornament {
            position: absolute;
            width: 80px;
            height: 80px;
            border: 3px solid #1a202c;
        }

        .corner-ornament.top-left {
            top: 40px;
            left: 40px;
            border-right: none;
            border-bottom: none;
        }

        .corner-ornament.top-right {
            top: 40px;
            right: 40px;
            border-left: none;
            border-bottom: none;
        }

        .corner-ornament.bottom-left {
            bottom: 40px;
            left: 40px;
            border-right: none;
            border-top: none;
        }

        .corner-ornament.bottom-right {
            bottom: 40px;
            right: 40px;
            border-left: none;
            border-top: none;
        }

        .header {
            text-align: center;
            padding: 60px 60px 40px;
            position: relative;
        }

        .logo-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding: 0 20px;
        }

        .logo-group {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .logo {
            height: 50px;
            width: auto;
        }

        .octamy-logo {
            height: 60px;
            font-weight: 700;
            font-size: 32px;
            color: #1a202c;
            letter-spacing: -1px;
        }

        .cert-title {
            font-family: 'Playfair Display', serif;
            font-size: 48px;
            font-weight: 700;
            color: #1a202c;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 3px;
        }

        .cert-subtitle {
            font-size: 18px;
            color: #4a5568;
            font-weight: 300;
            margin-bottom: 40px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .content {
            text-align: center;
            padding: 0 80px 40px;
        }

        .awarded-text {
            font-size: 22px;
            color: #2d3748;
            margin-bottom: 20px;
            font-style: italic;
        }

        .student-name {
            font-family: 'Playfair Display', serif;
            font-size: 42px;
            font-weight: 600;
            color: #1a202c;
            margin: 20px 0 30px;
            border-bottom: 3px solid #1a202c;
            padding-bottom: 10px;
            display: inline-block;
        }

        .completion-text {
            font-size: 20px;
            color: #2d3748;
            margin-bottom: 15px;
            line-height: 1.6;
        }

        .course-name {
            font-family: 'Playfair Display', serif;
            font-size: 32px;
            font-weight: 600;
            color: #1a202c;
            margin: 25px 0;
        }

        .achievement-details {
            display: flex;
            justify-content: space-around;
            margin: 40px 0;
            padding: 20px 0;
            border-top: 2px solid #e2e8f0;
            border-bottom: 2px solid #e2e8f0;
        }

        .detail-item {
            text-align: center;
        }

        .detail-label {
            font-size: 14px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }

        .detail-value {
            font-size: 18px;
            font-weight: 600;
            color: #1a202c;
        }

        .footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding: 0 80px 60px;
            margin-top: 40px;
        }

        .signature-section {
            text-align: center;
            flex: 1;
        }

        .signature-line {
            width: 200px;
            height: 2px;
            background: #1a202c;
            margin: 40px auto 10px;
        }

        .signature-text {
            font-size: 14px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .certification-info {
            text-align: right;
            flex: 1;
        }

        .cert-id {
            font-size: 14px;
            color: #718096;
            margin-bottom: 5px;
        }

        .issue-date {
            font-size: 14px;
            color: #718096;
        }

        .verify-qr {
            text-align: center;
            flex: 1;
        }

        .qr-placeholder {
            width: 80px;
            height: 80px;
            background: #f7fafc;
            border: 2px solid #e2e8f0;
            margin: 0 auto 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: #718096;
        }

        .verify-text {
            font-size: 12px;
            color: #718096;
        }

        .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            color: rgba(26, 32, 44, 0.03);
            font-weight: 700;
            z-index: 1;
            pointer-events: none;
        }

        .gold-accent {
            background: linear-gradient(45deg, #d4af37, #ffd700);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .certificate-container {
                box-shadow: none;
                width: 100%;
                height: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="certificate-container">
        <div class="watermark">OCTAMY</div>
        <div class="certificate-border"></div>
        <div class="decorative-border"></div>
        
        <div class="corner-ornament top-left"></div>
        <div class="corner-ornament top-right"></div>
        <div class="corner-ornament bottom-left"></div>
        <div class="corner-ornament bottom-right"></div>

        <div class="header">
            <div class="logo-section">
                <div class="logo-group">
                    <div class="logo" style="background: #f0f0f0; padding: 10px; border-radius: 8px; font-size: 12px; color: #666;">ISO CERT</div>
                    <div class="logo" style="background: #ff6b35; color: white; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: bold;">STARTUP INDIA</div>
                </div>
                
                <div class="octamy-logo gold-accent">OCTAMY</div>
                
                <div class="logo-group">
                    <div class="logo" style="background: #4a90e2; color: white; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: bold;">STARTUP ODISHA</div>
                    <div class="logo" style="background: #f0f0f0; padding: 10px; border-radius: 8px; font-size: 12px; color: #666;">VERIFIED</div>
                </div>
            </div>

            <h1 class="cert-title">Certificate</h1>
            <p class="cert-subtitle">of Achievement</p>
        </div>

        <div class="content">
            <p class="awarded-text">This is to certify that</p>
            
            <h2 class="student-name">${data.studentName}</h2>
            
            <p class="completion-text">
                has successfully completed the comprehensive course
            </p>
            
            <h3 class="course-name">${data.courseName}</h3>
            
            <div class="achievement-details">
                <div class="detail-item">
                    <div class="detail-label">Score Achieved</div>
                    <div class="detail-value">${data.score}%</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Completion Date</div>
                    <div class="detail-value">${data.completionDate}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Duration</div>
                    <div class="detail-value">${data.courseDuration || '2 Hours'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Grade</div>
                    <div class="detail-value">${data.score >= 90 ? 'Excellent' : data.score >= 80 ? 'Very Good' : data.score >= 70 ? 'Good' : 'Pass'}</div>
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="signature-section">
                <div class="signature-line"></div>
                <p class="signature-text">Director, Octamy Solutions</p>
            </div>
            
            <div class="verify-qr">
                <div class="qr-placeholder">QR CODE</div>
                <p class="verify-text">Scan to Verify</p>
            </div>
            
            <div class="certification-info">
                <p class="cert-id">Certificate ID: ${data.certificateId}</p>
                <p class="issue-date">Issued: ${data.issueDate}</p>
            </div>
        </div>
    </div>
</body>
</html>
  `;
}