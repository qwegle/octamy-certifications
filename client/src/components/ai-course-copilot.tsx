import { FormEvent, useId, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Layers3,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type {
  CourseDraft,
  CourseDraftLevel,
  CourseDraftProductType,
  CourseDraftRequest,
  CourseDraftWorkspace,
} from "@/lib/ai-course-draft";

type AiCourseDraftStatus = {
  available: boolean;
  provider?: string;
  model?: string;
  message?: string;
  reason?: string;
};

type AiCourseCopilotProps = {
  workspace: CourseDraftWorkspace;
  onApply: (draft: CourseDraft) => void | Promise<void>;
  initialBrief?: Partial<Omit<CourseDraftRequest, "workspace">>;
  disabled?: boolean;
  className?: string;
};

const inputClassName =
  "min-h-11 border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-violet-500";
const selectClassName =
  "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60";

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function isCourseDraft(value: unknown): value is CourseDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CourseDraft>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.duration === "number" &&
    typeof candidate.passingScore === "number" &&
    Array.isArray(candidate.learningOutcomes) &&
    Array.isArray(candidate.sections) &&
    candidate.sections.every((section) => (
      section &&
      typeof section.title === "string" &&
      typeof section.summary === "string" &&
      Array.isArray(section.lessons) &&
      section.lessons.every((lesson) => (
        lesson &&
        typeof lesson.title === "string" &&
        typeof lesson.objective === "string" &&
        typeof lesson.durationMinutes === "number" &&
        typeof lesson.isPreview === "boolean"
      ))
    )) &&
    Array.isArray(candidate.assessmentIdeas) &&
    candidate.assessmentIdeas.every((idea) => idea && typeof idea.title === "string")
  );
}

function normalizeStatus(payload: unknown): AiCourseDraftStatus {
  if (!payload || typeof payload !== "object") {
    return { available: false, message: "AI course generation is not configured." };
  }
  const status = payload as Record<string, unknown>;
  return {
    available: status.available === true || status.enabled === true || status.configured === true,
    provider: typeof status.provider === "string" ? status.provider : undefined,
    model: typeof status.model === "string" ? status.model : undefined,
    message: typeof status.message === "string" ? status.message : undefined,
    reason: typeof status.reason === "string" ? status.reason : undefined,
  };
}

