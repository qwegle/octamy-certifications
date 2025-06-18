import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import Header from '@/components/header';
import PayUMoneyForm from '@/components/payumoney-form';
import { QrCode, Download, Share2, Trophy, Calendar, Award, Truck, MapPin } from 'lucide-react';
import type { Certificate } from '@shared/schema';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface Address {
  id: number;
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export default function Payment() {
  const { certificateId } = useParams();
  const [, setLocation] = useLocation();
  const [includesPhysicalCopy, setIncludesPhysicalCopy] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const { data: certificate, refetch } = useQuery<Certificate>({
    queryKey: [`/api/certificates/${certificateId}`],
    enabled: !!certificateId,
  });

  // Fetch course details to get pricing information
  const { data: course } = useQuery({
    queryKey: [`/api/courses/${certificate?.courseId}`],
    enabled: !!certificate?.courseId,
  });

  // Fetch user addresses
  const { data: addresses = [] } = useQuery<Address[]>({
    queryKey: ["/api/user/addresses"],
    retry: false,
  });

  // Find default address
  useEffect(() => {
    const defaultAddress = addresses.find(addr => addr.isDefault);
    if (defaultAddress && !selectedAddressId) {
      setSelectedAddressId(defaultAddress.id);
    }
  }, [addresses, selectedAddressId]);

  const handlePaymentSuccess = async () => {
    await refetch();
    setLocation('/dashboard');
  };

  if (!certificate) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Certificate Not Found</h2>
          <p className="text-gray-600 mb-4">
            The certificate you're looking for doesn't exist. You may need to take and pass the exam first.
          </p>
          <Button onClick={() => setLocation('/courses')} className="mr-2">
            Browse Courses
          </Button>
          <Button onClick={() => setLocation('/dashboard')} variant="outline">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!certificate.isPaid ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Certificate Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Certificate Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-lg text-center">
                  <div className="text-2xl font-bold mb-2">{certificate.courseTitle}</div>
                  <div className="text-lg mb-4">Certificate of Achievement</div>
                  <div className="text-sm text-gray-600 mb-4">
                    This is to certify that
                  </div>
                  <div className="text-xl font-semibold mb-4">{certificate.userName}</div>
                  <div className="text-sm text-gray-600 mb-4">
                    has successfully completed the course with a score of
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-1">
                    {certificate.score}% - {certificate.badge}
                  </Badge>
                  <div className="text-xs text-gray-500 mt-4">
                    Certificate ID: {certificate.certificateId}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Score:</span>
                    <span className="font-medium">{certificate.score}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Badge:</span>
                    <Badge variant="outline">{certificate.badge}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Valid Until:</span>
                    <span className="font-medium">
                      {new Date(certificate.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-gray-900">Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Certificate Options */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Certificate Options</h3>
                  
                  <div className="space-y-3">
                    {/* Digital Only Option */}
                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                      <Checkbox 
                        id="digital-only"
                        checked={!includesPhysicalCopy}
                        onCheckedChange={() => setIncludesPhysicalCopy(false)}
                      />
                      <div className="flex-1">
                        <Label htmlFor="digital-only" className="flex items-center gap-2 cursor-pointer">
                          <Download className="w-4 h-4" />
                          Digital Certificate Only
                        </Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Download high-quality PDF certificate
                        </p>
                      </div>
                      <div className="text-right">
                        {course?.isOnSale && course?.originalPrice ? (
                          <>
                            <span className="line-through text-gray-400 text-sm">₹{course.originalPrice}</span>
                            <span className="ml-2 text-green-600 font-semibold">₹{course.price}</span>
                          </>
                        ) : (
                          <span className="font-semibold">₹{course?.price || '99'}</span>
                        )}
                      </div>
                    </div>

                    {/* Physical + Digital Option */}
                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                      <Checkbox 
                        id="physical-copy"
                        checked={includesPhysicalCopy}
                        onCheckedChange={() => setIncludesPhysicalCopy(true)}
                      />
                      <div className="flex-1">
                        <Label htmlFor="physical-copy" className="flex items-center gap-2 cursor-pointer">
                          <Truck className="w-4 h-4" />
                          Digital + Physical Certificate
                        </Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Premium paper certificate shipped to your address
                        </p>
                      </div>
                      <div className="text-right">
                        {course?.isOnSale && course?.originalPrice ? (
                          <>
                            <span className="line-through text-gray-400 text-sm">₹{(parseFloat(course.originalPrice) + 50).toFixed(0)}</span>
                            <span className="ml-2 text-green-600 font-semibold">₹{(parseFloat(course.price) + 50).toFixed(0)}</span>
                          </>
                        ) : (
                          <span className="font-semibold">₹{(parseFloat(course?.price || '99') + 50).toFixed(0)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shipping Address (only if physical copy is selected) */}
                {includesPhysicalCopy && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Shipping Address
                    </h3>
                    
                    {addresses.length > 0 ? (
                      <Select value={selectedAddressId?.toString()} onValueChange={(value) => setSelectedAddressId(parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select shipping address" />
                        </SelectTrigger>
                        <SelectContent>
                          {addresses.map((address) => (
                            <SelectItem key={address.id} value={address.id.toString()}>
                              <div className="text-left">
                                <div className="font-medium">{address.fullName}</div>
                                <div className="text-sm text-gray-500">
                                  {address.addressLine1}, {address.city}, {address.state} {address.postalCode}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-center p-4 border border-dashed rounded-lg">
                        <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 mb-2">No shipping addresses found</p>
                        <Button variant="outline" onClick={() => setLocation('/profile')}>
                          Add Shipping Address
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Price Breakdown */}
                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Digital Certificate</span>
                      <div className="text-right">
                        {course?.isOnSale && course?.originalPrice ? (
                          <>
                            <span className="line-through text-gray-400 text-sm">₹{course.originalPrice}</span>
                            <span className="ml-2 text-green-600 font-medium">₹{course.price}</span>
                          </>
                        ) : (
                          <span>₹{course?.price || '99.00'}</span>
                        )}
                      </div>
                    </div>
                    {includesPhysicalCopy && (
                      <div className="flex justify-between">
                        <span>Physical Copy & Shipping</span>
                        <span>₹50.00</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span>₹{((parseFloat(course?.price || '99') + (includesPhysicalCopy ? 50 : 0))).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Form */}
                <PayUMoneyForm
                  certificateId={certificateId!}
                  courseId={certificate.courseId}
                  amount={(parseFloat(course?.price || '99') + (includesPhysicalCopy ? 50 : 0)).toFixed(2)}
                  userEmail={certificate.userEmail}
                  userName={certificate.userName}
                  courseTitle={certificate.courseTitle}
                  includesPhysicalCopy={includesPhysicalCopy}
                  selectedAddressId={selectedAddressId}
                  sellerCode={localStorage.getItem('referralCode')}
                  onSuccess={handlePaymentSuccess}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-green-600">
                <Award className="h-8 w-8 mx-auto mb-2" />
                Payment Successful!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-lg">
                Your certificate is now ready for download.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  className="bg-octamy-black text-white hover:bg-octamy-gray-800"
                  onClick={() => window.open(`/api/certificates/${certificate.certificateId}/download`, '_blank')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Certificate
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'My Certificate',
                        text: `I've earned a certificate in ${certificate.courseTitle}!`,
                        url: `${window.location.origin}/verify/${certificate.certificateId}`
                      });
                    } else {
                      navigator.clipboard.writeText(`${window.location.origin}/verify/${certificate.certificateId}`);
                      // Add toast notification for copy
                    }
                  }}
                  className="border-octamy-gray-300 text-octamy-black hover:bg-octamy-gray-50"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Certificate
                </Button>
              </div>

              <div className="bg-octamy-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <QrCode className="h-4 w-4" />
                  <span className="text-sm font-medium">Verification</span>
                </div>
                <p className="text-xs text-octamy-gray-600">
                  Certificate ID: {certificate.certificateId}
                </p>
                <p className="text-xs text-octamy-gray-600">
                  Verify at: octamy.com/verify
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}