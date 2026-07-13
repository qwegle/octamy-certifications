import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import {
  BarChart3,
  Bookmark,
  Building2,
  CreditCard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';

interface RecruiterLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Overview', href: '/recruiter/dashboard', icon: Building2 },
  { name: 'Search talent', href: '/recruiter/search', icon: Search },
  { name: 'Saved searches', href: '/recruiter/saved-searches', icon: Bookmark },
  { name: 'Analytics', href: '/recruiter/analytics', icon: BarChart3 },
  { name: 'Wallet', href: '/recruiter/wallet', icon: Wallet },
  { name: 'Profile', href: '/recruiter/profile', icon: UserRound },
  { name: 'Company settings', href: '/recruiter/settings', icon: Settings },
];

export default function RecruiterLayout({ children }: RecruiterLayoutProps) {
  const { recruiter, logout, token } = useRecruiterAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!recruiter || !token) return null;

  const handleLogout = () => {
    logout();
    setLocation('/recruiter/auth');
  };

  const kycMeta = recruiter.kycStatus === 'approved'
    ? { label: 'Verified', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' }
    : recruiter.kycStatus === 'under_review'
      ? { label: 'Under review', className: 'border-amber-400/30 bg-amber-400/10 text-amber-200' }
      : recruiter.kycStatus === 'rejected'
        ? { label: 'Action required', className: 'border-rose-400/30 bg-rose-400/10 text-rose-200' }
        : { label: 'Setup pending', className: 'border-slate-400/30 bg-white/5 text-slate-300' };

  const recruiterName = `${recruiter.firstName || ''} ${recruiter.lastName || ''}`.trim() || recruiter.email;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-slate-950 text-white transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Link href="/recruiter/dashboard" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white text-sm font-black text-slate-950">O</span>
            <span>
              <span className="block text-sm font-semibold leading-tight">Octamy Recruiter</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-400">Verified talent</span>
            </span>
          </Link>
          <button type="button" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{recruiter.companyName || 'Your company'}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{recruiterName}</p>
              </div>
              <ShieldCheck className="h-5 w-5 shrink-0 text-sky-300" />
            </div>
            <Badge variant="outline" className={`mt-3 ${kycMeta.className}`}>{kycMeta.label}</Badge>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Recruiter navigation">
          {navigation.map((item) => {
            const active = location === item.href || location.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-rose-500/10 hover:text-rose-200">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-700 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" aria-expanded={sidebarOpen}>
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">Recruiter workspace</p>
                <p className="hidden truncate text-xs text-slate-500 sm:block">Hire using verified skill evidence</p>
              </div>
            </div>
            <Link href="/recruiter/wallet" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300">
              <CreditCard className="h-4 w-4 text-sky-600" />
              <span>{Number(recruiter.creditsBalance || 0).toLocaleString()} credits</span>
            </Link>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
