import {
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "wouter";
import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  GraduationCap,
  Images,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  User as UserIcon,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth.tsx";
import { useDashboardRoles } from "@/lib/use-dashboard-role";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

export type DashboardRole = "institute" | "creator" | "recruiter" | "learner" | "admin";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
};

type WorkspaceOption = {
  role: DashboardRole;
  label: string;
  href: string;
  icon: LucideIcon;
};

const NAV_BY_ROLE: Record<DashboardRole, NavItem[]> = {
  institute: [
    { label: "Overview", href: "/institute/dashboard", icon: LayoutDashboard, group: "Main" },
    { label: "Courses", href: "/institute/courses", icon: BookOpen, group: "Manage" },
    { label: "Exams", href: "/institute/exams", icon: ClipboardList, group: "Manage" },
    { label: "Question banks", href: "/institute/question-banks", icon: Database, group: "Manage" },
    { label: "Media library", href: "/institute/media", icon: Images, group: "Manage" },
    { label: "Students", href: "/institute/students", icon: GraduationCap, group: "Manage" },
    { label: "Team", href: "/institute/team", icon: Users, group: "Manage" },
    { label: "Reports", href: "/institute/reports", icon: BarChart3, group: "Insights" },
    { label: "Revenue & payouts", href: "/institute/payouts", icon: Wallet, group: "Money" },
    { label: "Institute identity", href: "/institute/settings", icon: Settings, group: "Account" },
  ],
  creator: [
    { label: "Overview", href: "/creator/dashboard", icon: LayoutDashboard, group: "Main" },
    { label: "Courses", href: "/creator/courses", icon: BookOpen, group: "Manage" },
    { label: "Question banks", href: "/creator/question-banks", icon: Database, group: "Manage" },
    { label: "Media library", href: "/creator/media", icon: Images, group: "Manage" },
    { label: "Earnings", href: "/creator/earnings", icon: Wallet, group: "Money" },
    { label: "Payouts", href: "/creator/payouts", icon: Wallet, group: "Money" },
    { label: "Account settings", href: "/profile-edit", icon: Settings, group: "Account" },
  ],
  recruiter: [
    { label: "Overview", href: "/recruiter/dashboard", icon: LayoutDashboard, group: "Main" },
    { label: "Search talent", href: "/recruiter/search", icon: Search, group: "Manage" },
    { label: "Saved searches", href: "/recruiter/saved-searches", icon: ListChecks, group: "Manage" },
    { label: "Profile", href: "/recruiter/profile", icon: UserIcon, group: "Account" },
    { label: "Company settings", href: "/recruiter/settings", icon: Settings, group: "Account" },
  ],
  learner: [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard, group: "Main" },
    { label: "My certificates", href: "/my-certificates", icon: Award, group: "Learning" },
    { label: "Progress", href: "/progress", icon: BarChart3, group: "Learning" },
    { label: "Browse exams", href: "/assessments", icon: BookOpen, group: "Learning" },
    { label: "Preferences", href: "/preferences", icon: SlidersHorizontal, group: "Account" },
    { label: "Profile", href: "/profile-edit", icon: Settings, group: "Account" },
  ],
  admin: [
    { label: "Overview", href: "/qwegle/dashboard", icon: LayoutDashboard, group: "Main" },
    { label: "Approvals", href: "/admin/approvals", icon: Shield, group: "Moderate" },
    { label: "Public site", href: "/", icon: ChevronRight, group: "Account" },
  ],
};

const ROLE_META: Record<DashboardRole, {
  label: string;
  helper: string;
  home: string;
  icon: LucideIcon;
  accent: string;
  accentSoft: string;
}> = {
  institute: {
    label: "Institute",
    helper: "Learning operations",
    home: "/institute/dashboard",
    icon: Building2,
    accent: "text-blue-700",
    accentSoft: "bg-blue-50 ring-blue-100",
  },
  creator: {
    label: "Creator",
    helper: "Content studio",
    home: "/creator/dashboard",
    icon: BookOpen,
    accent: "text-violet-700",
    accentSoft: "bg-violet-50 ring-violet-100",
  },
  recruiter: {
    label: "Recruiter",
    helper: "Talent intelligence",
    home: "/recruiter/dashboard",
    icon: Briefcase,
    accent: "text-emerald-700",
    accentSoft: "bg-emerald-50 ring-emerald-100",
  },
  learner: {
    label: "Learner",
    helper: "Skills passport",
    home: "/dashboard",
    icon: GraduationCap,
    accent: "text-amber-700",
    accentSoft: "bg-amber-50 ring-amber-100",
  },
  admin: {
    label: "Admin",
    helper: "Platform operations",
    home: "/qwegle/dashboard",
    icon: Shield,
    accent: "text-rose-700",
    accentSoft: "bg-rose-50 ring-rose-100",
  },
};

const ROLE_ORDER: DashboardRole[] = ["learner", "creator", "institute", "recruiter", "admin"];

interface DashboardLayoutProps {
  role: DashboardRole;
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  children: ReactNode;
}

