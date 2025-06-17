import puppeteer from 'puppeteer';

export interface CertificateData {
  certificateId: string;
  userName: string;
  courseTitle: string;
  issueDate: Date;
  completionDate: Date;
  passingScore: number;
  userScore: number;
  courseLevel: string;
}

function generateCertificateHTML(data: CertificateData): string {
  const expiryDate = new Date(data.issueDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 3);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Professional Certificate - ${data.certificateId}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', sans-serif;
          background: white;
          margin: 0;
          padding: 0;
        }
        
        .certificate-container {
          width: 297mm;
          height: 210mm;
          margin: 0 auto;
          background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
          border: 6px solid #000;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          page-break-inside: avoid;
        }
        
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .certificate-container {
            width: 297mm;
            height: 210mm;
            margin: 0;
            page-break-inside: avoid;
            page-break-after: always;
          }
        }
        
        .certificate-border {
          position: absolute;
          inset: 15px;
          border: 2px solid #c0c0c0;
          border-radius: 8px;
        }
        
        .decorative-corners {
          position: absolute;
          width: 60px;
          height: 60px;
          background: linear-gradient(45deg, #c0c0c0, #a0a0a0);
        }
        
        .decorative-corners.top-left {
          top: 25px;
          left: 25px;
          clip-path: polygon(0 0, 100% 0, 0 100%);
        }
        
        .decorative-corners.top-right {
          top: 25px;
          right: 25px;
          clip-path: polygon(100% 0, 100% 100%, 0 0);
        }
        
        .decorative-corners.bottom-left {
          bottom: 25px;
          left: 25px;
          clip-path: polygon(0 0, 100% 100%, 0 100%);
        }
        
        .decorative-corners.bottom-right {
          bottom: 25px;
          right: 25px;
          clip-path: polygon(100% 0, 100% 100%, 0 100%);
        }
        
        .certificate-content {
          position: relative;
          z-index: 10;
          padding: 30px;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
        }
        
        .header-section {
          margin-bottom: 15px;
        }
        
        .company-logo {
          display: inline-block;
          background: linear-gradient(145deg, #000000, #333333);
          color: white;
          padding: 12px 25px;
          margin-bottom: 10px;
          clip-path: polygon(10% 0%, 90% 0%, 100% 25%, 100% 75%, 90% 100%, 10% 100%, 0% 75%, 0% 25%);
        }
        
        .company-name {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 4px;
          font-family: 'Playfair Display', serif;
        }
        
        .company-tagline {
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
          font-family: 'Inter', sans-serif;
        }
        
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        
        .certificate-title {
          font-size: 36px;
          font-weight: 600;
          color: #000;
          margin: 15px 0;
          letter-spacing: 6px;
          text-transform: uppercase;
          font-family: 'Playfair Display', serif;
          position: relative;
        }
        
        .certificate-title::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #c0c0c0, transparent);
        }
        
        .certificate-subtitle {
          font-size: 18px;
          color: #666;
          font-style: italic;
          margin-bottom: 20px;
          font-family: 'Playfair Display', serif;
        }
        
        .awarded-text {
          font-size: 16px;
          color: #666;
          margin-bottom: 15px;
          font-style: italic;
          font-family: 'Playfair Display', serif;
        }
        
        .recipient-name {
          font-size: 28px;
          font-weight: 600;
          color: #000;
          margin: 15px 0;
          font-family: 'Playfair Display', serif;
          position: relative;
          padding: 10px 0;
        }
        
        .recipient-name::before,
        .recipient-name::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 250px;
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
          font-size: 14px;
          color: #666;
          margin: 15px 0;
          line-height: 1.6;
          font-family: 'Playfair Display', serif;
        }
        
        .course-name {
          font-size: 20px;
          font-weight: 600;
          color: #000;
          margin: 15px 0;
          padding: 12px 25px;
          border: 2px solid #c0c0c0;
          border-radius: 6px;
          background: linear-gradient(145deg, rgba(192,192,192,0.1) 0%, rgba(192,192,192,0.05) 100%);
          font-family: 'Playfair Display', serif;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        
        .achievement-section {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 30px;
          margin: 20px 0;
        }
        
        .badge-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .badge-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 12px;
          font-weight: 700;
          color: #fff;
          text-align: center;
          z-index: 10;
          font-family: 'Inter', sans-serif;
        }
        
        .achievement-details {
          text-align: left;
        }
        
        .achievement-score,
        .achievement-label {
          font-size: 14px;
          color: #333;
          margin: 5px 0;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
        }
        
        .footer-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 20px;
        }
        
        .certificate-details {
          text-align: left;
          font-size: 10px;
          color: #666;
          line-height: 1.4;
          font-family: 'Inter', sans-serif;
        }
        
        .signature-section {
          text-align: center;
        }
        
        .signature-line {
          width: 120px;
          height: 1px;
          background: #333;
          margin-bottom: 5px;
        }
        
        .signature-title {
          font-size: 12px;
          color: #666;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
        }
        
        .signature-name {
          font-size: 14px;
          color: #000;
          font-weight: 600;
          margin-top: 3px;
          font-family: 'Playfair Display', serif;
        }
        
        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 80px;
          color: rgba(192, 192, 192, 0.03);
          font-weight: 700;
          z-index: 1;
          pointer-events: none;
          font-family: 'Playfair Display', serif;
        }
        
        .certification-logos {
          position: absolute;
          bottom: 15px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 15px;
          align-items: center;
          z-index: 10;
        }
        
        .certification-logos img {
          height: 30px;
          width: auto;
          object-fit: contain;
          opacity: 0.7;
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
            <div class="header-section">
              <div class="company-logo">
                <div class="company-name">OCTAMY</div>
              </div>
              <div class="company-tagline">Solutions Private Limited</div>
              <div style="font-size: 10px; color: #999; font-style: italic;">Authorized Certification Body</div>
            </div>
            
            <div class="main-content">
              <div class="certificate-title">Certificate</div>
              <div class="certificate-subtitle">of Professional Excellence</div>
              
              <div class="awarded-text">This is to certify that</div>
              
              <div class="recipient-name">${data.userName}</div>
              
              <div class="completion-text">
                has successfully demonstrated mastery and completed the comprehensive<br />
                professional certification program
              </div>
              
              <div class="course-name">${data.courseTitle}</div>
              
              <div class="achievement-section">
                <div class="badge-container">
                  <svg width="100" height="100" viewBox="0 0 120 120" class="badge-image">
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
                  <div class="badge-text">${data.courseLevel.toUpperCase()}</div>
                </div>
                
                <div class="achievement-details">
                  <div class="achievement-score">Score Achieved: ${data.userScore}%</div>
                  <div class="achievement-label">Passing Score: ${data.passingScore}%</div>
                </div>
              </div>
            </div>
            
            <div class="footer-section">
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
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export { generateCertificateHTML };