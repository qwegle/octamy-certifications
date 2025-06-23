import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import {
  Users,
  Search,
  Wallet,
  Settings,
  LogOut,
  Building2,
  Shield,
  CreditCard
} from 'lucide-react';

interface RecruiterLayoutProps {
  children: ReactNode;
}

export default function RecruiterLayout({ children }: RecruiterLayoutProps) {
  const { recruiter, logout, token } = useRecruiterAuth();
  const [location, setLocation] = useLocation();

  if (!recruiter || !token) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setLocation('/recruiter/auth');
  };

  const getKycStatusBadge = () => {
    switch (recruiter.kycStatus) {
      case 'approved':
        return <Badge className="bg-green-600">KYC Approved</Badge>;
      case 'under_review':
        return <Badge className="bg-yellow-600">Under Review</Badge>;
      case 'rejected':
        return <Badge variant="destructive">KYC Rejected</Badge>;
      default:
        return <Badge variant="outline">KYC Pending</Badge>;
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/recruiter/dashboard', icon: Building2 },
    { name: 'Search Candidates', href: '/recruiter/search', icon: Search },
    { name: 'My Wallet', href: '/recruiter/wallet', icon: Wallet },
    { name: 'Profile', href: '/recruiter/profile', icon: Users },
    { name: 'Settings', href: '/recruiter/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/recruiter/dashboard" className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900">Octamy Recruiter</span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <CreditCard className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{recruiter.creditsBalance} Credits</span>
              </div>
              
              {getKycStatusBadge()}
              
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {recruiter.firstName} {recruiter.lastName}
                </p>
                <p className="text-xs text-gray-500">{recruiter.companyName}</p>
              </div>
              
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="flex items-center space-x-1"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm min-h-screen">
          <nav className="mt-8 px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}