import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
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
import { useDashboardRole } from "@/lib/use-dashboard-role";
import {
  Plus,
  Upload,
  Download,
  Settings,
  ChevronLeft,
  Trash2,
  History,
  Pencil,
} from "lucide-react";
import type { Question, QuestionBank, QuestionTopic, QuestionVersion } from "@shared/schema";

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
  canEdit: boolean;
}

export default function QuestionBankDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { toast } = useToast();
  const qc = useQueryClient();
  const role = useDashboardRole();

  const [topicFilter, setTopicFilter] = useState<number | null>(null);
  const [formatFilter, setFormatFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Question | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");

  const bankQuery = useQuery<BankResponse>({
    queryKey: [`/api/question-banks/${id}`],
    queryFn: async () => (await apiRequest("GET", `/api/question-banks/${id}`)).json(),
  });

  const questionsQuery = useQuery<{ items: Question[]; total: number }>({
    queryKey: [`/api/question-banks/${id}/questions`, { topicFilter, formatFilter, search, page }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (topicFilter) qs.set("topicId", String(topicFilter));
      if (formatFilter) qs.set("format", formatFilter);
      if (search) qs.set("search", search);
      qs.set("page", String(page));
      qs.set("perPage", "25");
      const r = await apiRequest("GET", `/api/question-banks/${id}/questions?${qs}`);
      return r.json();
    },
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
  });

  const deleteTopicMut = useMutation({
    mutationFn: async (tid: number) => {
      await apiRequest("DELETE", `/api/question-banks/${id}/topics/${tid}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}`] }),
  });

  const saveQuestionMut = useMutation({
    mutationFn: async (q: Partial<Question> & { id?: number }) => {
      if (q.id) {
        const r = await apiRequest("PATCH", `/api/question-banks/${id}/questions/${q.id}`, q);
        return r.json();
      }
      const r = await apiRequest("POST", `/api/question-banks/${id}/questions`, q);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}/questions`] });
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}`] });
      toast({ title: "Saved" });
      setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteQuestionMut = useMutation({
    mutationFn: async (qid: number) => {
      await apiRequest("DELETE", `/api/question-banks/${id}/questions/${qid}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}/questions`] });
      qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}`] });
      toast({ title: "Deleted" });
    },
  });

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
      <DashboardLayout role={role} title="Question bank" breadcrumbs={[{ label: "Question banks", href: "/question-banks" }, { label: "Loading…" }]}>
        <div className="text-center py-12 text-slate-500">Loading…</div>
      </DashboardLayout>
    );
  }
  if (!bankQuery.data) {
    return (
      <DashboardLayout role={role} title="Bank not found" breadcrumbs={[{ label: "Question banks", href: "/question-banks" }, { label: "Not found" }]}>
        <div className="max-w-xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold mb-2 text-slate-900">Bank not found</h1>
          <Link href="/question-banks">
            <Button variant="outline">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to banks
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const bank = bankQuery.data;
  const canEdit = bank.canEdit;

  return (
    <DashboardLayout
      role={role}
      title={bank.name}
      description={bank.description || `Reusable bank · ${bank.questionCount} questions`}
      breadcrumbs={[
        { label: "Question banks", href: "/question-banks" },
        { label: bank.name },
      ]}
    >
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/question-banks">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{bank.name}</h1>
              <p className="text-xs text-gray-500">
                {bank.questionCount} questions · {bank.visibility} · {bank.ownerType}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-1" /> Bulk Import
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/question-banks/${id}/questions/export`} target="_blank" rel="noreferrer">
                <Download className="w-4 h-4 mr-1" /> Export CSV
              </a>
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => setEditing(newQuestionDraft())}>
                <Plus className="w-4 h-4 mr-1" /> Question
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
          {/* Topic tree */}
          <aside className="bg-cream-soft border rounded-lg p-3 h-max sticky top-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Topics</h3>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setTopicOpen(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
            <button
              className={`w-full text-left px-2 py-1.5 rounded text-sm ${topicFilter === null ? "bg-purple-50 text-purple-700 font-medium" : "hover:bg-cream-deep"}`}
              onClick={() => { setTopicFilter(null); setPage(1); }}
            >
              All topics
            </button>
            {bank.topics.map((t) => (
              <div key={t.id} className="group flex items-center">
                <button
                  className={`flex-1 text-left px-2 py-1.5 rounded text-sm ${topicFilter === t.id ? "bg-purple-50 text-purple-700 font-medium" : "hover:bg-cream-deep"}`}
                  onClick={() => { setTopicFilter(t.id); setPage(1); }}
                >
                  {t.name}
                </button>
                {canEdit && (
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded"
                    onClick={() => {
                      if (confirm(`Delete topic '${t.name}'? Questions in it will keep their topic id.`)) {
                        deleteTopicMut.mutate(t.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </aside>

          {/* Questions */}
          <section>
            <Card className="mb-4">
              <CardContent className="p-3 flex flex-wrap gap-2 items-center">
                <Input
                  placeholder="Search questions…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full sm:w-64"
                />
                <Select value={formatFilter || "all"} onValueChange={(v) => { setFormatFilter(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="All formats" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All formats</SelectItem>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {questionsQuery.data && questionsQuery.data.items.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {questionsQuery.data.items.map((q) => (
                      <div key={q.id} className="p-3 flex items-start gap-3 hover:bg-cream-deep cursor-pointer" onClick={() => setEditing(q)}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">{q.question}</p>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            <Badge variant="secondary">{q.questionFormat}</Badge>
                            <Badge variant="outline">{q.difficulty}</Badge>
                            <span className="text-xs text-gray-500">{q.maxPoints} pts · v{q.version}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(q); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Delete this question?")) deleteQuestionMut.mutate(q.id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t text-sm">
                      <span>{questionsQuery.data.total} total</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
                        <span className="self-center">{page} / {totalPages}</span>
                        <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center text-gray-500">
                  No questions yet. {canEdit && "Use \"+ Question\" or Bulk Import."}
                </CardContent>
              </Card>
            )}
          </section>
        </div>

      {/* Topic dialog */}
      <Dialog open={topicOpen} onOpenChange={setTopicOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add topic</DialogTitle></DialogHeader>
          <Input value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} placeholder="e.g. Algebra" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTopicOpen(false)}>Cancel</Button>
            <Button onClick={() => createTopicMut.mutate(newTopicName)} disabled={!newTopicName}>Add</Button>
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
        />
      )}

      {/* Import dialog */}
      {importOpen && (
        <ImportDialog bankId={id} onClose={() => setImportOpen(false)} onDone={() => {
          qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}`] });
          qc.invalidateQueries({ queryKey: [`/api/question-banks/${id}/questions`] });
        }} />
      )}
    </DashboardLayout>
  );
}

function QuestionEditor({ bankId, topics, question, canEdit, onClose, onSave, saving }: {
  bankId: number;
  topics: QuestionTopic[];
  question: Question;
  canEdit: boolean;
  onClose: () => void;
  onSave: (q: any) => void;
  saving: boolean;
}) {
  const [q, setQ] = useState<any>({ ...question });
  const isMcq = q.questionFormat === "mcq_single" || q.questionFormat === "mcq_multi";
  const opts: string[] = Array.isArray(q.options) ? q.options : [];

  const versionsQuery = useQuery<QuestionVersion[]>({
    queryKey: [`/api/question-banks/${bankId}/questions/${q.id}/versions`],
    queryFn: async () => (await apiRequest("GET", `/api/question-banks/${bankId}/questions/${q.id}/versions`)).json(),
    enabled: !!q.id,
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>{q.id ? `Edit Question (v${q.version})` : "New Question"}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Format</Label>
            <Select value={q.questionFormat} onValueChange={(v) => setQ({ ...q, questionFormat: v })} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Topic</Label>
            <Select
              value={q.topicId ? String(q.topicId) : "none"}
              onValueChange={(v) => setQ({ ...q, topicId: v === "none" ? null : Number(v) })}
              disabled={!canEdit}
            >
              <SelectTrigger><SelectValue placeholder="No topic" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No topic</SelectItem>
                {topics.map((t) => (<SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Question</Label>
            <Textarea value={q.question} onChange={(e) => setQ({ ...q, question: e.target.value })} rows={3} disabled={!canEdit} />
          </div>
          {isMcq && (
            <div className="space-y-2">
              <Label>Options</Label>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type={q.questionFormat === "mcq_single" ? "radio" : "checkbox"}
                    name="correct"
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
                    disabled={!canEdit}
                  />
                  <Input
                    value={opts[i] || ""}
                    onChange={(e) => {
                      const next = [...opts];
                      while (next.length <= i) next.push("");
                      next[i] = e.target.value;
                      setQ({ ...q, options: next });
                    }}
                    placeholder={`Option ${"ABCD"[i]}`}
                    disabled={!canEdit}
                  />
                </div>
              ))}
            </div>
          )}
          {q.questionFormat === "true_false" && (
            <div>
              <Label>Correct answer</Label>
              <Select value={q.expectedAnswer ?? "true"} onValueChange={(v) => setQ({ ...q, expectedAnswer: v, correctAnswer: v === "true" ? 1 : 0 })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {!isMcq && q.questionFormat !== "true_false" && (
            <div>
              <Label>Expected answer</Label>
              <Textarea value={q.expectedAnswer ?? ""} onChange={(e) => setQ({ ...q, expectedAnswer: e.target.value })} rows={3} disabled={!canEdit} />
            </div>
          )}
          {q.questionFormat === "code" && (
            <div>
              <Label>Code language</Label>
              <Input value={q.codeLanguage ?? ""} onChange={(e) => setQ({ ...q, codeLanguage: e.target.value })} placeholder="e.g. python" disabled={!canEdit} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Marks</Label>
              <Input type="number" value={q.maxPoints ?? 1} onChange={(e) => setQ({ ...q, maxPoints: Number(e.target.value) })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Negative marks</Label>
              <Input type="number" value={q.negativeMarks ?? 0} onChange={(e) => setQ({ ...q, negativeMarks: Number(e.target.value) })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={q.difficulty} onValueChange={(v) => setQ({ ...q, difficulty: v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Time (sec)</Label>
              <Input type="number" value={q.timeLimitSec ?? ""} onChange={(e) => setQ({ ...q, timeLimitSec: e.target.value ? Number(e.target.value) : null })} disabled={!canEdit} />
            </div>
          </div>
          <div>
            <Label>Explanation (optional)</Label>
            <Textarea value={q.explanation ?? ""} onChange={(e) => setQ({ ...q, explanation: e.target.value })} rows={2} disabled={!canEdit} />
          </div>

          {q.id ? (
            <Accordion type="single" collapsible>
              <AccordionItem value="versions">
                <AccordionTrigger>
                  <span className="flex items-center gap-2 text-sm"><History className="w-4 h-4" /> Version history</span>
                </AccordionTrigger>
                <AccordionContent>
                  {versionsQuery.data && versionsQuery.data.length > 0 ? (
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

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            {canEdit && (
              <Button onClick={() => onSave(q)} disabled={saving || !q.question}>
                {saving ? "Saving…" : "Save"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ImportDialog({ bankId, onClose, onDone }: { bankId: number; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const upload = async (dryRun: boolean) => {
    if (!file) return;
    setImporting(true);
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
          title: `Imported ${data.created} rows`,
          description: data.errors?.length ? `${data.errors.length} errors skipped` : "All rows valid",
        });
        onDone();
        onClose();
      }
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Bulk Import Questions</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Upload a CSV or XLSX. <a href="/docs/question-import-format" className="text-purple-600 underline">Download CSV template</a> · Required columns: topic, question, format, optionA-D, correctAnswer, marks.
          </p>
          <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
          {preview && (
            <div className="border rounded p-3 max-h-60 overflow-auto text-xs">
              <p className="font-medium mb-2">
                {preview.totalRows} rows · {preview.valid ?? preview.created} valid · {preview.errors?.length ?? 0} errors
              </p>
              {preview.errors?.length > 0 && (
                <ul className="space-y-1 mb-2">
                  {preview.errors.slice(0, 10).map((e: any, i: number) => (
                    <li key={i} className="text-red-600">Row {e.row}: {e.message}</li>
                  ))}
                </ul>
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
          <Button variant="ghost" onClick={onClose} disabled={importing}>Cancel</Button>
          <Button variant="outline" onClick={() => upload(true)} disabled={!file || importing}>Preview</Button>
          <Button onClick={() => upload(false)} disabled={!file || importing}>
            {importing ? "Importing…" : preview ? `Import ${preview.valid ?? 0} rows` : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
