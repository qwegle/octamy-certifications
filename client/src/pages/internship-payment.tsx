import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { initializeRazorpay, createRazorpayPayment } from '@/lib/razorpay';
import { apiRequest } from '@/lib/queryClient';
import Header from '@/components/header';
import InternshipForm from '@/components/internship-form';
import { QrCode, Download, Share2, Trophy, Calendar, Award, CheckCircle } from 'lucide-react';
import type { Certificate } from '@shared/schema';

export default function InternshipPayment() {
  const { certificateId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<'payment' | 'form' | 'completed'>('payment');

  const { data: certificate, refetch } = useQuery<Certificate>({
    queryKey: [`/api/certificates/${certificateId}`],
    enabled: !!certificateId,
  });

  const paymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await fetch(`/api/certificates/${certificateId}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });
      
      if (!response.ok) {
        throw new Error('Payment failed');
      }
      
      return response.json();
    },
    onSuccess: async () => {
      await refetch();
      setStep('form');
      toast({
        title: "Payment Successful!",
        description: "Please fill in your internship details to complete the process.",
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

    try {
      const orderResponse = await fetch(`/api/certificates/${certificateId}/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }
      
      const orderData = await orderResponse.json();

      const options = {
        key: 'rzp_test_9Qg8QVTFCJp9dF', // This should come from environment
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Octamy',
        description: `Virtual Internship Certificate - ${certificate?.courseTitle}`,
        order_id: orderData.id,
        handler: (response: any) => {
          paymentMutation.mutate({
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          });
        },
        prefill: {
          name: certificate?.userName || '',
          email: certificate?.userEmail || '',
        },
        theme: {
          color: '#111111',
        },
      };

      createRazorpayPayment(options);
    } catch (error) {
      toast({
        title: "Payment Error",
        description: "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    setStep('completed');
    toast({
      title: "Application Complete!",
      description: "Your virtual internship certificate is ready.",
    });
  };

  if (!certificate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Certificate not found</h1>
            <Button onClick={() => setLocation('/')}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (certificate.isPaid && step === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-4xl mx-auto">
            <CardHeader className="text-center bg-slate-50 dark:bg-slate-900">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-slate-600 dark:text-slate-300" />
              </div>
              <CardTitle className="text-2xl text-slate-800 dark:text-slate-200">
                Virtual Internship Certificate Ready!
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  Congratulations! Your virtual internship certificate has been generated and is ready for download.
                </p>
                
                <div className="bg-cream-deep dark:bg-gray-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Certificate Details</h3>
                  <div className="space-y-2 text-left">
                    <p><strong>Course:</strong> {certificate.courseTitle}</p>
                    <p><strong>Recipient:</strong> {certificate.userName}</p>
                    <p><strong>Score:</strong> {certificate.score}%</p>
                    <p><strong>Issue Date:</strong> {new Date(certificate.issuedAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
                  <Button onClick={() => setLocation(`/certificate/${certificate.certificateId}`)}>
                    <Download className="w-4 h-4 mr-2" />
                    View Certificate
                  </Button>
                  <Button variant="outline" onClick={() => setLocation('/dashboard')}>
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {step === 'payment' && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <Badge variant="secondary" className="w-fit mx-auto mb-4">Virtual Internship</Badge>
              <CardTitle className="text-2xl">Complete Your Payment</CardTitle>
              <p className="text-gray-600 dark:text-gray-300">
                Secure payment for your virtual internship certificate
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">
                  What happens after payment?
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-700 dark:text-slate-300">
                  <li>Payment confirmation</li>
                  <li>Fill internship details form</li>
                  <li>Customize duration and dates</li>
                  <li>Receive your certificate instantly</li>
                </ol>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-slate-600 mb-2">₹299</div>
                <p className="text-gray-600 dark:text-gray-300">One-time payment</p>
              </div>

              <Button 
                onClick={handlePayment}
                disabled={paymentMutation.isPending}
                className="w-full bg-slate-600 hover:bg-slate-700"
                size="lg"
              >
                {paymentMutation.isPending ? 'Processing...' : 'Pay Now'}
              </Button>

              <p className="text-center text-sm text-gray-500">
                Secure payment powered by Razorpay
              </p>
            </CardContent>
          </Card>
        )}

        {step === 'form' && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Payment Successful!
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Now customize your virtual internship certificate details
              </p>
            </div>
            <InternshipForm 
              certificateId={parseInt(certificateId!)} 
              onSuccess={handleFormSuccess}
            />
          </div>
        )}
      </div>
    </div>
  );
}
