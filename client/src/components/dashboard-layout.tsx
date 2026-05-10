import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, BookOpen, Users, ClipboardList, BarChart3, Wallet, Settings,
  GraduationCap, Building2, Briefcase, Search, Award, FileText, Database,
  Menu, X, ChevronRight, LogOut, User as UserIcon, Bell, Shield, ListChecks,
} from "lucide-react";
import { useAuth } from "@/lib/auth.tsx";
import { cn } from "@/lib/utils";

export type DashboardRole = "institute" | "creator" | "recruiter" | "learner" | "admin";

type NavItem = { label: string; href: string; icon: any; group?: string };

const NAV_BY_ROLE: Record<DashboardRole, NavItem[]> = {
  institute: [
    { label: "Overview", href: "/institute/dashboard", icon: LayoutDashboard, group: "Main" },
    { label: "Exams", href: "/institute/exams", icon: ClipboardList, group: "Manage" },
    { label: "Question banks", href: "/question-banks", icon: Database, group: "Manage" },
    { label: "Students", href: "/institute/students", icon: GraduationCap, group: "Manage" },
    { label: "Team", href: "/institute/team", icon: Users, group: "Manage" },
    { label: "Reports", href: "/institute/reports", icon: BarChart3, group: "Insights" },
    { label: "Settings", href: "/profile", icon: Settings, group: "Account" },
  ],
  creator: [
    { label: "Overview", href: "/creator/dashboard", icon: LayoutDashboard, group: "Main" },
    { label: "Courses", href: "/creator/courses", icon: BookOpen, group: "Manage" },
    { label: "Question banks", href: "/question-banks", icon: Database, group: "Manage" },
    { label: "Earnings", href: "/creator/earnings", icon: Wallet, group: "Money" },
    { label: "Payouts", href: "/creator/payouts", icon: Wallet, group: "Money" },
    { label: "Settings", href: "/profile", icon: Settings, group: "Account" },
  ],
  recruiter: [
    { label: "Overview", href: "/recruiter/dashboard", icon: LayoutDashboard, group: "Main" },
    { label: "Search talent", href: "/recruiter/search", icon: Search, group: "Manage" },
    { label: "Saved searches", href: "/recruiter/saved-searches", icon: ListChecks, group: "Manage" },
    { label: "Settings", href: "/profile", icon: Settings, group: "Account" },
  ],
  learner: [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard, group: "Main" },
    { label: "My certificates", href: "/my-certificates", icon: Award, group: "Learning" },
    { label: "Browse exams", href: "/exams", icon: BookOpen, group: "Learning" },
    { label: "Settings", href: "/profile", icon: Settings, group: "Account" },
  ],
  admin: [
    { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard, group: "Main" },
    { label: "Approvals", href: "/admin/approvals", icon: Shield, group: "Moderate" },
    { label: "Settings", href: "/profile", icon: Settings, group: "Account" },
  ],
};

const ROLE_META: Record<DashboardRole, { label: string; icon: any; color: string }> = {
  institute: { label: "Institute", icon: Building2, color: "text-blue-700" },
  creator: { label: "Creator", icon: BookOpen, color: "text-purple-700" },
  recruiter: { label: "Recruiter", icon: Briefcase, color: "text-emerald-700" },
  learner: { label: "Learner", icon: GraduationCap, color: "text-amber-700" },
  admin: { label: "Admin", icon: Shield, color: "text-rose-700" },
};

interface DashboardLayoutProps {
  role: DashboardRole;
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  children: ReactNode;
}

export default function DashboardLayout({ role, title, description, breadcrumbs, actions, children }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const nav = NAV_BY_ROLE[role];
  const meta = ROLE_META[role];
  const RoleIcon = meta.icon;

  const groups = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    const g = item.group || "Main";
    (acc[g] ||= []).push(item);
    return acc;
  }, {});

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex bg-cream-soft" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)', backgroundSize: '24px 24px' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 flex flex-col transition-transform lg:translate-x-0",
          "bg-cream-soft/70 backdrop-blur-xl backdrop-saturate-150 border-r-2 border-slate-900/90 shadow-[4px_0_0_0_rgba(15,23,42,0.05)]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="px-4 py-4 border-b-2 border-slate-900/90 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,0.9)]">O</div>
            <span className="font-bold text-slate-900 text-lg">Octamy</span>
          </Link>
          <button className="lg:hidden text-slate-500" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-4 py-3 border-b border-cream-deep">
          <div className="flex items-center gap-2 px-3 py-2 bg-white/70 backdrop-blur rounded-xl border-2 border-slate-900/90 shadow-[2px_2px_0_0_rgba(15,23,42,0.9)]">
            <RoleIcon className={cn("w-4 h-4", meta.color)} />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">{meta.label}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group}</div>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = location === item.href || (item.href !== "/" && location.startsWith(item.href + "/"));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all",
                          active
                            ? "bg-slate-900 text-white font-semibold border-2 border-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,0.9)]"
                            : "text-slate-700 hover:bg-white/60 hover:backdrop-blur border-2 border-transparent hover:border-slate-900/20"
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Switch role / public site */}
        <div className="px-4 py-3 border-t-2 border-slate-900/90 space-y-1">
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-white/60 hover:backdrop-blur">
            <ChevronRight className="w-3 h-3 rotate-180" /> Back to public site
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-cream/60 backdrop-blur-xl backdrop-saturate-150 border-b-2 border-slate-900/90">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="lg:hidden p-1.5 rounded-md hover:bg-cream-deep"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5 text-slate-700" />
              </button>
              {/* Breadcrumbs */}
              {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                  {breadcrumbs.map((b, i) => (
                    <span key={i} className="flex items-center gap-1.5 min-w-0">
                      {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" />}
                      {b.href ? (
                        <Link href={b.href} className="hover:text-slate-900 truncate">{b.label}</Link>
                      ) : (
                        <span className="text-slate-700 truncate">{b.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
              )}
            </div>

            {/* User menu */}
            <div className="flex items-center gap-2 relative">
              <button className="p-1.5 rounded-md hover:bg-cream-deep text-slate-600" aria-label="Notifications">
                <Bell className="w-4 h-4" />
              </button>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-cream-deep"
              >
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-semibold">
                  {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-sm text-slate-700 max-w-[140px] truncate">{user?.name || user?.email}</span>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-cream-deep py-1 z-50">
                    <div className="px-3 py-2 border-b border-cream-deep">
                      <div className="text-sm font-medium text-slate-900 truncate">{user?.name}</div>
                      <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                    </div>
                    <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-cream-soft">
                      <UserIcon className="w-4 h-4" /> Profile
                    </Link>
                    <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-cream-soft">
                      <GraduationCap className="w-4 h-4" /> Switch to learner
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">{title}</h1>
                {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
              </div>
              {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
