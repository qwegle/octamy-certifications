import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function PaymentFailed() {
  const [location] = useLocation();
  const [transactionId, setTransactionId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1]);
    const txnid = urlParams.get('txnid');
    const error = urlParams.get('error');
    
    if (txnid) setTransactionId(txnid);
    if (error) {
      switch(error) {
        case 'hash_verification_failed':
          setErrorMessage('Payment verification failed. Please contact support.');
          break;
        case 'processing_error':
          setErrorMessage('Payment processing error. Please try again.');
          break;
        default:
          setErrorMessage(decodeURIComponent(error));
      }
    } else {
      setErrorMessage('Payment was unsuccessful. Please try again.');
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-2 border-red-500">
        <CardHeader className="text-center bg-red-500 text-white">
          <div className="mx-auto mb-4">
            <XCircle className="h-16 w-16" />
          </div>
          <CardTitle className="text-2xl font-bold">Payment Failed</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <p className="text-gray-600 mb-6">
            {errorMessage || "Your payment could not be processed. Please try again or contact support if the issue persists."}
          </p>
          
          {transactionId && (
            <div className="bg-gray-100 p-3 rounded mb-6">
              <p className="text-sm text-gray-600">Transaction ID:</p>
              <p className="font-mono font-bold text-black">{transactionId}</p>
            </div>
          )}

          <div className="space-y-3">
            <Button 
              onClick={() => window.history.back()} 
              className="w-full bg-black text-white hover:bg-gray-800"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            
            <Link href="/">
              <Button variant="outline" className="w-full border-2 border-black">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Courses
              </Button>
            </Link>
          </div>

          <p className="text-xs text-gray-500 mt-6">
            If you continue to experience issues, please contact our support team.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}