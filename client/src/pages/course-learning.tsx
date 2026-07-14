import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  Film,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Category, Course } from "@shared/schema";

type Lesson = {
  id: number;
  title: string;
  kind: "video" | "pdf" | "text" | "quiz" | "link";
  contentUrl: string | null;
  contentPath: string | null;
  contentText: string | null;
  durationSec: number;
  isPreview: boolean;
  locked?: boolean;
  hasContent?: boolean;
};
type Section = { id: number; title: string; lessons: Lesson[] };
type Access = {
  productType: "assessment" | "video_course" | "bundle";
  contentPrice: string | null;
  requiresPurchase: boolean;
  hasAccess: boolean;
  lessonCount: number;
  previewCount: number;
};

export default function CourseLearning() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamRetry, setStreamRetry] = useState(0);

  const { data: course, isLoading: courseLoading } = useQuery<Course & { category: Category }>({
    queryKey: ["/api/courses/slug", slug],
    enabled: Boolean(slug),
    queryFn: async () => (await apiRequest("GET", `/api/courses/slug/${encodeURIComponent(slug)}`)).json(),
  });
  const { data: access } = useQuery<Access>({
    queryKey: ["/api/courses/access", course?.id],
    enabled: Boolean(course?.id),
    queryFn: async () => (await apiRequest("GET", `/api/courses/${course!.id}/access`)).json(),
  });
  const { data: sections = [], isLoading: curriculumLoading } = useQuery<Section[]>({
    queryKey: ["/api/courses/curriculum", course?.id, access?.hasAccess],
    enabled: Boolean(course?.id),
    queryFn: async () => (await apiRequest("GET", `/api/courses/${course!.id}/curriculum`)).json(),
  });

  const lessons = useMemo(() => sections.flatMap((section) => section.lessons), [sections]);
  const selected = lessons.find((lesson) => lesson.id === selectedId) || lessons.find((lesson) => !lesson.locked) || lessons[0];
  useEffect(() => {
    if (!selectedId && selected) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    let active = true;
    setStreamUrl(null);
    setStreamError(null);
    if (!selected || selected.locked || !selected.contentPath || !["video", "pdf"].includes(selected.kind)) {
      setStreamLoading(false);
      return () => { active = false; };
    }
    setStreamLoading(true);
    apiRequest("POST", `/api/lessons/${selected.id}/content-session`)
      .then((response) => response.json())
      .then((session) => {
        if (!active) return;
        setStreamUrl(session.streamUrl);
        setStreamLoading(false);
      })
      .catch((error: Error) => {
        if (!active) return;
        setStreamError(error.message || "Lesson media could not be opened");
        setStreamLoading(false);
      });
    return () => { active = false; };
  }, [selected?.id, selected?.contentPath, selected?.kind, selected?.locked, streamRetry]);

  const freeEnrol = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to enrol");
      return (await apiRequest("POST", `/api/courses/${course!.id}/enrol-free`)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses/access", course?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses/curriculum", course?.id] });
      toast({ title: "Course access activated", description: "All published lessons are now available in your account." });
    },
    onError: (error: Error) => toast({ title: "Enrolment was not completed", description: error.message, variant: "destructive" }),
  });

  const paidCheckout = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in before purchasing course access");
      const sellerCode = localStorage.getItem("referralCode") || "";
      return (await apiRequest("POST", `/api/courses/${course!.id}/access-checkout`, { sellerCode })).json();
    },
    onSuccess: async (data) => {
      if (data.paymentSessionId) {
        if (!(window as any).Cashfree) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[data-cashfree-sdk="true"]') as HTMLScriptElement | null;
            if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); return; }
            const script = document.createElement("script");
            script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
            script.async = true;
            script.dataset.cashfreeSdk = "true";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Cashfree checkout could not be loaded"));
            document.head.appendChild(script);
          });
        }
        const cashfree = (window as any).Cashfree({ mode: (import.meta.env.VITE_CASHFREE_ENV || (import.meta.env.DEV ? "sandbox" : "production")).toLowerCase() });
        await cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: "_self" });
        return;
      }
      if (data.paymentLink) window.location.href = data.paymentLink;
    },
    onError: (error: Error) => toast({ title: "Checkout could not be started", description: error.message, variant: "destructive" }),
  });

  const unlock = () => {
    if (!user) { setLocation(`/login?next=${encodeURIComponent(`/learn/${slug}`)}`); return; }
    if (access?.requiresPurchase) paidCheckout.mutate(); else freeEnrol.mutate();
  };

  if (courseLoading || curriculumLoading) return <div className="min-h-screen bg-[#f6f3eb]"><Header /><div className="mx-auto max-w-7xl px-6 py-20"><div className="h-12 w-2/3 animate-pulse rounded-xl bg-slate-200" /><div className="mt-8 h-96 animate-pulse rounded-3xl bg-slate-200" /></div></div>;
  if (!course) return <div className="min-h-screen bg-[#f6f3eb]"><Header /><main className="mx-auto max-w-3xl px-6 py-24 text-center"><h1 className="text-4xl font-black">Course not found</h1><Link href="/courses"><Button className="mt-6">Browse catalog</Button></Link></main><Footer /></div>;

  return (
    <div className="min-h-screen bg-[#f6f3eb] text-slate-950">
      <SEO title={course.title} description={course.description} path={`/learn/${course.slug}`} />
      <Header />
      <main id="main-content">
        <section className="border-b border-white/10 bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-wrap gap-2"><Badge className="bg-violet-500/20 text-violet-100 hover:bg-violet-500/20">{access?.productType === "bundle" ? "Course + assessment" : "Video course"}</Badge><Badge variant="outline" className="border-white/20 text-slate-200">{course.level}</Badge></div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">{course.title}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{course.description}</p>
            <div className="mt-7 flex flex-wrap gap-5 text-sm text-slate-300"><span className="flex items-center gap-2"><BookOpen className="h-4 w-4" />{access?.lessonCount ?? lessons.length} lessons</span><span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{course.duration} min</span><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Entitlement-protected content</span></div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
              <div className={selected?.kind === "pdf" && !selected.locked ? "min-h-[70vh] bg-slate-950" : "aspect-video bg-slate-950"}>
                {!selected ? <div className="grid h-full place-items-center text-slate-400">No lessons have been published yet.</div>
                  : selected.locked ? <div className="grid h-full place-items-center p-8 text-center"><div><LockKeyhole className="mx-auto h-10 w-10 text-violet-300" /><h2 className="mt-5 text-2xl font-black text-white">This lesson is protected</h2><p className="mt-2 text-slate-300">Activate course access to open non-preview content.</p><Button onClick={unlock} className="mt-6 bg-white text-slate-950 hover:bg-slate-100">{access?.requiresPurchase ? `Buy access · ₹${Number(access.contentPrice).toLocaleString("en-IN")}` : "Enrol free"}</Button></div></div>
                  : ["video", "pdf"].includes(selected.kind) && streamLoading ? <div className="grid h-full min-h-80 place-items-center text-slate-300"><div className="text-center"><Film className="mx-auto h-9 w-9 animate-pulse" /><p className="mt-3 text-sm font-semibold">Preparing protected lesson…</p></div></div>
                  : ["video", "pdf"].includes(selected.kind) && streamError ? <div className="grid h-full min-h-80 place-items-center p-8 text-center"><div><LockKeyhole className="mx-auto h-10 w-10 text-amber-300" /><h2 className="mt-4 text-xl font-black text-white">Lesson media could not be opened</h2><p className="mt-2 max-w-lg text-sm text-slate-300">{streamError}</p><Button type="button" onClick={() => setStreamRetry((value) => value + 1)} className="mt-5 bg-white text-slate-950 hover:bg-slate-100">Try again</Button></div></div>
                  : selected.kind === "video" && streamUrl ? <video key={streamUrl} src={streamUrl} controls controlsList="nodownload" disablePictureInPicture preload="metadata" onContextMenu={(event) => event.preventDefault()} onError={() => setStreamError("The protected video stream was interrupted. Retry to renew access.")} className="h-full w-full object-contain" />
                  : selected.kind === "pdf" && streamUrl ? <iframe key={streamUrl} src={`${streamUrl}#toolbar=0&navpanes=0&scrollbar=1`} title={`${selected.title} PDF reader`} referrerPolicy="no-referrer" className="h-[70vh] min-h-[520px] w-full border-0 bg-white" />
                  : selected.kind === "text" ? <div className="h-full overflow-y-auto bg-white p-8 text-slate-800"><p className="whitespace-pre-wrap leading-7">{selected.contentText || "Lesson text has not been added yet."}</p></div>
                  : selected.contentUrl ? <div className="grid h-full place-items-center p-8 text-center"><FileText className="mx-auto h-10 w-10 text-violet-300" /><p className="mt-4 text-white">External lesson resource</p><a href={selected.contentUrl} target="_blank" rel="noreferrer"><Button className="mt-5 bg-white text-slate-950">Open resource <ArrowRight className="ml-2 h-4 w-4" /></Button></a></div>
                  : <div className="grid h-full place-items-center text-slate-400">Content has not been attached to this lesson.</div>}
              </div>
              {selected && <div className="p-5 sm:p-6"><div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{selected.kind}</Badge>{selected.isPreview && <Badge className="bg-emerald-100 text-emerald-800">Free preview</Badge>}</div><h2 className="mt-3 text-2xl font-black">{selected.title}</h2>{["video", "pdf"].includes(selected.kind) && !selected.locked && <p className="mt-3 max-w-3xl text-xs leading-5 text-slate-500">Access is account-gated and browser download controls are reduced. As with every web learning platform, these controls discourage casual copying but cannot guarantee prevention of screen capture or device-level recording.</p>}</div>}
            </div>

            {access?.productType === "bundle" && <Card className="mt-6 border-violet-200 bg-violet-50"><CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-violet-950">Ready to validate the skill?</h2><p className="mt-1 text-sm text-violet-900/70">The assessment and optional credential remain separate from course-content access.</p></div><Link href={`/exam/${course.slug}`}><Button className="bg-violet-700 text-white">Take assessment</Button></Link></CardContent></Card>}
          </div>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-center justify-between px-2 py-2"><h2 className="font-black">Course content</h2>{access?.hasAccess && <span className="flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />Unlocked</span>}</div>
            <div className="mt-2 max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              {sections.map((section) => <div key={section.id}><p className="px-2 text-xs font-black uppercase tracking-wider text-slate-400">{section.title}</p><div className="mt-1 space-y-1">{section.lessons.map((lesson) => <button key={lesson.id} onClick={() => setSelectedId(lesson.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${selected?.id === lesson.id ? "bg-slate-950 text-white" : "hover:bg-slate-100"}`}>{lesson.locked ? <LockKeyhole className="h-4 w-4 shrink-0" /> : lesson.kind === "video" ? <PlayCircle className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}<span className="min-w-0 flex-1 truncate">{lesson.title}</span>{lesson.isPreview && <span className="text-[10px] font-bold uppercase text-emerald-600">Preview</span>}</button>)}</div></div>)}
            </div>
            {!access?.hasAccess && access?.productType !== "assessment" && <Button onClick={unlock} disabled={freeEnrol.isPending || paidCheckout.isPending} className="mt-5 w-full bg-violet-700 text-white hover:bg-violet-800">{access?.requiresPurchase ? `Buy course · ₹${Number(access.contentPrice).toLocaleString("en-IN")}` : "Enrol free"}</Button>}
          </aside>
        </section>
      </main>
      <Footer />
    </div>
  );
}
