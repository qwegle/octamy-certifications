import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth.tsx';
import { useLocation, useRoute } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { CreditCard, Clock, Brain, ArrowLeft, CheckCircle } from 'lucide-react';
import type { Interview } from '@shared/schema';

export default function InterviewPayment() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/interviews/:id/payment');
  const [isProcessing, setIsProcessing] = useState(false);

  const interviewId = params?.id ? parseInt(params.id) : null;

  // Fetch interview details
  const { data: interviewData, isLoading } = useQuery({
    queryKey: ['/api/interviews', interviewId],
    enabled: !!interviewId && !!user && !!token,
    queryFn: async () => {
      const response = await fetch(`/api/interviews/${interviewId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch interview');
      return response.json();
    },
  });

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/interviews/${interviewId}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: 99,
          paymentMethod: 'payumoney',
        }),
      });
      if (!response.ok) throw new Error('Payment failed');
      return response.json();
    },
    onSuccess: () => {
      setLocation(`/interviews/${interviewId}`);
    },
  });

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      // Simulate payment processing (replace with actual PayUMoney integration)
      await new Promise(resolve => setTimeout(resolve, 2000));
      processPaymentMutation.mutate();
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-black mb-4">Login Required</h2>
            <p className="text-gray-600">Please log in to continue with payment.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const interview = interviewData?.interview;
  const questions = interviewData?.questions || [];

  if (!interview) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-black mb-4">Interview Not Found</h2>
            <p className="text-gray-600">The interview you're looking for doesn't exist.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => setLocation('/ai-interviews')}
            className="mb-4 border-black text-black hover:bg-gray-100"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Interviews
          </Button>
          <h1 className="text-4xl font-bold text-black mb-2">
            Complete Payment
          </h1>
          <p className="text-xl text-gray-600">
            Secure your AI interview session
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Interview Details */}
          <Card className="border-2 border-black">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Brain className="mr-2 h-5 w-5" />
                Interview Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-black">{interview.title}</h3>
                <p className="text-gray-600">{interview.technology} Technical Interview</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-black">{questions.length}</div>
                  <div className="text-sm text-gray-600">Questions</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-black">45-60</div>
                  <div className="text-sm text-gray-600">Minutes</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-black">What you'll get:</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    AI-powered technical interview
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    Detailed performance analysis
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    SWOT analysis and feedback
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    Shareable results for recruiters
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    Video recording of your session
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card className="border-2 border-black">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-black mb-2">₹99</div>
                <div className="text-gray-600">One-time payment</div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AI Interview Session</span>
                  <span className="font-medium text-black">₹99</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Platform Fee</span>
                  <span className="font-medium text-black">₹0</span>
                </div>
                <hr className="border-gray-200" />
                <div className="flex justify-between font-semibold">
                  <span className="text-black">Total</span>
                  <span className="text-black">₹99</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center text-blue-800">
                    <Clock className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Session expires in 24 hours after payment</span>
                  </div>
                </div>

                <Button
                  onClick={handlePayment}
                  disabled={isProcessing || processPaymentMutation.isPending}
                  className="w-full bg-black text-white hover:bg-gray-800 py-3"
                  size="lg"
                >
                  {isProcessing || processPaymentMutation.isPending ? (
                    'Processing Payment...'
                  ) : (
                    'Pay ₹99 & Start Interview'
                  )}
                </Button>

                <p className="text-xs text-center text-gray-500">
                  Secure payment powered by PayUMoney. Your payment information is encrypted and secure.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}