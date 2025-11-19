import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer, Share2, Loader2 } from 'lucide-react';

interface CertificateActionsProps {
  certificateId: string;
  userName: string;
  courseTitle: string;
  isDownloading?: boolean;
  onDownload?: () => void;
}

export function CertificateActions({ 
  certificateId, 
  userName, 
  courseTitle, 
  isDownloading = false,
  onDownload 
}: CertificateActionsProps) {
  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      // Default download behavior
      const link = document.createElement('a');
      link.href = `/api/certificates/${certificateId}/download`;
      link.download = `certificate-${certificateId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/certificate/${certificateId}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Professional Certificate - ${userName}`,
        text: `Certificate of completion for ${courseTitle}`,
        url: shareUrl
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Shareable link copied to clipboard!');
      }).catch(() => {
        // Fallback if clipboard access fails
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Shareable link copied to clipboard!');
      });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Button
        onClick={handleDownload}
        disabled={isDownloading}
        className="bg-premcq-black text-white hover:bg-premcq-gray-800"
      >
        {isDownloading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating PDF...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </>
        )}
      </Button>
      
      <Button
        variant="outline"
        onClick={handlePrint}
        className="border-premcq-black text-premcq-black hover:bg-premcq-gray-50"
      >
        <Printer className="w-4 h-4 mr-2" />
        Print Certificate
      </Button>
      
      <Button
        variant="outline"
        onClick={handleShare}
        className="border-premcq-gray-300 text-premcq-gray-700 hover:bg-premcq-gray-200"
      >
        <Share2 className="w-4 h-4 mr-2" />
        Share Certificate
      </Button>
    </div>
  );
}