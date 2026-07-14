import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import octamyLogoDark from "@/assets/image_1750054456482.png";

type RoleFlags = {
  isLearner: boolean;
  isCreator: boolean;
  isInstituteMember: boolean;
  isRecruiter: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  instituteRole: "owner" | "admin" | "teacher" | "staff" | null;
};

const PUBLIC_LINKS = [
  { href: "/exams", label: "Assessments" },
  { href: "/creator", label: "For creators" },
  { href: "/institute", label: "For institutes" },
  { href: "/for-recruiters", label: "For recruiters" },
  { href: "/verify", label: "Verify" },
] as const;

const APP_ROUTE_PREFIXES = [
  "/login", "/register", "/forgot-password", "/reset-password", "/dashboard",
  "/progress", "/preferences", "/profile", "/creator/dashboard", "/creator/courses",
  "/creator/payouts", "/creator/earnings", "/institute/dashboard", "/institute/students",
  "/institute/cohorts", "/institute/exams", "/institute/reports", "/institute/team",
  "/recruiter/dashboard", "/recruiter/analytics", "/recruiter/search", "/recruiter/wallet",
  "/recruiter/profile", "/recruiter/settings", "/recruiter/saved-searches", "/admin",
  "/qwegle", "/enhanced-admin", "/seller-dashboard", "/partner-dashboard", "/question-banks",
  "/exam", "/x", "/payment", "/checkout", "/certificate", "/internship-payment",
];

export default function Header() {
  const { user, token, logout, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const isAuthenticated = !!user && !!token;
  const isAppRoute = APP_ROUTE_PREFIXES.some((prefix) => location === prefix || location.startsWith(`${prefix}/`)) ||
    /^\/(creator|institute|recruiter)\/(login|register)/.test(location);

  const { data: roles } = useQuery<RoleFlags>({
    queryKey: ["/api/me/roles"],
    enabled: isAuthenticated,
    queryFn: async () => (await apiRequest("GET", "/api/me/roles")).json(),
    staleTime: 60_000,
  });

  const workspaces = useMemo(() => {
    if (!roles) return [] as Array<{ key: string; label: string; href: string; active: boolean }>;
    const items = [
      { key: "learner", label: "Learner", href: "/dashboard", active: location === "/dashboard" || location === "/progress" || location === "/preferences" },
    ];
    if (roles.isCreator) items.push({ key: "creator", label: "Creator", href: "/creator/dashboard", active: location.startsWith("/creator/") });
    if (roles.isInstituteMember) items.push({ key: "institute", label: "Institute", href: "/institute/dashboard", active: location.startsWith("/institute/") });
    if (roles.isRecruiter) items.push({ key: "recruiter", label: "Recruiter", href: "/recruiter/dashboard", active: location.startsWith("/recruiter/") });
    if (roles.isSeller) items.push({ key: "seller", label: "Partner", href: "/partner-dashboard", active: location === "/partner-dashboard" });
    if (roles.isAdmin) items.push({ key: "admin", label: "Admin", href: "/qwegle/dashboard", active: location.startsWith("/admin") || location.startsWith("/qwegle") });
    return items;
  }, [location, roles]);
  const currentWorkspace = workspaces.find((item) => item.active) || workspaces[0];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setLocation(`/exams?q=${encodeURIComponent(query)}`);
    setSearchQuery("");
    setSearchOpen(false);
    setMobileOpen(false);
  }

  function signOut() {
    logout();
    setLocation("/");
  }

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-slate-950 focus:px-4 focus:py-3 focus:text-white">
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 px-2 sm:px-4">
        <div className={`mx-auto max-w-7xl rounded-full border px-4 backdrop-blur-xl transition-shadow sm:px-5 ${scrolled ? "border-slate-200 bg-white/95 shadow-lg shadow-slate-900/5" : "border-slate-200/80 bg-white/85 shadow-sm"}`}>
          <div className="flex h-16 items-center justify-between gap-3">
            <Link href="/" aria-label="Octamy home" className="flex min-h-11 shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950">
              <img src={octamyLogoDark} alt="Octamy home" className="h-7 w-auto" />
            </Link>

            {!isAppRoute && (
              <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
                {PUBLIC_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${location === item.href ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}

            <div className="flex items-center gap-1.5">
              {!isAppRoute && (
                <button type="button" onClick={() => setSearchOpen((open) => !open)} className="hidden h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-950 md:inline-flex" aria-label="Search assessments" aria-expanded={searchOpen}>
                  <Search className="h-4 w-4" />
                </button>
              )}

              {!isLoading && !isAuthenticated && !isAppRoute && (
                <div className="hidden items-center gap-1 md:flex">
                  <Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button>
                  <Button asChild className="rounded-full px-5"><Link href="/register">Get started</Link></Button>
                </div>
              )}

              {!isLoading && isAuthenticated && (
                <div className="hidden items-center gap-2 md:flex">
                  {workspaces.length > 1 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="gap-1">
                          {currentWorkspace?.label || "Workspace"}<ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {workspaces.map((workspace) => (
                          <DropdownMenuItem key={workspace.key} onSelect={() => setLocation(workspace.href)} className={workspace.active ? "bg-slate-100 font-semibold" : ""}>
                            {workspace.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button asChild variant="ghost"><Link href={currentWorkspace?.href || "/dashboard"}>Dashboard</Link></Button>
                  )}
                  <Button type="button" onClick={signOut} variant="outline" className="rounded-full">Sign out</Button>
                </div>
              )}

              <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="public-mobile-navigation">
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {searchOpen && !isAppRoute && (
            <SearchForm id="site-assessment-search-desktop" value={searchQuery} onChange={setSearchQuery} onSubmit={submitSearch} className="pb-4" autoFocus />
          )}
        </div>

        {mobileOpen && (
          <div id="public-mobile-navigation" className="mx-auto mt-2 max-w-7xl rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/10 lg:hidden">
            {!isAppRoute && <SearchForm id="site-assessment-search-mobile" value={searchQuery} onChange={setSearchQuery} onSubmit={submitSearch} className="mb-3" autoFocus />}
            <nav aria-label="Mobile navigation" className="grid gap-1">
              {!isAppRoute && PUBLIC_LINKS.map((item) => (
                <Link key={item.href} href={item.href} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950">
                  {item.label}
                </Link>
              ))}
              {!isAppRoute && <Link href="/vision" className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Our vision</Link>}
            </nav>

            <div className="mt-3 grid gap-2 border-t border-slate-200 pt-4">
              {!isAuthenticated ? (
                <>
                  <Button asChild variant="outline"><Link href="/login">Sign in</Link></Button>
                  <Button asChild><Link href="/register">Get started</Link></Button>
                </>
              ) : (
                <>
                  {workspaces.map((workspace) => (
                    <Button key={workspace.key} asChild variant={workspace.active ? "default" : "outline"}>
                      <Link href={workspace.href}>{workspace.label} workspace</Link>
                    </Button>
                  ))}
                  <Button type="button" onClick={signOut} variant="ghost">Sign out</Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}

function SearchForm({ id, value, onChange, onSubmit, className = "", autoFocus = false }: { id: string; value: string; onChange: (value: string) => void; onSubmit: (event: React.FormEvent) => void; className?: string; autoFocus?: boolean }) {
  return (
    <form onSubmit={onSubmit} role="search" className={className}>
      <label htmlFor={id} className="sr-only">Search assessments</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input id={id} autoFocus={autoFocus} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search assessments or skills" className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-slate-500 focus:bg-white focus:ring-2 focus:ring-slate-200" />
      </div>
    </form>
  );
}
