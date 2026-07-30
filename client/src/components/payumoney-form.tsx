import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';

interface PayUMoneyFormProps {
  certificateId: string;
  amount: string;
  courseTitle: string;
  includesPhysicalCopy?: boolean;
  selectedAddressId?: number | null;
  sellerCode?: string | null;
}

export default function PayUMoneyForm({
  certificateId,
  amount,
  courseTitle,
  includesPhysicalCopy = false,
  selectedAddressId = null,
  sellerCode = null,
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
        certificateId,
        includesPhysicalCopy,
        selectedAddressId,
        sellerCode: sellerCode || undefined,
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
        title: "Checkout could not start",
        description:
          error instanceof Error
            ? error.message
            : "Secure checkout is temporarily unavailable. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handlePayment}
        disabled={isLoading || (includesPhysicalCopy && !selectedAddressId)}
        className="min-h-12 w-full bg-slate-950 text-white hover:bg-slate-800"
        size="lg"
        aria-label={`Pay ₹${amount} to activate the ${courseTitle} credential`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Opening secure checkout…
          </>
        ) : (
          <>
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Activate securely · ₹{amount}
          </>
        )}
      </Button>
      <div className="flex items-start justify-center gap-2 text-center text-xs leading-5 text-slate-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" aria-hidden="true" />
        <span>
          {defaultGateway === "cashfree"
            ? "Secure checkout powered by Cashfree. Octamy never receives your card or UPI credentials."
            : "Secure checkout powered by PayU. Octamy never receives your card or UPI credentials."}
        </span>
      </div>
    </div>
  );
}
