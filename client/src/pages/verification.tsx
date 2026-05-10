import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Search, CheckCircle, XCircle, Trophy, Calendar, Award } from 'lucide-react';
import type { Certificate } from '@shared/schema';

export default function Verification() {
  const [certificateId, setCertificateId] = useState('');
  const [verificationResult, setVerificationResult] = useState<Certificate | null>(null);
  const [showResult, setShowResult] = useState(false);
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('GET', `/api/certificates/${id}`, undefined);
      return response.json();
    },
    onSuccess: (data) => {
      setVerificationResult(data);
      setShowResult(true);
    },
    onError: () => {
      setVerificationResult(null);
      setShowResult(true);
      toast({
        title: "Certificate Not Found",
        description: "Please check the certificate ID and try again.",
        variant: "destructive",
      });
    },
  });

  const handleVerify = () => {
    if (!certificateId.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a certificate ID.",
        variant: "destructive",
      });
      return;
    }
    
    verifyMutation.mutate(certificateId.trim());
  };

  const handleReset = () => {
    setCertificateId('');
    setVerificationResult(null);
    setShowResult(false);
  };

  const isExpired = verificationResult ? new Date(verificationResult.expiresAt) < new Date() : false;
  const isValid = verificationResult?.isActive && verificationResult?.isPaid && !isExpired;

  return (
    <div className="min-h-screen bg-cream-soft">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-octamy-black mb-4">Verify Certificate</h1>
          <p className="text-xl text-octamy-gray-600">
            Enter certificate ID to verify authenticity and validity
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-octamy-black">Certificate Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-w-md mx-auto">
              <Label htmlFor="certificate-id" className="text-octamy-black">
                Certificate ID
              </Label>
              <div className="flex gap-4 mt-2">
                <Input
                  id="certificate-id"
                  type="text"
                  placeholder="Enter certificate ID"
                  value={certificateId}
                  onChange={(e) => setCertificateId(e.target.value)}
                  className="flex-1 focus:ring-2 focus:ring-octamy-black focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
                <Button
                  onClick={handleVerify}
                  disabled={verifyMutation.isPending}
                  className="bg-octamy-black text-white hover:bg-octamy-gray-800"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {verifyMutation.isPending ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
              <p className="text-sm text-octamy-gray-500 mt-2">
                Example: OCT-2024-ML-123456
              </p>
            </div>

            {showResult && (
              <div className="mt-8">
                {verificationResult ? (
                  <div className={`p-6 rounded-lg border-2 ${
                    isValid 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center mb-4">
                      {isValid ? (
                        <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500 mr-3" />
                      )}
                      <h3 className={`text-lg font-semibold ${
                        isValid ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {isValid ? 'Valid Certificate' : 'Invalid Certificate'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center">
                        <span className="font-medium text-octamy-gray-700 mr-2">Name:</span>
                        <span>{verificationResult.userName}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium text-octamy-gray-700 mr-2">Course:</span>
                        <span>{verificationResult.courseTitle}</span>
                      </div>
                      <div className="flex items-center">
                        <Trophy className="w-4 h-4 text-octamy-gray-600 mr-1" />
                        <span className="font-medium text-octamy-gray-700 mr-2">Score:</span>
                        <span>{verificationResult.score}%</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-octamy-gray-600 mr-1" />
                        <span className="font-medium text-octamy-gray-700 mr-2">Issued:</span>
                        <span>{new Date(verificationResult.issuedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center">
                        <Award className="w-4 h-4 text-octamy-gray-600 mr-1" />
                        <span className="font-medium text-octamy-gray-700 mr-2">Valid Until:</span>
                        <span>{new Date(verificationResult.expiresAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium text-octamy-gray-700 mr-2">Status:</span>
                        <Badge variant={isValid ? "default" : "destructive"}>
                          {isValid ? 'Valid' : 
                           !verificationResult.isPaid ? 'Unpaid' : 
                           isExpired ? 'Expired' : 'Invalid'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        onClick={() => window.open(`/certificates/${verificationResult.certificateId}`, '_blank')}
                        className="bg-octamy-black text-white hover:bg-octamy-gray-800"
                      >
                        View Full Certificate
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        className="border-octamy-gray-300 text-octamy-black hover:bg-octamy-gray-50"
                      >
                        Verify Another Certificate
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-red-50 border-2 border-red-200 rounded-lg">
                    <div className="flex items-center mb-4">
                      <XCircle className="w-6 h-6 text-red-500 mr-3" />
                      <h3 className="text-lg font-semibold text-red-800">
                        Certificate Not Found
                      </h3>
                    </div>
                    <p className="text-red-700 mb-4">
                      The certificate ID you entered does not exist in our system. Please check the ID and try again.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-octamy-black">About Certificate Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-octamy-gray-600">
              <p>
                Our certificate verification system allows you to instantly verify the authenticity 
                and validity of any Octamy certificate using its unique certificate ID.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>All certificates are issued with a unique identifier</li>
                <li>Certificates are valid for 2 years from the date of issue</li>
                <li>Only paid certificates are considered valid</li>
                <li>Verification is available 24/7 and is completely free</li>
              </ul>
              <p>
                If you have any questions about certificate verification, please contact our support team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
