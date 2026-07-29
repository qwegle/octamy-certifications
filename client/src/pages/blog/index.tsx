import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenText, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useSearch } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

type BlogSummary = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  canonicalPath: string;
  publishedAt: string;
  authorName: string;
  relatedAssessments: Array<{ id: number; title: string; href: string }>;
};
type BlogIndexResponse = {
  items: BlogSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(value));
}

export default function BlogIndex() {
  const search = useSearch();
  const requestedPage = Number(new URLSearchParams(search).get("page") || "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const { data, isLoading, error, refetch } = useQuery<BlogIndexResponse>({
    queryKey: ["/api/blog", page],
    queryFn: async () => (await apiRequest("GET", `/api/blog?page=${page}&pageSize=10`)).json(),
  });

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-slate-950">
      <SEO title="Octamy blog" description="Published Octamy product, assessment, and evidence updates. Only real published posts are listed." path="/blog" />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <section className="px-4 pb-10 pt-7 sm:px-6 sm:pt-10">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 px-7 py-14 text-white shadow-2xl shadow-slate-950/15 sm:px-12 sm:py-20">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Octamy journal</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-6xl">Product and assessment notes, published when there is something real to share.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">No placeholder articles or invented claims. Published posts can point directly to the live certification and practice catalogue.</p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20" aria-labelledby="published-posts-heading">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Published</p><h2 id="published-posts-heading" className="mt-2 text-3xl font-black tracking-tight">Latest posts</h2></div>
            <Button asChild variant="outline" className="hidden rounded-full sm:inline-flex"><Link href="/get-certified">Browse certifications <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>

          {isLoading ? (
            <div className="mt-7 grid gap-5 md:grid-cols-2" role="status" aria-label="Loading blog posts">
              {Array.from({ length: 4 }, (_, index) => <div key={index} aria-hidden className="h-64 animate-pulse rounded-3xl bg-slate-200" />)}
            </div>
          ) : error ? (
            <div className="mt-7 rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center" role="alert">
              <h2 className="text-xl font-bold">The blog could not be loaded.</h2><p className="mt-2 text-sm text-slate-600">No substitute or sample articles are shown.</p>
              <Button type="button" variant="outline" className="mt-5" onClick={() => void refetch()}>Try again</Button>
            </div>
          ) : data?.items.length === 0 ? (
            <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <BookOpenText className="mx-auto h-11 w-11 text-slate-400" aria-hidden />
              <h2 className="mt-4 text-2xl font-black">No posts are published yet</h2>
              <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-600">This page will list reviewed posts after an administrator explicitly publishes them. In the meantime, explore the live catalogues.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3"><Button asChild><Link href="/get-certified">Certifications</Link></Button><Button asChild variant="outline"><Link href="/practice">Practice exams</Link></Button></div>
            </div>
          ) : (
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              {data?.items.map((post) => (
                <article key={post.id} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-700"><time dateTime={post.publishedAt}>{displayDate(post.publishedAt)}</time> · {post.authorName}</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight"><Link href={`/blog/${post.slug}`} className="hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600">{post.title}</Link></h2>
                  <p className="mt-3 flex-1 leading-7 text-slate-600">{post.excerpt}</p>
                  {post.relatedAssessments.length > 0 && <p className="mt-5 text-xs font-semibold text-slate-500">Links to {post.relatedAssessments.length} live assessment{post.relatedAssessments.length === 1 ? "" : "s"}</p>}
                  <Link href={`/blog/${post.slug}`} aria-label={`Read ${post.title}`} className="mt-5 inline-flex min-h-11 items-center self-start font-bold text-violet-700 hover:text-violet-900">Read post <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </article>
              ))}
            </div>
          )}

          {data && data.pagination.totalPages > 1 && <nav aria-label="Blog pages" className="mt-9 flex items-center justify-center gap-3"><Button asChild={page > 1} variant="outline" disabled={page <= 1} className="rounded-full">{page > 1 ? <Link href={page === 2 ? "/blog" : `/blog?page=${page - 1}`}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Link> : <span><ChevronLeft className="mr-1 inline h-4 w-4" />Previous</span>}</Button><span className="text-sm font-semibold text-slate-600">Page {page} of {data.pagination.totalPages}</span><Button asChild={page < data.pagination.totalPages} variant="outline" disabled={page >= data.pagination.totalPages} className="rounded-full">{page < data.pagination.totalPages ? <Link href={`/blog?page=${page + 1}`}>Next<ChevronRight className="ml-1 h-4 w-4" /></Link> : <span>Next<ChevronRight className="ml-1 inline h-4 w-4" /></span>}</Button></nav>}
        </section>
      </main>
      <Footer />
    </div>
  );
}
