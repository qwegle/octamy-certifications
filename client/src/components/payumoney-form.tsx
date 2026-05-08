import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CreditCard, Shield } from 'lucide-react';

interface PayUMoneyFormProps {
  certificateId: string;
  courseId: number;
  amount: string;
  userEmail: string;
  userName: string;
  courseTitle: string;
  includesPhysicalCopy?: boolean;
  selectedAddressId?: number | null;
  sellerCode?: string | null;
  onSuccess: () => void;
}

export default function PayUMoneyForm({
  certificateId,
  courseId,
  amount,
  userEmail,
  userName,
  courseTitle,
  includesPhysicalCopy = false,
  selectedAddressId = null,
  sellerCode = null,
  onSuccess
}: PayUMoneyFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const defaultGateway = (import.meta.env.VITE_PAYMENT_DEFAULT_GATEWAY || "cashfree").toLowerCase();

  const loadCashfreeSdk = async () => {
    if ((window as any).Cashfree) return;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-cashfree-sdk="true"]');
      if (existing) return resolve();
      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.async = true;
      script.dataset.cashfreeSdk = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
      document.head.appendChild(script);
    });
  };

  const handlePayment = async () => {
    try {
      setIsLoading(true);

      const response = await apiRequest('POST', '/api/payment/initiate', {
        tempExamId: certificateId,
        courseId,
        userEmail,
        userName,
        productInfo: `Certificate for ${courseTitle}`,
        successUrl: `${window.location.origin}/payment/success`,
        failureUrl: `${window.location.origin}/payment/failure`,
        includesPhysicalCopy,
        selectedAddressId,
        amount,
        sellerCode // Pass seller code for partner commission tracking
      });

      const data = await response.json();

      if (data.success && data.gateway === "cashfree") {
        if (data.paymentSessionId) {
          await loadCashfreeSdk();
          const cashfree = (window as any).Cashfree({
            mode: (import.meta.env.VITE_CASHFREE_ENV || "production").toLowerCase(),
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
        // Create a form and submit to PayUMoney
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
        throw new Error(data.message || 'Failed to initiate payment');
      }
    } catch (error) {
      console.error('Payment error:', error);
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Secure Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Payment Details</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Certificate for:</span>
              <span className="font-medium">{courseTitle}</span>
            </div>
            <div className="flex justify-between">
              <span>Amount:</span>
              <span className="font-bold text-lg">₹{amount}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Shield className="h-4 w-4" />
          <span>
            {defaultGateway === "cashfree"
              ? "Secure checkout powered by Cashfree"
              : "Secured by PayUMoney with 256-bit SSL encryption"}
          </span>
        </div>

        <Button
          onClick={handlePayment}
          disabled={isLoading}
          className="w-full bg-black text-white hover:bg-gray-800"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay ₹${amount} Now`
          )}
        </Button>

        <p className="text-center text-xs text-gray-500">
          By proceeding, you agree to our terms and conditions. 
          Your certificate will be available for download immediately after successful payment.
        </p>
      </CardContent>
    </Card>
  );
}
