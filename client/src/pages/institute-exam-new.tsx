import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/header";
import Footer from "@/components/footer";
import Breadcrumbs from "@/components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";

type Institute = { id: number; name: string; status: string };

export default function InstituteExamNew() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [passingScore, setPassingScore] = useState(50);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data: institute } = useQuery<Institute>({
    queryKey: ["/api/me/institute"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/me/institute")).json(),
  });

  const create = useMutation({
    mutationFn: async () => {
      const body: any = {
        title,
        durationMin: Number(durationMin),
        passingScore: Number(passingScore),
        maxAttempts: Number(maxAttempts),
        ownerType: "institute",
        ownerId: institute!.id,
      };
      if (startsAt) body.startsAt = new Date(startsAt).toISOString();
      if (endsAt) body.endsAt = new Date(endsAt).toISOString();
      if (password) body.password = password;
      const r = await apiRequest("POST", "/api/exam-instances", body);
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/exam-instances"] });
      toast({
        title: "Exam created",
        description: `Share link: ${data.shareUrl}`,
      });
      setLocation("/institute/exams");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-cream-soft flex flex-col">
      <SEO title="Create exam" description="Create a new cohort exam." path="/institute/exams/new" />
      <Header />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Breadcrumbs
          items={[
            { label: "Institute", href: "/institute/dashboard" },
            { label: "Exams", href: "/institute/exams" },
            { label: "New" },
          ]}
        />
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-6">Create exam</h1>
        <Card className="border-cream-deep">
          <CardHeader>
            <CardTitle className="text-base">Exam details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mid-term Java OOP" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dur">Duration (min)</Label>
                <Input id="dur" type="number" min={5} max={360} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="pass">Passing %</Label>
                <Input id="pass" type="number" min={10} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="att">Max attempts</Label>
                <Input id="att" type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start">Starts at (optional)</Label>
                <Input id="start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="end">Ends at (optional)</Label>
                <Input id="end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="pwd">Password (optional)</Label>
              <Input id="pwd" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for open access" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => create.mutate()}
                disabled={!title || title.length < 3 || !institute?.id || create.isPending}
                className="bg-slate-900 text-white"
              >
                {create.isPending ? "Creating…" : "Create exam"}
              </Button>
              <Button variant="outline" onClick={() => setLocation("/institute/exams")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
