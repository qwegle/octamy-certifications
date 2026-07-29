import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpenCheck } from "lucide-react";
import { Link, useParams } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { canonicalOctamyUrl, OCTAMY_PUBLIC_ORIGIN } from "@shared/public-assessment-routes";
import { SafeBlogBody } from "./content";

type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  bodyFormat: "safe-markdown-v1";
  canonicalPath: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string;
  updatedAt: string;
  authorName: string;
  relatedAssessments: Array<{ id: number; title: string; purpose: string; href: string }>;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(value));
}

export default function BlogPostPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data, isLoading, error, refetch } = useQuery<{ post: BlogPost }>({
    queryKey: ["/api/blog", slug],
    queryFn: async () => (await apiRequest("GET", `/api/blog/${encodeURIComponent(slug)}`)).json(),
    enabled: Boolean(slug),
  });
  const post = data?.post;

  if (isLoading) return <div className="min-h-screen bg-[#f7f5f0]"><Header /><main id="main-content" className="mx-auto max-w-4xl px-5 py-16" role="status" aria-label="Loading blog post"><div className="h-8 w-36 animate-pulse rounded bg-slate-200" /><div className="mt-8 h-20 animate-pulse rounded-2xl bg-slate-200" /><div className="mt-8 h-96 animate-pulse rounded-3xl bg-slate-200" /></main><Footer /></div>;
  if (error || !post) {
    const missing = error instanceof ApiError && error.status === 404;
    return <div className="min-h-screen bg-[#f7f5f0]"><SEO title={missing ? "Blog post not found" : "Blog unavailable"} description={missing ? "This Octamy blog post is not published or does not exist." : "The Octamy blog is temporarily unavailable."} path={`/blog/${slug}`} noIndex /><Header /><main id="main-content" className="mx-auto max-w-3xl px-5 py-20 text-center" role={missing ? undefined : "alert"}><BookOpenCheck className="mx-auto h-12 w-12 text-slate-400" /><h1 className="mt-5 text-3xl font-black">{missing ? "This post is not available" : "The post could not be loaded"}</h1><p className="mt-3 text-slate-600">{missing ? "It may still be a draft, may have been unpublished, or the address may be incorrect." : "Please try again. No substitute content is shown."}</p><div className="mt-7 flex justify-center gap-3"><Button asChild><Link href="/blog"><ArrowLeft className="mr-2 h-4 w-4" />All posts</Link></Button>{!missing && <Button type="button" variant="outline" onClick={() => void refetch()}>Try again</Button>}</div></main><Footer /></div>;
  }

  const articleUrl = canonicalOctamyUrl(`/blog/${post.slug}`);
  const description = post.seoDescription || post.excerpt;
  const title = post.seoTitle || post.title;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description,
    url: articleUrl,
    mainEntityOfPage: articleUrl,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Person", name: post.authorName },
    publisher: { "@type": "Organization", name: "Octamy Solutions Private Limited", url: OCTAMY_PUBLIC_ORIGIN },
  };

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-slate-950">
      <SEO title={title} description={description} path={`/blog/${post.slug}`} type="article" publishedTime={post.publishedAt} modifiedTime={post.updatedAt} jsonLd={structuredData} />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <article className="mx-auto max-w-4xl px-5 pb-20 pt-10 sm:pt-16">
          <Link href="/blog" className="inline-flex min-h-11 items-center font-bold text-slate-600 hover:text-violet-700"><ArrowLeft className="mr-2 h-4 w-4" />Back to blog</Link>
          <header className="mt-8 border-b border-slate-200 pb-10">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Published <time dateTime={post.publishedAt}>{displayDate(post.publishedAt)}</time></p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-6xl">{post.title}</h1>
            <p className="mt-5 text-xl leading-8 text-slate-600">{post.excerpt}</p>
            <p className="mt-5 text-sm font-semibold text-slate-500">By {post.authorName}</p>
          </header>
          <div className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-12"><SafeBlogBody body={post.body} /></div>

          {post.relatedAssessments.length > 0 && (
            <aside className="mt-10 rounded-[2rem] bg-slate-950 p-7 text-white sm:p-10" aria-labelledby="related-assessments-heading">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-300">Continue on Octamy</p>
              <h2 id="related-assessments-heading" className="mt-2 text-2xl font-black">Related live assessments</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">These links are included only while the assessment remains active, public, and approved.</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">{post.relatedAssessments.map((assessment) => <li key={assessment.id}><Link href={assessment.href} className="flex min-h-14 items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-bold hover:bg-white/10">{assessment.title}<ArrowRight className="ml-3 h-4 w-4 shrink-0" /></Link><span className="sr-only">{assessment.purpose === "practice" ? "Practice assessment" : "Certification assessment"}</span></li>)}</ul>
            </aside>
          )}
        </article>
      </main>
      <Footer />
    </div>
  );
}
