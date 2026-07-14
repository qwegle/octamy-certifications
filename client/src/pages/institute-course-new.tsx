import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard-layout";
import { AiCourseCopilot } from "@/components/ai-course-copilot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { Image as ImageIcon, Info, Layers3, Sparkles, X } from "lucide-react";
import { MediaLibraryDialog } from "@/components/media-library";
import {
  CourseDraftMaterializationError,
  aiCourseDraftToFormValues,
  materializeAiCourseDraft,
  type CourseDraft,
} from "@/lib/ai-course-draft";

type Category = { id: number; name: string };
type AudienceBand = { id: number; code: string; label: string; description: string | null };
type Institute = { id: number; status: string };

export default function InstituteCourseNew() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "",
    description: "",
    categoryId: 0,
    duration: 30,
    passingScore: 60,
    price: 0,
    productType: "assessment" as "assessment" | "video_course" | "ebook" | "bundle",
    contentPrice: 0,
    level: "novice" as "novice" | "intermediate" | "advanced" | "expert",
    visibility: "private" as "private" | "unlisted" | "public",
    language: "en",
    certificationMode: "institute" as "institute" | "octamy_institute",
    defaultReviewPolicy: "after_window" as "immediate" | "after_final_attempt" | "after_window" | "score_only",
    audienceBandIds: [] as number[],
    thumbnailUrl: "",
  });
  const [mediaOpen, setMediaOpen] = useState(false);
  const [aiDraft, setAiDraft] = useState<CourseDraft | null>(null);

  function applyAiDraft(draft: CourseDraft) {
    const aiValues = aiCourseDraftToFormValues(draft);
    setForm((current) => ({ ...current, ...aiValues }));
    setAiDraft(draft);
    const lessonCount = draft.sections.reduce((total, section) => total + section.lessons.length, 0);
    toast({
      title: "AI blueprint applied",
      description: `${draft.sections.length} modules and ${lessonCount} lesson ideas are queued. Review the fields, choose a category, and set institute pricing before saving.`,
    });
  }

  function changeProductType(productType: typeof form.productType) {
    setForm((current) => ({ ...current, productType }));
    if (aiDraft && aiDraft.productType !== productType) {
      setAiDraft(null);
      toast({
        title: "AI outline detached",
        description: "The course format changed, so the previous curriculum will not be imported. Your editable fields were kept; generate a matching outline when ready.",
      });
    }
  }

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data: institute } = useQuery<Institute>({
    queryKey: ["/api/me/institute"],
    enabled: !!user && !!token,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/me/institute");
      if (!response.ok) throw new Error("Institute workspace unavailable");
      return response.json();
    },
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      if (!response.ok) throw new Error("Categories unavailable");
      return response.json();
    },
  });
  const { data: audienceBands = [] } = useQuery<AudienceBand[]>({
    queryKey: ["/api/audience-bands"],
    queryFn: async () => (await apiRequest("GET", "/api/audience-bands")).json(),
  });

  const create = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/institute/courses", {
        ...form,
        thumbnailUrl: form.thumbnailUrl || null,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Course could not be created");
      return response.json();
    },
    onSuccess: async (course: any) => {
      let toastTitle = course.reviewState === "submitted" ? "Course submitted" : "Draft saved";
      let toastDescription = course.submissionBlockedReason || "Continue in the curriculum builder.";

      if (aiDraft) {
        try {
          const result = await materializeAiCourseDraft("institute", Number(course.id), aiDraft);
          toastTitle = "Course and curriculum created";
          toastDescription = aiDraft.productType === "video_course"
            ? `${result.completedSections} modules and ${result.completedLessons} lesson placeholders were added. Add and review all teaching content before publishing.`
            : `${result.completedSections} modules and ${result.completedLessons} outline placeholders were added. Author and review scored questions separately in Question Banks before submission.`;
        } catch (error) {
          toastTitle = "Course saved; review the curriculum";
          toastDescription = error instanceof CourseDraftMaterializationError
            ? error.message
            : "The course was saved, but its AI outline could not be added. You can continue manually in the curriculum builder.";
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/institute/courses"] });
      toast({ title: toastTitle, description: toastDescription });
      setLocation(`/institute/courses/${course.id}/curriculum`);
    },
    onError: (error: Error) => toast({ title: "Course was not saved", description: error.message, variant: "destructive" }),
  });

  const verified = institute?.status === "verified";
  const actionLabel = verified && form.visibility !== "private" ? "Submit for review" : "Save private draft";
  const valid = form.title.trim().length >= 3 && form.description.trim().length >= 10 && form.categoryId > 0 && form.audienceBandIds.length > 0;

  if (!user) return null;

  return (
    <DashboardLayout
      role="institute"
      title="New course"
      description="Create an institute-owned draft, then build its curriculum."
      breadcrumbs={[{ label: "Courses", href: "/institute/courses" }, { label: "New" }]}
    >
      <SEO title="New institute course" description="Create an institute-owned course." path="/institute/courses/new" />
      <div className="max-w-4xl space-y-5">
      <AiCourseCopilot workspace="institute" onApply={applyAiDraft} />
      <Card className="border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-base">Course details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {aiDraft && (
            <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50/70 p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
              <div className="flex min-w-0 gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
                <div>
                  <p className="text-sm font-semibold text-slate-950">AI curriculum ready to add</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600"><Layers3 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{aiDraft.sections.length} modules will be created only when you save this course. Pricing, category, media, and visibility remain under institute control.</p>
                </div>
              </div>
              <Button type="button" variant="ghost" className="min-h-11 shrink-0 text-slate-600" onClick={() => setAiDraft(null)}>Keep fields only</Button>
            </div>
          )}
          {!verified && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>You can build the complete course now. It remains private until the institute workspace is verified and the course is submitted for review.</p>
            </div>
          )}
          <Field id="institute-course-title" label="Title" required><Input id="institute-course-title" className="min-h-11" required aria-required="true" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Python foundations for Batch 2026" /></Field>
          <Field id="institute-course-description" label="Description" required><Textarea id="institute-course-description" className="min-h-28" rows={4} required aria-required="true" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the learner outcome and included material." /></Field>
          <Field id="institute-course-thumbnail-picker" label="Course thumbnail">
            {form.thumbnailUrl ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <img src={form.thumbnailUrl} alt="Selected course thumbnail" className="aspect-video w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-slate-950/80 p-3 backdrop-blur">
                  <Button id="institute-course-thumbnail-picker" type="button" size="sm" variant="secondary" onClick={() => setMediaOpen(true)}>Choose another</Button>
                  <Button type="button" size="icon" variant="ghost" className="text-white hover:bg-white/15 hover:text-white" onClick={() => setForm({ ...form, thumbnailUrl: "" })} aria-label="Remove thumbnail"><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ) : (
              <button id="institute-course-thumbnail-picker" type="button" onClick={() => setMediaOpen(true)} className="flex min-h-11 w-full items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-left transition hover:border-violet-400 hover:bg-violet-50">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><ImageIcon className="h-5 w-5" /></span>
                <span><span className="block text-sm font-bold text-slate-900">Choose from media library</span><span className="block text-xs text-slate-500">Upload once and reuse it across institute content.</span></span>
              </button>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="institute-course-category" label="Category" required>
              <select id="institute-course-category" className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" required aria-required="true" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: Number(event.target.value) })}>
                <option value={0}>Select a category…</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field id="institute-course-level" label="Level" required>
              <select id="institute-course-level" className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" required aria-required="true" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as typeof form.level })}>
                <option value="novice">Novice</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option>
              </select>
            </Field>
          </div>
          <Field id="institute-course-product-type" label="What is the institute publishing?" required>
            <select id="institute-course-product-type" className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" required aria-required="true" value={form.productType} onChange={(event) => changeProductType(event.target.value as typeof form.productType)}>
              <option value="assessment">Assessment only</option>
              <option value="video_course">Video course</option>
              <option value="ebook">Protected ebook</option>
              <option value="bundle">Video course + assessment</option>
            </select>
            <p className="mt-1 text-xs leading-5 text-slate-500">Video lessons and PDFs use entitlement-protected delivery. Individual lessons can be marked as free previews.</p>
          </Field>
          <Field id="institute-course-audience" label="Learner audience" required>
            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2">
              {audienceBands.map((band, index) => {
                const checked = form.audienceBandIds.includes(band.id);
                return (
                  <label key={band.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 transition hover:ring-violet-300">
                    <input
                      id={index === 0 ? "institute-course-audience" : undefined}
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-violet-700"
                      checked={checked}
                      onChange={() => setForm((current) => ({
                        ...current,
                        audienceBandIds: checked
                          ? current.audienceBandIds.filter((id) => id !== band.id)
                          : [...current.audienceBandIds, band.id],
                      }))}
                    />
                    <span><span className="block text-sm font-semibold text-slate-900">{band.label}</span>{band.description && <span className="mt-0.5 block text-xs text-slate-500">{band.description}</span>}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">Audience bands power private assignment filters and age-appropriate assessment review.</p>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="institute-course-certification" label="Credential issuer" required>
              <select id="institute-course-certification" className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.certificationMode} onChange={(event) => setForm({ ...form, certificationMode: event.target.value as typeof form.certificationMode })}>
                <option value="institute">Institute-issued · Octamy verifies the record</option>
                <option value="octamy_institute">Request Octamy + institute co-certification</option>
              </select>
              <p className="mt-1 text-xs leading-5 text-slate-500">Co-certification is review-gated. If approved, Octamy appears left and the verified institute appears right on the credential.</p>
            </Field>
            <Field id="institute-course-review-policy" label="Answer review policy" required>
              <select id="institute-course-review-policy" className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.defaultReviewPolicy} onChange={(event) => setForm({ ...form, defaultReviewPolicy: event.target.value as typeof form.defaultReviewPolicy })}>
                <option value="after_window">After exam window closes · recommended</option>
                <option value="after_final_attempt">After final attempt</option>
                <option value="immediate">Immediate · practice only</option>
                <option value="score_only">Score only · no answer key</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="institute-course-duration" label="Duration (minutes)" required><Input id="institute-course-duration" className="min-h-11" type="number" min={5} max={600} required aria-required="true" value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })} /></Field>
            <Field id="institute-course-passing-score" label="Passing score (%)" required><Input id="institute-course-passing-score" className="min-h-11" type="number" min={10} max={100} required aria-required="true" value={form.passingScore} onChange={(event) => setForm({ ...form, passingScore: Number(event.target.value) })} /></Field>
            <Field id="institute-course-credential-price" label="Credential activation (₹)" required><Input id="institute-course-credential-price" className="min-h-11" type="number" min={0} required aria-required="true" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></Field>
          </div>
          {form.productType !== "assessment" && (
            <Field id="institute-course-access-price" label="Course access price (₹)" required>
              <Input id="institute-course-access-price" className="min-h-11" type="number" min={0} required aria-required="true" value={form.contentPrice} onChange={(event) => setForm({ ...form, contentPrice: Number(event.target.value) })} />
              <p className="mt-1 text-xs text-slate-500">Use ₹0 for free access. Paid content unlocks only after confirmed payment.</p>
            </Field>
          )}
          <Field id="institute-course-visibility" label="Submission state">
            <select id="institute-course-visibility" className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as typeof form.visibility })} disabled={!verified}>
              <option value="private">Draft — institute workspace only</option>
              <option value="unlisted">Submit as unlisted — direct link after approval</option>
              <option value="public">Submit as public — catalog after approval</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setLocation("/institute/courses")}>Cancel</Button>
            <Button type="button" onClick={() => create.mutate()} disabled={!valid || create.isPending} className="bg-slate-900 text-white">{create.isPending ? "Saving…" : actionLabel}</Button>
          </div>
        </CardContent>
      </Card>
      <MediaLibraryDialog
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        allowedKinds={["image"]}
        selectedUrl={form.thumbnailUrl}
        title="Choose a course thumbnail"
        onSelect={(asset) => setForm((current) => ({ ...current, thumbnailUrl: asset.url }))}
      />
      </div>
    </DashboardLayout>
  );
}

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id} className="text-sm text-slate-700">{label}{required && <span className="text-rose-700" aria-hidden="true"> *</span>}</Label>{children}</div>;
}
