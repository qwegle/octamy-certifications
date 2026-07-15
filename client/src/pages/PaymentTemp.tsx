import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Header from '@/components/header';
import { Trophy, Award, Truck, MapPin, TicketPercent, CheckCircle2 } from 'lucide-react';
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

interface TempExamResult {
  passed: boolean;
  score: number;
  userEmail: string;
  userName: string;
}

interface CheckoutCourse {
  id: number;
  slug: string;
  title: string;
  price: string;
  originalPrice?: string | null;
  isOnSale: boolean;
}

interface CouponQuote {
  valid: true;
  couponId: number;
  codeHint: string;
  originalAmount: string;
  discountAmount: string;
  finalAmount: string;
  currency: string;
}

export default function PaymentTemp() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [includesPhysicalCopy, setIncludesPhysicalCopy] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponQuote | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const hasUserSession = Boolean(localStorage.getItem('token'));


  // Extract parameters from URL
  const urlParams = new URLSearchParams(window.location.search);
  const tempExamId = urlParams.get('tempExamId');
  const courseId = urlParams.get('courseId');

  // Fetch temporary exam results
  const { data: examResults, isLoading: examLoading } = useQuery<TempExamResult>({
    queryKey: [`/api/exam-results-temp/${tempExamId}`],
    enabled: !!tempExamId,
  });

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery<CheckoutCourse>({
    queryKey: [`/api/courses/${courseId}`],
    enabled: !!courseId,
  });

  // Fetch user addresses
  const { data: addresses = [] } = useQuery<Address[]>({
    queryKey: ["/api/user/addresses"],
    enabled: hasUserSession,
    retry: false,
  });



  useEffect(() => {
    if (!tempExamId || !courseId) {
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

  const applyCoupon = async () => {
    if (!course || !couponCode.trim()) return;
    setCouponPending(true);
    try {
      const response = await apiRequest("POST", "/api/coupons/quote", {
        code: couponCode,
        courseId: course.id,
      });
      const quote = await response.json() as CouponQuote;
      setAppliedCoupon(quote);
      toast({
        title: "Coupon applied",
        description: `You save ₹${Number(quote.discountAmount).toLocaleString('en-IN')}.`,
      });
    } catch (error) {
      setAppliedCoupon(null);
      toast({
        title: "Coupon could not be applied",
        description: error instanceof Error ? error.message : "Review the code and try again.",
      });
    } finally {
      setCouponPending(false);
    }
  };

  const handlePayment = async () => {
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

    try {
      // Get referral code from localStorage
      const referralCode = localStorage.getItem('referralCode');
      
      const paymentData = {
        tempExamId,
        courseId: parseInt(courseId!),
        userEmail: examResults.userEmail || '',
        userName: examResults.userName || '',
        userPhone: "",
        sellerCode: referralCode || "",
        includesPhysicalCopy,
        selectedAddressId,
        couponCode: appliedCoupon ? couponCode.trim() : undefined,
      };

      const response = await apiRequest("POST", "/api/payment/initiate", paymentData);
      const data = await response.json();
      
      if (data.success && data.gateway === "cashfree") {
        if (data.paymentSessionId) {
          const existing = document.querySelector('script[data-cashfree-sdk="true"]');
          if (!existing && !(window as any).Cashfree) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
              script.async = true;
              script.dataset.cashfreeSdk = "true";
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
              document.head.appendChild(script);
            });
          }
          const cashfree = (window as any).Cashfree({
            mode: (import.meta.env.VITE_CASHFREE_ENV || (import.meta.env.DEV ? "sandbox" : "production")).toLowerCase(),
          });
          await cashfree.checkout({
            paymentSessionId: data.paymentSessionId,
            redirectTarget: "_self",
          });
          return;
        }
        if (data.paymentLink) {
          window.location.href = data.paymentLink;
          return;
        }
        throw new Error("Cashfree checkout details missing");
      }

      if (data.success && data.paymentForm) {
        // Create and submit the PayUMoney form directly
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.paymentForm.action;
        
        // Add all form fields
        Object.entries(data.paymentForm.fields).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value as string;
          form.appendChild(input);
        });
        
        document.body.appendChild(form);
        form.submit();
      } else {
        toast({
          title: "Payment Error",
          description: "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Checkout could not be started",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
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
              <Button onClick={() => navigate(course.slug ? `/get-certified/${course.slug}` : "/get-certified")} className="w-full">
                Retake Exam
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }



  const baseAmount = appliedCoupon ? Number(appliedCoupon.finalAmount) : parseFloat(course.price || '0');
  const discountAmount = appliedCoupon ? Number(appliedCoupon.discountAmount) : 0;
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
              Get your verified certificate for {course.title || 'Course'}
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
                        {course.title || 'Course'}
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        Awarded to: {examResults.userName || 'Unknown'}
                      </p>
                      <div className="flex justify-center gap-4 text-sm text-blue-600 dark:text-blue-400">
                        <span>Score: {examResults.score || 0}%</span>
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
                      <div className="font-medium">Shown on issued record</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Verification:</span>
                      <div className="font-medium">Credential ID + live URL</div>
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
                        <span>₹{course.price || 0}</span>
                      )}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <Label htmlFor="coupon" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <TicketPercent className="h-4 w-4 text-violet-600" />
                      Coupon code
                    </Label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="coupon"
                        value={couponCode}
                        onChange={(event) => {
                          setCouponCode(event.target.value.toUpperCase());
                          setAppliedCoupon(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void applyCoupon();
                          }
                        }}
                        placeholder="Enter code"
                        className="bg-white uppercase"
                      />
                      <Button type="button" variant="outline" onClick={applyCoupon} disabled={couponPending || !couponCode.trim()}>
                        {couponPending ? 'Checking…' : 'Apply'}
                      </Button>
                    </div>
                    {appliedCoupon && (
                      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Applied {appliedCoupon.codeHint}
                      </p>
                    )}
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm font-medium text-emerald-700">
                      <span>Coupon saving</span>
                      <span>−₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

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
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => navigate(hasUserSession ? '/profile-edit' : `/login?next=${encodeURIComponent(location)}`)}
                          >
                            {hasUserSession ? 'Add Address' : 'Sign in to add address'}
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
                  disabled={includesPhysicalCopy && !selectedAddressId}
                  size="lg" 
                  className="w-full"
                >
                  Pay ₹{totalAmount}
                </Button>

                <div className="text-xs text-center text-muted-foreground">
                  Coupon and pricing are revalidated securely before payment.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
