import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth.tsx";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Menu,
  X,
  Search,
  ChevronDown,
  Sparkles,
  ArrowRight,
  GraduationCap,
  ShieldCheck,
  Award,
  Users,
  Building2,
  Briefcase,
  HandCoins,
  HelpCircle,
  FileText,
  Trophy,
  ChevronRight,
} from "lucide-react";
import octamyLogoDark from "@/assets/image_1750054456482.png";
import type { Category } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";

type RoleFlags = {
  isLearner: boolean;
  isCreator: boolean;
  isInstituteMember: boolean;
  isRecruiter: boolean;
  isSeller: boolean;
  isAdmin: boolean;
};

const PREMIUM_CATEGORY_SLUGS: string[] = (
  import.meta.env.VITE_PREMIUM_CATEGORY_SLUGS || ""
)
  .split(",")
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);

type MegaItem = {
  href: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
};

export default function Header() {
  const { user, token, logout: authLogout, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthenticated = !!user && !!token;

  const { data: roles } = useQuery<RoleFlags>({
    queryKey: ["/api/me/roles"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/roles");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const hats = (() => {
    if (!roles) return [] as { key: string; label: string; href: string; matches: (p: string) => boolean }[];
    const list: { key: string; label: string; href: string; matches: (p: string) => boolean }[] = [
      { key: "learner", label: "Learner", href: "/dashboard", matches: (p) => p === "/dashboard" || p === "/progress" || p === "/preferences" },
    ];
    if (roles.isCreator)
      list.push({ key: "creator", label: "Creator", href: "/creator/dashboard", matches: (p) => p.startsWith("/creator/") && p !== "/creator" });
    if (roles.isInstituteMember)
      list.push({ key: "institute", label: "Institute", href: "/institute/dashboard", matches: (p) => p.startsWith("/institute/") && p !== "/institute" });
    if (roles.isRecruiter)
      list.push({ key: "recruiter", label: "Recruiter", href: "/recruiter/dashboard", matches: (p) => p.startsWith("/recruiter/") });
    if (roles.isSeller)
      list.push({ key: "seller", label: "Affiliate", href: "/seller-dashboard", matches: (p) => p === "/seller-dashboard" || p === "/partner-dashboard" });
    if (roles.isAdmin)
      list.push({ key: "admin", label: "Admin", href: "/admin/dashboard", matches: (p) => p.startsWith("/admin") || p.startsWith("/qwegle") });
    return list;
  })();

  const currentHat = hats.find((h) => h.matches(location)) || hats[0];

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openWith = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(key);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };

  const handleLogout = () => {
    authLogout();
    setLocation("/");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      setLocation(`/exams?q=${encodeURIComponent(q)}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const skillVerificationItems: MegaItem[] = [
    {
      href: "/virtual-internships",
      title: "Virtual Internship Programs",
      description: "Assessment-based internships with optional certification.",
      icon: <Briefcase className="h-5 w-5" />,
    },
    {
      href: "/exams",
      title: "Skill Assessments",
      description: "Free competency tests across 50+ tracks.",
      icon: <GraduationCap className="h-5 w-5" />,
    },
    {
      href: "/verify",
      title: "Verify a Credential",
      description: "Recruiters: confirm any Octamy certificate in 5 seconds.",
      icon: <ShieldCheck className="h-5 w-5" />,
    },
    {
      href: "/#badges",
      title: "Performance Badges",
      description: "Bronze · Silver · Gold · Platinum tiers.",
      icon: <Trophy className="h-5 w-5" />,
    },
  ];

  const businessItems: MegaItem[] = [
    {
      href: "/business-certifications",
      title: "Team Certifications",
      description: "Bulk-certify your workforce with branded credentials.",
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      href: "/recruiter/auth",
      title: "For Recruiters",
      description: "Hire verified, score-graded candidates.",
      icon: <Users className="h-5 w-5" />,
    },
    {
      href: "/sponsor",
      title: "Sponsor Assessments",
      description: "Support skill development and gain employer brand exposure.",
      icon: <HandCoins className="h-5 w-5" />,
    },
  ];

  const sellerItems: MegaItem[] = [
    {
      href: "/partners",
      title: "Become a Reseller",
      description: "Sell skill assessments — earn commission per certificate.",
      icon: <HandCoins className="h-5 w-5" />,
      badge: "Earn",
    },
    {
      href: "/seller-auth",
      title: "Seller Login",
      description: "Access your dashboard, courses and withdrawals.",
      icon: <Briefcase className="h-5 w-5" />,
    },
  ];

  const resourceItems: MegaItem[] = [
    { href: "/help-center", title: "Help Center", icon: <HelpCircle className="h-5 w-5" /> },
    { href: "/about", title: "About Octamy", icon: <FileText className="h-5 w-5" /> },
    { href: "/contact", title: "Contact", icon: <FileText className="h-5 w-5" /> },
    { href: "/privacy-policy", title: "Privacy Policy", icon: <FileText className="h-5 w-5" /> },
    { href: "/terms-of-service", title: "Terms of Service", icon: <FileText className="h-5 w-5" /> },
    { href: "/refund-policy", title: "Refund Policy", icon: <FileText className="h-5 w-5" /> },
  ];

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-slate-900 focus:text-white focus:px-3 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Skip to main content
      </a>

      <div className="hidden md:block bg-slate-900 text-white text-xs">
        <div className="max-w-7xl mx-auto px-6 h-8 flex items-center justify-between">
          <p className="flex items-center gap-2 text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Free skill assessments · Pay only when you pass · ISO 9001:2015 certified platform</span>
          </p>
          <div className="flex items-center gap-5 text-slate-300">
            <Link href="/verify" className="hover:text-white">Verify credential</Link>
            <span className="opacity-40">•</span>
            <Link href="/recruiter/login" className="hover:text-white">For recruiters</Link>
            <span className="opacity-40">•</span>
            <Link href="/partners" className="hover:text-white">Become a seller</Link>
          </div>
        </div>
      </div>

      <header className="sticky top-2 z-50" onMouseLeave={scheduleClose}>
        <div
          className={
            "max-w-7xl mx-auto px-4 sm:px-6 rounded-[999px] border backdrop-blur-md transition-all " +
            (scrolled
              ? "bg-white/95 border-slate-200 shadow-md"
              : "bg-white/90 border-slate-200/80 shadow-sm")
          }
        >
          <div className="h-16 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center shrink-0">
              <img src={octamyLogoDark} alt="Octamy" className="h-7 w-auto" />
            </Link>

            <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
              <MegaTrigger label="Exams" isOpen={openMenu === "exams"} onOpen={() => openWith("exams")} onClose={scheduleClose} />
              <MegaTrigger label="Skill Verification" isOpen={openMenu === "verify"} onOpen={() => openWith("verify")} onClose={scheduleClose} />
              <MegaTrigger label="For Business" isOpen={openMenu === "biz"} onOpen={() => openWith("biz")} onClose={scheduleClose} />
              <MegaTrigger label="Sellers" isOpen={openMenu === "sellers"} onOpen={() => openWith("sellers")} onClose={scheduleClose} />
              <MegaTrigger label="Resources" isOpen={openMenu === "resources"} onOpen={() => openWith("resources")} onClose={scheduleClose} />
            </nav>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="hidden md:inline-flex items-center justify-center h-9 w-9 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Search exams"
                aria-expanded={searchOpen}
              >
                <Search className="h-4 w-4" />
              </button>

              {!isLoading && !isAuthenticated ? (
                <div className="hidden md:flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="ghost" className="text-slate-700 hover:text-slate-900 hover:bg-slate-100">Sign in</Button>
                  </Link>
                  <Link href="/register">
                    <Button className="bg-slate-900 hover:bg-black text-white rounded-full px-5">Get started</Button>
                  </Link>
                </div>
              ) : !isLoading ? (
                <div className="hidden md:flex items-center gap-2">
                  {hats.length >= 2 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 gap-1">
                          {currentHat?.label ?? "Dashboard"}
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Switch hat</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {hats.map((h) => (
                          <DropdownMenuItem
                            key={h.key}
                            onClick={() => setLocation(h.href)}
                            className={currentHat?.key === h.key ? "bg-slate-100 font-medium" : ""}
                          >
                            {h.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Link href={currentHat?.href ?? "/dashboard"}>
                      <Button variant="ghost" className="text-slate-700 hover:text-slate-900 hover:bg-slate-100">Dashboard</Button>
                    </Link>
                  )}
                  <Button onClick={handleLogout} variant="outline" className="border-slate-300 text-slate-700 rounded-full">Logout</Button>
                </div>
              ) : null}

              <button
                className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-md text-slate-700 hover:bg-slate-100"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {searchOpen && (
            <form onSubmit={handleSearchSubmit} className="pb-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search assessments, categories, skills…"
                  className="w-full h-11 pl-10 pr-4 rounded-full border border-slate-300 bg-slate-50 focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-sky-200 outline-none text-sm"
                />
              </div>
            </form>
          )}
        </div>

        {openMenu && (
          <div
            className="hidden lg:block absolute left-0 right-0 top-[calc(100%+10px)] bg-white border border-slate-200 shadow-lg rounded-2xl"
            onMouseEnter={() => openWith(openMenu)}
            onMouseLeave={scheduleClose}
          >
            <div className="max-w-7xl mx-auto px-6 py-8">
              {openMenu === "exams" && <ExamsMega categories={categories} />}
              {openMenu === "verify" && <SimpleMega items={skillVerificationItems} promoTitle="Free assessments" promoBody="Take any test free. Pay only for the certificate after you pass." promoHref="/exams" promoCta="Browse exams" />}
              {openMenu === "biz" && <SimpleMega items={businessItems} promoTitle="Hire verified talent" promoBody="Search candidates by exam, score and badge tier. Free recruiter accounts." promoHref="/recruiter/auth" promoCta="Recruiter signup" />}
              {openMenu === "sellers" && <SimpleMega items={sellerItems} promoTitle="Earn with Octamy" promoBody="Resell skill assessments and earn recurring commission per certificate." promoHref="/partners" promoCta="Apply to become a seller" />}
              {openMenu === "resources" && <ResourcesMega items={resourceItems} />}
            </div>
          </div>
        )}

        {mobileOpen && (
          <div className="lg:hidden mt-2 rounded-2xl border border-slate-200 bg-white shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="px-4 py-4 space-y-1">
              <MobileGroup
                title="Exams"
                items={[
                  { href: "/exams", title: "All assessments" },
                  ...categories.slice(0, 8).map((c) => ({
                    href: `/category/${c.slug}`,
                    title: c.name,
                    badge: PREMIUM_CATEGORY_SLUGS.includes(c.slug) ? "Premium" : undefined,
                  })),
                ]}
              />
              <MobileGroup title="Skill Verification" items={skillVerificationItems} />
              <MobileGroup title="For Business" items={businessItems} />
              <MobileGroup title="Sellers" items={sellerItems} />
              <MobileGroup title="Resources" items={resourceItems} />

              <div className="pt-4 mt-2 border-t border-slate-200 space-y-2">
                {!isAuthenticated ? (
                  <>
                    <Link href="/login">
                      <Button variant="outline" className="w-full">Sign in</Button>
                    </Link>
                    <Link href="/register">
                      <Button className="w-full bg-slate-900 hover:bg-black text-white">Get started</Button>
                    </Link>
                  </>
                ) : (
                  <>
                    {hats.length >= 2 ? (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 px-1">Switch hat</div>
                        {hats.map((h) => (
                          <Link key={h.key} href={h.href}>
                            <Button
                              variant={currentHat?.key === h.key ? "default" : "outline"}
                              className={`w-full ${currentHat?.key === h.key ? "bg-slate-900 text-white" : ""}`}
                            >
                              {h.label}
                            </Button>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <Link href={currentHat?.href ?? "/dashboard"}>
                        <Button variant="outline" className="w-full">Dashboard</Button>
                      </Link>
                    )}
                    <Button onClick={handleLogout} className="w-full bg-slate-900 hover:bg-black text-white">Logout</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

function MegaTrigger({ label, isOpen, onOpen, onClose }: { label: string; isOpen: boolean; onOpen: () => void; onClose: () => void }) {
  return (
    <button
      type="button"
      onMouseEnter={onOpen}
      onFocus={onOpen}
      onClick={onOpen}
      className={
        "inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors " +
        (isOpen ? "text-slate-900 bg-slate-100" : "text-slate-700 hover:text-slate-900 hover:bg-slate-100")
      }
      aria-expanded={isOpen}
      aria-haspopup="true"
    >
      {label}
      <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (isOpen ? "rotate-180" : "")} />
    </button>
  );
}

function ExamsMega({ categories }: { categories: Category[] }) {
  const top = categories.slice(0, 9);
  return (
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-9">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 mb-4">
          Browse by category
        </p>
        <ul className="grid grid-cols-3 gap-x-6 gap-y-2">
          {top.map((c) => {
            const isPremium = PREMIUM_CATEGORY_SLUGS.includes(c.slug);
            return (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="group flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-slate-50">
                  <span className="flex items-center gap-2 text-sm text-slate-800 group-hover:text-slate-900">
                    {isPremium && <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                    {c.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 pt-4 border-t border-slate-100">
          <Link href="/exams" className="inline-flex items-center text-sm font-medium text-slate-900 hover:text-sky-700">
            See all assessments
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="col-span-3">
        <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 h-full flex flex-col justify-between">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-300/30">
              <Sparkles className="h-3 w-3" /> Free
            </span>
            <h3 className="mt-3 font-semibold leading-tight text-white">Take any assessment free</h3>
            <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
              Pay only when you pass — get a verified certificate trusted by recruiters across India.
            </p>
          </div>
          <Link href="/exams" className="mt-5 inline-flex items-center text-sm font-semibold text-white hover:text-amber-300">
            Start now <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function SimpleMega({ items, promoTitle, promoBody, promoHref, promoCta }: { items: MegaItem[]; promoTitle: string; promoBody: string; promoHref: string; promoCta: string }) {
  return (
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-9">
        <ul className="grid grid-cols-2 gap-2">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="group flex gap-3 items-start rounded-lg p-3 hover:bg-slate-50">
                <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700 group-hover:bg-sky-50 group-hover:text-sky-700 transition-colors shrink-0">
                  {i.icon || <Award className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 text-sm">{i.title}</span>
                    {i.badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{i.badge}</span>}
                  </span>
                  {i.description && <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">{i.description}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="col-span-3">
        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-5 h-full flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">{promoTitle}</h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{promoBody}</p>
          </div>
          <Link href={promoHref} className="mt-4 inline-flex items-center text-sm font-semibold text-sky-700 hover:text-sky-900">
            {promoCta} <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function ResourcesMega({ items }: { items: MegaItem[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {items.map((i) => (
        <li key={i.href}>
          <Link href={i.href} className="group flex gap-3 items-center rounded-lg p-3 hover:bg-slate-50">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 group-hover:bg-sky-50 group-hover:text-sky-700 transition-colors">
              {i.icon}
            </span>
            <span className="text-sm font-medium text-slate-800 group-hover:text-slate-900">{i.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MobileGroup({ title, items }: { title: string; items: MegaItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-3 text-left text-sm font-semibold text-slate-900"
        aria-expanded={open}
      >
        {title}
        <ChevronDown className={"h-4 w-4 text-slate-500 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <ul className="pb-3 space-y-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                <span>{i.title}</span>
                {i.badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{i.badge}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
