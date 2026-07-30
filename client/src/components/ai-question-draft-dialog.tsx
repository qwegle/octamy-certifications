import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  RotateCcw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type QuestionFormat = "mcq_single" | "true_false";
type Difficulty = "easy" | "medium" | "hard";

interface DifficultyMix {
  easy: number;
  medium: number;
  hard: number;
}

interface AiQuestionDraft {
  prompt: string;
  questionFormat: QuestionFormat;
  difficulty: Difficulty;
  options: string[];
  correctAnswer: number;
  explanation: string;
  tags: string[];
}

interface AiQuestionDraftResponse {
  drafts: AiQuestionDraft[];
  meta: {
    model: string;
    generatedAt: string;
    bankId: number;
    persisted: false;
    reviewRequired: true;
  };
}

interface AiQuestionDraftDialogProps {
  bankId: number;
  bankName: string;
  initialTopic?: string;
  onClose: () => void;
  onOpenImport: () => void;
}

function balancedMix(count: number): DifficultyMix {
  const hard = Math.floor(count / 5);
  const easy = Math.floor((count - hard) / 2);
  return { easy, medium: count - easy - hard, hard };
}

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  // A leading tab prevents spreadsheet formula execution. The existing import
  // path trims it before persistence, so the authored question is unchanged.
  if (/^[=+\-@]/.test(text)) text = `\t${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function draftCsv(topic: string, drafts: AiQuestionDraft[]): string {
  const headers = [
    "topic",
    "question",
    "format",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctAnswer",
    "marks",
    "negativeMarks",
    "timeLimitSec",
    "difficulty",
    "tags",
    "explanation",
    "generationSource",
  ];
  const rows = drafts.map((draft) => {
    const correctAnswer = draft.questionFormat === "true_false"
      ? (draft.correctAnswer === 1 ? "true" : "false")
      : "ABCD"[draft.correctAnswer] ?? "A";
    return [
      topic,
      draft.prompt,
      draft.questionFormat,
      draft.options[0] ?? "",
      draft.options[1] ?? "",
      draft.options[2] ?? "",
      draft.options[3] ?? "",
      correctAnswer,
      1,
      0,
      "",
      draft.difficulty,
      draft.tags.join(", "),
      draft.explanation,
      "ai_draft",
    ].map(csvCell).join(",");
  });
  return [headers.map(csvCell).join(","), ...rows].join("\n");
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function parseTags(value: string): string[] {
  const tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
  return tags.filter((tag, index) => (
    tags.findIndex((candidate) => normalized(candidate) === normalized(tag)) === index
  )).slice(0, 8);
}

function isDraftComplete(draft: AiQuestionDraft): boolean {
  const normalizedOptions = draft.options.map(normalized);
  const validTrueFalse = draft.questionFormat !== "true_false"
    || (draft.options.length === 2
      && normalizedOptions[0] === "false"
      && normalizedOptions[1] === "true"
      && draft.correctAnswer <= 1);

  return draft.prompt.trim().length >= 5
    && draft.options.length >= 2
    && draft.options.length <= 4
    && draft.options.every((option) => option.trim().length > 0)
    && new Set(normalizedOptions).size === normalizedOptions.length
    && draft.correctAnswer >= 0
    && draft.correctAnswer < draft.options.length
    && draft.explanation.trim().length >= 10
    && draft.tags.length >= 1
    && validTrueFalse;
}

export function AiQuestionDraftDialog({
  bankId,
  bankName,
  initialTopic,
  onClose,
  onOpenImport,
}: AiQuestionDraftDialogProps) {
  const { toast } = useToast();
  const [topic, setTopic] = useState(initialTopic || "");
  const [audience, setAudience] = useState("");
  const [count, setCount] = useState(5);
  const [difficultyMix, setDifficultyMix] = useState<DifficultyMix>(balancedMix(5));
  const [questionTypes, setQuestionTypes] = useState<QuestionFormat[]>(["mcq_single", "true_false"]);
  const [context, setContext] = useState("");
  const [formError, setFormError] = useState("");
  const [drafts, setDrafts] = useState<AiQuestionDraft[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tagInputs, setTagInputs] = useState<Record<number, string>>({});
  const [generationMeta, setGenerationMeta] = useState<AiQuestionDraftResponse["meta"] | null>(null);

  const statusQuery = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/ai/question-draft/status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ai/question-draft/status");
      return response.json();
    },
    staleTime: 30_000,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/question-draft", {
        bankId,
        topic: topic.trim(),
        audience: audience.trim(),
        count,
        difficultyMix,
        questionTypes,
        ...(context.trim() ? { context: context.trim() } : {}),
      });
      return response.json() as Promise<AiQuestionDraftResponse>;
    },
    onSuccess: (result) => {
      setDrafts(result.drafts);
      setSelected(new Set(result.drafts.map((_, index) => index)));
      setTagInputs(Object.fromEntries(
        result.drafts.map((draft, index) => [index, draft.tags.join(", ")]),
      ));
      setGenerationMeta(result.meta);
      setFormError("");
    },
    onError: (error: Error) => {
      toast({
        title: "Question drafting unavailable",
        description: error.message,
      });
    },
  });

  const selectedDrafts = useMemo(
    () => drafts.filter((_, index) => selected.has(index)),
    [drafts, selected],
  );
  const mixTotal = difficultyMix.easy + difficultyMix.medium + difficultyMix.hard;

  const updateDraft = (index: number, patch: Partial<AiQuestionDraft>) => {
    setDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, ...patch } : draft
    )));
  };

  const toggleType = (format: QuestionFormat) => {
    setQuestionTypes((current) => current.includes(format)
      ? current.filter((item) => item !== format)
      : [...current, format]);
  };

  const submitBrief = () => {
    if (topic.trim().length < 2 || audience.trim().length < 3) {
      setFormError("Add a clear topic and intended learner audience.");
      return;
    }
    if (mixTotal !== count) {
      setFormError(`Difficulty counts must total ${count}. They currently total ${mixTotal}.`);
      return;
    }
    if (questionTypes.length === 0) {
      setFormError("Choose at least one supported question format.");
      return;
    }
    setFormError("");
    generateMutation.mutate();
  };

  const downloadSelected = () => {
    if (selectedDrafts.length === 0) {
      toast({ title: "Select at least one reviewed draft" });
      return;
    }
    if (selectedDrafts.some((draft) => !isDraftComplete(draft))) {
      toast({
        title: "Complete the selected drafts",
        description: "Each selected draft needs a prompt, distinct answer options, a correct answer, an explanation, and at least one tag.",
      });
      return;
    }

    const blob = new Blob([draftCsv(topic.trim(), selectedDrafts)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `octamy-ai-question-drafts-${bankId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    toast({
      title: `${selectedDrafts.length} reviewed ${selectedDrafts.length === 1 ? "draft" : "drafts"} exported`,
      description: "Import the CSV, then explicitly approve each question before it can be used in an assessment.",
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden p-0"
        aria-busy={generateMutation.isPending}
      >
        <DialogHeader className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-left text-white sm:px-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-slate-500/20 p-2 text-slate-200" aria-hidden="true">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl text-white">Draft questions with AI</DialogTitle>
              <DialogDescription className="mt-1 max-w-2xl text-slate-300">
                Create an editable working set for {bankName}. Nothing is saved or shown to learners until you export, import, and explicitly approve it.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {drafts.length === 0 ? (
          <div className="overflow-y-auto px-5 py-5 sm:px-6">
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-950">
                <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Review-first workflow</p>
                <p className="mt-1 text-slate-800">Drafts stay in this browser dialog. Imported drafts remain inactive until a bank editor approves them.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-950">
                <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> SME review required</p>
                <p className="mt-1 text-slate-800">Verify accuracy, answer keys, bias, syllabus alignment, and age appropriateness before import.</p>
              </div>
            </div>

            {statusQuery.isError ? (
              <div role="alert" className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900">
                <p className="font-medium">AI availability could not be checked.</p>
                <p className="mt-1">Retry the secure configuration check, or continue with the existing bulk-import workflow.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => statusQuery.refetch()}>
                    Retry check
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={onOpenImport}>
                    Open bulk import
                  </Button>
                </div>
              </div>
            ) : statusQuery.data?.enabled === false ? (
              <div role="status" className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">AI drafting is not configured in this environment.</p>
                <p className="mt-1">Manual authoring and validated bulk import remain available.</p>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onOpenImport}>
                  Open bulk import
                </Button>
              </div>
            ) : null}

            {generateMutation.isPending && (
              <p role="status" aria-live="polite" className="sr-only">
                Drafting {count} questions. Keep this dialog open.
              </p>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ai-question-topic">Topic or syllabus objective</Label>
                  <Input
                    id="ai-question-topic"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    maxLength={200}
                    placeholder="e.g. Linear equations with one variable"
                  />
                </div>
                <div>
                  <Label htmlFor="ai-question-audience">Intended audience</Label>
                  <Input
                    id="ai-question-audience"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                    maxLength={300}
                    placeholder="e.g. Grade 8 learners following CBSE"
                  />
                </div>
                <div>
                  <Label htmlFor="ai-question-count">Number of questions</Label>
                  <Input
                    id="ai-question-count"
                    type="number"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(event) => {
                      const next = Math.min(20, Math.max(1, Number(event.target.value) || 1));
                      setCount(next);
                      setDifficultyMix(balancedMix(next));
                    }}
                  />
                  <p className="mt-1 text-xs text-slate-500">Maximum 20 drafts per request.</p>
                </div>
                <fieldset>
                  <legend className="text-sm font-medium text-slate-900">Supported auto-scored formats</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {([
                      ["mcq_single", "Single-answer MCQ"],
                      ["true_false", "True / False"],
                    ] as const).map(([value, label]) => (
                      <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-slate-700"
                          checked={questionTypes.includes(value)}
                          onChange={() => toggleType(value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="space-y-4">
                <fieldset>
                  <legend className="text-sm font-medium text-slate-900">Difficulty mix</legend>
                  <p className="mt-1 text-xs text-slate-500">The three counts must total {count}.</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["easy", "medium", "hard"] as const).map((difficulty) => (
                      <div key={difficulty}>
                        <Label htmlFor={`ai-difficulty-${difficulty}`} className="capitalize">{difficulty}</Label>
                        <Input
                          id={`ai-difficulty-${difficulty}`}
                          type="number"
                          min={0}
                          max={20}
                          value={difficultyMix[difficulty]}
                          onChange={(event) => setDifficultyMix((current) => ({
                            ...current,
                            [difficulty]: Math.min(20, Math.max(0, Number(event.target.value) || 0)),
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                  <p className={`mt-2 text-xs font-medium ${mixTotal === count ? "text-slate-700" : "text-red-700"}`}>
                    {mixTotal === count ? `Ready · ${mixTotal} total` : `${mixTotal} of ${count} allocated`}
                  </p>
                </fieldset>
                <div>
                  <Label htmlFor="ai-question-context">Optional reference context</Label>
                  <Textarea
                    id="ai-question-context"
                    value={context}
                    onChange={(event) => setContext(event.target.value)}
                    maxLength={3_000}
                    rows={7}
                    placeholder="Paste learning objectives, an original rubric, or syllabus boundaries. Do not include learner names, emails, responses, or other personal data."
                  />
                  <p className="mt-1 text-xs text-slate-500">Do not paste learner data, confidential records, copyrighted test banks, or answer histories.</p>
                </div>
              </div>
            </div>

            {formError && (
              <div role="alert" className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
                {formError}
              </div>
            )}
            {generateMutation.isError && (
              <div role="alert" className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
                <p className="font-medium">The draft was not generated</p>
                <p className="mt-1">{generateMutation.error.message}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">Review every selected draft</p>
                <p className="text-sm text-slate-600">
                  {selected.size} of {drafts.length} selected · not saved · generated {generationMeta ? new Date(generationMeta.generatedAt).toLocaleString() : "just now"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set(drafts.map((_, index) => index)))}>Select all</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
            </div>

            <div className="space-y-4">
              {drafts.map((draft, index) => {
                const complete = isDraftComplete(draft);
                const validationId = `ai-draft-validation-${index}`;
                return (
                  <article
                    key={index}
                    className={`rounded-xl border p-4 ${selected.has(index) ? "border-slate-300 bg-slate-50/30" : "border-slate-200 bg-white opacity-75"}`}
                    aria-describedby={validationId}
                  >
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <label className="flex cursor-pointer items-center gap-3 font-semibold text-slate-900">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-slate-700"
                        checked={selected.has(index)}
                        onChange={() => setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(index)) next.delete(index);
                          else next.add(index);
                          return next;
                        })}
                      />
                      Draft {index + 1}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{draft.questionFormat === "mcq_single" ? "Single MCQ" : "True / False"}</Badge>
                      <Badge className="capitalize" variant="secondary">{draft.difficulty}</Badge>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor={`ai-draft-prompt-${index}`}>Question prompt</Label>
                      <Textarea
                        id={`ai-draft-prompt-${index}`}
                        value={draft.prompt}
                        onChange={(event) => updateDraft(index, { prompt: event.target.value })}
                        maxLength={5_000}
                        rows={3}
                      />
                    </div>
                    <fieldset>
                      <legend className="text-sm font-medium text-slate-900">Answer options and key</legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {draft.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                            <input
                              type="radio"
                              name={`ai-draft-answer-${index}`}
                              aria-label={`Mark option ${optionIndex + 1} correct for draft ${index + 1}`}
                              className="h-4 w-4 shrink-0 accent-slate-700"
                              checked={draft.correctAnswer === optionIndex}
                              onChange={() => updateDraft(index, { correctAnswer: optionIndex })}
                            />
                            <Input
                              aria-label={`Option ${optionIndex + 1} for draft ${index + 1}`}
                              value={option}
                              readOnly={draft.questionFormat === "true_false"}
                              maxLength={1_000}
                              onChange={(event) => {
                                const options = [...draft.options];
                                options[optionIndex] = event.target.value;
                                updateDraft(index, { options });
                              }}
                              className="border-0 bg-transparent shadow-none focus-visible:ring-1"
                            />
                          </div>
                        ))}
                      </div>
                    </fieldset>
                    <div className="grid gap-4 lg:grid-cols-[10rem_1fr]">
                      <div>
                        <Label htmlFor={`ai-draft-difficulty-${index}`}>Difficulty</Label>
                        <Select value={draft.difficulty} onValueChange={(value: Difficulty) => updateDraft(index, { difficulty: value })}>
                          <SelectTrigger id={`ai-draft-difficulty-${index}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`ai-draft-tags-${index}`}>Tags</Label>
                        <Input
                          id={`ai-draft-tags-${index}`}
                          value={tagInputs[index] ?? draft.tags.join(", ")}
                          maxLength={500}
                          onChange={(event) => {
                            const value = event.target.value;
                            setTagInputs((current) => ({ ...current, [index]: value }));
                            updateDraft(index, { tags: parseTags(value) });
                          }}
                          placeholder="concept, skill, syllabus unit"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`ai-draft-explanation-${index}`}>Answer explanation</Label>
                      <Textarea
                        id={`ai-draft-explanation-${index}`}
                        value={draft.explanation}
                        onChange={(event) => updateDraft(index, { explanation: event.target.value })}
                        maxLength={3_000}
                        rows={3}
                      />
                    </div>
                    <p
                      id={validationId}
                      className={`flex items-center gap-2 text-xs ${complete ? "text-slate-700" : "text-slate-800"}`}
                    >
                      {complete
                        ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        : <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      {complete
                        ? "Ready for CSV validation. Human subject-matter approval is still required."
                        : "Complete the prompt, distinct options, answer key, explanation, and at least one tag before export."}
                    </p>
                  </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          {drafts.length === 0 ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={generateMutation.isPending}>Cancel</Button>
              <Button
                onClick={submitBrief}
                disabled={generateMutation.isPending || statusQuery.isLoading || statusQuery.data?.enabled !== true}
                className="bg-slate-700 hover:bg-slate-800"
              >
                {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generateMutation.isPending ? "Drafting questions…" : `Generate ${count} drafts`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => {
                setDrafts([]);
                setSelected(new Set());
                setTagInputs({});
                setGenerationMeta(null);
                generateMutation.reset();
              }}>
                <RotateCcw className="h-4 w-4" /> New brief
              </Button>
              <Button variant="outline" onClick={downloadSelected} disabled={selectedDrafts.length === 0}>
                <Download className="h-4 w-4" /> Download selected CSV
              </Button>
              <Button onClick={onOpenImport}>
                <FileUp className="h-4 w-4" /> Open bulk import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
