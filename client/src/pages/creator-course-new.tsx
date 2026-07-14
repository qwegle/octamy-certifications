import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/dashboard-layout';
import { AiCourseCopilot } from '@/components/ai-course-copilot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { SEO } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Layers3, Sparkles, X } from 'lucide-react';
import { MediaLibraryDialog } from '@/components/media-library';
import {
  CourseDraftMaterializationError,
  aiCourseDraftToFormValues,
  materializeAiCourseDraft,
  type CourseDraft,
} from '@/lib/ai-course-draft';

type Category = { id: number; name: string; slug: string };
type AudienceBand = { id: number; code: string; label: string; description: string | null };
type Creator = { id: number; status: string };

export default function CreatorCourseNew() {
  const [, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation('/creator/login');
  }, [authLoading, user, token, setLocation]);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: async () => (await apiRequest('GET', '/api/categories')).json(),
  });
  const { data: creator } = useQuery<Creator>({
    queryKey: ['/api/me/creator'],
    enabled: !!user && !!token,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/me/creator');
      if (!response.ok) throw new Error('Creator profile unavailable');
      return response.json();
    },
  });
  const { data: audienceBands = [] } = useQuery<AudienceBand[]>({
    queryKey: ['/api/audience-bands'],
    queryFn: async () => (await apiRequest('GET', '/api/audience-bands')).json(),
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: 0,
    duration: 30,
    passingScore: 60,
    price: 199,
    productType: 'assessment' as 'assessment' | 'video_course' | 'ebook' | 'bundle',
    contentPrice: 0,
    level: 'novice' as 'novice' | 'intermediate' | 'advanced' | 'expert',
    visibility: 'private' as 'public' | 'unlisted' | 'private',
    language: 'en',
    certificationMode: 'creator' as 'creator' | 'octamy_creator',
    defaultReviewPolicy: 'after_final_attempt' as 'immediate' | 'after_final_attempt' | 'after_window' | 'score_only',
    audienceBandIds: [] as number[],
    thumbnailUrl: '',
  });
  const [mediaOpen, setMediaOpen] = useState(false);
  const [aiDraft, setAiDraft] = useState<CourseDraft | null>(null);

  function applyAiDraft(draft: CourseDraft) {
    const aiValues = aiCourseDraftToFormValues(draft);
    setForm((current) => ({ ...current, ...aiValues }));
    setAiDraft(draft);
    const lessonCount = draft.sections.reduce((total, section) => total + section.lessons.length, 0);
    toast({
      title: 'AI blueprint applied',
      description: `${draft.sections.length} modules and ${lessonCount} lesson ideas are queued. Review the fields, choose a category, and set your pricing before saving.`,
    });
  }

  function changeProductType(productType: typeof form.productType) {
    setForm((current) => ({ ...current, productType }));
    if (aiDraft && aiDraft.productType !== productType) {
      setAiDraft(null);
      toast({
        title: 'AI outline detached',
        description: 'The course format changed, so the previous curriculum will not be imported. Your editable fields were kept; generate a matching outline when ready.',
      });
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/creator/courses', {
        ...form,
        thumbnailUrl: form.thumbnailUrl || null,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create course');
      }
      return res.json();
    },
    onSuccess: async (course: any) => {
      let toastTitle = course.reviewState === 'submitted' ? 'Course submitted' : 'Draft saved';
      let toastDescription = course.submissionBlockedReason || 'Continue in the curriculum builder.';

      if (aiDraft) {
        try {
          const result = await materializeAiCourseDraft('creator', Number(course.id), aiDraft);
          toastTitle = 'Course and curriculum created';
          toastDescription = aiDraft.productType === 'video_course'
            ? `${result.completedSections} modules and ${result.completedLessons} lesson placeholders were added. Add and review all teaching content before publishing.`
            : `${result.completedSections} modules and ${result.completedLessons} outline placeholders were added. Author and review scored questions separately in Question Banks before submission.`;
        } catch (error) {
          toastTitle = 'Course saved; review the curriculum';
          toastDescription = error instanceof CourseDraftMaterializationError
            ? error.message
            : 'The course was saved, but its AI outline could not be added. You can continue manually in the curriculum builder.';
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/creator/courses'] });
      toast({ title: toastTitle, description: toastDescription });
      setLocation(`/creator/courses/${course.id}/curriculum`);
    },
    onError: (e: Error) => toast({ title: 'Course was not saved', description: e.message, variant: 'destructive' }),
  });

  const approved = creator?.status === 'approved';
  const actionLabel = approved && form.visibility !== 'private' ? 'Submit for review' : 'Save private draft';
  const valid = form.title.trim().length >= 3 && form.description.trim().length >= 10 && form.categoryId > 0 && form.audienceBandIds.length > 0;

  return (
    <DashboardLayout role="creator" title="New course" description="Build a private draft, then submit it for review when your creator profile is approved." breadcrumbs={[{ label: 'Courses', href: '/creator/courses' }, { label: 'New' }]}>
      <SEO title="New course" description="Create a new course on Octamy." path="/creator/courses/new" />
      <div className="max-w-4xl space-y-5">
          <AiCourseCopilot workspace="creator" onApply={applyAiDraft} />
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-base">Course details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {aiDraft && (
                <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50/70 p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
                  <div className="flex min-w-0 gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">AI curriculum ready to add</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-600"><Layers3 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{aiDraft.sections.length} modules will be created only when you save this course. Pricing, category, media, and visibility remain under your control.</p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" className="min-h-11 shrink-0 text-slate-600" onClick={() => setAiDraft(null)}>Keep fields only</Button>
                </div>
              )}
              <Field id="creator-course-title" label="Title" required>
                <Input id="creator-course-title" className="min-h-11" required aria-required="true" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Advanced React Patterns" />
              </Field>
              <Field id="creator-course-description" label="Description" required>
                <Textarea id="creator-course-description" className="min-h-28" rows={4} required aria-required="true" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will the learner walk away knowing?" />
              </Field>
              <Field id="creator-course-thumbnail-picker" label="Course thumbnail">
                {form.thumbnailUrl ? (
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    <img src={form.thumbnailUrl} alt="Selected course thumbnail" className="aspect-video w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-slate-950/80 p-3 backdrop-blur">
                      <Button id="creator-course-thumbnail-picker" type="button" size="sm" variant="secondary" onClick={() => setMediaOpen(true)}>Choose another</Button>
                      <Button type="button" size="icon" variant="ghost" className="text-white hover:bg-white/15 hover:text-white" onClick={() => setForm({ ...form, thumbnailUrl: '' })} aria-label="Remove thumbnail"><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ) : (
                  <button id="creator-course-thumbnail-picker" type="button" onClick={() => setMediaOpen(true)} className="flex min-h-11 w-full items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-left transition hover:border-violet-400 hover:bg-violet-50">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><ImageIcon className="h-5 w-5" /></span>
                    <span><span className="block text-sm font-bold text-slate-900">Choose from media library</span><span className="block text-xs text-slate-500">Upload once and reuse across courses.</span></span>
                  </button>
                )}
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field id="creator-course-category" label="Category" required>
                  <select id="creator-course-category" className="h-11 w-full rounded-md border border-slate-300 bg-cream-soft px-3 py-2 text-sm" required aria-required="true" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>
                    <option value={0}>Select a category…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field id="creator-course-level" label="Level" required>
                  <select id="creator-course-level" className="h-11 w-full rounded-md border border-slate-300 bg-cream-soft px-3 py-2 text-sm" required aria-required="true" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as any })}>
                    <option value="novice">Novice</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </Field>
              </div>
              <Field id="creator-course-product-type" label="What are you publishing?" required>
                <select id="creator-course-product-type" className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" required aria-required="true" value={form.productType} onChange={(event) => changeProductType(event.target.value as typeof form.productType)}>
                  <option value="assessment">Assessment only</option>
                  <option value="video_course">Video course</option>
                  <option value="ebook">Protected ebook</option>
                  <option value="bundle">Video course + assessment</option>
                </select>
                <p className="mt-1 text-xs leading-5 text-slate-500">Video and bundle products use entitlement-protected lessons. Mark individual lessons as previews if everyone may open them.</p>
              </Field>
              <Field id="creator-course-audience" label="Who is this for?" required>
                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2">
                  {audienceBands.map((band, index) => {
                    const checked = form.audienceBandIds.includes(band.id);
                    return (
                      <label key={band.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 transition hover:ring-violet-300">
                        <input
                          id={index === 0 ? 'creator-course-audience' : undefined}
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
                <p className="mt-1 text-xs text-slate-500">Use audience bands for discovery and age-appropriate question review. Select every band the content genuinely serves.</p>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="creator-course-certification" label="Credential issuer" required>
                  <select id="creator-course-certification" className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.certificationMode} onChange={(event) => setForm({ ...form, certificationMode: event.target.value as typeof form.certificationMode })}>
                    <option value="creator">Creator-issued · Octamy verifies the record</option>
                    <option value="octamy_creator">Request Octamy + creator certification</option>
                  </select>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Requesting Octamy certification starts a content and assessment review. It is never granted by this selection alone.</p>
                </Field>
                <Field id="creator-course-review-policy" label="Answer review policy" required>
                  <select id="creator-course-review-policy" className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.defaultReviewPolicy} onChange={(event) => setForm({ ...form, defaultReviewPolicy: event.target.value as typeof form.defaultReviewPolicy })}>
                    <option value="immediate">Immediate · practice assessments</option>
                    <option value="after_final_attempt">After final attempt · recommended</option>
                    <option value="after_window">After assessment window closes</option>
                    <option value="score_only">Score only · no answer key</option>
                  </select>
                </Field>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field id="creator-course-duration" label="Duration (mins)" required>
                  <Input id="creator-course-duration" className="min-h-11" type="number" min={5} max={600} required aria-required="true" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
                </Field>
                <Field id="creator-course-passing-score" label="Passing score (%)" required>
                  <Input id="creator-course-passing-score" className="min-h-11" type="number" min={10} max={100} required aria-required="true" value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: Number(e.target.value) })} />
                </Field>
                <Field id="creator-course-credential-price" label="Credential activation (₹)" required>
                  <Input id="creator-course-credential-price" className="min-h-11" type="number" min={0} required aria-required="true" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </Field>
              </div>
              {form.productType !== 'assessment' && (
                <Field id="creator-course-access-price" label="Course access price (₹)" required>
                  <Input id="creator-course-access-price" className="min-h-11" type="number" min={0} required aria-required="true" value={form.contentPrice} onChange={(event) => setForm({ ...form, contentPrice: Number(event.target.value) })} />
                  <p className="mt-1 text-xs text-slate-500">Set ₹0 for a free course. Paid access is granted only after the payment provider confirms the order.</p>
                </Field>
              )}
              <Field id="creator-course-visibility" label="Visibility">
                <select id="creator-course-visibility" className="h-11 w-full rounded-md border border-slate-300 bg-cream-soft px-3 py-2 text-sm" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as any })} disabled={!approved}>
                  <option value="private">Draft — only you</option>
                  <option value="unlisted">Submit unlisted — direct link after approval</option>
                  <option value="public">Submit public — catalog after approval</option>
                </select>
                {!approved && <p className="mt-1 text-xs text-amber-800">Your creator profile is {creator?.status || 'loading'}. You can build the full draft now; submission unlocks after approval.</p>}
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setLocation('/creator/courses')}>Cancel</Button>
                <Button
                  type="button"
                  className="bg-slate-900 hover:bg-black text-white"
                  disabled={create.isPending || !valid}
                  onClick={() => create.mutate()}
                >
                  {create.isPending ? 'Saving…' : actionLabel}
                </Button>
              </div>
            </CardContent>
          </Card>
          <MediaLibraryDialog
            open={mediaOpen}
            onOpenChange={setMediaOpen}
            allowedKinds={['image']}
            selectedUrl={form.thumbnailUrl}
            title="Choose a course thumbnail"
            onSelect={(asset) => setForm((current) => ({ ...current, thumbnailUrl: asset.url }))}
          />
        </div>
    </DashboardLayout>
  );
}

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm text-slate-700">
        {label}{required && <span className="text-rose-700" aria-hidden="true"> *</span>}
      </Label>
      {children}
    </div>
  );
}
