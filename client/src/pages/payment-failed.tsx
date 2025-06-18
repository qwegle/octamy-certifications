import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, Home, RefreshCw, MessageCircle } from 'lucide-react';

export default function PaymentFailed() {
  const [, setLocation] = useLocation();
  const [transactionId, setTransactionId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [certificateId, setCertificateId] = useState<string>('');
  const [courseId, setCourseId] = useState<string>('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const txnid = urlParams.get('txnid');
    const error = urlParams.get('error');
    const certId = urlParams.get('certificateId');
    const course = urlParams.get('courseId');
    
    if (txnid) setTransactionId(txnid);
    if (certId) setCertificateId(certId);
    if (course) setCourseId(course);
    
    if (error) {
      switch (error) {
        case 'hash_verification_failed':
          setErrorMessage('Security verification failed. Please try again.');
          break;
        case 'processing_error':
          setErrorMessage('Payment processing error. Please try again.');
          break;
        case 'payment_failed':
          setErrorMessage('Payment was declined. Please check your payment details.');
          break;
        case 'exam_data_expired':
          setErrorMessage('Your exam session has expired. Please retake the exam.');
          break;
        default:
          setErrorMessage('Payment failed. Please try again.');
      }
    } else {
      setErrorMessage('Payment failed. Please try again.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-600 dark:text-red-400">
            Payment Failed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {errorMessage}
            </p>
            {transactionId && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Transaction ID: <span className="font-mono">{transactionId}</span>
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => {
                if (certificateId) {
                  setLocation(`/payment/${certificateId}`);
                } else if (courseId) {
                  setLocation(`/checkout/${courseId}`);
                } else {
                  setLocation('/courses');
                }
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation('/contact')}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
            
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setLocation('/')}
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300 text-center">
              Don't worry! No charges have been made to your account. 
              You can try the payment again or contact our support team for assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}