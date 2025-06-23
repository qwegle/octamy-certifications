import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import RecruiterLayout from '../components/RecruiterLayout';
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
}

export default function RecruiterWallet() {
  const { toast } = useToast();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const response = await apiRequest('GET', '/api/recruiter/wallet');
      if (response.ok) {
        const data = await response.json();
        setWalletData(data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch wallet data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseCredits = (amount: number) => {
    // This would integrate with payment gateway
    toast({
      title: 'Purchase Credits',
      description: `Redirecting to payment gateway for ${amount} credits...`,
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'spend':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
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
            Manage your credits and view transaction history
          </p>
        </div>

        {/* Current Balance */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Wallet className="h-6 w-6" />
                  <h2 className="text-lg font-semibold">Current Balance</h2>
                </div>
                <p className="text-3xl font-bold">{walletData?.balance || '0'} Credits</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90 mb-2">Credit Rates</p>
                <p className="text-xs opacity-75">Profile View: 1 credit</p>
                <p className="text-xs opacity-75">CV Download: 1 credit</p>
                <p className="text-xs opacity-75">Interview Data: 2 credits</p>
              </div>
            </div>
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
                { credits: 100, price: 1000, popular: false },
                { credits: 500, price: 4500, popular: true },
                { credits: 1000, price: 8000, popular: false },
              ].map((plan) => (
                <div
                  key={plan.credits}
                  className={`relative p-6 border rounded-lg ${
                    plan.popular
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-600">Most Popular</Badge>
                    </div>
                  )}
                  <div className="text-center">
                    <h3 className="text-2xl font-bold">{plan.credits}</h3>
                    <p className="text-gray-600">Credits</p>
                    <p className="text-xl font-semibold mt-2">₹{plan.price}</p>
                    <p className="text-sm text-gray-500">
                      ₹{(plan.price / plan.credits).toFixed(2)} per credit
                    </p>
                    <Button
                      className="w-full mt-4"
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handlePurchaseCredits(plan.credits)}
                    >
                      Purchase Now
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
                            ? 'text-red-600'
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