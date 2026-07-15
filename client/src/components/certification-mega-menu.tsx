import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Award, ChevronDown, ChevronRight, Code2, FlaskConical, TicketCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { publicAssessmentCategoryPath, publicAssessmentPath, publicPracticeCategoryPath } from "@shared/public-assessment-routes";

type MenuItem = {
  id: number;
  title: string;
  slug: string;
  category: { id?: number; name: string; slug: string };
  audienceBands?: Array<{ code: string; label: string }>;
};

type MenuResponse = {
  items: MenuItem[];
  pagination: { total: number };
};

const CATEGORY_ORDER = [
  "enterprise-applications",
  "software-engineering",
  "data-ai-analytics",
  "cloud-devops",
  "cybersecurity",
  "product-business-technology",
  "tech-certifications",
];

function useCertificationMenu() {
  const query = useQuery<MenuResponse>({
    queryKey: ["/api/assessments", "certification-navigation"],
    queryFn: async () => (await apiRequest("GET", "/api/assessments?page=1&pageSize=48")).json(),
    staleTime: 5 * 60_000,
  });
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; items: MenuItem[] }>();
    for (const item of query.data?.items || []) {
      const existing = map.get(item.category.slug) || {
        name: item.category.name,
        slug: item.category.slug,
        items: [],
      };
      existing.items.push(item);
      map.set(item.category.slug, existing);
    }
    return Array.from(map.values()).sort((left, right) => {
      const leftIndex = CATEGORY_ORDER.indexOf(left.slug);
      const rightIndex = CATEGORY_ORDER.indexOf(right.slug);
      if (leftIndex === -1 && rightIndex === -1) return left.name.localeCompare(right.name);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
  }, [query.data?.items]);
  return { ...query, groups };
}

