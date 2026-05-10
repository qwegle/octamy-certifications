import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/header";
import Footer from "@/components/footer";
import Breadcrumbs from "@/components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { Plus, Trash2, ChevronUp, ChevronDown, Eye } from "lucide-react";

type Lesson = {
  id: number;
  title: string;
  kind: string;
  contentUrl: string | null;
  contentText: string | null;
  durationSec: number;
  position: number;
  isPreview: boolean;
};
type Section = {
  id: number;
  title: string;
  position: number;
  lessons: Lesson[];
};

export default function CreatorCurriculum() {
  const params = useParams<{ id: string }>();
  const courseId = Number(params.id);
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [newSection, setNewSection] = useState("");
  const [newLessonBy, setNewLessonBy] = useState<Record<number, { title: string; kind: string; url: string }>>({});

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/creator/login");
  }, [authLoading, user, token, setLocation]);

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: [`/api/courses/${courseId}/curriculum`],
    enabled: Number.isFinite(courseId),
    queryFn: async () => (await apiRequest("GET", `/api/courses/${courseId}/curriculum`)).json(),
  });

  const addSection = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/creator/courses/${courseId}/sections`, {
        title: newSection,
        position: sections.length,
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: () => {
      setNewSection("");
      qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const delSection = useMutation({
    mutationFn: async (sid: number) => {
      const r = await apiRequest("DELETE", `/api/creator/courses/${courseId}/sections/${sid}`);
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] }),
  });

  const addLesson = useMutation({
    mutationFn: async (sectionId: number) => {
      const draft = newLessonBy[sectionId] || { title: "", kind: "video", url: "" };
      const r = await apiRequest("POST", `/api/creator/courses/${courseId}/lessons`, {
        sectionId,
        title: draft.title,
        kind: draft.kind,
        contentUrl: draft.url || null,
        position: sections.find((s) => s.id === sectionId)?.lessons.length ?? 0,
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: (_d, sectionId) => {
      setNewLessonBy((s) => ({ ...s, [sectionId]: { title: "", kind: "video", url: "" } }));
      qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const delLesson = useMutation({
    mutationFn: async (lid: number) => {
      const r = await apiRequest("DELETE", `/api/creator/courses/${courseId}/lessons/${lid}`);
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] }),
  });

  const moveLesson = useMutation({
    mutationFn: async ({ id, position }: { id: number; position: number }) => {
      const r = await apiRequest("PATCH", `/api/creator/courses/${courseId}/lessons/${id}`, { position });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] }),
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO title="Curriculum · Creator" description="Build your course curriculum." path={`/creator/courses/${courseId}/curriculum`} />
      <Header />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Breadcrumbs
          items={[
            { label: "Creator", href: "/creator/dashboard" },
            { label: "Courses", href: "/creator/courses" },
            { label: `Curriculum #${courseId}` },
          ]}
        />
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Curriculum</h1>
            <p className="text-sm text-slate-600 mt-1">Organize your course into sections and lessons. Learners see them in order.</p>
          </div>
          <Link href={`/creator/courses`}>
            <Button variant="outline">Back to courses</Button>
          </Link>
        </div>

        <Card className="border-slate-200 mb-6">
          <CardHeader><CardTitle className="text-base">Add section</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="e.g. Module 1: Foundations" />
              <Button onClick={() => addSection.mutate()} disabled={newSection.length < 2 || addSection.isPending} className="bg-slate-900 text-white">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : sections.length === 0 ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="py-12 text-center text-sm text-slate-600">
              No sections yet. Add your first section above to start building the curriculum.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sections.map((s) => {
              const draft = newLessonBy[s.id] || { title: "", kind: "video", url: "" };
              return (
                <Card key={s.id} className="border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => delSection.mutate(s.id)} disabled={delSection.isPending}>
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {s.lessons.length === 0 ? (
                      <p className="text-xs text-slate-500">No lessons yet.</p>
                    ) : (
                      <ul className="divide-y border rounded-md">
                        {s.lessons.map((l, idx) => (
                          <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <div className="min-w-0 flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase">{l.kind}</Badge>
                              <span className="truncate text-sm text-slate-900">{l.title}</span>
                              {l.isPreview && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]"><Eye className="w-3 h-3 mr-1" />Preview</Badge>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => moveLesson.mutate({ id: l.id, position: l.position - 1 })}>
                                <ChevronUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" disabled={idx === s.lessons.length - 1} onClick={() => moveLesson.mutate({ id: l.id, position: l.position + 1 })}>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => delLesson.mutate(l.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_2fr_auto] gap-2 pt-2 border-t">
                      <Input
                        value={draft.title}
                        onChange={(e) => setNewLessonBy((p) => ({ ...p, [s.id]: { ...draft, title: e.target.value } }))}
                        placeholder="Lesson title"
                      />
                      <Select value={draft.kind} onValueChange={(v) => setNewLessonBy((p) => ({ ...p, [s.id]: { ...draft, kind: v } }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="quiz">Quiz</SelectItem>
                          <SelectItem value="link">Link</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={draft.url}
                        onChange={(e) => setNewLessonBy((p) => ({ ...p, [s.id]: { ...draft, url: e.target.value } }))}
                        placeholder="Content URL (optional)"
                      />
                      <Button
                        onClick={() => addLesson.mutate(s.id)}
                        disabled={!draft.title || draft.title.length < 2 || addLesson.isPending}
                        className="bg-slate-900 text-white"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
