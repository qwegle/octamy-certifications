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

        {/* Premium Certificate Display - Updated Design */}
        <div className="relative mb-8">
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none z-20">
              <div className="text-6xl font-bold text-red-400 transform rotate-45">
                {!certificate.isPaid ? 'UNPAID' : isExpired ? 'EXPIRED' : 'INVALID'}
              </div>
            </div>
          )}
          
          <div className="relative overflow-hidden">
            <style jsx>{`
              @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700;800&display=swap');
            `}</style>
            
            <div 
              className="w-full h-auto relative bg-gradient-to-br from-white via-gray-50 to-white"
              style={{ 
                aspectRatio: '1.414/1',
                background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                border: '8px solid #000',
                borderRadius: '16px',
                boxShadow: '0 40px 80px rgba(0,0,0,0.4)'
              }}
            >
              {/* Decorative borders */}
              <div 
                className="absolute inset-4"
                style={{
                  background: `
                    radial-gradient(circle at 0% 0%, #c0c0c0 2px, transparent 2px),
                    radial-gradient(circle at 100% 0%, #c0c0c0 2px, transparent 2px),
                    radial-gradient(circle at 0% 100%, #c0c0c0 2px, transparent 2px),
                    radial-gradient(circle at 100% 100%, #c0c0c0 2px, transparent 2px)
                  `,
                  backgroundSize: '40px 40px',
                  backgroundPosition: 'top left, top right, bottom left, bottom right',
                  backgroundRepeat: 'no-repeat'
                }}
              ></div>
              
              {/* Decorative corners */}
              <div className="absolute top-8 left-8 w-28 h-28" style={{ 
                background: `
                  linear-gradient(45deg, #c0c0c0 1px, transparent 1px 20px, transparent),
                  linear-gradient(-45deg, #c0c0c0 1px, transparent 1px 20px, transparent)
                `,
                clipPath: 'polygon(0 0, 100% 0, 0 100%)'
              }}></div>
              <div className="absolute top-8 right-8 w-28 h-28" style={{ 
                background: `
                  linear-gradient(135deg, #c0c0c0 1px, transparent 1px 20px, transparent),
                  linear-gradient(45deg, #c0c0c0 1px, transparent 1px 20px, transparent)
                `,
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
              }}></div>
              <div className="absolute bottom-8 left-8 w-28 h-28" style={{ 
                background: `
                  linear-gradient(-45deg, #c0c0c0 1px, transparent 1px 20px, transparent),
                  linear-gradient(-135deg, #c0c0c0 1px, transparent 1px 20px, transparent)
                `,
                clipPath: 'polygon(0 0, 100% 100%, 0 100%)'
              }}></div>
              <div className="absolute bottom-8 right-8 w-28 h-28" style={{ 
                background: `
                  linear-gradient(45deg, #c0c0c0 1px, transparent 1px 20px, transparent),
                  linear-gradient(135deg, #c0c0c0 1px, transparent 1px 20px, transparent)
                `,
                clipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
              }}></div>
              
              <div className="relative z-10 p-20 text-center h-full flex flex-col justify-center">
                {/* Header */}
                <div className="mb-16 relative">
                  <div 
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 w-72 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, #c0c0c0, transparent)' }}
                  ></div>
                  <div 
                    className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 w-48 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, #c0c0c0, transparent)' }}
                  ></div>
                  
                  <div className="inline-block bg-gradient-to-r from-black via-gray-800 to-black text-white px-11 py-6 mb-6 relative"
                       style={{ clipPath: 'polygon(10% 0%, 90% 0%, 100% 25%, 100% 75%, 90% 100%, 10% 100%, 0% 75%, 0% 25%)' }}>
                    <div 
                      className="text-5xl font-bold uppercase tracking-widest"
                      style={{ 
                        fontFamily: "'Cormorant Garamond', serif",
                        letterSpacing: '8px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      OCTAMY
                    </div>
                  </div>
                  
                  <div 
                    className="company-tagline text-sm font-medium uppercase tracking-widest mb-4"
                    style={{ 
                      fontSize: '12px',
                      color: '#000000',
                      marginBottom: '5px',
                      fontFamily: "'Poppins', sans-serif",
                      letterSpacing: '4px'
                    }}
                  >
                    Solutions Private Limited
                  </div>
                  
                  <div 
                    className="text-xs tracking-wide"
                    style={{ 
                      fontSize: '10px',
                      color: '#000',
                      fontStyle: 'italic',
                      fontFamily: "'Poppins', sans-serif",
                      letterSpacing: '1px'
                    }}
                  >
                    Authorized Certification Body
                  </div>
                </div>
                
                {/* Title */}
                <div className="mb-16 relative">
                  <h1 
                    className="text-8xl font-semibold text-gray-900 uppercase mb-5 relative"
                    style={{ 
                      fontFamily: "'Cormorant Garamond', serif",
                      letterSpacing: '16px',
                      textShadow: '0 4px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div 
                      className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-20 h-1"
                      style={{ background: 'linear-gradient(90deg, #d4af37, #f4e09d, #d4af37)' }}
                    ></div>
                    Certificate of Completion
                    <div 
                      className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-28 h-0.5"
                      style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }}
                    ></div>
                  </h1>
                </div>
                
                {/* Content */}
                <div className="mb-12">
                  <p 
                    className="text-2xl text-gray-700 mb-10 italic tracking-wide"
                    style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '1px' }}
                  >
                    This is to certify that
                  </p>
                  
                  <div 
                    className="recipient-name my-12 py-8 relative"
                    style={{ 
                      fontSize: '28px',
                      fontWeight: '600',
                      color: '#1f2138',
                      fontFamily: "'Poppins', serif",
                      position: 'relative',
                      padding: '10px 0'
                    }}
                  >
                    <div 
                      className="absolute top-0 left-1/2 transform -translate-x-1/2 w-96 h-px"
                      style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }}
                    ></div>
                    {certificate.userName}
                    <div 
                      className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-96 h-px"
                      style={{ background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }}
                    ></div>
                  </div>
                  
                  <p 
                    className="completion-text my-10"
                    style={{ 
                      fontSize: '14px',
                      color: '#666',
                      margin: '15px 0',
                      lineHeight: '1.6',
                      fontFamily: "'Poppins', serif"
                    }}
                  >
                    has successfully demonstrated mastery and completed the comprehensive<br />
                    professional certification program
                  </p>
                  
                  <div 
                    className="course-name my-10"
                    style={{ 
                      fontSize: '20px',
                      fontWeight: '600',
                      color: '#1f2138',
                      margin: '15px 0',
                      padding: '12px 25px',
                      border: '2px solid #000000',
                      borderRadius: '6px',
                      background: 'linear-gradient(141deg, rgba(192, 192, 192, 0.1) 0%, rgba(192, 192, 192, 0.05) 100%)',
                      fontFamily: "'Poppins', serif",
                      textTransform: 'uppercase',
                      letterSpacing: '2px'
                    }}
                  >
                    {certificate.courseTitle}
                  </div>
                  
                  <div className="flex justify-center items-center gap-10 my-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 via-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                      <Award className="w-10 h-10 text-gray-900" />
                    </div>
                    <div 
                      className="bg-gradient-to-br from-yellow-500 via-yellow-400 to-yellow-500 text-gray-900 px-11 py-6 text-2xl font-bold tracking-widest rounded shadow-lg"
                      style={{ 
                        fontFamily: "'Cormorant Garamond', serif",
                        letterSpacing: '3px',
                        boxShadow: '0 6px 12px rgba(212,175,55,0.3)'
                      }}
                    >
                      ACHIEVEMENT SCORE: {certificate.score}%
                    </div>
                  </div>
                </div>
                
                {/* Details */}
                <div 
                  className="flex justify-between mt-16 pt-10 border-t border-b border-yellow-500 bg-gradient-to-r from-transparent via-yellow-50 to-transparent"
                  style={{ borderColor: '#d4af37' }}
                >
                  <div className="text-center flex-1">
                    <div 
                      className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold"
                      style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}
                    >
                      Certificate Number
                    </div>
                    <div 
                      className="text-lg font-semibold text-gray-700 tracking-wide"
                      style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '1px' }}
                    >
                      {certificate.certificateNumber}
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div 
                      className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold"
                      style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}
                    >
                      Date of Issue
                    </div>
                    <div 
                      className="text-lg font-semibold text-gray-700 tracking-wide"
                      style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '1px' }}
                    >
                      {new Date(certificate.issuedAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div 
                      className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold"
                      style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '2px' }}
                    >
                      Validity
                    </div>
                    <div 
                      className="text-lg font-semibold text-gray-700 tracking-wide"
                      style={{ fontFamily: "'Crimson Text', serif", letterSpacing: '1px' }}
                    >
                      Lifetime
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="footer-section absolute bottom-12 flex justify-between w-full px-20" style={{ marginBottom: '70px' }}>
                <div className="text-left">
                  {/* Signature Image */}
                  <img 
                    src="/attached_assets/Nitikesh_signature_1750177747117.png" 
                    alt="Nitikesh Pattanayak Signature" 
                    className="mb-2 h-12 w-auto"
                    style={{ height: '48px', width: 'auto', marginBottom: '8px' }}
                  />
                  <div 
                    className="w-60 h-px mb-3 relative signature-line"
                    style={{ background: 'linear-gradient(90deg, #d4af37, transparent)' }}
                  >
                    <div 
                      className="absolute left-0 -top-0.5 w-14 h-1"
                      style={{ background: '#d4af37' }}
                    ></div>
                  </div>
                  <div 
                    className="signature-name"
                    style={{ 
                      fontSize: '14px',
                      color: '#000',
                      fontWeight: '600',
                      marginTop: '3px',
                      fontFamily: "'Poppins', serif"
                    }}
                  >
                    Nitikesh Pattanayak
                  </div>
                  <div 
                    className="company-tagline"
                    style={{ 
                      fontSize: '12px',
                      color: '#1f2138',
                      marginBottom: '5px',
                      fontFamily: "'Poppins', sans-serif"
                    }}
                  >
                    Director of Certification
                  </div>
                </div>
                
                <div className="text-right certificate-details">
                  <div 
                    className="w-20 h-20 bg-gradient-to-br from-yellow-500 via-yellow-400 to-yellow-500 border-2 border-gray-900 rounded-full mb-4 flex items-center justify-center relative shadow-lg mx-auto"
                    style={{ boxShadow: '0 4px 8px rgba(212,175,55,0.3)' }}
                  >
                    <div 
                      className="badge-text"
                      style={{
                        position: 'absolute',
                        top: '68%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#fff',
                        textAlign: 'center',
                        zIndex: '10',
                        fontFamily: "'Inter', sans-serif"
                      }}
                    >
                      VERIFIED
                    </div>
                  </div>
                  <div 
                    className="expiry-info"
                    style={{ 
                      fontSize: '11px',
                      color: '#666',
                      fontFamily: "'Poppins', sans-serif",
                      textAlign: 'left'
                    }}
                  >
                    Digital Verification<br />
                    verify.octamy.com
                  </div>
                </div>
                
                {/* Certification Logos */}
                <div className="certification-logos flex justify-center items-center gap-8 mt-10 pt-6 border-t-2 border-yellow-500">
                  <img 
                    src="https://images.seeklogo.com/logo-png/55/2/iso-certified-company-stamp-logo-png_seeklogo-556487.png" 
                    alt="ISO Certified" 
                    style={{ 
                      height: '55px',
                      width: 'auto',
                      objectFit: 'contain'
                    }} 
                  />
                  <img 
                    src="https://static.vecteezy.com/system/resources/previews/019/909/405/non_2x/make-in-india-transparent-make-in-india-free-free-png.png" 
                    alt="Make in India" 
                    style={{ 
                      height: '55px',
                      width: 'auto',
                      objectFit: 'contain'
                    }} 
                  />
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
