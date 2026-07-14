import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer, Share2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      // Default download behavior
      const link = document.createElement('a');
      link.href = `/api/certificates/${encodeURIComponent(certificateId)}/download?format=pdf`;
      link.download = `certificate-${certificateId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const copyShareUrl = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Verification link copied', description: 'Anyone with the link can inspect the credential’s live status.' });
    } catch (error) {
      console.error('Credential link copy failed:', error);
      toast({ title: 'Link could not be copied', description: 'Open the credential record and copy the address from your browser.', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/verify/${encodeURIComponent(certificateId)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${courseTitle} assessment credential`,
          text: `Inspect ${userName}'s recorded assessment result and the credential's current status.`,
          url: shareUrl,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Credential share failed:', error);
        await copyShareUrl(shareUrl);
      }
    } else {
      await copyShareUrl(shareUrl);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Button
        onClick={handleDownload}
        disabled={isDownloading}
        className="bg-octamy-black text-white hover:bg-octamy-gray-800"
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
        className="border-octamy-black text-octamy-black hover:bg-octamy-gray-50"
      >
        <Printer className="w-4 h-4 mr-2" />
        Print Certificate
      </Button>
      
      <Button
        variant="outline"
        onClick={handleShare}
        className="border-octamy-gray-300 text-octamy-gray-700 hover:bg-octamy-gray-200"
      >
        <Share2 className="w-4 h-4 mr-2" />
        Share verification
      </Button>
    </div>
  );
}
