import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowRight, Award, BookOpenCheck, ChevronLeft, ChevronRight, GraduationCap, Search, ShieldCheck, Sparkles, TicketCheck } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { CertificationCard, type CertificationCardItem } from "@/components/certification-card";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  buildAssessmentCatalogQuery,
  parseAssessmentCatalogQuery,
  type AssessmentCatalogFilters,
} from "@/lib/assessment-catalog-query";
import {
  ASSESSMENT_HUB_PATH,
  PRACTICE_HUB_PATH,
  publicAssessmentCategoryPath,
  publicPracticeCategoryPath,
} from "@shared/public-assessment-routes";

type CatalogMode = "octamy" | "creator" | "practice";
type CatalogResponse = {
  items: CertificationCardItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  facets: {
    categories: Array<{ id: number; name: string; slug: string; parentId: number | null; kind: string }>;
    audienceBands: Array<{ id: number; code: string; label: string }>;
    levels: string[];
  };
};

const levelLabels: Record<string, string> = {
  novice: "Foundation",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

const familyAccents: Record<string, string> = {
  ssc: "bg-rose-50 text-rose-800 border-rose-100",
  neet: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100",
  jee: "bg-indigo-50 text-indigo-800 border-indigo-100",
  "banking-exams": "bg-emerald-50 text-emerald-800 border-emerald-100",
  "railway-exams": "bg-sky-50 text-sky-800 border-sky-100",
  mathematics: "bg-violet-50 text-violet-800 border-violet-100",
  physics: "bg-blue-50 text-blue-800 border-blue-100",
  chemistry: "bg-pink-50 text-pink-800 border-pink-100",
};

export function AssessmentCatalog({ mode }: { mode: CatalogMode }) {
  const [location, setLocation] = useLocation();
  const locationSearch = useSearch();
  const filters = useMemo(() => parseAssessmentCatalogQuery(locationSearch), [locationSearch]);
  const { q: search, category, audience, level, page } = filters;
  const [searchInput, setSearchInput] = useState(search);
  const endpoint = mode === "practice" ? "/api/practice-assessments" : mode === "octamy" ? "/api/assessments" : "/api/creator-assessments";
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "12" });
    if (search) params.set("search", search);
    if (category !== "all") params.set("category", category);
    if (audience !== "all") params.set("audience", audience);
    if (level !== "all") params.set("level", level);
    return params.toString();
  }, [page, search, category, audience, level]);

  const { data, isLoading, error, refetch } = useQuery<CatalogResponse>({
    queryKey: [endpoint, query],
    queryFn: async () => (await apiRequest("GET", `${endpoint}?${query}`)).json(),
  });
  const octamy = mode === "octamy";
  const practice = mode === "practice";
  const updateFilters = (patch: Partial<AssessmentCatalogFilters>, replace = true) => {
    setLocation(`${location}${buildAssessmentCatalogQuery({ ...filters, ...patch })}`, { replace });
  };

  useEffect(() => setSearchInput(search), [search]);

  const categoryFacets = data?.facets.categories ?? [];
  const visibleCategory = (item: { slug: string; parentId: number | null }) => {
    const belongsToPracticeRoot = (candidate: { slug: string; parentId: number | null } | undefined): boolean => {
      if (!candidate) return false;
      if (["competitive-exams", "school-education"].includes(candidate.slug)) return true;
      return belongsToPracticeRoot(categoryFacets.find((parent) => parent.id === candidate.parentId));
    };
    const practiceRoot = belongsToPracticeRoot(item);
    if (practice) return practiceRoot;
    if (octamy) return !practiceRoot;
    return true;
  };
  const visibleCategories = categoryFacets.filter(visibleCategory);
  const rootCategories = visibleCategories.filter((item) => item.parentId == null);
  const orphanCategories = visibleCategories.filter((item) => item.parentId != null && !visibleCategories.some((candidate) => candidate.id === item.parentId));
  const schoolRoot = categoryFacets.find((item) => item.slug === "school-education");
  const competitiveRoot = categoryFacets.find((item) => item.slug === "competitive-exams");
  const schoolSubjects = categoryFacets.filter((item) => item.parentId === schoolRoot?.id && item.kind === "subject");
  const competitiveFamilies = categoryFacets.filter((item) => item.parentId === competitiveRoot?.id && item.kind === "exam_family");

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-slate-950">
      <SEO
        title={practice ? "Practice Exams with Octamy" : octamy ? "Get Certified with Octamy" : "Creator certification marketplace"}
        description={practice ? "Subscription-only practice exams for preparation. Practice scores are not recruiter-facing Octamy credentials." : octamy ? "Choose a technology and industry certification path, take a serious exam free, review every answer and activate a digitally verifiable credential after passing." : "Discover approved creator certification exams with the credential issuer shown clearly."}
        path={practice ? PRACTICE_HUB_PATH : octamy ? ASSESSMENT_HUB_PATH : "/creator-assessments"}
      />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <section className="px-4 pb-10 pt-8 sm:px-5 sm:pb-14 sm:pt-12">
          <div className="relative mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-slate-950/15 lg:grid-cols-[1.1fr_.9fr]">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(139,92,246,.32),transparent_35%),radial-gradient(circle_at_90%_80%,rgba(14,165,233,.2),transparent_38%)]" />
            <div className="relative p-7 sm:p-10 lg:p-14">
              <Badge className="border border-white/15 bg-white/10 text-violet-200 hover:bg-white/10"><Award className="mr-1.5 h-3.5 w-3.5" />{practice ? "Practice Pass" : octamy ? "Tech and industry certifications" : "Creator-issued credentials"}</Badge>
              <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-6xl">{practice ? "Practice without confusing your career signal." : octamy ? "Get certified for real industry roles." : "Turn expert knowledge into verified achievement."}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                {practice ? "SSC, NEET, school and similar preparation exams live here. They are for learning and repetition, not recruiter-facing Octamy credentials." : octamy ? "Choose a technology or industry certification path, take a governed exam without paying upfront and activate a verifiable credential after passing." : "Every certification shows who authored the exam, who issues the credential and whether Octamy co-certification applies."}
              </p>
              <form className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); updateFilters({ q: searchInput.trim().slice(0, 120), page: 1 }); }}>
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <Input aria-label={practice ? "Search practice exams" : "Search certifications"} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={practice ? "Search SSC, NEET, mathematics..." : "Search software, data, cloud, cybersecurity..."} className="h-12 border-0 bg-white pl-11 text-slate-950 shadow-none focus-visible:ring-0" />
                </div>
                <Button type="submit" size="lg" className="h-12 rounded-xl bg-violet-600 px-7 hover:bg-violet-500">{practice ? "Find practice" : "Find certification"}</Button>
              </form>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" />Server-scored exams</span>
                <span className="flex items-center gap-1.5"><BookOpenCheck className="h-4 w-4 text-sky-400" />Answer review after submission</span>
                <span className="flex items-center gap-1.5"><Award className="h-4 w-4 text-violet-400" />Live credential verification</span>
              </div>
            </div>

            <div className="relative hidden border-l border-white/10 p-8 lg:flex lg:flex-col lg:justify-center">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">How it works</p>
              <div className="mt-5 grid gap-3">
                {[
                  { number: "01", title: practice ? "Choose practice" : "Choose your path", copy: practice ? "Pick a preparation exam." : "Find a job-relevant skill exam." },
                  { number: "02", title: practice ? "Use Practice Pass" : "Take the certification exam", copy: practice ? "Active learner subscription is required." : "Your attempt is free and questions rotate." },
                  { number: "03", title: "Review and improve", copy: "See correct and incorrect answers immediately." },
                  { number: "04", title: practice ? "Repeat" : "Activate your credential", copy: practice ? "Practice scores stay separate from hiring credentials." : "Pay directly, use a coupon, or redeem an institute voucher." },
                ].map((step) => <div key={step.number} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"><span className="text-sm font-black text-violet-300">{step.number}</span><div><p className="font-bold">{step.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{step.copy}</p></div></div>)}
              </div>
            </div>
          </div>
        </section>

        {practice && (schoolSubjects.length > 0 || competitiveFamilies.length > 0) && (
          <section className="mx-auto max-w-7xl px-5 pb-8" aria-labelledby="certification-paths-heading">
            <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Practice inventory</p><h2 id="certification-paths-heading" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Practice exams stay outside hiring credentials.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Use these for preparation and repetition. They are not shared with recruiters as Octamy-certified career evidence.</p></div><Link href="#certification-results" className="hidden text-sm font-bold text-slate-600 hover:text-violet-700 sm:inline-flex">View practice <ArrowRight className="ml-1 h-4 w-4" /></Link></div>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="min-w-0 rounded-3xl border border-sky-100 bg-sky-50/70 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-sky-800">School practice</p><h3 className="mt-1 text-xl font-black">Optional preparation only</h3></div><GraduationCap className="h-6 w-6 text-sky-700" /></div><div className="mt-4 flex flex-wrap gap-2">{(data?.facets.audienceBands || []).filter((band) => band.code.startsWith("grade_")).map((band) => <Button key={band.id} type="button" size="sm" variant={audience === band.code ? "default" : "outline"} className="rounded-full bg-white" onClick={() => updateFilters({ audience: band.code, category: "school-education", page: 1 })}>{band.label}</Button>)}</div><div className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1">{schoolSubjects.map((item) => <Link key={item.id} href={publicPracticeCategoryPath(item.slug)} className="min-w-[145px] rounded-2xl border border-white bg-white p-3 text-sm font-bold text-slate-800 shadow-sm hover:text-violet-700">{item.name}<ChevronRight className="mt-3 h-4 w-4" /></Link>)}</div></div>
              <div className="min-w-0 rounded-3xl border border-violet-100 bg-violet-50/70 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-violet-800">Aspirant practice</p><h3 className="mt-1 text-xl font-black">Browse by exam family</h3></div><Award className="h-6 w-6 text-violet-700" /></div><div className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1">{competitiveFamilies.map((family) => <Link key={family.id} href={publicPracticeCategoryPath(family.slug)} className={`min-w-[155px] rounded-2xl border p-3 text-sm font-black shadow-sm hover:-translate-y-0.5 ${familyAccents[family.slug] || "border-white bg-white text-slate-800"}`}>{family.name}<span className="mt-3 flex items-center text-xs font-semibold opacity-70">View practice <ChevronRight className="ml-1 h-3.5 w-3.5" /></span></Link>)}</div></div>
            </div>
          </section>
        )}

        <section id="certification-results" className="mx-auto max-w-7xl px-5 pb-16 pt-4">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(150px,220px))]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input aria-label="Search certifications" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") updateFilters({ q: searchInput.trim().slice(0, 120), page: 1 }); }} placeholder="Search certifications" className="h-11 pl-9" />
              </div>
              <select aria-label={practice ? "Filter by practice path" : "Filter by certification path"} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm" value={category} onChange={(event) => updateFilters({ category: event.target.value, page: 1 })}>
                <option value="all">{practice ? "All practice paths" : "All certification paths"}</option>
                {rootCategories.map((root) => {
                  const children = categoryFacets.filter((item) => item.parentId === root.id);
                  return children.length > 0 ? <optgroup key={root.id} label={root.name}><option value={root.slug}>All {root.name.toLowerCase()}</option>{children.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</optgroup> : <option key={root.id} value={root.slug}>{root.name}</option>;
                })}
                {orphanCategories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
              </select>
              <select aria-label="Filter by learner stage" className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm" value={audience} onChange={(event) => updateFilters({ audience: event.target.value, page: 1 })}>
                <option value="all">Every learner stage</option>
                {data?.facets.audienceBands.map((item) => <option key={item.id} value={item.code}>{item.label}</option>)}
              </select>
              <div className="flex gap-2">
                <select aria-label="Filter by level" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm" value={level} onChange={(event) => updateFilters({ level: event.target.value, page: 1 })}><option value="all">Every level</option>{Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <Button type="button" className="h-11 rounded-xl" onClick={() => updateFilters({ q: searchInput.trim().slice(0, 120), page: 1 })}>Apply</Button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-end justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">{practice ? "Practice catalogue" : "Certification catalogue"}</p><h2 className="mt-1 text-2xl font-black">{data ? `${data.pagination.total} ${practice ? "practice exam" : "certification"}${data.pagination.total === 1 ? "" : "s"}` : practice ? "Available practice exams" : "Available certifications"}</h2><p className="mt-1 text-sm text-slate-500">{practice ? "Practice Pass required. No recruiter credential is issued." : "Institute-sponsored private exams stay inside their secure workspace."}</p></div>
            {octamy && <Button asChild variant="outline" className="hidden rounded-full sm:inline-flex"><Link href="/institutes"><TicketCheck className="mr-2 h-4 w-4" />Certification vouchers</Link></Button>}
          </div>

          {isLoading ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[31rem] animate-pulse rounded-[1.4rem] bg-slate-200" />)}</div>
            : error ? <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center"><p className="font-semibold">The certification catalogue could not be loaded.</p><Button className="mt-4" variant="outline" onClick={() => refetch()}>Try again</Button></div>
            : data?.items.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><BookOpenCheck className="mx-auto h-10 w-10 text-slate-400" /><h2 className="mt-4 text-xl font-bold">{practice ? "No practice exams match these filters" : "No certifications match these filters"}</h2><p className="mt-2 text-sm text-slate-500">Clear a filter or search more broadly.</p></div>
            : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data?.items.map((item) => <CertificationCard key={item.id} item={item} variant={practice ? "practice" : "certification"} categoryHref={practice ? publicPracticeCategoryPath(item.category.slug) : octamy ? publicAssessmentCategoryPath(item.category.slug) : `/creator-assessments?category=${encodeURIComponent(item.category.slug)}`} />)}</div>}

          {data && data.pagination.totalPages > 1 && <nav aria-label="Certification catalogue pages" className="mt-9 flex items-center justify-center gap-3"><Button variant="outline" className="rounded-full" disabled={page <= 1} onClick={() => updateFilters({ page: Math.max(1, page - 1) }, false)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><span className="text-sm font-semibold text-slate-600">Page {page} of {data.pagination.totalPages}</span><Button variant="outline" className="rounded-full" disabled={page >= data.pagination.totalPages} onClick={() => updateFilters({ page: Math.min(data.pagination.totalPages, page + 1) }, false)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></nav>}

          {octamy && <div className="mt-12 grid gap-4 rounded-[2rem] bg-violet-100/60 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-violet-800"><Sparkles className="h-4 w-4" />A different way to certify</p><h2 className="mt-2 text-2xl font-black tracking-tight">No upfront credential fee. No hidden result.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Take the exam, inspect your answer review and decide whether to activate the credential. Institutes can sponsor learners with controlled vouchers.</p></div><Button asChild className="rounded-full"><Link href="/vision">See how Octamy works <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>}
          {practice && <div className="mt-12 grid gap-4 rounded-[2rem] bg-slate-100 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700"><Sparkles className="h-4 w-4" />Practice Pass</p><h2 className="mt-2 text-2xl font-black tracking-tight">Unlimited practice for ₹299/month.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Practice is deliberately separated from Octamy career certification, so recruiters see only validated industry credentials.</p></div><Button asChild className="rounded-full"><Link href="/pricing">Get Practice Pass <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>}
        </section>
      </main>
      <Footer />
    </div>
  );
}
