import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Award, ChevronDown, ChevronRight, GraduationCap, School, TicketCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { publicAssessmentCategoryPath, publicAssessmentPath } from "@shared/public-assessment-routes";

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
  "ssc",
  "neet",
  "jee",
  "banking-exams",
  "railway-exams",
  "mathematics",
  "physics",
  "chemistry",
];

function useCertificationMenu() {
  const query = useQuery<MenuResponse>({
    queryKey: ["/api/assessments", "certification-navigation"],
    queryFn: async () => (await apiRequest("GET", "/api/assessments?page=1&pageSize=48")).json(),
    staleTime: 5 * 60_000,
  });
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; items: MenuItem[]; pathType: "competitive" | "school" }>();
    for (const item of query.data?.items || []) {
      const existing = map.get(item.category.slug) || {
        name: item.category.name,
        slug: item.category.slug,
        items: [],
        pathType: item.audienceBands?.some((band) => band.code === "competitive_exam") ? "competitive" : "school",
      };
      existing.items.push(item);
      if (item.audienceBands?.some((band) => band.code === "competitive_exam")) existing.pathType = "competitive";
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
  const competitiveGroups = groups.filter((group) => group.pathType === "competitive");
  const schoolGroups = groups.filter((group) => group.pathType === "school");
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
        <div className="absolute inset-x-0 top-[calc(100%-1px)] z-50 pt-3" role="dialog" aria-label="Get certified navigation" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
          <div className="grid max-h-[min(690px,calc(100vh-7rem))] grid-cols-[230px_280px_minmax(0,1fr)] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white text-left shadow-2xl shadow-slate-950/15">
            <div className="flex flex-col bg-slate-950 p-5 text-white">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200"><Award className="h-5 w-5" /></div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-violet-300">Explore certification</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Prove what you know.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">Take a serious exam, review your result and activate a verifiable credential after passing.</p>
              <nav className="mt-6 grid gap-1">
                <Link href="/get-certified" className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-white/10">All certifications <ArrowRight className="h-4 w-4" /></Link>
                <Link href={publicAssessmentCategoryPath("competitive-exams")} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10"><GraduationCap className="h-4 w-4" />Competitive exams</Link>
                <Link href={publicAssessmentCategoryPath("school-education")} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10"><School className="h-4 w-4" />School subjects by grade</Link>
                <Link href="/institutes" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10"><TicketCheck className="h-4 w-4" />Institute vouchers</Link>
              </nav>
              <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-bold">Learner All Access</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">Eligible Octamy certifications included for ₹1,999/month.</p>
                <Link href="/pricing" className="mt-3 inline-flex items-center text-xs font-bold text-violet-300">See membership <ChevronRight className="h-3.5 w-3.5" /></Link>
              </div>
            </div>

            <div className="overflow-y-auto border-r border-slate-200 py-3">
              <p className="px-5 pb-2 pt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Competitive exams</p>
              {isLoading ? Array.from({ length: 7 }, (_, index) => <div key={index} className="mx-4 my-2 h-11 animate-pulse rounded-xl bg-slate-100" />) : competitiveGroups.map((group) => (
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
              {!isLoading && <p className="border-t border-slate-100 px-5 pb-2 pt-4 text-xs font-black uppercase tracking-[0.14em] text-slate-400">School subjects by grade</p>}
              {!isLoading && schoolGroups.map((group) => (
                <Link key={group.slug} href={publicAssessmentCategoryPath(group.slug)} onMouseEnter={() => setActiveSlug(group.slug)} onFocus={() => setActiveSlug(group.slug)} className={`flex items-center justify-between gap-3 border-l-2 px-5 py-3 text-sm transition ${activeGroup?.slug === group.slug ? "border-violet-600 bg-violet-50 font-bold text-violet-900" : "border-transparent text-slate-700 hover:bg-slate-50"}`}>
                  <span><span className="block">{group.name}</span><span className="mt-0.5 block text-[11px] font-medium text-slate-400">{group.items.length} grade-specific certification{group.items.length === 1 ? "" : "s"}</span></span><ChevronRight className="h-4 w-4 shrink-0" />
                </Link>
              ))}
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
              {!isLoading && !activeGroup && <p className="py-12 text-center text-sm text-slate-500">Certification paths are being prepared.</p>}
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
