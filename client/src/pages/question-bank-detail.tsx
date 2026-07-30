import { useState, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/components/dashboard-layout";
import { AiQuestionDraftDialog } from "@/components/ai-question-draft-dialog";
import { useDashboardRole } from "@/lib/use-dashboard-role";
import {
  Plus,
  Upload,
  Download,
  ChevronLeft,
  Trash2,
  History,
  Pencil,
  Eye,
  AlertCircle,
  FileQuestion,
  Sparkles,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { Question, QuestionBank, QuestionTopic, QuestionVersion } from "@shared/schema";

type QuestionReviewDecision = "approved" | "rejected";

const FORMATS = [
  { value: "mcq_single", label: "MCQ (single)" },
  { value: "mcq_multi", label: "MCQ (multi)" },
  { value: "true_false", label: "True / False" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "short", label: "Short answer" },
  { value: "long", label: "Long answer" },
  { value: "code", label: "Code" },
  { value: "numeric", label: "Numeric" },
  { value: "match", label: "Match" },
];

interface BankResponse extends QuestionBank {
  topics: QuestionTopic[];
  inventory: { approvedActive: number; easy: number; medium: number; hard: number; draft: number; retired: number };
  canEdit: boolean;
}

export default function QuestionBankDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [location] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const detectedRole = useDashboardRole();
  const role = location.startsWith("/admin/")
    ? "admin"
    : location.startsWith("/institute/")
    ? "institute"
    : location.startsWith("/creator/")
      ? "creator"
      : detectedRole;
  const bankBase = role === "admin"
    ? "/admin"
    : role === "institute"
    ? "/institute/question-banks"
    : role === "creator"
      ? "/creator/question-banks"
      : "/question-banks";

  const [topicFilter, setTopicFilter] = useState<number | null>(null);
  const [formatFilter, setFormatFilter] = useState<string>("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("");
  const [reviewFilter, setReviewFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Question | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");

  const bankQuery = useQuery<BankResponse>({
    queryKey: [`/api/question-banks/${id}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/question-banks/${id}`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Question bank not found");
      return response.json();
    },
    enabled: Number.isInteger(id) && id > 0,
  });

  const questionsQuery = useQuery<{ items: Question[]; total: number }>({
    queryKey: [`/api/question-banks/${id}/questions`, { topicFilter, formatFilter, difficultyFilter, reviewFilter, search, page }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (topicFilter) qs.set("topicId", String(topicFilter));
      if (formatFilter) qs.set("format", formatFilter);
      if (difficultyFilter) qs.set("difficulty", difficultyFilter);
      if (reviewFilter) qs.set("reviewStatus", reviewFilter);
      if (search) qs.set("search", search);
      qs.set("page", String(page));
      qs.set("perPage", "25");
      const r = await apiRequest("GET", `/api/question-banks/${id}/questions?${qs}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to load questions");
      return r.json();
    },
    enabled: Number.isInteger(id) && id > 0,
  });

  const createTopicMut = useMutation({
    mutationFn: async (name: string) => {
      const r = await apiRequest("POST", `/api/question-banks/${id}/topics`, { name });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}`] });
      setTopicOpen(false);
      setNewTopicName("");
      toast({ title: "Topic added" });
    },
    onError: (error: Error) => toast({ title: "Could not add topic", description: error.message }),
  });

  const deleteTopicMut = useMutation({
    mutationFn: async (tid: number) => {
      const response = await apiRequest("DELETE", `/api/question-banks/${id}/topics/${tid}`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Failed to delete topic");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}`] }),
    onError: (error: Error) => toast({ title: "Could not delete topic", description: error.message }),
  });

  const saveQuestionMut = useMutation({
    mutationFn: async (q: Partial<Question> & { id?: number }) => {
      if (q.id) {
        const r = await apiRequest("PATCH", `/api/question-banks/${id}/questions/${q.id}`, q);
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to update question");
        return r.json();
      }
      const r = await apiRequest("POST", `/api/question-banks/${id}/questions`, q);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to create question");
      return r.json();
    },
    onSuccess: (saved: Question) => {
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}/questions`] });
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}`] });
      toast({
        title: saved.reviewStatus === "pending" ? "Changes saved for review" : "Question saved",
        description: saved.reviewStatus === "pending"
          ? "The edited question is inactive until a bank editor explicitly approves this version."
          : "The human-authored question is approved and available for assessment selection.",
      });
      setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteQuestionMut = useMutation({
    mutationFn: async (qid: number) => {
      const response = await apiRequest("DELETE", `/api/question-banks/${id}/questions/${qid}`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Failed to delete question");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}/questions`] });
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}`] });
      toast({ title: "Deleted" });
    },
    onError: (error: Error) => toast({ title: "Could not delete question", description: error.message }),
  });

  const reviewQuestionMut = useMutation({
    mutationFn: async ({
      questionId,
      status,
      expectedVersion,
      note,
    }: {
      questionId: number;
      status: QuestionReviewDecision;
      expectedVersion: number;
      note?: string;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/question-banks/${id}/questions/${questionId}/review`,
        { status, expectedVersion, ...(note?.trim() ? { note: note.trim() } : {}) },
      );
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Failed to save review decision");
      return response.json() as Promise<Question>;
    },
    onSuccess: (reviewed, variables) => {
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}/questions`] });
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}/questions/${reviewed.id}/versions`] });
      toast({
        title: variables.status === "approved" ? "Question approved" : "Question rejected",
        description: variables.status === "approved"
          ? "This reviewed version is now eligible for assessment selection."
          : "This question remains inactive and cannot be selected for an assessment.",
      });
      setEditing(null);
    },
    onError: (error: Error) => toast({
      title: "Review decision could not be saved",
      description: error.message,
    }),
  });

  const releaseEvidenceMut = useMutation({
    mutationFn: async ({ questionId, ...payload }: {
      questionId: number;
      expectedVersion: number;
      changeNote: string;
      syllabusVersion: string;
      objectiveCode: string;
      answerValidationMethod: "authoritative_reference" | "primary_source" | "independent_calculation";
      answerValidationReference: string;
      distractorReviewNote: string;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/question-banks/${id}/questions/${questionId}/release-evidence`,
        payload,
      );
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Failed to save release evidence");
      return response.json() as Promise<Question>;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}/questions`] });
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}/questions/${saved.id}/versions`] });
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}`] });
      setEditing(null);
      toast({ title: "Release evidence saved", description: "The new version is pending independent review." });
    },
    onError: (error: Error) => toast({ title: "Release evidence could not be saved", description: error.message, variant: "destructive" }),
  });

  const exportQuestions = async () => {
    try {
      const response = await apiRequest("GET", `/api/question-banks/${id}/questions/export`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `question-bank-${id}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: "Question bank exported" });
    } catch (error: any) {
      toast({ title: "Could not export", description: error.message });
    }
  };

  const totalPages = useMemo(() => {
    if (!questionsQuery.data) return 1;
    return Math.max(1, Math.ceil(questionsQuery.data.total / 25));
  }, [questionsQuery.data]);

  const newQuestionDraft = (): Question => ({
    id: 0,
    courseId: null as any,
    bankId: id,
    topicId: topicFilter,
    question: "",
    options: ["", "", "", ""] as any,
    correctAnswer: 0,
    isActive: true,
    questionType: "multiple_choice",
    questionFormat: "mcq_single",
    difficulty: "medium",
    maxPoints: 1,
    negativeMarks: 0,
    timeLimitSec: null,
    imageUrl: null,
    codeLanguage: null,
    expectedAnswer: null,
    tags: [] as any,
    explanation: null,
    version: 1,
    aiScenario: null,
    aiEvaluationCriteria: null as any,
    expectedKeywords: null as any,
    createdBy: null,
    createdAt: null as any,
    updatedAt: null as any,
  } as unknown as Question);

  if (bankQuery.isLoading) {
    return (
      <DashboardLayout role={role} title="Question bank" breadcrumbs={[{ label: "Question banks", href: bankBase }, { label: "Loading…" }]}>
        <Card role="status" aria-live="polite" aria-label="Loading question bank">
          <CardContent className="p-10 text-center text-sm text-slate-600">
            <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" aria-hidden="true" />
            Loading question bank…
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }
  if (!bankQuery.data) {
    return (
      <DashboardLayout role={role} title="Bank not found" breadcrumbs={[{ label: "Question banks", href: bankBase }, { label: "Not found" }]}>
        <Card role={bankQuery.isError ? "alert" : undefined} className="mx-auto max-w-xl">
          <CardContent className="p-8 text-center sm:p-12">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-600" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-slate-900">Question bank unavailable</h2>
            <p className="mt-1 text-sm text-slate-600">
              {bankQuery.error instanceof Error
                ? bankQuery.error.message
                : "The link may be invalid, or you may not have access to this bank."}
            </p>
            <Button variant="outline" asChild className="mt-4">
              <Link href={bankBase}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to banks
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const bank = bankQuery.data;
  const canEdit = bank.canEdit;

  return (
    <DashboardLayout
      role={role}
      title={bank.name}
      description={bank.description || `Reusable bank · ${bank.questionCount} ${bank.questionCount === 1 ? "question" : "questions"}`}
      breadcrumbs={[
        { label: "Question banks", href: bankBase },
        { label: bank.name },
      ]}
    >
        {/* Top bar */}
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={bankBase} aria-label="Back to question banks">
                <ChevronLeft className="w-4 h-4" />
                Back to banks
              </Link>
            </Button>
            <p className="text-xs text-slate-500">
              {bank.questionCount} {bank.questionCount === 1 ? "question" : "questions"} · {bank.visibility} · {bank.ownerType}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setAiDraftOpen(true)}
              >
                <Sparkles className="w-4 h-4 mr-1" /> Draft with AI
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-1" /> Bulk import
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportQuestions}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
            {canEdit && (
              <Button size="sm" className="col-span-2 sm:col-span-1" onClick={() => setEditing(newQuestionDraft())}>
                <Plus className="w-4 h-4 mr-1" /> Add question
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[{ label: "Publishable", value: bank.inventory.approvedActive }, { label: "Easy", value: bank.inventory.easy }, { label: "Medium", value: bank.inventory.medium }, { label: "Hard", value: bank.inventory.hard }, { label: "Needs review", value: bank.inventory.draft }, { label: "Retired", value: bank.inventory.retired }].map((item) => (
            <Card key={item.label}><CardContent className="p-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p><p className="mt-1 text-xl font-black tabular-nums text-slate-950">{Number(item.value).toLocaleString()}</p></CardContent></Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
          {/* Topic tree */}
          <aside className="h-max rounded-xl border border-slate-200 bg-white p-3 lg:sticky lg:top-4" aria-label="Question topics">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm text-slate-900">Topics</h2>
              {canEdit && (
                <Button size="icon" variant="ghost" onClick={() => setTopicOpen(true)} aria-label="Add topic" title="Add topic">
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
            <button
              type="button"
              aria-pressed={topicFilter === null}
              className={`min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${topicFilter === null ? "bg-slate-50 text-slate-700 font-medium" : "hover:bg-slate-50"}`}
              onClick={() => { setTopicFilter(null); setPage(1); }}
            >
              All topics
            </button>
            {bank.topics.map((t) => (
              <div key={t.id} className="group flex items-center">
                <button
                  type="button"
                  aria-pressed={topicFilter === t.id}
                  className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${topicFilter === t.id ? "bg-slate-50 text-slate-700 font-medium" : "hover:bg-slate-50"}`}
                  onClick={() => { setTopicFilter(t.id); setPage(1); }}
                >
                  {t.name}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Delete topic ${t.name}`}
                    title={`Delete topic ${t.name}`}
                    disabled={deleteTopicMut.isPending}
                    className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    onClick={() => {
                      if (confirm(`Delete topic '${t.name}'? Its questions will become ungrouped. Topics used by an assessment blueprint are protected.`)) {
                        deleteTopicMut.mutate(t.id);
                      }
                    }}
                  >
                    <Trash2 className="mx-auto w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            {bank.topics.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-500">No custom topics yet.</p>
            )}
          </aside>

          {/* Questions */}
          <section aria-labelledby="questions-heading" className="min-w-0">
            <h2 id="questions-heading" className="sr-only">Questions</h2>
            <Card className="mb-4">
              <CardContent className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_11rem_10rem_11rem]">
                <div>
                  <Label htmlFor="question-search" className="sr-only">Search questions</Label>
                  <Input
                    id="question-search"
                    type="search"
                    placeholder="Search questions…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="question-format-filter" className="sr-only">Filter by question format</Label>
                  <Select value={formatFilter || "all"} onValueChange={(v) => { setFormatFilter(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger id="question-format-filter" className="w-full" aria-label="Filter by question format"><SelectValue placeholder="All formats" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All formats</SelectItem>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="question-difficulty-filter" className="sr-only">Filter by difficulty</Label>
                  <Select value={difficultyFilter || "all"} onValueChange={(value) => { setDifficultyFilter(value === "all" ? "" : value); setPage(1); }}><SelectTrigger id="question-difficulty-filter"><SelectValue placeholder="All difficulties" /></SelectTrigger><SelectContent><SelectItem value="all">All difficulties</SelectItem><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select>
                </div>
                <div>
                  <Label htmlFor="question-review-filter" className="sr-only">Filter by review status</Label>
                  <Select value={reviewFilter || "all"} onValueChange={(value) => { setReviewFilter(value === "all" ? "" : value); setPage(1); }}><SelectTrigger id="question-review-filter"><SelectValue placeholder="All review states" /></SelectTrigger><SelectContent><SelectItem value="all">All review states</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="retired">Retired history</SelectItem></SelectContent></Select>
                </div>
              </CardContent>
            </Card>

            {questionsQuery.isError ? (
              <Card role="alert" aria-live="assertive">
                <CardContent className="p-8 text-center sm:p-12">
                  <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-600" aria-hidden="true" />
                  <h3 className="font-semibold text-slate-900">Questions could not be loaded</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                    {questionsQuery.error instanceof Error
                      ? questionsQuery.error.message
                      : "Check your connection and try again."}
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => questionsQuery.refetch()}>
                    Try again
                  </Button>
                </CardContent>
              </Card>
            ) : questionsQuery.isLoading ? (
              <Card role="status" aria-live="polite" aria-label="Loading questions">
                <CardContent className="p-10 text-center text-sm text-slate-600">
                  <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" aria-hidden="true" />
                  Loading questions…
                </CardContent>
              </Card>
            ) : questionsQuery.data && questionsQuery.data.items.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {questionsQuery.data.items.map((q) => (
                      <article key={q.id} className="flex items-stretch hover:bg-slate-50 focus-within:bg-slate-50">
                        <button
                          type="button"
                          className="min-w-0 flex-1 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900"
                          onClick={() => setEditing(q)}
                          aria-label={`${canEdit && q.reviewStatus !== "retired" ? "Edit" : "View"} question: ${q.question}`}
                        >
                          <span className="line-clamp-2 block text-sm font-medium text-slate-900">{q.question}</span>
                          <span className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{q.questionFormat}</span>
                            <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{q.difficulty}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                              q.reviewStatus === "approved"
                                ? "bg-slate-50 text-slate-800"
                                : q.reviewStatus === "rejected"
                                  ? "bg-slate-50 text-slate-800"
                                  : "bg-slate-50 text-slate-800"
                            }`}>
                              {q.reviewStatus || "draft"}
                            </span>
                            {q.generationSource === "ai_draft" && (
                              <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-800">AI draft</span>
                            )}
                            <span className="text-xs text-slate-500">{q.maxPoints} pts · v{q.version}</span>
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-1 px-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`${canEdit && q.reviewStatus !== "retired" ? "Edit" : "View"} question: ${q.question}`}
                            title={canEdit && q.reviewStatus !== "retired" ? "Edit question" : "View question"}
                            onClick={() => setEditing(q)}
                          >
                            {canEdit && q.reviewStatus !== "retired" ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          {canEdit && q.reviewStatus !== "retired" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete question: ${q.question}`}
                              title="Delete question"
                              disabled={deleteQuestionMut.isPending}
                              onClick={() => {
                                if (confirm("Delete this question?")) deleteQuestionMut.mutate(q.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-slate-700" />
                            </Button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <nav className="flex flex-col items-center justify-between gap-3 border-t p-3 text-sm sm:flex-row" aria-label="Question pages">
                      <span>{questionsQuery.data.total} questions total</span>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                        <span className="self-center tabular-nums" aria-current="page">Page {page} of {totalPages}</span>
                        <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
                      </div>
                    </nav>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center sm:p-12">
                  <FileQuestion className="mx-auto mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
                  <h3 className="font-semibold text-slate-900">
                    {search || formatFilter || difficultyFilter || reviewFilter || topicFilter ? "No matching questions" : "No questions yet"}
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                    {search || formatFilter || difficultyFilter || reviewFilter || topicFilter
                      ? "Try changing the search, format, or topic filter."
                      : canEdit
                        ? "Add one question now or import a prepared spreadsheet."
                        : "This bank does not contain any questions yet."}
                  </p>
                  {(search || formatFilter || difficultyFilter || reviewFilter || topicFilter) ? (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => { setSearch(""); setFormatFilter(""); setDifficultyFilter(""); setReviewFilter(""); setTopicFilter(null); setPage(1); }}
                    >
                      Clear filters
                    </Button>
                  ) : canEdit ? (
                    <Button className="mt-4" onClick={() => setEditing(newQuestionDraft())}>
                      <Plus className="h-4 w-4" /> Add question
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </section>
        </div>

      {/* Topic dialog */}
      <Dialog open={topicOpen} onOpenChange={setTopicOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add topic</DialogTitle><DialogDescription>Group related questions inside this bank.</DialogDescription></DialogHeader>
          <form
            id="add-question-topic-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (newTopicName.trim()) createTopicMut.mutate(newTopicName.trim());
            }}
          >
            <Label htmlFor="new-topic-name">Topic name</Label>
            <Input
              id="new-topic-name"
              name="topicName"
              required
              autoFocus
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="e.g. Algebra"
            />
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTopicOpen(false)}>Cancel</Button>
            <Button type="submit" form="add-question-topic-form" disabled={!newTopicName.trim() || createTopicMut.isPending}>
              {createTopicMut.isPending ? "Adding…" : "Add topic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question editor */}
      {editing && (
        <QuestionEditor
          bankId={id}
          topics={bank.topics}
          question={editing}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
          onSave={(q) => saveQuestionMut.mutate(q)}
          saving={saveQuestionMut.isPending}
          onReview={(questionId, status, expectedVersion, note) => reviewQuestionMut.mutate({ questionId, status, expectedVersion, note })}
          reviewing={reviewQuestionMut.isPending}
          requiresReleaseEvidence={bank.ownerType === "admin" && ["certification", "practice"].includes(bank.bankPurpose)}
          onSaveEvidence={(payload) => releaseEvidenceMut.mutate(payload)}
          savingEvidence={releaseEvidenceMut.isPending}
        />
      )}

      {/* Import dialog */}
      {importOpen && (
        <ImportDialog bankId={id} onClose={() => setImportOpen(false)} onDone={() => {
          qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}`] });
          qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}/questions`] });
        }} />
      )}

      {aiDraftOpen && (
        <AiQuestionDraftDialog
          bankId={id}
          bankName={bank.name}
          initialTopic={bank.topics.find((topic) => topic.id === topicFilter)?.name}
          onClose={() => setAiDraftOpen(false)}
          onOpenImport={() => {
            setAiDraftOpen(false);
            setImportOpen(true);
          }}
        />
      )}
    </DashboardLayout>
  );
}

function QuestionEditor({ bankId, topics, question, canEdit, onClose, onSave, saving, onReview, reviewing, requiresReleaseEvidence, onSaveEvidence, savingEvidence }: {
  bankId: number;
  topics: QuestionTopic[];
  question: Question;
  canEdit: boolean;
  onClose: () => void;
  onSave: (q: any) => void;
  saving: boolean;
  onReview: (questionId: number, status: QuestionReviewDecision, expectedVersion: number, note?: string) => void;
  reviewing: boolean;
  requiresReleaseEvidence: boolean;
  onSaveEvidence: (payload: {
    questionId: number;
    expectedVersion: number;
    changeNote: string;
    syllabusVersion: string;
    objectiveCode: string;
    answerValidationMethod: "authoritative_reference" | "primary_source" | "independent_calculation";
    answerValidationReference: string;
    distractorReviewNote: string;
  }) => void;
  savingEvidence: boolean;
}) {
  const [q, setQ] = useState<any>({ ...question });
  const [reviewNote, setReviewNote] = useState("");
  const existingEvidence = (question.answerMetadata as any)?.releaseEvidence;
  const [evidence, setEvidence] = useState({
    syllabusVersion: existingEvidence?.syllabusVersion || "",
    objectiveCode: existingEvidence?.objectiveCode || "",
    answerValidationMethod: (existingEvidence?.answerValidation?.method || "primary_source") as "authoritative_reference" | "primary_source" | "independent_calculation",
    answerValidationReference: existingEvidence?.answerValidation?.reference || "",
    distractorReviewNote: existingEvidence?.distractorReview?.note || "",
    changeNote: "",
  });
  const isMcq = q.questionFormat === "mcq_single" || q.questionFormat === "mcq_multi";
  const opts: string[] = Array.isArray(q.options) ? q.options : [];
  const editorId = `question-editor-${q.id || "new"}`;
  const isDirty = useMemo(() => JSON.stringify(q) !== JSON.stringify(question), [q, question]);
  const canModify = canEdit && q.reviewStatus !== "retired";

  const versionsQuery = useQuery<QuestionVersion[]>({
    queryKey: [`/api/question-banks/${bankId}/questions/${q.id}/versions`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/question-banks/${bankId}/questions/${q.id}/versions`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Failed to load versions");
      return response.json();
    },
    enabled: !!q.id,
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {q.id ? `${canModify ? "Edit" : "View"} question (v${q.version})` : "New question"}
          </SheetTitle>
          <SheetDescription>
            {canModify
              ? "Define the prompt, answer key, scoring, and review metadata."
              : "Review the prompt, answer key, scoring, and version history."}
          </SheetDescription>
        </SheetHeader>
        <form
          id={`${editorId}-form`}
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canModify && q.question?.trim()) onSave(q);
          }}
        >
          {q.id ? (
            <section className={`rounded-xl border p-4 ${
              q.reviewStatus === "approved"
                ? "border-slate-200 bg-slate-50"
                : q.reviewStatus === "rejected"
                  ? "border-slate-200 bg-slate-50"
                  : "border-slate-200 bg-slate-50"
            }`} aria-labelledby={`${editorId}-governance-title`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={`${editorId}-governance-title`} className="font-semibold text-slate-900">Review governance</h3>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold capitalize text-slate-800">
                  {q.reviewStatus || "draft"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                {q.generationSource === "ai_draft"
                  ? "AI-assisted draft · requires an explicit human decision before assessment use."
                  : q.generationSource === "imported"
                    ? "Imported question · requires an explicit human decision before assessment use."
                    : "Human-authored question."}
              </p>
              {q.reviewStatus !== "approved" && (
                <p className="mt-1 text-xs font-medium text-slate-700">
                  Inactive: scheduled assessments must select only active, approved questions.
                </p>
              )}
              {q.reviewedAt && (
                <p className="mt-1 text-xs text-slate-600">
                  Last reviewed {new Date(q.reviewedAt).toLocaleString()}
                  {q.reviewedBy ? ` · reviewer #${q.reviewedBy}` : ""}
                </p>
              )}
              {canModify && (
                <div className="mt-3">
                  <Label htmlFor={`${editorId}-review-note`}>Item-specific review attestation</Label>
                  <Textarea
                    id={`${editorId}-review-note`}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="Describe the answer, distractor, syllabus, and language checks performed (minimum 20 characters)."
                  />
                  <p className="mt-1 text-xs text-slate-600">Required for approval and rejection. It is tied to this exact content hash and version.</p>
                  {isDirty && (
                    <p role="status" className="mt-1 text-xs font-medium text-slate-800">
                      Save your edits first. The saved version will return to pending review.
                    </p>
                  )}
                </div>
              )}
            </section>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
              Octamy certification questions are saved for independent review; other workspace questions follow the owner’s review policy.
            </div>
          )}
          {q.id && canModify && requiresReleaseEvidence && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3" aria-labelledby={`${editorId}-evidence-title`}>
              <div><h3 id={`${editorId}-evidence-title`} className="font-semibold text-slate-900">Assessment release evidence</h3><p className="mt-1 text-xs leading-5 text-slate-600">Saving evidence creates a new pending version and invalidates any earlier approval.</p></div>
              <div><Label htmlFor={`${editorId}-syllabus`}>Syllabus version</Label><Input id={`${editorId}-syllabus`} value={evidence.syllabusVersion} onChange={(event) => setEvidence({ ...evidence, syllabusVersion: event.target.value })} maxLength={160} /></div>
              <div><Label htmlFor={`${editorId}-objective`}>Objective code</Label><Input id={`${editorId}-objective`} value={evidence.objectiveCode} onChange={(event) => setEvidence({ ...evidence, objectiveCode: event.target.value })} maxLength={160} /></div>
              <div><Label htmlFor={`${editorId}-validation-method`}>Answer validation method</Label><Select value={evidence.answerValidationMethod} onValueChange={(value: "authoritative_reference" | "primary_source" | "independent_calculation") => setEvidence({ ...evidence, answerValidationMethod: value })}><SelectTrigger id={`${editorId}-validation-method`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary_source">Primary source</SelectItem><SelectItem value="authoritative_reference">Authoritative reference</SelectItem><SelectItem value="independent_calculation">Independent calculation</SelectItem></SelectContent></Select></div>
              <div><Label htmlFor={`${editorId}-validation-reference`}>Answer validation reference</Label><Textarea id={`${editorId}-validation-reference`} value={evidence.answerValidationReference} onChange={(event) => setEvidence({ ...evidence, answerValidationReference: event.target.value })} maxLength={2000} rows={2} placeholder="Exact source URL/citation or independently reproduced calculation." /></div>
              <div><Label htmlFor={`${editorId}-distractor-note`}>Distractor review note</Label><Textarea id={`${editorId}-distractor-note`} value={evidence.distractorReviewNote} onChange={(event) => setEvidence({ ...evidence, distractorReviewNote: event.target.value })} maxLength={2000} rows={2} placeholder="Explain why distractors are plausible but not alternate correct answers." /></div>
              <div><Label htmlFor={`${editorId}-evidence-change-note`}>Evidence change note</Label><Input id={`${editorId}-evidence-change-note`} value={evidence.changeNote} onChange={(event) => setEvidence({ ...evidence, changeNote: event.target.value })} maxLength={500} placeholder="Why this evidence is being added or changed." /></div>
              <Button
                type="button"
                variant="outline"
                disabled={savingEvidence || isDirty || evidence.syllabusVersion.trim().length < 3 || evidence.objectiveCode.trim().length < 2 || evidence.answerValidationReference.trim().length < 8 || evidence.distractorReviewNote.trim().length < 10 || evidence.changeNote.trim().length < 10}
                onClick={() => onSaveEvidence({ questionId: q.id, expectedVersion: q.version, ...evidence })}
              >
                {savingEvidence ? "Saving evidence…" : "Save release evidence"}
              </Button>
            </section>
          )}
          <div>
            <Label htmlFor={`${editorId}-format`}>Format</Label>
            <Select value={q.questionFormat} onValueChange={(v) => setQ({ ...q, questionFormat: v })} disabled={!canModify}>
              <SelectTrigger id={`${editorId}-format`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`${editorId}-topic`}>Topic</Label>
            <Select
              value={q.topicId ? String(q.topicId) : "none"}
              onValueChange={(v) => setQ({ ...q, topicId: v === "none" ? null : Number(v) })}
              disabled={!canModify}
            >
              <SelectTrigger id={`${editorId}-topic`}><SelectValue placeholder="No topic" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No topic</SelectItem>
                {topics.map((t) => (<SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`${editorId}-prompt`}>Question</Label>
            <Textarea
              id={`${editorId}-prompt`}
              name="question"
              required
              aria-required="true"
              value={q.question}
              onChange={(e) => setQ({ ...q, question: e.target.value })}
              rows={3}
              disabled={!canModify}
            />
          </div>
          {isMcq && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-900">Answer options</legend>
              <p className="text-xs text-slate-500">
                {q.questionFormat === "mcq_single"
                  ? "Select the one correct answer."
                  : "Select every correct answer."}
              </p>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    id={`${editorId}-correct-${i}`}
                    type={q.questionFormat === "mcq_single" ? "radio" : "checkbox"}
                    name={`${editorId}-correct`}
                    aria-label={`Mark option ${"ABCD"[i]} as correct`}
                    className="h-5 w-5 shrink-0 accent-slate-700"
                    checked={q.questionFormat === "mcq_single"
                      ? q.correctAnswer === i
                      : (q.expectedAnswer || "").split(",").map(Number).includes(i)}
                    onChange={() => {
                      if (q.questionFormat === "mcq_single") {
                        setQ({ ...q, correctAnswer: i });
                      } else {
                        const cur = (q.expectedAnswer || "").split(",").map(Number).filter((n: number) => !isNaN(n));
                        const next = cur.includes(i) ? cur.filter((n: number) => n !== i) : [...cur, i].sort();
                        setQ({ ...q, expectedAnswer: next.join(","), correctAnswer: next[0] ?? 0 });
                      }
                    }}
                    disabled={!canModify}
                  />
                  <Label htmlFor={`${editorId}-option-${i}`} className="sr-only">
                    Option {"ABCD"[i]}
                  </Label>
                  <Input
                    id={`${editorId}-option-${i}`}
                    name={`option${"ABCD"[i]}`}
                    value={opts[i] || ""}
                    onChange={(e) => {
                      const next = [...opts];
                      while (next.length <= i) next.push("");
                      next[i] = e.target.value;
                      setQ({ ...q, options: next });
                    }}
                    placeholder={`Option ${"ABCD"[i]}`}
                    disabled={!canModify}
                  />
                </div>
              ))}
            </fieldset>
          )}
          {q.questionFormat === "true_false" && (
            <div>
              <Label htmlFor={`${editorId}-true-false-answer`}>Correct answer</Label>
              <Select value={q.expectedAnswer ?? "true"} onValueChange={(v) => setQ({ ...q, expectedAnswer: v, correctAnswer: v === "true" ? 1 : 0 })} disabled={!canModify}>
                <SelectTrigger id={`${editorId}-true-false-answer`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {!isMcq && q.questionFormat !== "true_false" && (
            <div>
              <Label htmlFor={`${editorId}-expected-answer`}>Expected answer</Label>
              <Textarea
                id={`${editorId}-expected-answer`}
                name="expectedAnswer"
                value={q.expectedAnswer ?? ""}
                onChange={(e) => setQ({ ...q, expectedAnswer: e.target.value })}
                rows={3}
                disabled={!canModify}
              />
            </div>
          )}
          {q.questionFormat === "code" && (
            <div>
              <Label htmlFor={`${editorId}-code-language`}>Code language</Label>
              <Input
                id={`${editorId}-code-language`}
                name="codeLanguage"
                value={q.codeLanguage ?? ""}
                onChange={(e) => setQ({ ...q, codeLanguage: e.target.value })}
                placeholder="e.g. python"
                disabled={!canModify}
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${editorId}-marks`}>Marks</Label>
              <Input id={`${editorId}-marks`} name="marks" type="number" min="0" step="0.25" value={q.maxPoints ?? 1} onChange={(e) => setQ({ ...q, maxPoints: Number(e.target.value) })} disabled={!canModify} />
            </div>
            <div>
              <Label htmlFor={`${editorId}-negative-marks`}>Negative marks</Label>
              <Input id={`${editorId}-negative-marks`} name="negativeMarks" type="number" min="0" step="0.25" value={q.negativeMarks ?? 0} onChange={(e) => setQ({ ...q, negativeMarks: Number(e.target.value) })} disabled={!canModify} />
            </div>
            <div>
              <Label htmlFor={`${editorId}-difficulty`}>Difficulty</Label>
              <Select value={q.difficulty} onValueChange={(v) => setQ({ ...q, difficulty: v })} disabled={!canModify}>
                <SelectTrigger id={`${editorId}-difficulty`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${editorId}-time-limit`}>Time limit (seconds)</Label>
              <Input id={`${editorId}-time-limit`} name="timeLimit" type="number" min="1" value={q.timeLimitSec ?? ""} onChange={(e) => setQ({ ...q, timeLimitSec: e.target.value ? Number(e.target.value) : null })} disabled={!canModify} />
            </div>
          </div>
          <div>
            <Label htmlFor={`${editorId}-explanation`}>Explanation (optional)</Label>
            <Textarea id={`${editorId}-explanation`} name="explanation" value={q.explanation ?? ""} onChange={(e) => setQ({ ...q, explanation: e.target.value })} rows={2} disabled={!canModify} />
          </div>

          {q.id ? (
            <Accordion type="single" collapsible>
              <AccordionItem value="versions">
                <AccordionTrigger>
                  <span className="flex items-center gap-2 text-sm"><History className="w-4 h-4" /> Version history</span>
                </AccordionTrigger>
                <AccordionContent>
                  {versionsQuery.isError ? (
                    <p role="alert" className="text-xs text-slate-700">
                      Version history could not be loaded.
                    </p>
                  ) : versionsQuery.isLoading ? (
                    <p role="status" className="text-xs text-slate-500">Loading version history…</p>
                  ) : versionsQuery.data && versionsQuery.data.length > 0 ? (
                    <ul className="space-y-2 text-xs">
                      {versionsQuery.data.map((v) => (
                        <li key={v.id} className="border rounded p-2">
                          <div className="font-medium">v{v.version} · {new Date(v.createdAt).toLocaleString()}</div>
                          {v.changeNote && <div className="text-gray-600 mt-1">{v.changeNote}</div>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-xs text-gray-500">No prior versions.</p>}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}

          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-white py-4">
            <Button type="button" variant="ghost" onClick={onClose}>{canModify ? "Cancel" : "Close"}</Button>
            {canModify && q.id && q.reviewStatus !== "rejected" && (
              <Button
                type="button"
                variant="outline"
                className="border-slate-200 text-slate-800 hover:bg-slate-50 hover:text-slate-900"
                disabled={isDirty || reviewing || reviewNote.trim().length < 20}
                onClick={() => onReview(q.id, "rejected", q.version, reviewNote)}
              >
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            )}
            {canModify && q.id && q.reviewStatus !== "approved" && (
              <Button
                type="button"
                className="bg-slate-700 hover:bg-slate-800"
                disabled={isDirty || reviewing || reviewNote.trim().length < 20}
                onClick={() => onReview(q.id, "approved", q.version, reviewNote)}
              >
                <CheckCircle2 className="h-4 w-4" /> {reviewing ? "Saving review…" : "Approve version"}
              </Button>
            )}
            {canModify && (
              <Button type="submit" disabled={saving || reviewing || !q.question?.trim()}>
                {saving ? "Saving…" : "Save question"}
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ImportDialog({ bankId, onClose, onDone }: { bankId: number; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [activeAction, setActiveAction] = useState<"preview" | "import" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const { toast } = useToast();
  const importing = activeAction !== null;

  const upload = async (dryRun: boolean) => {
    if (!file) return;
    setActiveAction(dryRun ? "preview" : "import");
    setErrorMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dryRun", String(dryRun));
      const token = localStorage.getItem("token");
      const r = await fetch(`/api/question-banks/${bankId}/questions/import`, {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Import failed");
      if (dryRun) {
        setPreview(data);
      } else {
        toast({
          title: `Imported ${data.created} questions for review`,
          description: `${data.pendingReview ?? data.created} inactive questions now require explicit human approval${data.errors?.length ? ` · ${data.errors.length} invalid rows skipped` : ""}.`,
        });
        onDone();
        onClose();
      }
    } catch (e: any) {
      setErrorMessage(e.message || "The file could not be processed.");
      toast({ title: "Import could not be completed", description: e.message });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Bulk Import Questions</DialogTitle><DialogDescription>Validate a CSV or spreadsheet, then review each imported question before assessment use.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <p id="question-import-help" className="text-sm text-slate-600">
            Upload a CSV or XLSX. <a href="/docs/question-import-format" className="font-medium text-slate-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700">Download CSV template</a>. Required columns: topic, question, format, optionA-D, correctAnswer, marks. All imported rows remain inactive pending human review.
          </p>
          <div>
            <Label htmlFor="question-import-file">Question file</Label>
            <Input
              id="question-import-file"
              name="questionFile"
              type="file"
              accept=".csv,.xlsx,.xls"
              aria-describedby="question-import-help"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setErrorMessage("");
              }}
            />
            {file && <p className="mt-1.5 text-xs text-slate-500">Selected: {file.name}</p>}
          </div>
          {activeAction && (
            <p role="status" aria-live="polite" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {activeAction === "preview" ? "Validating file…" : "Importing valid questions…"}
            </p>
          )}
          {errorMessage && (
            <div role="alert" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
              <p className="font-medium">The file could not be processed</p>
              <p className="mt-1">{errorMessage}</p>
            </div>
          )}
          {preview && (
            <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 p-3 text-xs" role="status" aria-live="polite">
              <p className="font-medium mb-2">
                {preview.totalRows} rows · {preview.valid ?? preview.created} valid · {preview.errors?.length ?? 0} errors
              </p>
              <p className="mb-2 text-slate-800">
                {preview.pendingReview ?? preview.valid ?? 0} valid questions will require approval after import.
              </p>
              {preview.errors?.length > 0 && (
                <div className="mb-3 rounded-md bg-slate-50 p-2 text-slate-900">
                  <p className="font-medium">Rows that need attention</p>
                  <ul className="mt-1 space-y-1">
                  {preview.errors.slice(0, 10).map((e: any, i: number) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                  </ul>
                </div>
              )}
              {preview.preview?.length > 0 && (
                <div>
                  <p className="font-medium mt-2">Preview (first 5):</p>
                  <ul className="space-y-1">
                    {preview.preview.map((p: any, i: number) => (
                      <li key={i} className="text-gray-700">• {p.question}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={importing}>Cancel</Button>
          <Button type="button" variant="outline" onClick={() => upload(true)} disabled={!file || importing}>
            {activeAction === "preview" ? "Validating…" : "Validate file"}
          </Button>
          <Button onClick={() => upload(false)} disabled={!file || importing}>
            {activeAction === "import" ? "Importing…" : preview ? `Import ${preview.valid ?? preview.created ?? 0} rows` : "Import questions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
