import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import Footer from "@/components/footer";
import Breadcrumbs from "@/components/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { Plus, Copy, Calendar, Clock, ShieldCheck } from "lucide-react";

type Institute = { id: number; name: string; status: string };
type Instance = {
  id: number;
  title: string;
  shareCode: string;
  shareUrl: string;
  durationMin: number;
  passingScore: number;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
};

export default function InstituteExams() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data: institute } = useQuery<Institute>({
    queryKey: ["/api/me/institute"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/me/institute")).json(),
  });

  const { data: instances = [], isLoading } = useQuery<Instance[]>({
    queryKey: ["/api/exam-instances", institute?.id],
    enabled: !!institute?.id,
    queryFn: async () =>
      (await apiRequest("GET", `/api/exam-instances?ownerType=institute&ownerId=${institute!.id}`)).json(),
  });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-cream-soft flex flex-col">
      <SEO title="Exams · Institute" description="Create and manage cohort exams." path="/institute/exams" />
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Breadcrumbs items={[{ label: "Institute", href: "/institute/dashboard" }, { label: "Exams" }]} />
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Exams</h1>
            <p className="text-sm text-slate-600 mt-1">
              Generate share-link exams for your students. Each exam gets a unique code; password and cohort gating are optional.
            </p>
          </div>
          <Button onClick={() => setLocation("/institute/exams/new")} className="bg-slate-900 text-white">
            <Plus className="w-4 h-4 mr-2" /> Create exam
          </Button>
        </div>

        {institute?.status !== "verified" ? (
          <Card className="border-amber-200 bg-amber-50 mb-6">
            <CardContent className="pt-6 text-sm text-amber-900">
              Your institute is still <strong>{institute?.status || "unverified"}</strong>. Exams created before verification may be limited.
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="text-sm text-slate-500">Loading exams…</div>
        ) : instances.length === 0 ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="py-12 text-center">
              <ShieldCheck className="w-10 h-10 mx-auto text-slate-400 mb-3" />
              <h3 className="text-lg font-medium text-slate-900">No exams yet</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Create your first exam, share the link with a cohort, and we'll auto-collect attempts and pass/fail results.
              </p>
              <Button onClick={() => setLocation("/institute/exams/new")} className="mt-4 bg-slate-900 text-white">
                <Plus className="w-4 h-4 mr-2" /> Create exam
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {instances.map((x) => (
              <Card key={x.id} className="border-cream-deep">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900 truncate">{x.title}</h3>
                      <Badge variant="outline" className="text-xs uppercase">{x.status}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {x.durationMin} min</span>
                      <span>Pass ≥ {x.passingScore}%</span>
                      {x.startsAt ? <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(x.startsAt).toLocaleString()}</span> : null}
                      <code className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">/x/{x.shareCode}</code>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => copy(x.shareUrl)}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy link
                    </Button>
                    <Link href={`/x/${x.shareCode}`}>
                      <Button variant="outline" size="sm">Open</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
