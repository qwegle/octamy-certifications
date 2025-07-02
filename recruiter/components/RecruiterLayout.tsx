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
        return <Badge className="bg-green-600 text-white">✓ Verified</Badge>;
      case 'under_review':
        return <Badge className="bg-yellow-600 text-white">⏳ Review</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600 text-white">✗ Rejected</Badge>;
      default:
        return <Badge className="bg-gray-600 text-white">⚠ Pending</Badge>;
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
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Header */}
      <header className="bg-black shadow-lg border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/recruiter/dashboard" className="flex items-center space-x-3">
                <Shield className="h-8 w-8 text-white" />
                <span className="text-2xl font-bold text-white">Octamy AI Recruiter</span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 bg-gray-800 px-3 py-2 rounded-full">
                <CreditCard className="h-4 w-4 text-white" />
                <span className="font-medium text-white">{recruiter.creditsBalance} Credits</span>
              </div>
              
              {getKycStatusBadge()}
              
              <div className="text-right text-white">
                <p className="text-sm font-medium">
                  {recruiter.firstName} {recruiter.lastName}
                </p>
                <p className="text-xs text-gray-300">{recruiter.companyName}</p>
              </div>
              
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="flex items-center space-x-1 border-gray-600 text-white hover:bg-gray-800"
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
        <aside className="w-64 bg-black min-h-screen border-r border-gray-800">
          <nav className="mt-8 px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-black shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
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
        <main className="flex-1 p-8 bg-gray-50 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}