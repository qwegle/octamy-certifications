import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, CheckCircle, XCircle, Award, Calendar, User, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Verify() {
  const [certificateId, setCertificateId] = useState("");
  const [searchAttempted, setSearchAttempted] = useState(false);

  const { data: certificate, isLoading, error } = useQuery({
    queryKey: ["/api/certificates/verify", certificateId],
    enabled: searchAttempted && certificateId.length > 0,
    retry: false,
  });

  const handleSearch = () => {
    if (certificateId.trim()) {
      setSearchAttempted(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-black text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold">OCTAMY</Link>
            <div className="hidden md:flex space-x-6">
              <Link href="/" className="hover:text-gray-300">Courses</Link>
              <Link href="/partners" className="hover:text-gray-300">Partners</Link>
              <Link href="/help-center" className="hover:text-gray-300">Help</Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth">
              <Button variant="outline" className="border-white text-white hover:bg-white hover:text-black">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/">
            <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-black mb-2">Certificate Verification</h1>
          <p className="text-gray-600">Enter a certificate ID to verify its authenticity and view details.</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="w-5 h-5 mr-2" />
              Verify Certificate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Enter certificate ID (e.g., OCT-2025-DEM-1234567890)"
                value={certificateId}
                onChange={(e) => setCertificateId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch}
                disabled={!certificateId.trim() || isLoading}
                className="bg-black text-white hover:bg-gray-800"
              >
                {isLoading ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {searchAttempted && (
          <Card>
            <CardContent className="p-8">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
                  <p className="text-gray-600">Verifying certificate...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-red-600 mb-2">Certificate Not Found</h3>
                  <p className="text-gray-600">
                    The certificate ID "{certificateId}" could not be verified. Please check the ID and try again.
                  </p>
                </div>
              ) : certificate ? (
                <div className="text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-green-600 mb-6">Certificate Verified</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <User className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-500">Recipient</p>
                          <p className="font-semibold">{certificate.userName}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <BookOpen className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-500">Course</p>
                          <p className="font-semibold">{certificate.courseTitle}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <Award className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-500">Achievement</p>
                          <Badge className="bg-yellow-500 text-black font-bold">
                            {certificate.badge.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Calendar className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-500">Issue Date</p>
                          <p className="font-semibold">
                            {new Date(certificate.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <Calendar className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-500">Valid Until</p>
                          <p className="font-semibold">
                            {new Date(certificate.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-500">Certificate Number</p>
                          <p className="font-mono text-sm">{certificate.certificateNumber}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">
                      This certificate is authentic and verified by Octamy Solutions Private Limited.
                    </p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}