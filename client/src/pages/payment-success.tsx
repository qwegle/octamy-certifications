import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Home, User } from 'lucide-react';
import { useAuth } from '@/lib/auth.tsx';

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [transactionId, setTransactionId] = useState<string>('');
  const [certificateId, setCertificateId] = useState<string>('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const txnid = urlParams.get('txnid');
    const certId = urlParams.get('certificateId');
    
    if (txnid) setTransactionId(txnid);
    if (certId) setCertificateId(certId);
  }, []);

  return (
    <div className="min-h-screen bg-cream-deep dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400">
            Payment Successful!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Your payment has been processed successfully. Your certificate is now available for download.
            </p>
            {transactionId && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Transaction ID: <span className="font-mono">{transactionId}</span>
              </p>
            )}
          </div>

          <div className="space-y-3">
            {user ? (
              <>
                <Button
                  className="w-full"
                  onClick={() => setLocation('/dashboard')}
                >
                  <User className="w-4 h-4 mr-2" />
                  View My Certificates
                </Button>
                {certificateId && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(`/api/certificates/${certificateId}/download`, '_blank')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Certificate
                  </Button>
                )}
              </>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  Please check your email for the certificate download link.
                </p>
                {certificateId && (
                  <Button
                    variant="outline"
                    className="w-full mb-3"
                    onClick={() => window.open(`/api/certificates/${certificateId}/download`, '_blank')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Certificate
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setLocation('/auth')}
                >
                  <User className="w-4 h-4 mr-2" />
                  Login to Access Certificate
                </Button>
              </div>
            )}
            
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setLocation('/')}
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300 text-center">
              Your certificate is permanently stored and verified on our platform. 
              You can always re-download it from your dashboard.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}