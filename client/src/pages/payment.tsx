import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { initializeRazorpay, createRazorpayPayment } from '@/lib/razorpay';
import { apiRequest } from '@/lib/queryClient';
import Header from '@/components/header';
import { QrCode, Download, Share2, Trophy, Calendar, Award } from 'lucide-react';
import type { Certificate } from '@shared/schema';

export default function Payment() {
  const { certificateId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: certificate, refetch } = useQuery<Certificate>({
    queryKey: [`/api/certificates/${certificateId}`],
    enabled: !!certificateId,
  });

  const paymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      return apiRequest('POST', `/api/certificates/${certificateId}/payment`, paymentData);
    },
    onSuccess: async () => {
      await refetch();
      toast({
        title: "Payment Successful!",
        description: "Your certificate is now available for download.",
      });
    },
    onError: () => {
      toast({
        title: "Payment Failed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    },
  });

  const handlePayment = async () => {
    const razorpayLoaded = await initializeRazorpay();
    
    if (!razorpayLoaded) {
      toast({
        title: "Payment Error",
        description: "Payment gateway failed to load. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const options = {
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_key',
      amount: 19900, // ₹199 in paise
      currency: 'INR',
      name: 'Octamy',
      description: `Certificate for ${certificate?.courseTitle}`,
      order_id: `order_${Date.now()}`,
      handler: (response: any) => {
        paymentMutation.mutate({
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
        });
      },
      prefill: {
        name: certificate?.userName || '',
        email: certificate?.userEmail || '',
      },
      theme: {
        color: '#000000',
      },
    };

    createRazorpayPayment(options);
  };

  const handleShare = (platform: string) => {
    const url = `${window.location.origin}/certificates/${certificate?.certificateId}`;
    const text = `I just earned my ${certificate?.courseTitle} certification from Octamy! Check it out:`;
    
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
              <p>Loading certificate...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-octamy-black mb-4">
            {certificate.isPaid ? 'Your Certificate' : 'Certificate Preview'}
          </h1>
          <p className="text-xl text-octamy-gray-600">
            {certificate.isPaid 
              ? 'Download and share your verified certificate'
              : 'Remove watermark and unlock download access'
            }
          </p>
        </div>

        {/* Certificate Preview */}
        <Card className="mb-8 relative overflow-hidden">
          {!certificate.isPaid && (
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none z-10">
              <div className="text-6xl font-bold text-octamy-gray-400 transform rotate-45">
                PREVIEW
              </div>
            </div>
          )}
          
          <CardContent className="p-8 relative z-20">
            {/* Certificate Header */}
            <div className="text-center mb-8">
              <span className="text-2xl font-bold text-octamy-black mb-4 block">octamy</span>
              <h3 className="text-3xl font-bold text-octamy-black">Certificate of Completion</h3>
            </div>

            {/* Certificate Body */}
            <div className="text-center mb-8">
              <p className="text-lg text-octamy-gray-600 mb-4">This certifies that</p>
              <h4 className="text-4xl font-bold text-octamy-black mb-4">{certificate.userName}</h4>
              <p className="text-lg text-octamy-gray-600 mb-2">has successfully completed</p>
              <h5 className="text-2xl font-semibold text-octamy-black mb-6">{certificate.courseTitle}</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mb-8">
                <div className="flex flex-col items-center">
                  <Trophy className="w-8 h-8 text-octamy-black mb-2" />
                  <p className="text-sm text-octamy-gray-500">Score</p>
                  <p className="text-xl font-bold text-octamy-black">{certificate.score}%</p>
                </div>
                <div className="flex flex-col items-center">
                  <Calendar className="w-8 h-8 text-octamy-black mb-2" />
                  <p className="text-sm text-octamy-gray-500">Date Issued</p>
                  <p className="text-xl font-bold text-octamy-black">
                    {new Date(certificate.issuedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <Award className="w-8 h-8 text-octamy-black mb-2" />
                  <p className="text-sm text-octamy-gray-500">Valid Until</p>
                  <p className="text-xl font-bold text-octamy-black">
                    {new Date(certificate.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Certificate Footer */}
            <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-octamy-gray-200">
              <div className="text-center mb-4 md:mb-0">
                <p className="text-sm text-octamy-gray-500">Certificate ID</p>
                <p className="font-mono text-octamy-black">{certificate.certificateId}</p>
              </div>
              <div className="w-16 h-16 bg-octamy-gray-200 rounded flex items-center justify-center">
                <QrCode className="w-8 h-8 text-octamy-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Section */}
        {certificate.isPaid ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-octamy-black">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Verified Certificate
                  </Badge>
                </div>
                Your certificate is ready!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-octamy-black text-white hover:bg-octamy-gray-800">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/certificates/${certificate.certificateId}`)}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-octamy-gray-600 mb-4">Share on social media:</p>
                <div className="flex justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('linkedin')}
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    LinkedIn
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('twitter')}
                    className="text-blue-400 border-blue-400 hover:bg-blue-50"
                  >
                    Twitter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare('whatsapp')}
                    className="text-green-600 border-green-600 hover:bg-green-50"
                  >
                    WhatsApp
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-octamy-black">
                Unlock Your Certificate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-center text-octamy-gray-600">
                Remove watermark and get download access for ₹199
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={handlePayment}
                  disabled={paymentMutation.isPending}
                  className="bg-octamy-black text-white hover:bg-octamy-gray-800"
                >
                  {paymentMutation.isPending ? 'Processing...' : 'Pay ₹199 & Download'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation('/dashboard')}
                  className="border-octamy-gray-300 text-octamy-black hover:bg-octamy-gray-50"
                >
                  Continue as Guest
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
