import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { QrCode, Download, Share2, Trophy, Calendar, Award, CheckCircle, XCircle } from 'lucide-react';
import type { Certificate } from '@shared/schema';

export default function CertificateView() {
  const { certificateId } = useParams();

  const { data: certificate } = useQuery<Certificate>({
    queryKey: [`/api/certificates/${certificateId}`],
    enabled: !!certificateId,
  });

  const handleDownload = async () => {
    if (!certificate?.isPaid) {
      alert('Certificate payment is required before download');
      return;
    }

    try {
      // Open certificate in new tab for printing/saving as PDF
      const downloadUrl = `/api/certificates/${certificateId}/download`;
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to open certificate. Please try again.');
    }
  };

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const text = `Check out my ${certificate?.courseTitle} certification from Octamy!`;
    
    let shareUrl = '';
    switch (platform) {
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(url).then(() => {
          alert('Certificate link copied to clipboard!');
        });
        return;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  if (!certificate) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="text-center py-12">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-octamy-black mb-2">Certificate Not Found</h2>
              <p className="text-octamy-gray-600">
                The certificate you're looking for doesn't exist or has been removed.
              </p>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const isExpired = new Date(certificate.expiresAt) < new Date();
  const isActive = certificate.isActive && certificate.isPaid && !isExpired;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            {isActive ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-4 h-4 mr-1" />
                Verified Certificate
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="w-4 h-4 mr-1" />
                {!certificate.isPaid ? 'Unpaid' : isExpired ? 'Expired' : 'Invalid'}
              </Badge>
            )}
          </div>
          <h1 className="text-4xl font-bold text-octamy-black mb-4">
            Professional Certificate
          </h1>
          <p className="text-xl text-octamy-gray-600">
            Issued by Octamy Certification Platform
          </p>
        </div>

        {/* Premium Certificate Display */}
        <div className="relative mb-8">
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none z-10">
              <div className="text-6xl font-bold text-red-400 transform rotate-45">
                {!certificate.isPaid ? 'UNPAID' : isExpired ? 'EXPIRED' : 'INVALID'}
              </div>
            </div>
          )}
          
          <div className="relative overflow-hidden">
            <style jsx>{`
              @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600;700;800&display=swap');
            `}</style>
            
            <div className="w-full h-auto bg-white border-8 border-black relative" style={{ aspectRatio: '1200/850' }}>
              {/* Ornate corners */}
              <div className="absolute top-6 left-6 w-16 h-16 border-2 border-black" style={{ borderRight: 'none', borderBottom: 'none' }}></div>
              <div className="absolute top-6 right-6 w-16 h-16 border-2 border-black" style={{ borderLeft: 'none', borderBottom: 'none' }}></div>
              <div className="absolute bottom-6 left-6 w-16 h-16 border-2 border-black" style={{ borderRight: 'none', borderTop: 'none' }}></div>
              <div className="absolute bottom-6 right-6 w-16 h-16 border-2 border-black" style={{ borderLeft: 'none', borderTop: 'none' }}></div>
              
              <div className="relative z-10 p-12 text-center h-full flex flex-col justify-center">
                <div className="mb-8">
                  <div className="flex items-center justify-center mb-6">
                    <div 
                      className="font-black text-black uppercase border-2 border-black px-6 py-3 bg-white shadow-md text-3xl"
                      style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '4px', boxShadow: '4px 4px 0 black' }}
                    >
                      OCTAMY
                    </div>
                  </div>
                  <div 
                    className="font-bold text-black uppercase text-sm border-t-2 border-black pt-2"
                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}
                  >
                    SOLUTIONS PRIVATE LIMITED
                  </div>
                  
                  <h1 
                    className="font-black text-black mb-3 uppercase text-5xl"
                    style={{ 
                      fontFamily: "'Playfair Display', serif", 
                      letterSpacing: '8px',
                      textShadow: '2px 2px 0 white, 4px 4px 0 rgba(0,0,0,0.1)'
                    }}
                  >
                    CERTIFICATE
                  </h1>
                  <p 
                    className="text-gray-700 mb-10 text-xl italic"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    of Professional Achievement
                  </p>
                </div>
                
                <div 
                  className="font-medium text-black mb-6 uppercase text-sm"
                  style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '1.5px' }}
                >
                  This is to certify that
                </div>
                
                <div 
                  className="font-bold text-black my-8 py-4 border-t-4 border-b-4 border-black uppercase text-4xl"
                  style={{ 
                    fontFamily: "'Playfair Display', serif", 
                    letterSpacing: '3px',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.02) 50%, transparent 100%)'
                  }}
                >
                  {certificate.userName}
                </div>
                
                <div 
                  className="text-gray-700 my-6 text-base"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  has successfully completed the professional certification course
                </div>
                
                <div 
                  className="font-bold text-black my-6 uppercase text-2xl p-4 border-2 border-black bg-white"
                  style={{ 
                    fontFamily: "'Playfair Display', serif", 
                    letterSpacing: '2px',
                    boxShadow: '0 3px 0 black'
                  }}
                >
                  {certificate.courseTitle}
                </div>
                
                <div className="flex justify-center items-center my-8 gap-6">
                  <div 
                    className="bg-white text-black border-2 border-black px-4 py-3 font-bold uppercase text-sm"
                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '1px' }}
                  >
                    {certificate.badge.toUpperCase()} LEVEL
                  </div>
                  <div 
                    className="bg-black text-white px-6 py-4 font-extrabold uppercase text-sm border-4 border-black"
                    style={{ 
                      fontFamily: "'Inter', sans-serif", 
                      letterSpacing: '1.5px',
                      boxShadow: '0 3px 0 #333'
                    }}
                  >
                    SCORE: {certificate.score}%
                  </div>
                </div>
                
                <div className="flex justify-between mt-10 pt-6 border-t-2 border-b-2 border-black">
                  <div className="text-center flex-1">
                    <div 
                      className="text-gray-600 mb-2 text-xs uppercase font-semibold"
                      style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '1.5px' }}
                    >
                      Certificate No.
                    </div>
                    <div 
                      className="font-bold text-black text-sm uppercase"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      {certificate.certificateNumber}
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div 
                      className="text-gray-600 mb-2 text-xs uppercase font-semibold"
                      style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '1.5px' }}
                    >
                      Issue Date
                    </div>
                    <div 
                      className="font-bold text-black text-sm uppercase"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      {new Date(certificate.issuedAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div 
                      className="text-gray-600 mb-2 text-xs uppercase font-semibold"
                      style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '1.5px' }}
                    >
                      Valid Until
                    </div>
                    <div 
                      className="font-bold text-black text-sm uppercase"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      {new Date(certificate.expiresAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="absolute bottom-8 flex justify-between w-full px-12">
                <div className="text-left">
                  <div className="w-32 h-1 bg-black mb-2"></div>
                  <div 
                    className="text-gray-700 text-xs uppercase font-semibold"
                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '1px' }}
                  >
                    Authorized Signature
                  </div>
                  <div 
                    className="text-black text-sm font-semibold mt-1"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Director, Octamy Solutions
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="w-16 h-16 bg-black border-2 border-gray-800 mb-2 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                      QR
                    </div>
                  </div>
                  <div 
                    className="text-gray-600 text-xs uppercase font-semibold"
                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '1px' }}
                  >
                    Verify Authenticity
                  </div>
                  <div 
                    className="text-black text-xs font-semibold mt-1"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    octamy.com/verify
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Certificate Details */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-octamy-black mb-4">Certificate Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-octamy-gray-700">Recipient:</span>
                <span className="ml-2">{certificate.userName}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Email:</span>
                <span className="ml-2">{certificate.userEmail}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Course:</span>
                <span className="ml-2">{certificate.courseTitle}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Score:</span>
                <span className="ml-2">{certificate.score}%</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Issue Date:</span>
                <span className="ml-2">{new Date(certificate.issuedAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Expiry Date:</span>
                <span className="ml-2">{new Date(certificate.expiresAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="font-medium text-octamy-gray-700">Status:</span>
                <span className={`ml-2 ${isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {isActive ? 'Valid' : (!certificate.isPaid ? 'Unpaid' : isExpired ? 'Expired' : 'Invalid')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Download & Share Section */}
        {isActive && (
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-xl font-bold text-octamy-black mb-4">Download & Share</h3>
              
              {/* Download Button */}
              <div className="mb-6">
                <Button
                  onClick={handleDownload}
                  className="bg-octamy-black text-white hover:bg-octamy-gray-800 px-8 py-3 text-lg"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download PDF Certificate
                </Button>
                <p className="text-sm text-octamy-gray-600 mt-2">
                  Get your professional certificate as a high-quality PDF
                </p>
              </div>

              {/* Share Options */}
              <h4 className="text-lg font-semibold text-octamy-black mb-3">Share This Certificate</h4>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => handleShare('copy')}
                  className="border-octamy-gray-300 text-octamy-black hover:bg-octamy-gray-50"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShare('linkedin')}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  Share on LinkedIn
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShare('twitter')}
                  className="text-blue-400 border-blue-400 hover:bg-blue-50"
                >
                  Share on Twitter
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShare('whatsapp')}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  Share on WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Required Section */}
        {!certificate.isPaid && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-6 text-center">
              <h3 className="text-xl font-bold text-orange-800 mb-2">Payment Required</h3>
              <p className="text-orange-700 mb-4">
                Complete your payment to download and share your certificate
              </p>
              <Button 
                onClick={() => window.location.href = `/payment/${certificate.id}`}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                Pay ₹99 & Download Certificate
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <Footer />
    </div>
  );
}
