import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { BookOpenCheck, ChevronRight, Search } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { CertificationCard, type CertificationCardItem } from "@/components/certification-card";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  ASSESSMENT_HUB_PATH,
  publicAssessmentCategoryPath,
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

type CatalogResponse = {
  items: CertificationCardItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
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
  const title = category ? `${category.name} Certification Exams | Octamy` : "Certification path | Octamy";
  const description = category?.metaDescription || category?.description || "Explore reviewed Octamy certification exams by subject and exam family.";
  const breadcrumbNodes = hierarchy ? [...hierarchy.ancestors, hierarchy.category] : [];
  const jsonLd = useMemo(() => {
    if (!hierarchy) return undefined;
    const itemListElement = [
      { name: "Home", path: "/" },
      { name: "Get certified", path: ASSESSMENT_HUB_PATH },
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
              <Link href={ASSESSMENT_HUB_PATH} className="hover:text-slate-950">Get certified</Link>
              {hierarchy?.ancestors.map((node) => (
                <span key={node.id} className="contents">
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  <Link href={publicAssessmentCategoryPath(node.slug)} className="hover:text-slate-950">{node.name}</Link>
                </span>
              ))}
              {category && <><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /><span className="font-medium text-slate-800" aria-current="page">{category.name}</span></>}
            </nav>

            <Badge className="mt-6 border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-50">Octamy certification path</Badge>
            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">{category?.name || (hierarchyQuery.isLoading ? "Loading category…" : "Category unavailable")}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">{category ? description : "This certification path could not be found or is no longer public."}</p>

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
                  <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="h-11 bg-white pl-9" placeholder={`Search ${category.name}`} aria-label={`Search ${category.name} certifications`} />
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
              <h2 className="mt-4 text-xl font-bold">{unavailable ? "Certification path not found" : "Certifications could not be loaded"}</h2>
              <p className="mt-2 text-sm text-slate-600">Browse all certification paths or try this page again.</p>
              <Button asChild variant="outline" className="mt-5"><Link href={ASSESSMENT_HUB_PATH}>Browse certifications</Link></Button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <BookOpenCheck className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-bold">No matching certifications yet</h2>
              <p className="mt-2 text-sm text-slate-600">Try a broader search or explore a related subcategory.</p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div><h2 id="category-assessments-heading" className="text-2xl font-black">Available certification exams</h2><p className="mt-1 text-sm text-slate-600">{total} reviewed Octamy certification{total === 1 ? "" : "s"} in this path.</p></div>
                {total > items.length && <Button asChild variant="outline"><Link href={`${ASSESSMENT_HUB_PATH}?category=${encodeURIComponent(category!.slug)}${search ? `&q=${encodeURIComponent(search)}` : ""}`}>View all results</Link></Button>}
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => <CertificationCard key={item.id} item={item} />)}
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
