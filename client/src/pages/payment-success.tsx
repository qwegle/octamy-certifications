import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, ArrowRight } from "lucide-react";

export default function PaymentSuccess() {
  const [location] = useLocation();
  const [transactionId, setTransactionId] = useState<string>("");

  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1]);
    const txnid = urlParams.get('txnid');
    if (txnid) {
      setTransactionId(txnid);
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-2 border-green-500">
        <CardHeader className="text-center bg-green-500 text-white">
          <div className="mx-auto mb-4">
            <CheckCircle className="h-16 w-16" />
          </div>
          <CardTitle className="text-2xl font-bold">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <p className="text-gray-600 mb-6">
            Your payment has been processed successfully. You can now access your course and take the certification exam.
          </p>
          
          {transactionId && (
            <div className="bg-gray-100 p-3 rounded mb-6">
              <p className="text-sm text-gray-600">Transaction ID:</p>
              <p className="font-mono font-bold text-black">{transactionId}</p>
            </div>
          )}

          <div className="space-y-3">
            <Link href="/dashboard">
              <Button className="w-full bg-black text-white hover:bg-gray-800">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            
            <Link href="/">
              <Button variant="outline" className="w-full border-2 border-black">
                Browse More Courses
              </Button>
            </Link>
          </div>

          <p className="text-xs text-gray-500 mt-6">
            You will receive a confirmation email shortly with your purchase details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}