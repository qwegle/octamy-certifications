import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IndianRupee, Lock, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  attemptId: number;
  courseTitle: string;
}

export default function PaymentModal({ open, onClose, attemptId, courseTitle }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePayment = async () => {
    setLoading(true);
    
    try {
      const response = await apiRequest("POST", `/api/exam-attempts/${attemptId}/initiate-payment`, {});
      const data = await response.json();
      
      if (data.success && data.paymentForm) {
        // Create and submit the payment form
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.paymentForm.action;
        
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
        throw new Error("Failed to initialize payment");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md border-2 border-black">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Lock className="w-5 h-5" />
            Unlock Your Results
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Pay ₹29 to view your detailed exam results for <span className="font-semibold text-black">{courseTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="bg-gray-50 rounded-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Results Unlock Fee</span>
              <span className="text-2xl font-bold text-black flex items-center">
                <IndianRupee className="w-5 h-5" />
                29
              </span>
            </div>
            
            <div className="pt-4 border-t border-gray-200 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-600">View your score and detailed results</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-600">Track your progress and improvement</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-600">Access results anytime from your dashboard</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={loading}
            className="border-black text-black"
            data-testid="button-cancel-payment"
          >
            Cancel
          </Button>
          <Button 
            onClick={handlePayment}
            disabled={loading}
            className="bg-black text-white hover:bg-gray-800"
            data-testid="button-proceed-payment"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <IndianRupee className="w-4 h-4 mr-2" />
                Pay ₹29 & Unlock
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
