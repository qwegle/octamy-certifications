import { useLocation } from 'wouter';
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
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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

export default function PaymentTemp() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [includesPhysicalCopy, setIncludesPhysicalCopy] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState<any>(null);

  // Extract parameters from URL
  const urlParams = new URLSearchParams(window.location.search);
  const tempExamId = urlParams.get('tempExamId');
  const courseId = urlParams.get('courseId');

  // Fetch temporary exam results
  const { data: examResults, isLoading: examLoading } = useQuery({
    queryKey: [`/api/exam-results-temp/${tempExamId}`],
    enabled: !!tempExamId,
  });

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: [`/api/courses/${courseId}`],
    enabled: !!courseId,
  });

  // Fetch user addresses
  const { data: addresses = [] } = useQuery<Address[]>({
    queryKey: ["/api/user/addresses"],
    retry: false,
  });

  // Payment initiation mutation
  const paymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await apiRequest("POST", "/api/payment/initiate", paymentData);
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Payment initiation response:', data);
      if (data.success && data.paymentForm) {
        setPaymentForm(data.paymentForm);
      } else {
        toast({
          title: "Payment Error",
          description: "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Payment initiation error:", error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initialize payment",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    console.log('PaymentTemp URL params:', { tempExamId, courseId, location });
    if (!tempExamId || !courseId) {
      console.error('Missing required parameters:', { tempExamId, courseId });
      toast({
        title: "Error",
        description: "Missing payment parameters. Please try taking the exam again.",
        variant: "destructive",
      });
      navigate('/');
      return;
    }
  }, [tempExamId, courseId, location]);

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddress = addresses.find(addr => addr.isDefault);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      }
    }
  }, [addresses, selectedAddressId]);

  const handlePayment = () => {
    if (!examResults || !course || !tempExamId) {
      toast({
        title: "Error",
        description: "Missing required data for payment",
        variant: "destructive",
      });
      return;
    }

    if (includesPhysicalCopy && !selectedAddressId) {
      toast({
        title: "Address Required",
        description: "Please select a shipping address for physical certificate delivery",
        variant: "destructive",
      });
      return;
    }

    const paymentData = {
      tempExamId,
      courseId: parseInt(courseId!),
      userEmail: examResults.userEmail,
      userName: examResults.userName,
      userPhone: "",
      sellerCode: "",
      includesPhysicalCopy,
      selectedAddressId,
      amount: course.price
    };

    paymentMutation.mutate(paymentData);
  };

  if (examLoading || courseLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!examResults || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Data Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The exam results or course data could not be found.
              </p>
              <Button onClick={() => navigate("/")} className="w-full">
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!examResults.passed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Exam Not Passed</h2>
              <p className="text-muted-foreground mb-4">
                You need to pass the exam before purchasing a certificate.
              </p>
              <Button onClick={() => navigate(`/course/${course.slug}`)} className="w-full">
                Retake Exam
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (paymentForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <PayUMoneyForm paymentForm={paymentForm} />
        </div>
      </div>
    );
  }

  const baseAmount = parseFloat(course.price);
  const shippingCost = includesPhysicalCopy ? 50 : 0;
  const totalAmount = baseAmount + shippingCost;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Complete Your Purchase</h1>
            <p className="text-muted-foreground">
              Get your verified certificate for {course.title}
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Certificate Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Certificate Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-800">
                    <div className="text-center space-y-2">
                      <Trophy className="h-12 w-12 text-blue-600 mx-auto" />
                      <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100">
                        Professional Certificate
                      </h3>
                      <p className="text-blue-700 dark:text-blue-300">
                        {course.title}
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        Awarded to: {examResults.userName}
                      </p>
                      <div className="flex justify-center gap-4 text-sm text-blue-600 dark:text-blue-400">
                        <span>Score: {examResults.score}%</span>
                        <span>•</span>
                        <span>Grade: {examResults.score >= 90 ? 'A+' : examResults.score >= 80 ? 'A' : 'B+'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Issue Date:</span>
                      <div className="font-medium">{new Date().toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Validity:</span>
                      <div className="font-medium">Lifetime</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Verification:</span>
                      <div className="font-medium">QR Code + URL</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Format:</span>
                      <div className="font-medium">PDF Download</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Pricing */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Digital Certificate</span>
                    <span className="font-medium">
                      {course.isOnSale && course.originalPrice ? (
                        <div className="text-right">
                          <span className="line-through text-muted-foreground mr-2">
                            ₹{course.originalPrice}
                          </span>
                          <span className="text-green-600">₹{course.price}</span>
                        </div>
                      ) : (
                        <span>₹{course.price}</span>
                      )}
                    </span>
                  </div>

                  {/* Physical Copy Option */}
                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                    <Checkbox
                      id="physicalCopy"
                      checked={includesPhysicalCopy}
                      onCheckedChange={(checked) => setIncludesPhysicalCopy(!!checked)}
                    />
                    <div className="flex-1">
                      <Label htmlFor="physicalCopy" className="flex items-center gap-2 cursor-pointer">
                        <Truck className="h-4 w-4" />
                        Physical Certificate (Premium Paper)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        High-quality printed certificate delivered to your address
                      </p>
                    </div>
                    <span className="font-medium">+₹50</span>
                  </div>

                  {/* Address Selection */}
                  {includesPhysicalCopy && (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Shipping Address
                      </Label>
                      {addresses.length > 0 ? (
                        <Select
                          value={selectedAddressId?.toString() || ""}
                          onValueChange={(value) => setSelectedAddressId(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select shipping address" />
                          </SelectTrigger>
                          <SelectContent>
                            {addresses.map((address) => (
                              <SelectItem key={address.id} value={address.id.toString()}>
                                <div className="text-left">
                                  <div className="font-medium">{address.fullName}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {address.addressLine1}, {address.city}, {address.state} {address.postalCode}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="p-3 border border-dashed rounded-lg text-center">
                          <p className="text-sm text-muted-foreground">No addresses found</p>
                          <Button variant="outline" size="sm" className="mt-2">
                            Add Address
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total Amount</span>
                      <span>₹{totalAmount}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Button */}
                <Button 
                  onClick={handlePayment}
                  disabled={paymentMutation.isPending || (includesPhysicalCopy && !selectedAddressId)}
                  size="lg" 
                  className="w-full"
                >
                  {paymentMutation.isPending ? "Processing..." : `Pay ₹${totalAmount}`}
                </Button>

                <div className="text-xs text-center text-muted-foreground">
                  Secure payment powered by PayUMoney
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}