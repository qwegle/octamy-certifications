import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Shield, Lock } from "lucide-react";
import type { Course } from "@shared/schema";

interface PayUMoneyPaymentProps {
  course: Course;
  sellerCode?: string;
  onSuccess?: () => void;
}

export default function PayUMoneyPayment({ course, sellerCode, onSuccess }: PayUMoneyPaymentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: ""
  });
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/payment/initiate`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: course.id,
          userEmail: formData.email,
          userName: formData.name,
          userPhone: formData.phone,
          sellerCode: sellerCode
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Create and submit secure PayUMoney form
        const form = document.createElement('form');
        form.method = data.paymentForm.method;
        form.action = data.paymentForm.action;
        form.style.display = 'none';

        // Add security headers if provided
        if (data.paymentForm.securityHeaders) {
          Object.entries(data.paymentForm.securityHeaders).forEach(([key, value]) => {
            form.setAttribute(`data-${key.toLowerCase()}`, value as string);
          });
        }

        Object.entries(data.paymentForm.fields).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value as string;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        
        // Show loading state before redirect
        toast({
          title: "Redirecting to Payment Gateway",
          description: "Please wait while we redirect you to the secure payment page...",
        });

        form.submit();
        document.body.removeChild(form);

        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error("Failed to initiate payment");
      }
    } catch (error) {
      console.error("Payment initiation error:", error);
      toast({
        title: "Payment Error",
        description: "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto border-2 border-black">
      <CardHeader className="bg-black text-white">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Complete Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-6">
          <h3 className="font-bold text-lg mb-2">{course.title}</h3>
          <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
            <span>Professional Certification</span>
            <span className="font-bold text-xl text-black">₹{course.price}</span>
          </div>
          
          {sellerCode && (
            <div className="bg-gray-100 p-3 rounded mb-4">
              <p className="text-sm text-gray-600">
                Partner referral code: <span className="font-mono font-bold">{sellerCode}</span>
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter your full name"
              className="border-2 border-gray-300 focus:border-black"
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              className="border-2 border-gray-300 focus:border-black"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Enter your phone number"
              className="border-2 border-gray-300 focus:border-black"
            />
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Shield className="h-4 w-4" />
              <span>Secure Payment with PayUMoney</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Lock className="h-4 w-4" />
              <span>256-bit SSL encryption</span>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-black text-white hover:bg-gray-800 py-3 text-lg font-bold"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : `Pay ₹${course.price}`}
          </Button>
        </form>

        <p className="text-xs text-gray-500 mt-4 text-center">
          By proceeding, you agree to our terms of service and privacy policy.
        </p>
      </CardContent>
    </Card>
  );
}