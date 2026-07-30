import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, Library } from "lucide-react";
import { MediaLibraryDialog, type MediaKind } from "@/components/media-library";

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
type LessonDraft = { title: string; kind: string; url: string; text: string; isPreview: boolean };
const emptyLesson = (): LessonDraft => ({ title: "", kind: "video", url: "", text: "", isPreview: false });

export default function CreatorCurriculum() {
  const params = useParams<{ id: string }>();
  const courseId = Number(params.id);
  const { user, token, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isInstitute = location.startsWith("/institute/");
  const workspace = isInstitute ? "institute" : "creator";
  const coursesPath = `/${workspace}/courses`;
  const curriculumApi = `/api/${workspace}/courses/${courseId}`;

  const [newSection, setNewSection] = useState("");
  const [newLessonBy, setNewLessonBy] = useState<Record<number, LessonDraft>>({});
  const [mediaPicker, setMediaPicker] = useState<{ sectionId: number; kind: MediaKind } | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation(`/${workspace}/login`);
  }, [authLoading, user, token, setLocation, workspace]);

  const { data: sections = [], isLoading, isError, refetch } = useQuery<Section[]>({
    queryKey: [`/api/courses/${courseId}/curriculum`],
    enabled: Number.isFinite(courseId),
    queryFn: async () => (await apiRequest("GET", `/api/courses/${courseId}/curriculum`)).json(),
  });

  const addSection = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `${curriculumApi}/sections`, {
        title: newSection,
        position: sections.length,
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: () => {
      setNewSection("");
      qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] });
      toast({ title: "Section added", description: "Your curriculum structure has been updated." });
    },
    onError: (e: any) => toast({ title: "Section was not added", description: e.message, variant: "destructive" }),
  });

  const delSection = useMutation({
    mutationFn: async (sid: number) => {
      const r = await apiRequest("DELETE", `${curriculumApi}/sections/${sid}`);
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] });
      toast({ title: "Section removed", description: "Its lessons were removed from this draft." });
    },
    onError: (e: any) => toast({ title: "Section was not removed", description: e.message, variant: "destructive" }),
  });

  const addLesson = useMutation({
    mutationFn: async (sectionId: number) => {
      const draft = newLessonBy[sectionId] || emptyLesson();
      const r = await apiRequest("POST", `${curriculumApi}/lessons`, {
        sectionId,
        title: draft.title,
        kind: draft.kind,
        contentUrl: draft.url || null,
        contentText: draft.kind === "text" ? draft.text || null : null,
        isPreview: draft.isPreview,
        position: sections.find((s) => s.id === sectionId)?.lessons.length ?? 0,
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: (_d, sectionId) => {
      setNewLessonBy((s) => ({ ...s, [sectionId]: emptyLesson() }));
      qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] });
      toast({ title: "Lesson added", description: "The lesson is now part of this course draft." });
    },
    onError: (e: any) => toast({ title: "Lesson was not added", description: e.message, variant: "destructive" }),
  });

  const delLesson = useMutation({
    mutationFn: async (lid: number) => {
      const r = await apiRequest("DELETE", `${curriculumApi}/lessons/${lid}`);
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] }),
    onError: (e: any) => toast({ title: "Lesson was not removed", description: e.message, variant: "destructive" }),
  });

  const moveLesson = useMutation({
    mutationFn: async ({ id, position }: { id: number; position: number }) => {
      const r = await apiRequest("PATCH", `${curriculumApi}/lessons/${id}`, { position });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] }),
    onError: (e: any) => toast({ title: "Lesson order was not saved", description: e.message, variant: "destructive" }),
  });

  const togglePreview = useMutation({
    mutationFn: async ({ id, isPreview }: { id: number; isPreview: boolean }) => {
      const response = await apiRequest("PATCH", `${curriculumApi}/lessons/${id}`, { isPreview });
      if (!response.ok) throw new Error((await response.json()).message || "Preview setting was not saved");
      return response.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/curriculum`] }),
    onError: (error: Error) => toast({ title: "Preview setting was not saved", description: error.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <DashboardLayout
      role={isInstitute ? "institute" : "creator"}
      title="Curriculum"
      description="Organize your course into sections and lessons. Learners see them in order."
      breadcrumbs={[
        { label: "Courses", href: coursesPath },
        { label: `Curriculum #${courseId}` },
      ]}
      actions={(
        <Button asChild variant="outline"><Link href={coursesPath}>Back to courses</Link></Button>
      )}
    >
      <SEO title={`Curriculum · ${isInstitute ? "Institute" : "Creator"}`} description="Build your course curriculum." path={`${coursesPath}/${courseId}/curriculum`} />
        <Card className="mb-6 border-slate-200">
          <CardHeader><CardTitle className="text-base">Add section</CardTitle></CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(event) => { event.preventDefault(); addSection.mutate(); }}
            >
              <div className="flex-1">
                <Label htmlFor="new-curriculum-section">Section name</Label>
                <Input
                  id="new-curriculum-section"
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  placeholder="e.g. Module 1: Foundations"
                  required
                  minLength={2}
                  className="mt-1 min-h-11"
                />
              </div>
              <Button type="submit" disabled={newSection.trim().length < 2 || addSection.isPending}>
                <Plus className="mr-1 h-4 w-4" /> {addSection.isPending ? "Adding…" : "Add section"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-3" aria-label="Loading curriculum">
            {[1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-200/70" />)}
          </div>
        ) : isError ? (
          <Card className="border-slate-200 bg-slate-50/70">
            <CardContent className="py-8 text-center">
              <h2 className="font-semibold text-slate-900">Curriculum could not be loaded</h2>
              <p className="mt-1 text-sm text-slate-600">Check your workspace access and try again.</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => refetch()}>Try again</Button>
            </CardContent>
          </Card>
        ) : sections.length === 0 ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="py-12 text-center text-sm text-slate-600">
              No sections yet. Add your first section above to start building the curriculum.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sections.map((s) => {
              const draft = newLessonBy[s.id] || emptyLesson();
              return (
                <Card key={s.id} className="border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove section ${s.title}`}
                      title={`Remove section ${s.title}`}
                      onClick={() => {
                        if (window.confirm(`Remove “${s.title}” and every lesson in it?`)) delSection.mutate(s.id);
                      }}
                      disabled={delSection.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-slate-600" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {s.lessons.length === 0 ? (
                      <p className="text-xs text-slate-500">No lessons yet.</p>
                    ) : (
                      <ul className="divide-y border rounded-md">
                        {s.lessons.map((l, idx) => (
                          <li key={l.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase">{l.kind}</Badge>
                              <span className="truncate text-sm text-slate-900">{l.title}</span>
                              <button
                                type="button"
                                className="inline-flex min-h-11 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                                onClick={() => togglePreview.mutate({ id: l.id, isPreview: !l.isPreview })}
                                aria-label={`${l.isPreview ? "Protect" : "Allow free preview for"} ${l.title}`}
                                title={l.isPreview ? "Make this lesson protected" : "Allow this lesson as a free preview"}
                              >
                                <Badge variant={l.isPreview ? "default" : "outline"} className={l.isPreview ? "bg-slate-100 text-slate-800 text-[10px] hover:bg-slate-200" : "text-[10px] text-slate-500"}><Eye className="w-3 h-3 mr-1" />{l.isPreview ? "Preview" : "Protected"}</Badge>
                              </button>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                              <Button type="button" size="icon" variant="ghost" aria-label={`Move ${l.title} up`} title="Move lesson up" disabled={idx === 0 || moveLesson.isPending} onClick={() => moveLesson.mutate({ id: l.id, position: l.position - 1 })}>
                                <ChevronUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" aria-label={`Move ${l.title} down`} title="Move lesson down" disabled={idx === s.lessons.length - 1 || moveLesson.isPending} onClick={() => moveLesson.mutate({ id: l.id, position: l.position + 1 })}>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={`Remove lesson ${l.title}`}
                                title={`Remove lesson ${l.title}`}
                                disabled={delLesson.isPending}
                                onClick={() => { if (window.confirm(`Remove “${l.title}” from this course?`)) delLesson.mutate(l.id); }}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-slate-600" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-[1fr_150px_2fr_auto_auto] lg:items-end">
                      <div>
                        <Label htmlFor={`lesson-title-${s.id}`}>Lesson title</Label>
                        <Input
                          id={`lesson-title-${s.id}`}
                          value={draft.title}
                          onChange={(e) => setNewLessonBy((p) => ({ ...p, [s.id]: { ...draft, title: e.target.value } }))}
                          placeholder="e.g. Introduction"
                          className="mt-1 min-h-11"
                        />
                      </div>
                      <div>
                        <Label id={`lesson-kind-label-${s.id}`}>Content type</Label>
                        <Select value={draft.kind} onValueChange={(v) => setNewLessonBy((p) => ({ ...p, [s.id]: { ...draft, kind: v } }))}>
                        <SelectTrigger className="mt-1 min-h-11" aria-labelledby={`lesson-kind-label-${s.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="quiz">Quiz</SelectItem>
                          <SelectItem value="link">Link</SelectItem>
                        </SelectContent>
                      </Select>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1">
                        <Label htmlFor={`lesson-url-${s.id}`}>{draft.kind === "video" || draft.kind === "pdf" ? "Protected media" : "Content URL"} <span className="font-normal text-slate-500">(optional)</span></Label>
                        <Input
                          id={`lesson-url-${s.id}`}
                          value={draft.url}
                          onChange={(e) => setNewLessonBy((p) => ({ ...p, [s.id]: { ...draft, url: e.target.value } }))}
                          placeholder={draft.kind === "text" ? "Use the text field below" : draft.kind === "video" || draft.kind === "pdf" ? "Choose a file from Media" : "https://…"}
                          disabled={draft.kind === "text" || draft.kind === "quiz" || draft.kind === "video" || draft.kind === "pdf"}
                          className="mt-1 min-h-11"
                        />
                      </div>
                      {(draft.kind === "video" || draft.kind === "pdf") && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setMediaPicker({ sectionId: s.id, kind: draft.kind === "video" ? "video" : "document" })}
                          title="Choose from media library"
                          aria-label={`Choose ${draft.kind === "video" ? "a video" : "a PDF"} from the media library`}
                        >
                          <Library className="h-4 w-4 sm:mr-1" />
                          <span className="sm:hidden lg:inline">Media</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={() => addLesson.mutate(s.id)}
                        disabled={draft.title.trim().length < 2 || addLesson.isPending}
                      >
                        <Plus className="mr-1 h-4 w-4" /> {addLesson.isPending ? "Adding…" : "Add lesson"}
                      </Button>
                    </div>
                    {(draft.kind === "video" || draft.kind === "pdf") && (
                      <p className="text-xs leading-5 text-slate-500">Choose an Octamy media item so learners receive entitlement-checked inline access. Public third-party video or PDF URLs are not accepted for protected delivery.</p>
                    )}
                    {draft.kind === "text" && (
                      <div>
                        <Label htmlFor={`lesson-text-${s.id}`}>Lesson text</Label>
                        <Textarea
                          id={`lesson-text-${s.id}`}
                          value={draft.text}
                          onChange={(event) => setNewLessonBy((current) => ({ ...current, [s.id]: { ...draft, text: event.target.value } }))}
                          placeholder="Write the lesson content. It is stored as plain text."
                          rows={6}
                          className="mt-1"
                        />
                      </div>
                    )}
                    <div id={`preview-help-${s.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Free preview</p>
                        <p className="text-xs text-slate-500">Anyone can open this lesson before purchasing course access.</p>
                      </div>
                      <Switch checked={draft.isPreview} onCheckedChange={(checked) => setNewLessonBy((current) => ({ ...current, [s.id]: { ...draft, isPreview: checked } }))} aria-label={`Allow a free preview for the new lesson in ${s.title}`} aria-describedby={`preview-help-${s.id}`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {mediaPicker && (
          <MediaLibraryDialog
            open
            onOpenChange={(open) => { if (!open) setMediaPicker(null); }}
            allowedKinds={[mediaPicker.kind]}
            selectedUrl={newLessonBy[mediaPicker.sectionId]?.url}
            title={mediaPicker.kind === "video" ? "Choose a lesson video" : "Choose a lesson PDF"}
            onSelect={(asset) => {
              const sectionId = mediaPicker.sectionId;
              setNewLessonBy((current) => ({
                ...current,
                [sectionId]: {
                  ...(current[sectionId] || { ...emptyLesson(), kind: asset.kind === "video" ? "video" : "pdf" }),
                  url: asset.url,
                },
              }));
              setMediaPicker(null);
            }}
          />
        )}
    </DashboardLayout>
  );
}
