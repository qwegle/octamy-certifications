import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import RecruiterLayout from '../components/RecruiterLayout';

export default function PaymentFailed() {
  const [, setLocation] = useLocation();
  const [transactionId, setTransactionId] = useState<string>('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const txnid = urlParams.get('txnid');
    if (txnid) {
      setTransactionId(txnid);
    }
  }, []);

  return (
    <RecruiterLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Failed</h1>
          <p className="text-gray-600">There was an issue processing your payment</p>
        </div>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>Payment Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {transactionId && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Transaction ID</span>
                <span className="font-mono text-sm">{transactionId}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Status</span>
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                Failed
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-800 mb-2">Common Issues:</h3>
              <ul className="text-sm text-slate-700 space-y-1">
                <li>• Insufficient funds in your account</li>
                <li>• Card verification failed</li>
                <li>• Bank declined the transaction</li>
                <li>• Network connectivity issues</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="flex space-x-4">
          <Button 
            onClick={() => setLocation('/recruiter/wallet')} 
            className="flex-1"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button 
            onClick={() => setLocation('/recruiter/dashboard')} 
            variant="outline" 
            className="flex-1"
          >
            Back to Dashboard
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Need Help?</h3>
            <p className="text-sm text-gray-600 mb-3">
              If you continue to experience issues with payments, please contact our support team.
            </p>
            <Button variant="outline" size="sm">
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </RecruiterLayout>
  );
}