export function CertificationMegaMenu({ currentPath }: { currentPath: string }) {
  const { groups, isLoading } = useCertificationMenu();
  const [open, setOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeGroup = groups.find((group) => group.slug === activeSlug) || groups[0];
  const current = currentPath === "/get-certified" || currentPath.startsWith("/get-certified/");

  useEffect(() => {
    if (!activeSlug && groups[0]) setActiveSlug(groups[0].slug);
  }, [activeSlug, groups]);

  useEffect(() => {
    setOpen(false);
  }, [currentPath]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const openMenu = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 260);
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) scheduleClose();
  };

  return (
    <div ref={containerRef} className="static" onMouseEnter={openMenu} onMouseLeave={scheduleClose} onFocus={openMenu} onBlur={handleBlur} onKeyDown={(event) => { if (event.key === "Escape") { cancelClose(); setOpen(false); } }}>
      <button
        type="button"
        className={`inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold transition-colors ${current || open ? "bg-violet-50 text-violet-800" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        onFocus={openMenu}
      >
        Get certified <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%-1px)] z-50 pt-2" role="dialog" aria-label="Get certified navigation" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
          <div className="grid max-h-[min(560px,calc(100vh-6rem))] grid-cols-[200px_260px_minmax(0,1fr)] overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white text-left shadow-2xl shadow-slate-950/15">
            <div className="flex flex-col bg-slate-950 p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200"><Award className="h-4 w-4" /></div>
                <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">Career</p><h2 className="text-lg font-black tracking-tight">Get certified</h2></div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-300">Job-focused exams for cloud, AI, ERP, software, data and security roles.</p>
              <nav className="mt-4 grid gap-1">
                <Link href="/get-certified" className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold hover:bg-white/10">All certifications <ArrowRight className="h-4 w-4" /></Link>
                <Link href={publicAssessmentCategoryPath("enterprise-applications")} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-200 hover:bg-white/10"><TicketCheck className="h-4 w-4" />SAP / Oracle / CRM</Link>
                <Link href={publicAssessmentCategoryPath("cloud-devops")} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-200 hover:bg-white/10"><Code2 className="h-4 w-4" />Cloud & DevOps</Link>
                <Link href={publicAssessmentCategoryPath("data-ai-analytics")} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-200 hover:bg-white/10"><FlaskConical className="h-4 w-4" />AI & data</Link>
              </nav>
              <div className="mt-4 overflow-hidden rounded-xl border border-amber-200/25 bg-gradient-to-br from-violet-500/25 to-cyan-400/10 p-3 shadow-inner">
                <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">Premium practice</p><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-violet-950">₹299/mo</span></div>
                <p className="mt-1.5 text-[11px] leading-4 text-slate-200">Unlimited practice, answer review and progress tracking.</p>
                <Link href="/practice" className="mt-2 inline-flex items-center text-[11px] font-bold text-white">Explore Practice Pass <ChevronRight className="h-3 w-3" /></Link>
              </div>
            </div>

            <div className="overflow-y-auto border-r border-slate-200 py-3">
              <p className="px-5 pb-2 pt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Technology paths</p>
              {isLoading ? Array.from({ length: 7 }, (_, index) => <div key={index} className="mx-4 my-2 h-11 animate-pulse rounded-xl bg-slate-100" />) : groups.map((group) => (
                <Link
                  key={group.slug}
                  href={publicAssessmentCategoryPath(group.slug)}
                  onMouseEnter={() => setActiveSlug(group.slug)}
                  onFocus={() => setActiveSlug(group.slug)}
                  className={`flex items-center justify-between gap-3 border-l-2 px-5 py-3 text-sm transition ${activeGroup?.slug === group.slug ? "border-violet-600 bg-violet-50 font-bold text-violet-900" : "border-transparent text-slate-700 hover:bg-slate-50"}`}
                >
                  <span><span className="block">{group.name}</span><span className="mt-0.5 block text-[11px] font-medium text-slate-400">{group.items.length} certification{group.items.length === 1 ? "" : "s"}</span></span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </Link>
              ))}
              {!isLoading && <Link href={publicPracticeCategoryPath("competitive-exams")} className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Practice-only exams <ChevronRight className="h-4 w-4" /></Link>}
            </div>

            <div className="overflow-y-auto p-5">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div><p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">{activeGroup?.name || "Certifications"}</p><p className="mt-1 text-sm text-slate-500">Choose an exam to view its unique certification page.</p></div>
                {activeGroup && <Link href={publicAssessmentCategoryPath(activeGroup.slug)} className="shrink-0 text-xs font-bold text-slate-700 hover:text-violet-700">View path</Link>}
              </div>
              <div className="grid gap-1 py-3 sm:grid-cols-2">
                {(activeGroup?.items || []).map((item) => (
                  <Link key={item.id} href={publicAssessmentPath(item.slug)} className="group rounded-xl px-3 py-3 hover:bg-slate-50">
                    <span className="block text-sm font-semibold leading-5 text-slate-800 group-hover:text-violet-800">{item.title.replace(/\s+(Practice|Diagnostic)$/i, "")}</span>
                    <span className="mt-1 block text-[11px] font-medium text-slate-400">{item.audienceBands?.map((band) => band.label).join(" · ") || "Octamy certification exam"}</span>
                  </Link>
                ))}
              </div>
              {!isLoading && !activeGroup && <div className="mx-auto max-w-sm py-8 text-center"><p className="font-bold text-slate-800">Explore job-ready certifications</p><p className="mt-2 text-sm leading-6 text-slate-500">Browse software, cloud, AI, data, ERP and security credentials.</p><Link href="/get-certified" className="mt-4 inline-flex items-center text-sm font-bold text-violet-700">View certification catalog <ArrowRight className="ml-1 h-4 w-4" /></Link></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MobileCertificationMenu({ onNavigate }: { onNavigate: () => void }) {
  const { groups, isLoading } = useCertificationMenu();
  return (
    <details className="group rounded-2xl border border-slate-200 bg-slate-50">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-black text-slate-900">
        Get certified <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-200 bg-white p-2">
        <Link href="/get-certified" onClick={onNavigate} className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-bold text-violet-800 hover:bg-violet-50">Browse all certifications <ArrowRight className="h-4 w-4" /></Link>
        {isLoading ? <div className="m-3 h-24 animate-pulse rounded-xl bg-slate-100" /> : groups.map((group) => (
          <details key={group.slug} className="group/path border-t border-slate-100 first:border-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{group.name}<ChevronDown className="h-3.5 w-3.5 transition group-open/path:rotate-180" /></summary>
            <div className="mb-2 ml-2 border-l border-slate-200 pl-2">
              {group.items.slice(0, 6).map((item) => <Link key={item.id} href={publicAssessmentPath(item.slug)} onClick={onNavigate} className="block rounded-lg px-3 py-2 text-xs leading-5 text-slate-600 hover:bg-violet-50 hover:text-violet-800">{item.title.replace(/\s+(Practice|Diagnostic)$/i, "")}</Link>)}
              <Link href={publicAssessmentCategoryPath(group.slug)} onClick={onNavigate} className="block rounded-lg px-3 py-2 text-xs font-bold text-violet-700">View all {group.name}</Link>
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}
