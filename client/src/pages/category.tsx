import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Award, BookOpenCheck, ChevronRight, Clock3, Search, ShieldCheck } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  ASSESSMENT_HUB_PATH,
  publicAssessmentCategoryPath,
  publicAssessmentPath,
} from "@shared/public-assessment-routes";

type CategoryNode = {
  id: number;
  name: string;
  description: string;
  icon: string;
  slug: string;
  parentId: number | null;
  kind: string;
  sortOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
};

type CategoryHierarchy = {
  category: CategoryNode;
  ancestors: CategoryNode[];
  children: CategoryNode[];
  canonicalPath: string;
};

type AssessmentItem = {
  id: number;
  title: string;
  description: string;
  slug: string;
  duration: number;
  passingScore: number;
  price: string;
  level: string;
  thumbnailUrl: string | null;
  originLabel: string;
  certificationLabel: string;
  category: { name: string; slug: string };
};

type CatalogResponse = {
  items: AssessmentItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const levelLabels: Record<string, string> = {
  novice: "Novice",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export default function CategoryPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const hierarchyQuery = useQuery<CategoryHierarchy>({
    queryKey: ["/api/assessment-categories", slug.toLowerCase()],
    enabled: !!slug,
    retry: false,
    queryFn: async () => (await apiRequest("GET", `/api/assessment-categories/${encodeURIComponent(slug)}`)).json(),
  });
  const hierarchy = hierarchyQuery.data;
  const category = hierarchy?.category;

  const catalogQuery = useQuery<CatalogResponse>({
    queryKey: ["/api/assessments", "category-page", category?.slug, search],
    enabled: !!category,
    queryFn: async () => {
      const params = new URLSearchParams({ category: category!.slug, page: "1", pageSize: "48" });
      if (search) params.set("search", search);
      return (await apiRequest("GET", `/api/assessments?${params}`)).json();
    },
  });

  useEffect(() => {
    if (!hierarchy?.canonicalPath || typeof window === "undefined") return;
    if (window.location.pathname !== hierarchy.canonicalPath) {
      setLocation(`${hierarchy.canonicalPath}${window.location.search}`, { replace: true });
    }
  }, [hierarchy?.canonicalPath, setLocation]);

  const canonicalPath = hierarchy?.canonicalPath || publicAssessmentCategoryPath(slug);
  const title = category?.metaTitle || (category ? `${category.name} assessments` : "Assessment category");
  const description = category?.metaDescription || category?.description || "Browse reviewed Octamy assessments by subject and exam family.";
  const breadcrumbNodes = hierarchy ? [...hierarchy.ancestors, hierarchy.category] : [];
  const jsonLd = useMemo(() => {
    if (!hierarchy) return undefined;
    const itemListElement = [
      { name: "Home", path: "/" },
      { name: "Assessments", path: ASSESSMENT_HUB_PATH },
      ...breadcrumbNodes.map((node) => ({ name: node.name, path: publicAssessmentCategoryPath(node.slug) })),
    ].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `https://octamy.com${item.path}`,
    }));
    return [
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement },
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        description,
        url: `https://octamy.com${canonicalPath}`,
        isPartOf: { "@type": "WebSite", name: "Octamy", url: "https://octamy.com" },
      },
    ];
  }, [breadcrumbNodes, canonicalPath, description, hierarchy, title]);

  const items = catalogQuery.data?.items ?? [];
  const total = catalogQuery.data?.pagination.total ?? 0;
  const loading = hierarchyQuery.isLoading || (!!category && catalogQuery.isLoading);
  const unavailable = !hierarchyQuery.isLoading && !category;
  const emptyCategory = Boolean(category) && !search && !catalogQuery.isLoading && !catalogQuery.isError && total === 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <SEO
        title={title}
        description={description.slice(0, 300)}
        path={canonicalPath}
        jsonLd={jsonLd}
        noIndex={unavailable || emptyCategory}
      />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <section className="border-b border-slate-200 bg-white px-5 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
              <Link href="/" className="hover:text-slate-950">Home</Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <Link href={ASSESSMENT_HUB_PATH} className="hover:text-slate-950">Assessments</Link>
              {hierarchy?.ancestors.map((node) => (
                <span key={node.id} className="contents">
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  <Link href={publicAssessmentCategoryPath(node.slug)} className="hover:text-slate-950">{node.name}</Link>
                </span>
              ))}
              {category && <><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /><span className="font-medium text-slate-800" aria-current="page">{category.name}</span></>}
            </nav>

            <Badge className="mt-6 border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-50">Octamy in-house taxonomy</Badge>
            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">{category?.name || (hierarchyQuery.isLoading ? "Loading category…" : "Category unavailable")}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">{category ? description : "This assessment category could not be found or is no longer public."}</p>

            {hierarchy?.children.length ? (
              <div className="mt-7 flex flex-wrap gap-2" aria-label="Subcategories">
                {hierarchy.children.map((child) => (
                  <Link key={child.id} href={publicAssessmentCategoryPath(child.slug)} className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white">
                    {child.name}
                  </Link>
                ))}
              </div>
            ) : null}

            {category && (
              <form className="mt-8 flex max-w-xl gap-2" role="search" onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim().slice(0, 120)); }}>
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="h-11 bg-white pl-9" placeholder={`Search ${category.name}`} aria-label={`Search ${category.name} assessments`} />
                </div>
                <Button type="submit" className="h-11">Search</Button>
              </form>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 sm:py-12" aria-labelledby="category-assessments-heading">
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-80 animate-pulse rounded-3xl bg-slate-200" />)}</div>
          ) : unavailable || catalogQuery.isError ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
              <BookOpenCheck className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-bold">{unavailable ? "Category not found" : "Assessments could not be loaded"}</h2>
              <p className="mt-2 text-sm text-slate-600">Browse the public assessment catalogue or try this page again.</p>
              <Button asChild variant="outline" className="mt-5"><Link href={ASSESSMENT_HUB_PATH}>Browse assessments</Link></Button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <BookOpenCheck className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-bold">No matching assessments yet</h2>
              <p className="mt-2 text-sm text-slate-600">Try a broader search or explore a related subcategory.</p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div><h2 id="category-assessments-heading" className="text-2xl font-black">Available assessments</h2><p className="mt-1 text-sm text-slate-600">{total} reviewed Octamy assessment{total === 1 ? "" : "s"} in this taxonomy branch.</p></div>
                {total > items.length && <Button asChild variant="outline"><Link href={`${ASSESSMENT_HUB_PATH}?category=${encodeURIComponent(category!.slug)}${search ? `&q=${encodeURIComponent(search)}` : ""}`}>View all results</Link></Button>}
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <Card key={item.id} className="group overflow-hidden rounded-3xl border-slate-200 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
                      {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-violet-700 via-slate-900 to-sky-800"><Award className="h-14 w-14 text-white/80" /></div>}
                      <Badge className="absolute left-4 top-4 bg-white text-slate-950 hover:bg-white">{item.originLabel}</Badge>
                    </div>
                    <CardContent className="p-5">
                      <div className="flex flex-wrap gap-2"><Badge variant="outline">{levelLabels[item.level] || item.level}</Badge><Badge variant="outline">{item.category.name}</Badge></div>
                      <h3 className="mt-4 text-xl font-bold tracking-tight">{item.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>
                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600"><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{item.duration} minutes</span><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Pass {item.passingScore}%</span></div>
                      <p className="mt-4 text-xs leading-5 text-slate-600">{item.certificationLabel}</p>
                      <div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-sm font-bold text-emerald-700">Free attempt</p><p className="text-xs text-slate-500">Credential activation ₹{item.price}</p></div><Button asChild><Link href={publicAssessmentPath(item.slug)}>View assessment</Link></Button></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
