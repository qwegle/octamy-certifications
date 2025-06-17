import { Certificate } from '../../shared/schema';

export function generateCertificateHTML(certificate: Certificate): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate - ${certificate.certificateId}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .certificate-container {
            background: white;
            width: 100%;
            max-width: 800px;
            aspect-ratio: 1.414;
            position: relative;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        
        .certificate-border {
            position: absolute;
            inset: 20px;
            border: 3px solid #000;
            border-radius: 4px;
        }
        
        .ornate-corner {
            position: absolute;
            width: 60px;
            height: 60px;
            border: 2px solid #000;
        }
        
        .ornate-corner::before,
        .ornate-corner::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            border: 1px solid #000;
        }
        
        .ornate-corner.top-left {
            top: -2px;
            left: -2px;
            border-right: none;
            border-bottom: none;
        }
        
        .ornate-corner.top-left::before {
            top: 15px;
            left: 15px;
            border-right: none;
            border-bottom: none;
        }
        
        .ornate-corner.top-left::after {
            top: 30px;
            left: 30px;
            border-right: none;
            border-bottom: none;
        }
        
        .ornate-corner.top-right {
            top: -2px;
            right: -2px;
            border-left: none;
            border-bottom: none;
        }
        
        .ornate-corner.top-right::before {
            top: 15px;
            right: 15px;
            border-left: none;
            border-bottom: none;
        }
        
        .ornate-corner.top-right::after {
            top: 30px;
            right: 30px;
            border-left: none;
            border-bottom: none;
        }
        
        .ornate-corner.bottom-left {
            bottom: -2px;
            left: -2px;
            border-right: none;
            border-top: none;
        }
        
        .ornate-corner.bottom-left::before {
            bottom: 15px;
            left: 15px;
            border-right: none;
            border-top: none;
        }
        
        .ornate-corner.bottom-left::after {
            bottom: 30px;
            left: 30px;
            border-right: none;
            border-top: none;
        }
        
        .ornate-corner.bottom-right {
            bottom: -2px;
            right: -2px;
            border-left: none;
            border-top: none;
        }
        
        .ornate-corner.bottom-right::before {
            bottom: 15px;
            right: 15px;
            border-left: none;
            border-top: none;
        }
        
        .ornate-corner.bottom-right::after {
            bottom: 30px;
            right: 30px;
            border-left: none;
            border-top: none;
        }
        
        .certificate-content {
            padding: 80px 60px 60px;
            text-align: center;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        
        .certificate-title {
            font-family: 'Playfair Display', serif;
            font-size: 48px;
            font-weight: 700;
            color: #000;
            margin-bottom: 20px;
            letter-spacing: 2px;
        }
        
        .certificate-subtitle {
            font-size: 18px;
            color: #666;
            margin-bottom: 40px;
            font-weight: 300;
            letter-spacing: 1px;
        }
        
        .recipient-name {
            font-family: 'Playfair Display', serif;
            font-size: 36px;
            font-weight: 400;
            color: #000;
            margin: 30px 0;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            display: inline-block;
            min-width: 300px;
        }
        
        .course-title {
            font-size: 24px;
            font-weight: 600;
            color: #000;
            margin: 30px 0 20px;
        }
        
        .achievement-text {
            font-size: 16px;
            color: #555;
            line-height: 1.6;
            margin: 20px 0;
        }
        
        .score-badge {
            display: inline-block;
            background: #000;
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: 600;
            margin: 20px 0;
        }
        
        .certificate-footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid #ddd;
        }
        
        .signature-section {
            text-align: center;
            flex: 1;
        }
        
        .signature-line {
            border-bottom: 2px solid #000;
            width: 200px;
            margin: 0 auto 10px;
            height: 40px;
        }
        
        .signature-label {
            font-size: 12px;
            color: #666;
            font-weight: 500;
        }
        
        .certificate-details {
            text-align: right;
            font-size: 12px;
            color: #666;
            line-height: 1.4;
        }
        
        .company-info {
            text-align: left;
            font-size: 12px;
            color: #666;
            line-height: 1.4;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .certificate-container {
                box-shadow: none;
                border-radius: 0;
                max-width: none;
                width: 100%;
                height: 100vh;
            }
        }
    </style>
</head>
<body>
    <div class="certificate-container">
        <div class="certificate-border">
            <div class="ornate-corner top-left"></div>
            <div class="ornate-corner top-right"></div>
            <div class="ornate-corner bottom-left"></div>
            <div class="ornate-corner bottom-right"></div>
        </div>
        
        <div class="certificate-content">
            <div>
                <h1 class="certificate-title">CERTIFICATE</h1>
                <p class="certificate-subtitle">OF ACHIEVEMENT</p>
                
                <p class="achievement-text">This is to certify that</p>
                
                <div class="recipient-name">${certificate.userName}</div>
                
                <p class="achievement-text">has successfully completed the course</p>
                
                <h2 class="course-title">${certificate.courseTitle}</h2>
                
                <div class="score-badge">Score: ${certificate.score}% | ${certificate.badge} Level</div>
                
                <p class="achievement-text">
                    This certificate demonstrates proficiency and commitment to professional development
                    in the field of study. The recipient has met all requirements and standards
                    established for this certification program.
                </p>
            </div>
            
            <div class="certificate-footer">
                <div class="company-info">
                    <strong>Octamy Solutions</strong><br>
                    Professional Certification Platform<br>
                    Certificate ID: ${certificate.certificateId}
                </div>
                
                <div class="signature-section">
                    <div class="signature-line"></div>
                    <div class="signature-label">Authorized Signature</div>
                </div>
                
                <div class="certificate-details">
                    Issued: ${new Date(certificate.issuedAt).toLocaleDateString()}<br>
                    Expires: ${new Date(certificate.expiresAt).toLocaleDateString()}<br>
                    Verify at: octamy.com/verify/${certificate.certificateId}
                </div>
            </div>
        </div>
    </div>
</body>
</html>
  `;
}