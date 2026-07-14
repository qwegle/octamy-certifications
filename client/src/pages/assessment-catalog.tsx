import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Award, BookOpenCheck, ChevronLeft, ChevronRight, Clock3, Search, ShieldCheck } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  publicAssessmentPath,
} from "@shared/public-assessment-routes";

type CatalogMode = "octamy" | "creator";
type CatalogItem = {
  id: number;
  title: string;
  description: string;
  slug: string;
  duration: number;
  passingScore: number;
  price: string;
  level: string;
  thumbnailUrl: string | null;
  subscriptionEligible: boolean;
  originLabel: string;
  certificationLabel: string;
  creator: { displayName: string; slug: string } | null;
  category: { name: string; slug: string };
  audienceBands: Array<{ id: number; code: string; label: string }>;
};
type CatalogResponse = {
  items: CatalogItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  facets: {
    categories: Array<{ id: number; name: string; slug: string; parentId: number | null; kind: string }>;
    audienceBands: Array<{ id: number; code: string; label: string }>;
    levels: string[];
  };
};

const levelLabels: Record<string, string> = {
  novice: "Novice",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
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
    const next = { ...filters, ...patch };
    setLocation(`${location}${buildAssessmentCatalogQuery(next)}`, { replace });
  };

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const categoryFacets = data?.facets.categories ?? [];
  const rootCategories = categoryFacets.filter((item) => item.parentId == null);
  const orphanCategories = categoryFacets.filter((item) => (
    item.parentId != null && !categoryFacets.some((candidate) => candidate.id === item.parentId)
  ));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <SEO
        title={octamy ? "Octamy-certified assessments" : "Creator assessment marketplace"}
        description={octamy ? "Take reviewed in-house Octamy assessments with controlled evidence and credential policies." : "Discover approved creator assessments with clearly identified credential issuers."}
        path={octamy ? ASSESSMENT_HUB_PATH : "/creator-assessments"}
      />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <section className="relative overflow-hidden bg-slate-950 px-5 py-16 text-white sm:py-20">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.35),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,.22),transparent_38%)]" />
          <div className="relative mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <Badge className="border border-white/15 bg-white/10 text-sky-200 hover:bg-white/10">{octamy ? "Octamy in-house" : "Reviewed creator marketplace"}</Badge>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">{octamy ? "Serious assessments. Verifiable evidence." : "Expert assessments, with the issuer made clear."}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                {octamy
                  ? "Octamy authors and reviews this catalogue. Practice feedback follows the published policy; passing can produce a digitally verifiable credential."
                  : "Creators own the assessment and credential unless an item explicitly shows completed Octamy co-certification. Marketplace approval is not the same as Octamy certification."}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild variant="secondary"><Link href={octamy ? "/creator-assessments" : ASSESSMENT_HUB_PATH}>{octamy ? "Browse creator assessments" : "Browse Octamy assessments"}</Link></Button>
                <Button asChild variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href="/vision">How evidence works</Link></Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8">
          <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(260px,1fr)_repeat(3,minmax(150px,220px))]" onSubmit={(event) => { event.preventDefault(); updateFilters({ q: searchInput.trim().slice(0, 120), page: 1 }); }}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input aria-label="Search assessments" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search skill, subject, or exam" className="h-11 pl-9" />
            </div>
            <select aria-label="Filter by category" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm" value={category} onChange={(event) => updateFilters({ category: event.target.value, page: 1 })}>
              <option value="all">All categories</option>
              {rootCategories.map((root) => {
                const children = categoryFacets.filter((item) => item.parentId === root.id);
                return children.length > 0 ? (
                  <optgroup key={root.id} label={root.name}>
                    <option value={root.slug}>All {root.name.toLowerCase()}</option>
                    {children.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
                  </optgroup>
                ) : <option key={root.id} value={root.slug}>{root.name}</option>;
              })}
              {orphanCategories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
            </select>
            <select aria-label="Filter by audience" className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm" value={audience} onChange={(event) => updateFilters({ audience: event.target.value, page: 1 })}>
              <option value="all">All audiences</option>
              {data?.facets.audienceBands.map((item) => <option key={item.id} value={item.code}>{item.label}</option>)}
            </select>
            <div className="flex gap-2">
              <select aria-label="Filter by level" className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm" value={level} onChange={(event) => updateFilters({ level: event.target.value, page: 1 })}>
                <option value="all">All levels</option>
                {Object.entries(levelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <Button type="submit" className="h-11">Search</Button>
            </div>
          </form>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-slate-900">{data ? `${data.pagination.total} assessment${data.pagination.total === 1 ? "" : "s"}` : "Assessment catalogue"}</p><p className="text-xs text-slate-500">Institute-funded exams are private and never appear here.</p></div>
          </div>

          {isLoading ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-96 animate-pulse rounded-3xl bg-slate-200" />)}</div>
          ) : error ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center"><p className="font-semibold">The catalogue could not be loaded.</p><Button className="mt-4" variant="outline" onClick={() => refetch()}>Try again</Button></div>
          ) : data?.items.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><BookOpenCheck className="mx-auto h-10 w-10 text-slate-400" /><h2 className="mt-4 text-xl font-bold">No assessments match these filters</h2><p className="mt-2 text-sm text-slate-500">Clear one filter or search for a broader skill.</p></div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {data?.items.map((item) => (
                <Card key={item.id} className="group overflow-hidden rounded-3xl border-slate-200 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
                    {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-violet-700 via-slate-900 to-sky-800"><Award className="h-14 w-14 text-white/80" /></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    <Badge className="absolute left-4 top-4 bg-white text-slate-950 hover:bg-white">{item.originLabel}</Badge>
                    {item.subscriptionEligible && <Badge className="absolute right-4 top-4 bg-emerald-500 text-emerald-950 hover:bg-emerald-500">All Access</Badge>}
                  </div>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap gap-2 text-xs"><Link href={octamy ? publicAssessmentCategoryPath(item.category.slug) : `/creator-assessments?category=${encodeURIComponent(item.category.slug)}`}><Badge variant="outline" className="hover:border-slate-400">{item.category.name}</Badge></Link><Badge variant="outline">{levelLabels[item.level] || item.level}</Badge></div>
                    <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-950">{item.title}</h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">{item.audienceBands.slice(0, 3).map((band) => <span key={band.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{band.label}</span>)}</div>
                    <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600"><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{item.duration} minutes</span><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Pass {item.passingScore}%</span></div>
                    <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600"><Award className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" /><span>{item.certificationLabel}{item.creator ? ` · ${item.creator.displayName}` : ""}</span></div>
                    <div className="mt-5 flex items-end justify-between gap-4"><div><p className="text-sm font-bold text-emerald-700">Free attempt</p><p className="text-xs text-slate-500">Credential activation ₹{item.price}</p></div><Button asChild><Link href={publicAssessmentPath(item.slug)}>View assessment</Link></Button></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {data && data.pagination.totalPages > 1 && (
            <nav aria-label="Assessment catalogue pages" className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" disabled={page <= 1} onClick={() => updateFilters({ page: Math.max(1, page - 1) }, false)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
              <span className="text-sm font-semibold text-slate-600">Page {page} of {data.pagination.totalPages}</span>
              <Button variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => updateFilters({ page: Math.min(data.pagination.totalPages, page + 1) }, false)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
            </nav>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
