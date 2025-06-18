import { generateCertificateHTML } from './certificateGenerator';

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

// Alternative HTML-to-PDF approach without Puppeteer for frontend use
export function generateCertificateForPrint(data: CertificateData): string {
  const html = generateCertificateHTML(data);
  
  // Add print-specific styles
  const printOptimizedHtml = html.replace(
    '</head>',
    `
    <style>
      @media print {
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        .certificate-container {
          width: 297mm !important;
          height: 210mm !important;
          margin: 0 !important;
          page-break-inside: avoid !important;
          page-break-after: always !important;
          transform: none !important;
        }
        
        * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
      
      .print-button {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        padding: 10px 20px;
        background: #000;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-family: Arial, sans-serif;
      }
      
      .print-button:hover {
        background: #333;
      }
      
      @media print {
        .print-button {
          display: none !important;
        }
      }
    </style>
    <script>
      function printCertificate() {
        window.print();
      }
      
      function downloadAsPDF() {
        // Create a blob URL for the certificate
        const element = document.documentElement;
        
        // Simple download trigger using the browser's built-in print to PDF
        if (window.confirm('This will open the print dialog. Choose "Save as PDF" to download the certificate.')) {
          window.print();
        }
      }
      
      // Auto-focus for better printing
      window.addEventListener('load', function() {
        // Auto-print if URL contains print parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('autoprint') === 'true') {
          setTimeout(() => {
            window.print();
          }, 1000);
        }
      });
    </script>
    </head>`
  ).replace(
    '<body>',
    `<body>
    <button class="print-button" onclick="printCertificate()">🖨️ Print Certificate</button>
    <button class="print-button" onclick="downloadAsPDF()" style="top: 60px;">📄 Download PDF</button>`
  );
  
  return printOptimizedHtml;
}

// Generate a certificate URL that can be used for printing/downloading
export function generatePrintableCertificateURL(certificateData: CertificateData, baseUrl: string): string {
  return `${baseUrl}/certificate/${certificateData.certificateId}?print=true`;
}