function isActiveRoute(location: string, href: string) {
  const pathname = location.split("?")[0];
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function WorkspaceSwitcher({
  role,
  workspaces,
  onNavigate,
  compact = false,
}: {
  role: DashboardRole;
  workspaces: WorkspaceOption[];
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const meta = ROLE_META[role];
  const RoleIcon = meta.icon;

  if (workspaces.length <= 1) {
    return (
      <div className={cn("flex min-w-0 items-center gap-3", compact ? "px-1" : "rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm")}>
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1", meta.accentSoft)}>
          <RoleIcon className={cn("h-4 w-4", meta.accent)} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{meta.label}</span>
          {!compact && <span className="block truncate text-xs text-slate-500">{meta.helper}</span>}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-xl text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2",
            compact ? "px-1 hover:bg-slate-100" : "border border-slate-200 bg-white px-3 py-2.5 shadow-sm hover:border-slate-300",
          )}
          aria-label={`Current workspace: ${meta.label}. Switch workspace`}
        >
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1", meta.accentSoft)}>
            <RoleIcon className={cn("h-4 w-4", meta.accent)} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900">{meta.label}</span>
            {!compact && <span className="block truncate text-xs text-slate-500">{meta.helper}</span>}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-xl border-slate-200 p-1.5 shadow-xl">
        <DropdownMenuLabel className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Switch workspace
        </DropdownMenuLabel>
        {workspaces.map((workspace) => {
          const WorkspaceIcon = workspace.icon;
          const isCurrent = workspace.role === role;
          return (
            <DropdownMenuItem key={workspace.role} asChild className="min-h-11 cursor-pointer rounded-lg p-0 focus:bg-slate-100">
              <Link
                href={workspace.href}
                onClick={onNavigate}
                className="flex min-h-11 w-full items-center gap-3 px-3 py-2"
                aria-current={isCurrent ? "page" : undefined}
              >
                <WorkspaceIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span className="flex-1 text-sm font-medium text-slate-800">{workspace.label}</span>
                {isCurrent && <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarNavigation({
  role,
  location,
  nav,
  workspaces,
  onNavigate,
}: {
  role: DashboardRole;
  location: string;
  nav: NavItem[];
  workspaces: WorkspaceOption[];
  onNavigate?: () => void;
}) {
  const groups = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    const group = item.group || "Main";
    (acc[group] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex min-h-[72px] items-center border-b border-slate-200 px-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          aria-label="Octamy public website"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white shadow-sm">O</span>
          <span className="text-lg font-bold tracking-tight text-slate-950">Octamy</span>
        </Link>
      </div>

      <div className="border-b border-slate-200 px-4 py-4">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Current workspace</p>
        <WorkspaceSwitcher role={role} workspaces={workspaces} onNavigate={onNavigate} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label={`${ROLE_META[role].label} workspace`}>
        <div className="space-y-5">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{group}</p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActiveRoute(location, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1",
                          active
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                        )}
                      >
                        <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-slate-400")} aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
          Public website
        </Link>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  role,
  title,
  description,
  breadcrumbs,
  actions,
  children,
}: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const rolesQuery = useDashboardRoles();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [childHasPageHeading, setChildHasPageHeading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const nav = useMemo(() => {
    const items = NAV_BY_ROLE[role];
    if (role !== "institute" || rolesQuery.data?.isAdmin) return items;
    const instituteRole = rolesQuery.data?.instituteRole;
    if (!instituteRole || instituteRole === "staff") return items.filter((item) => item.href === "/institute/dashboard");
    if (instituteRole === "teacher") {
      return items.filter((item) => item.href !== "/institute/payouts" && item.href !== "/institute/settings");
    }
    return items;
  }, [role, rolesQuery.data?.instituteRole, rolesQuery.data?.isAdmin]);
  const meta = ROLE_META[role];
  const RoleIcon = meta.icon;

  const workspaces = useMemo<WorkspaceOption[]>(() => {
    const flags = rolesQuery.data;
    const available = new Set<DashboardRole>();

    if (role === "admin") {
      available.add("admin");
    } else {
      available.add("learner");
      if (flags?.isCreator) available.add("creator");
      if (flags?.isInstituteMember) available.add("institute");
      if (flags?.isRecruiter) available.add("recruiter");
      if (flags?.isAdmin || user?.isAdmin) available.add("admin");
      // Keep the authorized current workspace visible while the role query is
      // loading or temporarily unavailable.
      available.add(role);
    }

    return ROLE_ORDER.filter((workspaceRole) => available.has(workspaceRole)).map((workspaceRole) => ({
      role: workspaceRole,
      label: ROLE_META[workspaceRole].label,
      href: ROLE_META[workspaceRole].home,
      icon: ROLE_META[workspaceRole].icon,
    }));
  }, [role, rolesQuery.data, user?.isAdmin]);

  // Some older pages still own their contextual h1. Detect it before paint so
  // the shell does not show a second title, while newer pages continue to get a
  // consistent accessible page heading from the layout.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const updateHeadingOwnership = () => setChildHasPageHeading(Boolean(content.querySelector("h1")));
    updateHeadingOwnership();

    const observer = new MutationObserver(updateHeadingOwnership);
    observer.observe(content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [children, location]);

  const handleLogout = () => {
    if (role === "admin") {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      setLocation("/qwegle/login");
      return;
    }
    logout();
    setLocation("/");
  };

  const displayName = role === "admin" ? "Administrator" : (user?.name || user?.email || "Account");
  const displayEmail = role === "admin" ? "Admin workspace" : user?.email;
  const showMobileMore = nav.length > 4;
  const mobilePrimaryNav = nav.slice(0, showMobileMore ? 4 : 5);
  const moreNavigationActive = showMobileMore && nav.slice(4).some((item) => isActiveRoute(location, item.href));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-slate-950 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-xl"
      >
        Skip to main content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-white lg:block" aria-label="Workspace sidebar">
        <SidebarNavigation role={role} location={location} nav={nav} workspaces={workspaces} />
      </aside>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-[min(88vw,320px)] border-r border-slate-200 bg-white p-0 shadow-2xl [&>button]:right-3 [&>button]:top-3 [&>button]:grid [&>button]:h-11 [&>button]:w-11 [&>button]:place-items-center [&>button]:rounded-lg [&>button]:opacity-100 [&>button]:hover:bg-slate-100"
        >
          <SheetTitle className="sr-only">{meta.label} workspace navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate the workspace or switch to another available Octamy workspace.</SheetDescription>
          <SidebarNavigation
            role={role}
            location={location}
            nav={nav}
            workspaces={workspaces}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-600 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-900 lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open workspace navigation"
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>

              {breadcrumbs && breadcrumbs.length > 0 ? (
                <nav className="hidden min-w-0 items-center gap-1.5 text-sm text-slate-500 sm:flex" aria-label="Breadcrumb">
                  {breadcrumbs.map((breadcrumb, index) => (
                    <span key={`${breadcrumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                      {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />}
                      {breadcrumb.href ? (
                        <Link href={breadcrumb.href} className="truncate rounded-sm outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900">
                          {breadcrumb.label}
                        </Link>
                      ) : (
                        <span className={cn("truncate", index === breadcrumbs.length - 1 && "font-medium text-slate-700")} aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>
                          {breadcrumb.label}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>
              ) : (
                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                  <RoleIcon className={cn("h-4 w-4", meta.accent)} aria-hidden="true" />
                  <span className="truncate text-sm font-medium text-slate-700">{meta.label} workspace</span>
                </div>
              )}

              <div className="min-w-0 sm:hidden">
                <p className="truncate text-xs font-medium text-slate-500">{meta.label}</p>
                <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-11 max-w-[190px] items-center gap-2 rounded-xl px-1.5 pr-2 text-left outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 sm:px-2"
                  aria-label="Open account menu"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-semibold text-white" aria-hidden="true">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className="block truncate text-sm font-semibold text-slate-800">{displayName}</span>
                    <span className="block truncate text-xs text-slate-500">{meta.label}</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 rounded-xl border-slate-200 p-1.5 shadow-xl">
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="truncate text-xs text-slate-500">{displayEmail}</p>
                </div>
                <DropdownMenuSeparator className="bg-slate-200" />
                <div className="px-2 py-2">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Workspace</p>
                  <WorkspaceSwitcher role={role} workspaces={workspaces} compact />
                </div>
                {role !== "admin" && (
                  <>
                    <DropdownMenuSeparator className="bg-slate-200" />
                    <DropdownMenuItem asChild className="min-h-11 cursor-pointer rounded-lg p-0 focus:bg-slate-100">
                      <Link href="/profile-edit" className="flex min-h-11 w-full items-center gap-3 px-3 text-sm font-medium text-slate-700">
                        <UserIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        Profile & account
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-slate-200" />
                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-medium text-rose-700 focus:bg-rose-50 focus:text-rose-800"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="px-4 pb-28 pt-5 outline-none sm:px-6 sm:pt-7 lg:px-8 lg:pb-10"
        >
          <div className="mx-auto max-w-7xl">
            {(!childHasPageHeading || actions) && (
              <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", childHasPageHeading && "justify-end sm:justify-end")}>
                {!childHasPageHeading && (
                  <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
                    {description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
                  </div>
                )}
                {actions && <div className="flex min-h-11 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
              </div>
            )}
            <div ref={contentRef}>{children}</div>
          </div>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
        aria-label="Primary workspace navigation"
      >
        <ul
          className="mx-auto grid max-w-lg gap-1"
          style={{ gridTemplateColumns: `repeat(${mobilePrimaryNav.length + (showMobileMore ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {mobilePrimaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActiveRoute(location, item.href);
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900",
                    active ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="w-full truncate text-center">{item.label}</span>
                </Link>
              </li>
            );
          })}
          {showMobileMore && (
            <li className="min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-expanded={mobileMenuOpen}
                className={cn(
                  "flex min-h-[52px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900",
                  moreNavigationActive ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                <span>More</span>
              </button>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
