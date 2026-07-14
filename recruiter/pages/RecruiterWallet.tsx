import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import RecruiterLayout from '../components/RecruiterLayout';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import {
  CreditCard,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
  Eye,
  Download,
  FileText
} from 'lucide-react';

interface Transaction {
  id: number;
  type: 'purchase' | 'spend' | 'refund';
  amount: string;
  description: string;
  balanceAfter: string;
  createdAt: string;
}

interface WalletData {
  balance: string;
  transactions: Transaction[];
  costs: { profile_view: number; cv_download: number; interview_access: number };
  chargingModel: 'one_time_unlock';
  rules: string[];
}

export default function RecruiterWallet() {
  const { toast } = useToast();
  const { updateRecruiter } = useRecruiterAuth();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingCredits, setPurchasingCredits] = useState<number | null>(null);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const response = await apiRequest('GET', '/api/recruiter/wallet');
      if (response.ok) {
        const data = await response.json();
        setWalletData(data);
        updateRecruiter({ creditsBalance: data.balance });
      }
    } catch (error) {
      toast({
        title: 'Wallet temporarily unavailable',
        description: 'We could not refresh your balance. No wallet action was taken.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseCredits = async (amount: number) => {
    try {
      setPurchasingCredits(amount);
      const response = await apiRequest('POST', '/api/recruiter/credit-orders', { credits: amount });
      const data = await response.json();
      if (data.paymentLink) {
        window.location.href = data.paymentLink;
        return;
      }
      if (!data.paymentSessionId) throw new Error('Payment provider did not return a checkout session');
      if (!(window as any).Cashfree) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>('script[data-cashfree-sdk="true"]');
          if (existing) {
            if ((window as any).Cashfree) return resolve();
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Failed to load Cashfree checkout')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
          script.async = true;
          script.dataset.cashfreeSdk = 'true';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Cashfree checkout'));
          document.head.appendChild(script);
        });
      }
      const cashfree = (window as any).Cashfree({
        mode: (import.meta.env.VITE_CASHFREE_ENV || (import.meta.env.DEV ? 'sandbox' : 'production')).toLowerCase(),
      });
      await cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: '_self' });
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Checkout not started',
        description: error instanceof Error ? error.message : 'Failed to initiate payment. Please try again.',
      });
    } finally {
      setPurchasingCredits(null);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'spend':
        return <TrendingDown className="h-4 w-4 text-amber-600" />;
      case 'refund':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      default:
        return <CreditCard className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityIcon = (description: string) => {
    if (description.includes('profile_view')) return <Eye className="h-4 w-4" />;
    if (description.includes('cv_download')) return <Download className="h-4 w-4" />;
    if (description.includes('interview_access')) return <FileText className="h-4 w-4" />;
    return <CreditCard className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <RecruiterLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      </RecruiterLayout>
    );
  }

  return (
    <RecruiterLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Wallet</h1>
          <p className="text-gray-600 mt-2">
            One balance, transparent one-time unlock costs, and a complete transaction trail.
          </p>
        </div>

        {/* Current Balance */}
        <Card className="bg-gradient-to-r from-black to-gray-800 text-white shadow-2xl">
          <CardContent className="p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-cream-soft bg-opacity-20 p-2 rounded-full">
                    <Wallet className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold">Current Balance</h2>
                </div>
                <p className="text-4xl font-bold mb-2">{walletData?.balance || '0'}</p>
                <p className="text-lg text-gray-300">Available Credits</p>
              </div>
              <div className="w-full rounded-xl bg-white/10 p-4 sm:w-72">
                <p className="text-sm font-semibold mb-3">One-time unlock pricing</p>
                <div className="space-y-2 text-xs text-slate-200">
                  <p className="flex justify-between gap-6"><span>Candidate profile</span><span className="font-semibold text-white">{walletData?.costs?.profile_view ?? 1} credit</span></p>
                  <p className="flex justify-between gap-6"><span>Shared CV</span><span className="font-semibold text-white">{walletData?.costs?.cv_download ?? 1} credit</span></p>
                  <p className="flex justify-between gap-6"><span>Interview evidence</span><span className="font-semibold text-white">{walletData?.costs?.interview_access ?? 2} credits</span></p>
                </div>
                <p className="mt-3 border-t border-white/10 pt-3 text-xs text-slate-300">Reopen an unlocked item anytime for 0 credits.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-200 bg-sky-50/60">
          <CardHeader className="pb-2"><CardTitle className="text-base text-sky-950">How credits are protected</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm text-sky-900 md:grid-cols-3">
              {(walletData?.rules || []).map((rule) => <li key={rule} className="rounded-lg border border-sky-100 bg-white/80 p-3">{rule}</li>)}
            </ul>
          </CardContent>
        </Card>

        {/* Purchase Credits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Purchase Credits</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { credits: 100, price: 1000, popular: false, savings: 0 },
                { credits: 500, price: 4500, popular: true, savings: 10 },
                { credits: 1000, price: 8000, popular: false, savings: 20 },
              ].map((plan) => (
                <div
                  key={plan.credits}
                  className={`relative p-6 border rounded-xl transition-all hover:shadow-lg ${
                    plan.popular
                      ? 'border-black bg-black text-white shadow-xl scale-105'
                      : 'border-cream-deep bg-cream-soft hover:border-gray-300'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-cream-soft text-black font-bold">🚀 Most Popular</Badge>
                    </div>
                  )}
                  {plan.savings > 0 && (
                    <div className="absolute -top-2 -right-2">
                      <Badge className="bg-green-600 text-white">Save {plan.savings}%</Badge>
                    </div>
                  )}
                  <div className="text-center">
                    <h3 className="text-3xl font-bold mb-1">{plan.credits}</h3>
                    <p className={`text-sm mb-4 ${plan.popular ? 'text-gray-300' : 'text-gray-600'}`}>Credits</p>
                    <div className="mb-4">
                      <p className="text-2xl font-bold">₹{plan.price}</p>
                      <p className={`text-sm ${plan.popular ? 'text-gray-300' : 'text-gray-500'}`}>
                        ₹{(plan.price / plan.credits).toFixed(2)} per credit
                      </p>
                    </div>
                    <Button
                      className={`w-full mt-4 font-semibold ${
                        plan.popular 
                          ? 'bg-cream-soft text-black hover:bg-gray-100' 
                          : 'bg-black text-white hover:bg-gray-800'
                      }`}
                      onClick={() => handlePurchaseCredits(plan.credits)}
                      disabled={purchasingCredits !== null}
                    >
                      {purchasingCredits === plan.credits ? 'Opening checkout…' : plan.popular ? 'Get Started' : 'Purchase Now'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {walletData?.transactions && walletData.transactions.length > 0 ? (
              <div className="space-y-4">
                {walletData.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {getTransactionIcon(transaction.type)}
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(transaction.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-medium ${
                          transaction.type === 'purchase'
                            ? 'text-green-600'
                            : transaction.type === 'spend'
                            ? 'text-amber-700'
                            : 'text-blue-600'
                        }`}
                      >
                        {transaction.type === 'spend' ? '-' : '+'}
                        {transaction.amount} credits
                      </p>
                      <p className="text-sm text-gray-500">
                        Balance: {transaction.balanceAfter}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No transactions yet. Purchase credits to get started.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </RecruiterLayout>
  );
}