export function AiCourseCopilot({
  workspace,
  onApply,
  initialBrief,
  disabled = false,
  className,
}: AiCourseCopilotProps) {
  const id = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [applyError, setApplyError] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [brief, setBrief] = useState<Omit<CourseDraftRequest, "workspace">>({
    topic: initialBrief?.topic ?? "",
    audience: initialBrief?.audience ?? "",
    goal: initialBrief?.goal ?? "",
    level: initialBrief?.level ?? "novice",
    productType: initialBrief?.productType ?? "video_course",
    moduleCount: initialBrief?.moduleCount ?? 5,
    language: initialBrief?.language ?? "English",
    additionalContext: initialBrief?.additionalContext ?? "",
  });

  const statusQuery = useQuery({
    queryKey: ["/api/ai/course-draft/status"],
    queryFn: async () => normalizeStatus(await (await apiRequest("GET", "/api/ai/course-draft/status")).json()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/course-draft", {
        workspace,
        ...brief,
        topic: brief.topic.trim(),
        audience: brief.audience.trim(),
        goal: brief.goal.trim(),
        language: brief.language.trim(),
        additionalContext: brief.additionalContext?.trim() || undefined,
      } satisfies CourseDraftRequest);
      const payload: unknown = await response.json();
      const candidatePayload = payload && typeof payload === "object" && "draft" in payload
        ? (payload as { draft: unknown }).draft
        : payload;
      const responseMeta = payload && typeof payload === "object" && "meta" in payload
        ? (payload as { meta: unknown }).meta
        : undefined;
      const candidate = candidatePayload && typeof candidatePayload === "object"
        ? {
            ...candidatePayload,
            meta: responseMeta && typeof responseMeta === "object" ? responseMeta : {},
          }
        : candidatePayload;
      if (!isCourseDraft(candidate)) {
        throw new Error("The AI response was incomplete. No changes were applied; please generate again.");
      }
      return candidate;
    },
    onSuccess: (nextDraft) => {
      setDraft(nextDraft);
      setApplyError("");
    },
  });

  const lessonCount = useMemo(
    () => draft?.sections.reduce((count, section) => count + section.lessons.length, 0) ?? 0,
    [draft],
  );
  const status = statusQuery.data;
  const unavailable = disabled || statusQuery.isError || status?.available === false;
  const canGenerate = (
    brief.topic.trim().length >= 3 &&
    brief.audience.trim().length >= 3 &&
    brief.goal.trim().length >= 8 &&
    brief.language.trim().length >= 2 &&
    brief.moduleCount >= 2 &&
    brief.moduleCount <= 10
  );

  function submitBrief(event: FormEvent) {
    event.preventDefault();
    if (canGenerate && !generate.isPending) generate.mutate();
  }

  async function applyDraft() {
    if (!draft || isApplying) return;
    setApplyError("");
    setIsApplying(true);
    try {
      await onApply(draft);
      setOpen(false);
    } catch (error) {
      setApplyError(readError(error));
    } finally {
      setIsApplying(false);
    }
  }

  const unavailableMessage = disabled
    ? "AI assistance is unavailable for this workspace."
    : statusQuery.isError
      ? "We could not confirm AI availability. Your manual course form is still ready to use."
      : status?.message || status?.reason || "AI course generation is not configured. Your manual course form is still available.";

  return (
    <>
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-white via-violet-50/70 to-indigo-50 p-4 shadow-sm sm:p-5",
          className,
        )}
        aria-labelledby={`${id}-title`}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white shadow-sm" aria-hidden="true">
              <BrainCircuit className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={`${id}-title`} className="text-base font-bold text-slate-950">AI course copilot</h2>
                <Badge className="border border-violet-200 bg-violet-100 text-[10px] font-bold uppercase tracking-wider text-violet-800 hover:bg-violet-100">
                  Guided draft
                </Badge>
              </div>
              <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
                Turn a learning goal into course details, outcomes, modules, and lesson ideas—then review every field before saving.
              </p>
              {unavailable && !statusQuery.isLoading && (
                <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-600" role="status">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{unavailableMessage}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            {statusQuery.isError && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-slate-600"
                onClick={() => statusQuery.refetch()}
                aria-label="Check AI availability again"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              className="min-h-11 flex-1 bg-slate-950 px-5 text-white hover:bg-violet-950 sm:flex-none"
              disabled={statusQuery.isLoading || unavailable}
              onClick={() => setOpen(true)}
            >
              {statusQuery.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {statusQuery.isLoading ? "Checking AI…" : "Build with AI"}
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={open} onOpenChange={(next) => !generate.isPending && !isApplying && setOpen(next)}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-5xl gap-0 overflow-y-auto border-slate-200 bg-slate-50 p-0 shadow-2xl [&>button.absolute]:grid [&>button.absolute]:h-11 [&>button.absolute]:w-11 [&>button.absolute]:place-items-center">
          <div className="border-b border-slate-200 bg-white px-5 py-5 pr-16 sm:px-7">
            <DialogHeader>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">
                  <Sparkles className="mr-1 h-3 w-3" /> Octamy AI
                </Badge>
                <span className="text-xs font-medium text-slate-500">
                  {draft ? "Step 2 of 2 · Review" : "Step 1 of 2 · Course brief"}
                </span>
              </div>
              <DialogTitle className="text-xl font-bold text-slate-950 sm:text-2xl">
                {draft ? "Review your course blueprint" : "Create a strong first draft"}
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                {draft
                  ? "Check the structure and outcomes. Applying this blueprint only fills your editable form; it does not publish or save the course."
                  : "Give the copilot enough context to propose a focused, teachable course. Specific inputs produce a stronger outline."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {!draft ? (
            <form onSubmit={submitBrief}>
              <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                  <Field id={`${id}-topic`} label="Course topic" required className="sm:col-span-2">
                    <Input
                      id={`${id}-topic`}
                      className={inputClassName}
                      value={brief.topic}
                      onChange={(event) => setBrief((current) => ({ ...current, topic: event.target.value }))}
                      placeholder="e.g. SQL analytics for product managers"
                      minLength={3}
                      maxLength={160}
                      required
                      autoFocus
                    />
                  </Field>
                  <Field id={`${id}-audience`} label="Who is this for?" required>
                    <Input
                      id={`${id}-audience`}
                      className={inputClassName}
                      value={brief.audience}
                      onChange={(event) => setBrief((current) => ({ ...current, audience: event.target.value }))}
                      placeholder="Early-career product managers"
                      minLength={3}
                      maxLength={200}
                      required
                    />
                  </Field>
                  <Field id={`${id}-language`} label="Delivery language" required>
                    <Input
                      id={`${id}-language`}
                      className={inputClassName}
                      value={brief.language}
                      onChange={(event) => setBrief((current) => ({ ...current, language: event.target.value }))}
                      placeholder="English"
                      minLength={2}
                      maxLength={60}
                      required
                    />
                  </Field>
                  <Field id={`${id}-goal`} label="Learner transformation" required className="sm:col-span-2">
                    <Textarea
                      id={`${id}-goal`}
                      className="min-h-24 border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-violet-500"
                      value={brief.goal}
                      onChange={(event) => setBrief((current) => ({ ...current, goal: event.target.value }))}
                      placeholder="After completing this course, learners should be able to…"
                      minLength={8}
                      maxLength={500}
                      required
                    />
                  </Field>
                  <Field id={`${id}-level`} label="Difficulty" required>
                    <select
                      id={`${id}-level`}
                      className={selectClassName}
                      value={brief.level}
                      onChange={(event) => setBrief((current) => ({ ...current, level: event.target.value as CourseDraftLevel }))}
                    >
                      <option value="novice">Novice</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </Field>
                  <Field id={`${id}-product`} label="Course format" required>
                    <select
                      id={`${id}-product`}
                      className={selectClassName}
                      value={brief.productType}
                      onChange={(event) => setBrief((current) => ({ ...current, productType: event.target.value as CourseDraftProductType }))}
                    >
                      <option value="video_course">Video course</option>
                      <option value="bundle">Video course + assessment</option>
                      <option value="assessment">Assessment only</option>
                    </select>
                    {brief.productType !== "video_course" && (
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">
                        AI will suggest an assessment plan, not publishable scored questions. Questions must be authored or imported, reviewed, and approved in Question Banks.
                      </p>
                    )}
                  </Field>
                  <Field id={`${id}-modules`} label="Number of modules" required>
                    <Input
                      id={`${id}-modules`}
                      className={inputClassName}
                      type="number"
                      min={2}
                      max={10}
                      value={brief.moduleCount}
                      onChange={(event) => setBrief((current) => ({ ...current, moduleCount: Number(event.target.value) }))}
                      required
                    />
                  </Field>
                  <Field id={`${id}-context`} label="Requirements or context" optional className="sm:col-span-2">
                    <Textarea
                      id={`${id}-context`}
                      className="min-h-24 border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus-visible:ring-violet-500"
                      value={brief.additionalContext}
                      onChange={(event) => setBrief((current) => ({ ...current, additionalContext: event.target.value }))}
                      placeholder="Include prerequisite knowledge, examples, standards, tools, or topics to avoid."
                      maxLength={1_500}
                    />
                    <p className="mt-1 text-right text-xs text-slate-400">{brief.additionalContext?.length ?? 0}/1,500</p>
                  </Field>
                </div>

                <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4" aria-label="AI generation guidance">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> You stay in control
                  </div>
                  <ul className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />Nothing is saved or published automatically.</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />Your existing course form remains the source of truth.</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />Review facts, outcomes, accessibility, and assessment quality.</li>
                  </ul>
                  <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                    Do not enter confidential student data, private company material, or personal information.
                  </div>
                </aside>
              </div>

              {generate.isError && (
                <div className="mx-5 mb-5 flex gap-2 rounded-xl border border-rose-200 bg-white p-3 text-sm text-rose-900 sm:mx-7" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><strong>Draft not generated.</strong> {readError(generate.error)}</span>
                </div>
              )}

              <DialogFooter className="gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)} disabled={generate.isPending}>Cancel</Button>
                <Button type="submit" className="min-h-11 bg-slate-950 px-5 text-white hover:bg-violet-950" disabled={!canGenerate || generate.isPending}>
                  {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {generate.isPending ? "Designing your course…" : "Generate blueprint"}
                </Button>
              </DialogFooter>
              <span className="sr-only" aria-live="polite">{generate.isPending ? "AI is generating your course blueprint." : ""}</span>
            </form>
          ) : (
            <div>
              <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0 space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 capitalize text-slate-700">{draft.level}</Badge>
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700"><Clock3 className="mr-1 h-3 w-3" />{draft.duration} min</Badge>
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700"><Layers3 className="mr-1 h-3 w-3" />{draft.sections.length} modules</Badge>
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700"><BookOpen className="mr-1 h-3 w-3" />{lessonCount} lessons</Badge>
                    </div>
                    <h3 className="mt-4 text-xl font-bold leading-tight text-slate-950">{draft.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{draft.description}</p>
                  </div>

                  <section aria-labelledby={`${id}-outline-title`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 id={`${id}-outline-title`} className="text-sm font-bold text-slate-950">Curriculum outline</h3>
                      <span className="text-xs text-slate-500">Draft content</span>
                    </div>
                    <ol className="space-y-3">
                      {draft.sections.map((section, sectionIndex) => (
                        <li key={`${section.title}-${sectionIndex}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex gap-3">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-100 text-xs font-bold text-violet-800">{sectionIndex + 1}</span>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-slate-900">{section.title}</h4>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{section.summary}</p>
                              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                {section.lessons.map((lesson, lessonIndex) => (
                                  <li key={`${lesson.title}-${lessonIndex}`} className="rounded-xl bg-slate-50 px-3 py-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="text-xs font-semibold leading-5 text-slate-800">{lesson.title}</span>
                                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">{lesson.kind}</span>
                                    </div>
                                    {lesson.objective && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{lesson.objective}</p>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                </div>

                <aside className="space-y-4 lg:sticky lg:top-0 lg:h-fit" aria-label="Blueprint summary">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-950"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Learning outcomes</div>
                    <ul className="mt-3 space-y-2">
                      {draft.learningOutcomes.map((outcome, index) => (
                        <li key={`${outcome}-${index}`} className="flex gap-2 text-xs leading-5 text-slate-600">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet-600" />{outcome}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {draft.assessmentIdeas.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-amber-950"><Lightbulb className="h-4 w-4" />Assessment planning notes</div>
                      <ul className="mt-3 space-y-2 text-xs leading-5 text-amber-950/80">
                        {draft.assessmentIdeas.map((idea, index) => (
                          <li key={`${idea.title}-${index}`} className="rounded-lg bg-white/60 px-2.5 py-2">
                            <span className="font-semibold">{idea.title}</span>
                            <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-amber-900/60">
                              {idea.type.replace(/_/g, " ")} · {idea.difficulty}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-xs leading-5 text-slate-600">
                    <strong className="text-slate-800">AI-assisted outline.</strong> Lesson content and scored questions are not generated here. Verify accuracy, inclusivity, copyright, prerequisites, and assessment alignment before publishing.
                  </div>
                </aside>
              </div>

              {applyError && (
                <div className="mx-5 mb-5 flex gap-2 rounded-xl border border-rose-200 bg-white p-3 text-sm text-rose-900 sm:mx-7" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><strong>Blueprint not applied.</strong> {applyError}</span>
                </div>
              )}

              <DialogFooter className="gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => { setDraft(null); setApplyError(""); }} disabled={isApplying}>
                  <RefreshCw className="mr-2 h-4 w-4" />Refine brief
                </Button>
                <Button type="button" className="min-h-11 bg-slate-950 px-5 text-white hover:bg-violet-950" onClick={applyDraft} disabled={isApplying}>
                  {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  {isApplying ? "Applying blueprint…" : "Use this blueprint"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  id,
  label,
  required,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-semibold text-slate-800">
          {label}{required && <span className="text-rose-700" aria-hidden="true"> *</span>}
        </Label>
        {optional && <span className="text-[11px] text-slate-400">Optional</span>}
      </div>
      {children}
    </div>
  );
}

export type { AiCourseCopilotProps };
