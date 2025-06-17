export interface CertificateData {
  certificateId: string;
  courseId: number;
  userEmail: string;
  userName: string;
  score: number;
  examAttemptId: number;
  courseTitle: string;
  expiresAt: Date;
  badge: string;
  certificateNumber: string;
  isPaid: boolean;
  paymentId?: string;
  retakeCount?: number;
}

export function generateCertificateHTML(data: CertificateData): string {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Certificate - ${data.courseTitle}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Inter', sans-serif;
          background: white;
          padding: 40px;
          color: #000;
        }
        .certificate {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 60px;
          border: 8px solid #000;
          position: relative;
        }
        .certificate::before {
          content: '';
          position: absolute;
          top: 20px;
          left: 20px;
          right: 20px;
          bottom: 20px;
          border: 2px solid #000;
          pointer-events: none;
        }
        .ornate-corner {
          position: absolute;
          width: 40px;
          height: 40px;
          border: 3px solid #000;
        }
        .ornate-corner.top-left {
          top: 35px;
          left: 35px;
          border-right: none;
          border-bottom: none;
        }
        .ornate-corner.top-right {
          top: 35px;
          right: 35px;
          border-left: none;
          border-bottom: none;
        }
        .ornate-corner.bottom-left {
          bottom: 35px;
          left: 35px;
          border-right: none;
          border-top: none;
        }
        .ornate-corner.bottom-right {
          bottom: 35px;
          right: 35px;
          border-left: none;
          border-top: none;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .logo {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 700;
          color: #000;
          margin-bottom: 10px;
        }
        .company {
          font-size: 14px;
          color: #666;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .certificate-title {
          font-family: 'Playfair Display', serif;
          font-size: 48px;
          font-weight: 400;
          text-align: center;
          margin: 40px 0;
          color: #000;
        }
        .recipient {
          text-align: center;
          margin: 40px 0;
        }
        .recipient-label {
          font-size: 16px;
          color: #666;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .recipient-name {
          font-family: 'Playfair Display', serif;
          font-size: 36px;
          font-weight: 700;
          color: #000;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          display: inline-block;
          min-width: 300px;
        }
        .achievement {
          text-align: center;
          margin: 40px 0;
          font-size: 18px;
          line-height: 1.6;
          color: #333;
        }
        .course-title {
          font-weight: 600;
          color: #000;
        }
        .details {
          display: flex;
          justify-content: space-between;
          margin-top: 60px;
          padding-top: 20px;
          border-top: 1px solid #ccc;
        }
        .detail-item {
          text-align: center;
          flex: 1;
        }
        .detail-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 5px;
        }
        .detail-value {
          font-size: 14px;
          font-weight: 500;
          color: #000;
        }
        .badge {
          display: inline-block;
          padding: 8px 16px;
          background: #000;
          color: white;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 10px 0;
        }
        @media print {
          body { padding: 0; }
          .certificate { border: 8px solid #000; }
        }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="ornate-corner top-left"></div>
        <div class="ornate-corner top-right"></div>
        <div class="ornate-corner bottom-left"></div>
        <div class="ornate-corner bottom-right"></div>
        
        <div class="header">
          <div class="logo">OCTAMY</div>
          <div class="company">Octamy Solutions</div>
        </div>
        
        <div class="certificate-title">Certificate of Achievement</div>
        
        <div class="recipient">
          <div class="recipient-label">This certifies that</div>
          <div class="recipient-name">${data.userName}</div>
        </div>
        
        <div class="achievement">
          has successfully completed the professional certification program in<br>
          <span class="course-title">${data.courseTitle}</span><br>
          with a score of <strong>${data.score}%</strong>
          <div class="badge">${data.badge}</div>
        </div>
        
        <div class="details">
          <div class="detail-item">
            <div class="detail-label">Date Issued</div>
            <div class="detail-value">${currentDate}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Certificate ID</div>
            <div class="detail-value">${data.certificateNumber}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Valid Until</div>
            <div class="detail-value">${data.expiresAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}