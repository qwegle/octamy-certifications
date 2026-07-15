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
  publicAssessmentCategoryPath,
} from "@shared/public-assessment-routes";

type CatalogMode = "octamy" | "creator";
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

const featuredSlugs = ["ssc", "neet-ug", "jee", "banking-recruitment", "railway-recruitment", "mathematics", "physics", "chemistry"];
const familyAccents: Record<string, string> = {
  ssc: "bg-rose-50 text-rose-800 border-rose-100",
  "neet-ug": "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100",
  jee: "bg-indigo-50 text-indigo-800 border-indigo-100",
  "banking-recruitment": "bg-emerald-50 text-emerald-800 border-emerald-100",
  "railway-recruitment": "bg-sky-50 text-sky-800 border-sky-100",
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
  const endpoint = mode === "octamy" ? "/api/assessments" : "/api/creator-assessments";
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
  const updateFilters = (patch: Partial<AssessmentCatalogFilters>, replace = true) => {
    setLocation(`${location}${buildAssessmentCatalogQuery({ ...filters, ...patch })}`, { replace });
  };

  useEffect(() => setSearchInput(search), [search]);

  const categoryFacets = data?.facets.categories ?? [];
  const rootCategories = categoryFacets.filter((item) => item.parentId == null);
  const orphanCategories = categoryFacets.filter((item) => item.parentId != null && !categoryFacets.some((candidate) => candidate.id === item.parentId));
  const featuredFamilies = featuredSlugs
    .map((slug) => categoryFacets.find((item) => item.slug === slug))
    .filter((item): item is CatalogResponse["facets"]["categories"][number] => Boolean(item));

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-slate-950">
      <SEO
        title={octamy ? "Get Certified with Octamy" : "Creator certification marketplace"}
        description={octamy ? "Choose an Octamy certification path, take a serious exam free, review every answer and activate a digitally verifiable credential after passing." : "Discover approved creator certification exams with the credential issuer shown clearly."}
        path={octamy ? ASSESSMENT_HUB_PATH : "/creator-assessments"}
      />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <section className="px-4 pb-10 pt-8 sm:px-5 sm:pb-14 sm:pt-12">
          <div className="relative mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-slate-950/15 lg:grid-cols-[1.1fr_.9fr]">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(139,92,246,.32),transparent_35%),radial-gradient(circle_at_90%_80%,rgba(14,165,233,.2),transparent_38%)]" />
            <div className="relative p-7 sm:p-10 lg:p-14">
              <Badge className="border border-white/15 bg-white/10 text-violet-200 hover:bg-white/10"><Award className="mr-1.5 h-3.5 w-3.5" />{octamy ? "Octamy certification exams" : "Creator-issued credentials"}</Badge>
              <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-6xl">{octamy ? "Get certified in what you know." : "Turn expert knowledge into verified achievement."}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                {octamy ? "Choose a certification path, take a governed exam without paying upfront and inspect every answer. Activate the credential only after you pass." : "Every certification shows who authored the exam, who issues the credential and whether Octamy co-certification applies."}
              </p>
              <form className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); updateFilters({ q: searchInput.trim().slice(0, 120), page: 1 }); }}>
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <Input aria-label="Search certifications" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search SSC, NEET, mathematics, physics…" className="h-12 border-0 bg-white pl-11 text-slate-950 shadow-none focus-visible:ring-0" />
                </div>
                <Button type="submit" size="lg" className="h-12 rounded-xl bg-violet-600 px-7 hover:bg-violet-500">Find certification</Button>
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
                  { number: "01", title: "Choose your path", copy: "Find a grade, subject or competitive exam." },
                  { number: "02", title: "Take the certification exam", copy: "Your attempt is free and questions rotate." },
                  { number: "03", title: "Review and improve", copy: "See correct and incorrect answers immediately." },
                  { number: "04", title: "Activate your credential", copy: "Pay, use All Access or redeem an institute voucher." },
                ].map((step) => <div key={step.number} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"><span className="text-sm font-black text-violet-300">{step.number}</span><div><p className="font-bold">{step.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{step.copy}</p></div></div>)}
              </div>
            </div>
          </div>
        </section>

        {octamy && featuredFamilies.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 pb-8" aria-labelledby="certification-paths-heading">
            <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Browse by path</p><h2 id="certification-paths-heading" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Popular certification paths</h2></div><Link href="#certification-results" className="hidden text-sm font-bold text-slate-600 hover:text-violet-700 sm:inline-flex">View all results <ArrowRight className="ml-1 h-4 w-4" /></Link></div>
            <div className="mt-5 flex snap-x gap-3 overflow-x-auto pb-3">
              {featuredFamilies.map((family) => <Link key={family.id} href={publicAssessmentCategoryPath(family.slug)} className={`min-w-[180px] snap-start rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${familyAccents[family.slug] || "border-slate-200 bg-white text-slate-800"}`}><div className="flex items-center justify-between"><GraduationCap className="h-5 w-5" /><ChevronRight className="h-4 w-4" /></div><p className="mt-5 text-sm font-black">{family.name}</p><p className="mt-1 text-xs opacity-70">View certifications</p></Link>)}
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
              <select aria-label="Filter by certification path" className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm" value={category} onChange={(event) => updateFilters({ category: event.target.value, page: 1 })}>
                <option value="all">All certification paths</option>
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
            <div><p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Certification catalogue</p><h2 className="mt-1 text-2xl font-black">{data ? `${data.pagination.total} certification${data.pagination.total === 1 ? "" : "s"}` : "Available certifications"}</h2><p className="mt-1 text-sm text-slate-500">Institute-sponsored private exams stay inside their secure workspace.</p></div>
            {octamy && <Button asChild variant="outline" className="hidden rounded-full sm:inline-flex"><Link href="/institutes"><TicketCheck className="mr-2 h-4 w-4" />Certification vouchers</Link></Button>}
          </div>

          {isLoading ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[31rem] animate-pulse rounded-[1.4rem] bg-slate-200" />)}</div>
            : error ? <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center"><p className="font-semibold">The certification catalogue could not be loaded.</p><Button className="mt-4" variant="outline" onClick={() => refetch()}>Try again</Button></div>
            : data?.items.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><BookOpenCheck className="mx-auto h-10 w-10 text-slate-400" /><h2 className="mt-4 text-xl font-bold">No certifications match these filters</h2><p className="mt-2 text-sm text-slate-500">Clear a filter or search for a broader exam family.</p></div>
            : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data?.items.map((item) => <CertificationCard key={item.id} item={item} categoryHref={octamy ? publicAssessmentCategoryPath(item.category.slug) : `/creator-assessments?category=${encodeURIComponent(item.category.slug)}`} />)}</div>}

          {data && data.pagination.totalPages > 1 && <nav aria-label="Certification catalogue pages" className="mt-9 flex items-center justify-center gap-3"><Button variant="outline" className="rounded-full" disabled={page <= 1} onClick={() => updateFilters({ page: Math.max(1, page - 1) }, false)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><span className="text-sm font-semibold text-slate-600">Page {page} of {data.pagination.totalPages}</span><Button variant="outline" className="rounded-full" disabled={page >= data.pagination.totalPages} onClick={() => updateFilters({ page: Math.min(data.pagination.totalPages, page + 1) }, false)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></nav>}

          {octamy && <div className="mt-12 grid gap-4 rounded-[2rem] bg-violet-100/60 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-violet-800"><Sparkles className="h-4 w-4" />A different way to certify</p><h2 className="mt-2 text-2xl font-black tracking-tight">No upfront credential fee. No hidden result.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Take the exam, inspect your answer review and decide whether to activate the credential. Institutes can sponsor learners with controlled vouchers.</p></div><Button asChild className="rounded-full"><Link href="/vision">See how Octamy works <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>}
        </section>
      </main>
      <Footer />
    </div>
  );
}
