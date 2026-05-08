import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Sparkles, ArrowRight, Search } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import CourseCard from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category, Course } from "@shared/schema";

const PREMIUM_CATEGORY_SLUGS: string[] = (
  import.meta.env.VITE_PREMIUM_CATEGORY_SLUGS || ""
)
  .split(",")
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);

const PAGE_SIZE = 12;

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });
  const { data: courses = [], isLoading } = useQuery<
    (Course & { category: Category })[]
  >({
    queryKey: ["/api/courses"],
  });

  const category = useMemo(
    () =>
      categories.find(
        (c) => (c.slug || "").toLowerCase() === (slug || "").toLowerCase()
      ),
    [categories, slug]
  );

  const isPremium =
    !!category && PREMIUM_CATEGORY_SLUGS.includes(category.slug.toLowerCase());

  const filtered = useMemo(() => {
    const all = courses.filter((c) => c.categoryId === category?.id);
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [courses, category?.id, search]);

  const url = `https://octamy.com/category/${slug}`;
  const title = category
    ? `${category.name} Skill Assessments & Certifications | Octamy`
    : "Category | Octamy";
  const description = category
    ? `Browse free ${category.name.toLowerCase()} assessments on Octamy. Pay only after passing — earn a verified credential trusted by recruiters across India.`
    : "Browse skill-verification assessments by category on Octamy.";

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
      </Helmet>
      <Header />
      <main id="main-content" className="bg-white text-slate-900 min-h-screen">
        {/* Hero */}
        <section
          className={
            "border-b border-slate-200 " +
            (isPremium
              ? "bg-gradient-to-b from-amber-50 via-white to-white"
              : "bg-gradient-to-b from-sky-50 to-white")
          }
        >
          <div className="max-w-7xl mx-auto px-6 py-14 sm:py-20">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link href="/" className="hover:text-slate-900">
                Home
              </Link>
              <span>/</span>
              <Link href="/exams" className="hover:text-slate-900">
                Exams
              </Link>
              <span>/</span>
              <span className="text-slate-900 font-medium">
                {category?.name || slug}
              </span>
            </div>
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              {isPremium && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-300">
                  <Sparkles className="h-3.5 w-3.5" /> Premium category
                </span>
              )}
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                Skill Assessments
              </span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">
              {category?.name || (isLoading ? "Loading…" : "Category not found")}
            </h1>
            {category?.description && (
              <p className="mt-5 text-lg text-slate-700 max-w-3xl leading-relaxed">
                {category.description}
              </p>
            )}
            <div className="mt-8 flex items-center gap-2 max-w-md">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setVisible(PAGE_SIZE);
                  }}
                  placeholder={`Search in ${category?.name || "this category"}…`}
                  className="pl-10"
                  aria-label="Search exams in this category"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Listing */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 rounded-lg bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          ) : !category ? (
            <div className="rounded-lg border border-slate-200 p-10 text-center">
              <h2 className="text-xl font-semibold">Category not found</h2>
              <p className="mt-2 text-slate-600">
                The category{" "}
                <code className="px-1 rounded bg-slate-100">{slug}</code> does
                not exist.
              </p>
              <Link href="/exams" className="mt-4 inline-block">
                <Button variant="outline">Browse all exams</Button>
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-slate-200 p-10 text-center">
              <h2 className="text-xl font-semibold">No exams yet</h2>
              <p className="mt-2 text-slate-600">
                We're adding more {category.name.toLowerCase()} assessments.
                Check back soon or browse all exams.
              </p>
              <Link href="/exams" className="mt-4 inline-block">
                <Button variant="outline">Browse all exams</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-baseline justify-between">
                <p className="text-sm text-slate-600">
                  Showing {Math.min(visible, filtered.length)} of{" "}
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "exam" : "exams"}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.slice(0, visible).map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
              {visible < filtered.length && (
                <div className="mt-10 text-center">
                  <Button
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="bg-slate-900 hover:bg-black text-white rounded-full px-8"
                  >
                    Load more
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
