import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, CreditCard, ArrowRight } from 'lucide-react';
import RecruiterLayout from '../components/RecruiterLayout';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import { apiRequest } from '@/lib/queryClient';

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const { recruiter } = useRecruiterAuth();
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const txnid = urlParams.get('txnid');
    const amount = urlParams.get('amount');
    const credits = urlParams.get('credits');

    if (txnid && amount && credits) {
      setPaymentDetails({
        transactionId: txnid,
        amount: parseFloat(amount),
        credits: parseInt(credits)
      });
      
      // Process the credit addition
      processCreditAddition(parseInt(credits), txnid);
    }
  }, []);

  const processCreditAddition = async (credits: number, paymentId: string) => {
    try {
      const response = await apiRequest('POST', '/api/recruiter/purchase-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: credits,
          paymentId: paymentId
        })
      });

      if (response.ok) {
        setProcessing(false);
      }
    } catch (error) {
      console.error('Error processing credit addition:', error);
      setProcessing(false);
    }
  };

  if (processing) {
    return (
      <RecruiterLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Processing your payment...</p>
          </div>
        </div>
      </RecruiterLayout>
    );
  }

  return (
    <RecruiterLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600">Your credits have been added to your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Payment Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Transaction ID</span>
              <span className="font-mono text-sm">{paymentDetails?.transactionId}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Amount Paid</span>
              <span className="font-semibold">₹{paymentDetails?.amount}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Credits Added</span>
              <span className="font-semibold text-green-600">{paymentDetails?.credits} credits</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Status</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                Completed
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex space-x-4">
          <Button 
            onClick={() => setLocation('/recruiter/wallet')} 
            className="flex-1"
          >
            View Wallet
          </Button>
          <Button 
            onClick={() => setLocation('/recruiter/search')} 
            variant="outline" 
            className="flex-1"
          >
            Start Searching
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </RecruiterLayout>
  );
}