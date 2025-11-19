import puppeteer from "puppeteer";

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
  let formattedExpiryDate: any;
  if (data.courseTitle.toLowerCase().includes("internship")) {
    formattedExpiryDate = "Never";
  } else {
    expiryDate.setFullYear(expiryDate.getFullYear() + 2);
    formattedExpiryDate = expiryDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  const issueDate = data.issueDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // return `
  //   <!DOCTYPE html>
  //   <html lang="en">
  //   <head>
  //     <meta charset="UTF-8">
  //     <meta name="viewport" content="width=device-width, initial-scale=1.0">
  //     <title>Professional Certificate - ${data.certificateId}</title>
  //     <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  //     <style>
  //       * {
  //         margin: 0;
  //         padding: 0;
  //         box-sizing: border-box;
  //       }

  //       body {
  //         font-family: 'Poppins', sans-serif;
  //         background: white;
  //         margin: 0;
  //         padding: 0;
  //       }

  //       .certificate-container {
  //         width: 297mm;
  //         height: 210mm;
  //         margin: 0 auto;
  //         background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
  //         border: 6px solid #000;
  //         position: relative;
  //         overflow: hidden;
  //         display: flex;
  //         flex-direction: column;
  //         page-break-inside: avoid;
  //       }

  //       @media print {
  //         body {
  //           margin: 0;
  //           padding: 0;
  //           background: white;
  //         }

  //         .certificate-container {
  //           width: 297mm;
  //           height: 210mm;
  //           margin: 0;
  //           page-break-inside: avoid;
  //           page-break-after: always;
  //         }
  //       }

  //       .certificate-border {
  //         position: absolute;
  //         inset: 15px;
  //         border: 2px solid #c0c0c0;
  //         border-radius: 8px;
  //         background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,249,250,0.9) 50%, rgba(255,255,255,0.9) 100%);
  //         background-image:
  //           radial-gradient(circle at 25% 25%, rgba(200,200,200,0.1) 2px, transparent 2px),
  //           radial-gradient(circle at 75% 25%, rgba(200,200,200,0.1) 2px, transparent 2px),
  //           radial-gradient(circle at 25% 75%, rgba(200,200,200,0.1) 2px, transparent 2px),
  //           radial-gradient(circle at 75% 75%, rgba(200,200,200,0.1) 2px, transparent 2px);
  //         background-size: 50px 50px;
  //       }

  //       .decorative-corners {
  //         position: absolute;
  //         width: 60px;
  //         height: 60px;
  //         background: linear-gradient(45deg, #000000, #b6b6b6);
  //       }

  //       .decorative-corners.top-left {
  //         top: 25px;
  //         left: 25px;
  //         clip-path: polygon(0 0, 100% 0, 0 100%);
  //       }

  //       .decorative-corners.top-right {
  //         top: 25px;
  //         right: 25px;
  //         clip-path: polygon(100% 0, 100% 100%, 0 0);
  //       }

  //       .decorative-corners.bottom-left {
  //         bottom: 25px;
  //         left: 25px;
  //         clip-path: polygon(0 0, 100% 100%, 0 100%);
  //       }

  //       .decorative-corners.bottom-right {
  //         bottom: 25px;
  //         right: 25px;
  //         clip-path: polygon(100% 0, 100% 100%, 0 100%);
  //       }

  //       .certificate-content {
  //         position: relative;
  //         z-index: 10;
  //         padding: 30px;
  //         height: 100%;
  //         display: flex;
  //         flex-direction: column;
  //         justify-content: space-between;
  //         text-align: center;
  //       }

  //       .header-section {
  //         margin-bottom: 15px;
  //       }

  //       .company-logo {
  //         text-align: center;
  //         margin-bottom: 10px;
  //       }

  //       .company-logo img {
  //         height: 50px;
  //         width: auto;
  //         object-fit: contain;
  //       }

  //       .company-name {
  //         font-size: 24px;
  //         font-weight: 700;
  //         letter-spacing: 4px;
  //         font-family: 'Playfair Display', serif;
  //       }

  //       .company-tagline {
  //         font-size: 12px;
  //         color: #000000;
  //         margin-bottom: 5px;
  //         font-family: 'Poppins', sans-serif;
  //       }

  //       .main-content {
  //         flex: 1;
  //         display: flex;
  //         flex-direction: column;
  //         justify-content: center;
  //         align-items: center;
  //       }

  //       .certificate-title {
  //         font-size: 36px;
  //         font-weight: 600;
  //         color: #000;
  //         margin: 15px 0;
  //         letter-spacing: 6px;
  //         text-transform: uppercase;
  //         font-family: 'Poppins', sans-serif;
  //         position: relative;
  //       }

  //       .certificate-title::after {
  //         content: '';
  //         position: absolute;
  //         bottom: -8px;
  //         left: 50%;
  //         transform: translateX(-50%);
  //         width: 80px;
  //         height: 2px;
  //         background: linear-gradient(90deg, transparent, #c0c0c0, transparent);
  //       }

  //       .certificate-subtitle {
  //         font-size: 18px;
  //         color: #666;
  //         font-style: italic;
  //         margin-bottom: 20px;
  //         font-family: 'Poppins', sans-serif;
  //       }

  //       .awarded-text {
  //         font-size: 16px;
  //         color: #666;
  //         margin-bottom: 15px;
  //         font-style: italic;
  //         font-family: 'Poppins', sans-serif;
  //       }

  //       .recipient-name {
  //         font-size: 28px;
  //         font-weight: 600;
  //         color: #1f2138;
  //         margin: 0;
  //         font-family: 'Poppins', serif;
  //         position: relative;
  //         padding: 10px 0;
  //       }

  //       .recipient-name::before,
  //       .recipient-name::after {
  //         content: '';
  //         position: absolute;
  //         left: 50%;
  //         transform: translateX(-50%);
  //         width: 250px;
  //         height: 1px;
  //         background: linear-gradient(90deg, transparent, #c0c0c0, transparent);
  //       }

  //       .recipient-name::before {
  //         top: 0;
  //       }

  //       .recipient-name::after {
  //         bottom: 0;
  //       }

  //       .completion-text {
  //         font-size: 14px;
  //         color: #666;
  //         margin: 15px 0;
  //         line-height: 1.6;
  //         font-family: 'Poppins', serif;
  //       }

  //       .course-name {
  //         font-size: 20px;
  //         font-weight: 600;
  //         color: #1f2138;
  //         margin: 5px 0;
  //         padding: 12px 25px;
  //         border: 2px solid #000000;
  //         border-radius: 6px;
  //         background: linear-gradient(141deg, rgba(192, 192, 192, 0.1) 0%, rgba(192, 192, 192, 0.05) 100%);
  //         font-family: 'Poppins', serif;
  //         text-transform: uppercase;
  //         letter-spacing: 2px;
  //       }

  //       .badge-container {
  //         position: absolute;
  //         top: 30px;
  //         right: 50px;
  //         display: flex;
  //         flex-direction: column;
  //         align-items: center;
  //         z-index: 15;
  //       }

  //       .badge-text {
  //         position: absolute;
  //         top: 50%;
  //         left: 50%;
  //         transform: translate(-50%, -50%);
  //         font-size: 10px;
  //         font-weight: 700;
  //         color: #fff;
  //         text-align: center;
  //         z-index: 10;
  //         font-family: 'Poppins', sans-serif;
  //       }

  //       .footer-section {
  //         display: flex;
  //         justify-content: space-between;
  //         align-items: flex-end;
  //         margin-top: 20px;
  //         margin-bottom: 70px !important;
  //       }

  //       .certificate-details {
  //         text-align: left;
  //         font-size: 10px;
  //         color: #666;
  //         line-height: 1.6;
  //         font-family: 'Poppins', sans-serif;
  //       }

  //       .signature-section {
  //         text-align: center;
  //         position: relative;
  //       }

  //       .signature-image {
  //         width: 100px;
  //         height: auto;
  //         margin-bottom: 5px;
  //         display: block;
  //         margin-left: auto;
  //         margin-right: auto;
  //       }

  //       .signature-line {
  //         width: 120px;
  //         height: 1px;
  //         background: #333;
  //         margin-bottom: 5px;
  //       }

  //       .signature-title {
  //         font-size: 12px;
  //         color: #666;
  //         font-weight: 500;
  //         font-family: 'Inter', sans-serif;
  //       }

  //       .signature-name {
  //         font-size: 14px;
  //         color: #000;
  //         font-weight: 600;
  //         margin-top: 3px;
  //         font-family: 'Playfair Display', serif;
  //       }

  //       .bottom-section {
  //         position: absolute;
  //         bottom: 20px;
  //         left: 0;
  //         right: 0;
  //         display: flex;
  //         justify-content: space-between;
  //         align-items: center;
  //         padding: 0 100px;
  //         margin-bottom: 20px;
  //         z-index: 10;
  //       }

  //       .footer-section {
  //         margin-bottom: 50px;
  //       }

  //       .expiry-info {
  //         font-size: 11px;
  //         color: #666;
  //         font-family: 'Inter', sans-serif;
  //         text-align: left;
  //       }

  //       .expiry-info strong {
  //         color: #333;
  //       }

  //       .watermark {
  //         position: absolute;
  //         top: 50%;
  //         left: 50%;
  //         transform: translate(-50%, -50%) rotate(-45deg);
  //         font-size: 80px;
  //         color: rgba(192, 192, 192, 0.03);
  //         font-weight: 700;
  //         z-index: 1;
  //         pointer-events: none;
  //         font-family: 'Playfair Display', serif;
  //       }

  //       .certification-logos {
  //         display: flex;
  //         gap: 20px;
  //         align-items: center;
  //       }

  //       .certification-logos img {
  //         height: 55px;
  //         width: auto;
  //         object-fit: contain;
  //         opacity: 0.7;
  //       }
  //     </style>
  //   </head>
  //   <body>
  //     <div class="certificate-container">
  //       <div class="certificate-border">
  //         <div class="decorative-corners top-left"></div>
  //         <div class="decorative-corners top-right"></div>
  //         <div class="decorative-corners bottom-left"></div>
  //         <div class="decorative-corners bottom-right"></div>

  //         <div class="watermark">PREMCQ</div>

  //         <div class="certificate-content">
  //           <div class="header-section">
  //             <div class="company-logo">
  //               <img src="https://premcq.com/storage/optionbuilder/uploads/554402-14-2025_0143pmpremcq_logo_black.png" alt="PremCQ Logo" style="height: 50px;">
  //             </div>
  //             <div class="company-tagline">Solutions Private Limited</div>
  //             <div style="font-size: 10px; color: #333; font-family: 'Poppins', sans-serif; letter-spacing: 1px;">An ISO Certified Company</div>
  //           </div>

  //           <!-- Badge positioned in top right -->
  //           <div class="badge-container">
  //             <svg width="160" height="160" viewBox="0 0 120 120" class="badge-image">
  //               <defs>
  //                 <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
  //                   <stop offset="0%" style="stop-color:#4a4a4a;stop-opacity:1" />
  //                   <stop offset="50%" style="stop-color:#2a2a2a;stop-opacity:1" />
  //                   <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
  //                 </linearGradient>
  //                 <linearGradient id="ribbonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
  //                   <stop offset="0%" style="stop-color:#888;stop-opacity:1" />
  //                   <stop offset="50%" style="stop-color:#666;stop-opacity:1" />
  //                   <stop offset="100%" style="stop-color:#555;stop-opacity:1" />
  //                 </linearGradient>
  //               </defs>

  //               <!-- Shield Shape -->
  //               <path d="M60 10 L100 30 L100 60 Q100 80 85 95 Q70 105 60 110 Q50 105 35 95 Q20 80 20 60 L20 30 Z"
  //                     fill="url(#shieldGradient)" stroke="#fff" stroke-width="2"/>

  //               <!-- Inner Circle -->
  //               <circle cx="60" cy="45" r="15" fill="#fff" stroke="#333" stroke-width="1"/>

  //               <!-- Sunburst pattern around circle -->
  //               <g transform="translate(60,45)">
  //                 <g stroke="#fff" stroke-width="1" fill="none">
  //                   <circle r="20" opacity="0.3"/>
  //                   <path d="M0,-25 L0,-20 M0,20 L0,25 M25,0 L20,0 M-20,0 L-25,0" stroke-width="2"/>
  //                   <path d="M17.6,-17.6 L14.1,-14.1 M-14.1,14.1 L-17.6,17.6 M17.6,17.6 L14.1,14.1 M-14.1,-14.1 L-17.6,-17.6" stroke-width="1.5"/>
  //                 </g>
  //               </g>

  //               <!-- Ribbon banners -->
  //               <path d="M20 70 Q35 65 50 70 Q60 72 70 70 Q85 65 100 70 L95 85 Q80 80 65 85 Q60 87 55 85 Q40 80 25 85 Z"
  //                     fill="url(#ribbonGradient)" stroke="#333" stroke-width="1" opacity="0.8"/>

  //               <path d="M25 85 Q40 80 55 85 Q60 87 65 85 Q80 80 95 85 L90 95 Q75 90 60 95 Q45 90 30 95 Z"
  //                     fill="url(#ribbonGradient)" stroke="#333" stroke-width="1" opacity="0.6"/>

  //               <!-- Ribbon ends -->
  //               <path d="M20 70 L15 85 L25 80 Z" fill="url(#ribbonGradient)" opacity="0.9"/>
  //               <path d="M100 70 L105 85 L95 80 Z" fill="url(#ribbonGradient)" opacity="0.9"/>
  //             </svg>
  //             <div class="badge-text" style="position: absolute; top: 68%; left: 50%; transform: translate(-50%, -50%); font-size: 12px; font-weight: 700; color: #fff; text-align: center; z-index: 10; font-family: 'Inter', sans-serif;">${(data.courseLevel || 'VERIFIED').toUpperCase()}</div>
  //           </div>

  //           <div class="main-content">
  //             <div class="certificate-title">Certificate of Completion</div>

  //             <div class="awarded-text">This is to certify that</div>

  //             <div class="recipient-name">${data.userName}</div>

  //             <div class="completion-text">
  //               has successfully demonstrated mastery and completed the comprehensive<br />
  //               professional certification program
  //             </div>

  //             <div class="course-name">${data.courseTitle}</div>
  //           </div>

  //           <div class="footer-section">
  //             <div class="certificate-details" style="margin-left: 30px;">
  //               <div><strong>Certificate ID:</strong> ${data.certificateId}</div>
  //               <div><strong>Issue Date:</strong> ${new Date(data.issueDate).toLocaleDateString()}</div>
  //               <div><strong>Expiry Date:</strong> ${expiryDate.toLocaleDateString()}</div>
  //               <div><strong>Status:</strong> Valid Internationally</div>
  //             </div>

  //             <div class="signature-section">
  //               <svg
  //                 width="200"
  //                 height="60"
  //                 viewBox="0 0 200 60"
  //                 xmlns="http://www.w3.org/2000/svg"
  //                 class="signature-image"
  //               >
  //                 <path d="M20 40 Q30 25, 45 35 Q60 45, 75 30 Q90 20, 105 35 Q120 50, 135 25 Q150 15, 165 40 Q175 50, 185 35"
  //                       fill="none"
  //                       stroke="#1f2138"
  //                       stroke-width="2"
  //                       stroke-linecap="round"/>
  //                 <path d="M25 45 Q40 50, 55 42 Q70 35, 85 48 Q100 55, 115 42 Q130 30, 145 45 Q160 55, 175 42"
  //                       fill="none"
  //                       stroke="#1f2138"
  //                       stroke-width="1"
  //                       stroke-linecap="round"
  //                       opacity="0.7"/>
  //                 <path d="M20 50 Q100 45, 180 50"
  //                       fill="none"
  //                       stroke="#1f2138"
  //                       stroke-width="1"
  //                       stroke-linecap="round"/>
  //               </svg>
  //               <div class="signature-line"></div>
  //               <div class="signature-name" style="font-size: 14px; color: #000; font-weight: 600; margin-top: 3px; font-family: 'Poppins', serif;">Nitikesh Pattanayak</div>
  //               <div class="signature-title" style="font-size: 12px; color: #1f2138; margin-bottom: 5px; font-family: 'Poppins', sans-serif;">Director of Certification</div>
  //             </div>
  //           </div>
  //         </div>

  //         <!-- Bottom section with logos and expiry -->
  //         <div class="bottom-section">
  //           <div class="expiry-info">
  //             <strong>Valid Until:</strong> ${expiryDate.toLocaleDateString()}<br>
  //             <strong>Verification:</strong> premcq.com/verify
  //           </div>

  //           <div class="certification-logos">
  //             <!-- ISO Certified Logo -->
  //             <svg
  //               width="120"
  //               height="80"
  //               viewBox="0 0 120 80"
  //               xmlns="http://www.w3.org/2000/svg"
  //               style="height: 55px; width: auto;"
  //             >
  //               <rect width="120" height="80" fill="#003366" rx="5"/>
  //               <circle cx="60" cy="40" r="25" fill="none" stroke="#ffffff" stroke-width="3"/>
  //               <text x="60" y="30" text-anchor="middle" fill="#ffffff" font-size="12" font-family="Arial, sans-serif" font-weight="bold">ISO</text>
  //               <text x="60" y="45" text-anchor="middle" fill="#ffffff" font-size="8" font-family="Arial, sans-serif">CERTIFIED</text>
  //               <text x="60" y="55" text-anchor="middle" fill="#ffffff" font-size="8" font-family="Arial, sans-serif">COMPANY</text>
  //             </svg>

  //             <!-- Make in India Logo -->
  //             <svg
  //               width="120"
  //               height="80"
  //               viewBox="0 0 120 80"
  //               xmlns="http://www.w3.org/2000/svg"
  //               style="height: 55px; width: auto;"
  //             >
  //               <rect width="120" height="80" fill="#ff9933" rx="5"/>
  //               <rect y="27" width="120" height="26" fill="#ffffff"/>
  //               <rect y="53" width="120" height="27" fill="#138808" rx="0 0 5 5"/>
  //               <circle cx="60" cy="40" r="12" fill="none" stroke="#000080" stroke-width="1"/>
  //               <g stroke="#000080" stroke-width="0.5">
  //                 <line x1="60" y1="28" x2="60" y2="52"/>
  //                 <line x1="48" y1="40" x2="72" y2="40"/>
  //                 <line x1="51.5" y1="31.5" x2="68.5" y2="48.5"/>
  //                 <line x1="68.5" y1="31.5" x2="51.5" y2="48.5"/>
  //               </g>
  //               <text x="60" y="15" text-anchor="middle" fill="#000" font-size="10" font-family="Arial, sans-serif" font-weight="bold">MAKE IN</text>
  //               <text x="60" y="72" text-anchor="middle" fill="#fff" font-size="10" font-family="Arial, sans-serif" font-weight="bold">INDIA</text>
  //             </svg>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   </body>
  //   </html>
  // `;

  return `
  <!DOCTYPE html>
  <html lang="en">
   <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Certificate of Completion</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Poppins:wght@300;400;500;600;700&display=swap");

      * {
       box-sizing: border-box;
       font-family: 'Poppins', system-ui, -apple-system, sans-serif;
     }


      body {
        margin: 0;
        padding: 0;
        font-family: 'Poppins', system-ui, -apple-system, sans-serif;
        width: 1123px;
        height: 756px;
        background-color: #f3f4f6;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .certificate-container {
        width: 1123px;
        height: 756px;
        position: relative;
        background-color: white;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        transform-origin: center;
      }

      @media print {
        body {
          margin: 0;
          padding: 0;
          background: white;
        }

        .certificate-container {
          width: 1123px;
          height: 756px;
          margin: 0;
          box-shadow: none;
          page-break-inside: avoid;
          page-break-after: always;
        }
      }

      .certificate-content {
        padding: 64px;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .decorative-background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        z-index: 1;
      }

      .main-content {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        margin: 0;
        z-index: 2;
        position: relative;
      }

      .header-section {
        text-align: center;
        margin-bottom: 48px;
      }

      .logo-container {
        margin-bottom: 0px;
      }

      .logo-image {
        width: 256px;
        height: auto;
        margin: 0 auto;
        display: block;
      }

      .company-name {
        font-size: 14px;
        color: #331f30;
        margin: 8px 0 4px 0;
      }

      .company-subtitle {
        font-size: 12px;
        color: #696171;
        margin: 0;
      }

      .title-section {
        text-align: center;
      }

      .certificate-title {
        font-size: 32px;
        letter-spacing: 5px;
        color: #08060c;
        font-weight: normal;
        margin: 0;
      }

      .subtitle {
        color: #787378;
        font-size: 18px;
        margin: 0;
      }

      .decorative-frame {
        width: 128px;
        height: auto;
      }

      .recipient-name {
        font-size: 40px;
        font-weight: bold;
        color: #282842;
        margin: 2px;
      }

      .completion-text {
        font-size: 18px;
        max-width: 768px;
        text-align: center;
        padding: 0 48px;
        color: #807a83;
        line-height: 1.5;
        margin: 10px 0 0 0;
      }

      .course-title {
        font-size: 20px;
        font-weight: 600;
        color: #292945;
        margin-bottom: 0;
      }

      .footer-section {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        z-index: 2;
        position: relative;
        margin-top: 30px;
      }

      .certificate-details {
        display: flex;
        flex-direction: column;
      }

      .details-main {
        font-size: 12px;
        color: #807a83;
        margin-bottom: 20px;
      }

      .details-main p {
        margin: 2px 0;
      }

      .details-secondary {
        font-size: 12px;
        margin-left: 16px;
        color: #807a83;
      }

      .details-secondary p {
        margin: 2px 0;
      }

      .signature-section {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 16px;
      }
      .signature{
        height:45px
      }  
      .signature-info {
        text-align: center;
        margin-right: 10px;
      }

      .signature-name {
        font-size: 18px;
        font-weight: 600;
        color: #16111e;
        margin: 0 0 4px 0;
      }

      .signature-title {
        font-size: 12px;
        color: #433d5e;
        margin: 0;
      }

      .certification-logos {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }

      .certification-logo {
        height: 50px;
        width: auto;
      }

      .font-semibold {
        font-weight: 600;
      }

      /* Badge Styles */
      .badge-container {
        position: absolute;
        width: 200px;
        height: 200px;
        top: 30px;
        right: 30px;
        z-index: 10;
      }

      .badge-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
      }

      .badge-text {
        position: absolute;
        top: 70%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 18px;
        font-weight: 700;
        text-align: center;
        font-family: "Inter", sans-serif;
        text-transform: uppercase;
        letter-spacing: 1px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      }
    </style>
  </head>
  <body>
    <div class="certificate-container">
      <!-- Golden curved decorative elements -->
      <div class="decorative-background">
        <img
          src="/certificateImages/SolutionsPrivateLimited.svg"
          style="width: 1150px;"
          alt=""
        />
      </div>

      <!-- Top Right Badge -->
      <div class="badge-container">
        <img
          src="/certificateImages/Badge.svg"
          class="badge-image"
          alt=""
        />
        <div class="badge-text">${data.courseLevel}</div>
      </div>

      <div class="certificate-content">
        <!-- Main content -->
        <div class="main-content">
          <div class="header-section">
            <div class="logo-container">
              <img
                src="/certificateImages/premcq.svg"
                alt="PremCQ Logo"
                class="logo-image"
              />
            </div>
            <p class="company-name">Solutions Private Limited</p>
            <p class="company-subtitle">An ISO Certified Company</p>
          </div>

          <div class="title-section">
            <h1 class="certificate-title">CERTIFICATE OF COMPLETION</h1>
            <h3 class="subtitle">This is to certify that</h3>
          </div>

          <!-- Decorative Frame -->
          <img
            src="/certificateImages/Frame 1.svg"
            alt="Decorative Frame"
            class="decorative-frame"
          />

          <h1 class="recipient-name">${data.userName}</h1>

          <!-- Decorative Frame -->
          <img
            src="/certificateImages/Frame 1.svg"
            alt="Decorative Frame"
            class="decorative-frame"
          />

          <p class="completion-text">
            has successfully demonstrated mastery and completed the
            comprehensive professional certification program
          </p>

          <p class="course-title">${data.courseTitle}</p>
        </div>

        <!-- Footer -->
        <div class="footer-section">
          <div class="certificate-details">
            <div class="details-main">
              <p><span class="font-semibold">Certificate ID:</span> ${
                data.certificateId
              }</p>
              <p><span class="font-semibold">Issue Date:</span> ${issueDate}</p>
              <p><span class="font-semibold">Expiry Date: </span>${formattedExpiryDate}</p>
              <p>
                <span class="font-semibold">Status:</span> Valid Internationally
              </p>
            </div>
            <div class="details-secondary">
             <p>
              ${
                formattedExpiryDate === "Never"
                  ? '<span class="font-semibold">Duration: </span> 90 Days'
                  : ""
                }
              </p>
              <p>
                <span class="font-semibold">Verification: </span>
                www.premcq.com/verify
              </p>
            </div>
          </div>

          <div class="signature-section">
            <div class="signature-info">
              <img class="signature" src="/certificateImages/sign.svg"/>
              <p class="signature-name">Nitikesh Pattanayak</p>
              <p class="signature-title">Director of Certification</p>
            </div>
            <div class="certification-logos">
              <img
                src="/certificateImages/Make_In_India.svg"
                alt="Make in India"
                class="certification-logo"
              />
              <img
                src="/certificateImages/makeinodisha.svg"
                alt="Make in India"
                class="certification-logo"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`;
}

export async function generateCertificatePDF(
  data: CertificateData
): Promise<Buffer> {
  const html = generateCertificateHTML(data);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
      "--disable-extensions",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export {
  generateCertificateHTML,
  // generateCertificateHTMLDemo
};
