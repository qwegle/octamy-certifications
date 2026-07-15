import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, Database, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/components/dashboard-layout";
import type { CourseBlueprintItem, QuestionBank, QuestionTopic } from "@shared/schema";

type Difficulty = "easy" | "medium" | "hard" | "mixed";

interface BlueprintRow {
  id?: number;
  bankId: number;
  topicId: number | null;
  questionCount: number;
  difficulty: Difficulty;
  marksPerQuestion: number;
  negativeMarks: number;
  sortOrder: number;
}

interface BankOption extends QuestionBank {
  topics: QuestionTopic[];
  inventory: Array<{ topicId: number | null; difficulty: string; available: number }>;
}

function availableForRule(bank: BankOption | undefined, row: BlueprintRow) {
  if (!bank) return 0;
  return bank.inventory
    .filter((item) => (row.topicId == null || item.topicId === row.topicId) && (row.difficulty === "mixed" || item.difficulty === row.difficulty))
    .reduce((sum, item) => sum + Number(item.available), 0);
}

export default function BlueprintEditor() {
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BlueprintRow[]>([]);
  const [addBankId, setAddBankId] = useState<number | null>(null);
  const [changeNote, setChangeNote] = useState("");

  const banksQuery = useQuery<BankOption[]>({
    queryKey: ["/api/question-banks/blueprint-options"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/question-banks/blueprint-options");
      if (!response.ok) throw new Error("Question pools could not be loaded");
      return response.json();
    },
  });
  const blueprintQuery = useQuery<CourseBlueprintItem[]>({
    queryKey: [`/api/courses/${courseId}/blueprint`],
    queryFn: async () => (await apiRequest("GET", `/api/courses/${courseId}/blueprint`)).json(),
    enabled: Number.isInteger(courseId) && courseId > 0,
  });

  useEffect(() => {
    if (!banksQuery.data?.length || addBankId) return;
    setAddBankId(banksQuery.data.find((bank) => bank.status === "active")?.id ?? banksQuery.data[0].id);
  }, [addBankId, banksQuery.data]);

  useEffect(() => {
    if (!blueprintQuery.data) return;
    setRows(blueprintQuery.data.map((row) => ({
      id: row.id,
      bankId: row.bankId,
      topicId: row.topicId,
      questionCount: row.questionCount,
      difficulty: row.difficulty as Difficulty,
      marksPerQuestion: row.marksPerQuestion,
      negativeMarks: row.negativeMarks,
      sortOrder: row.sortOrder,
    })));
  }, [blueprintQuery.data]);

  const banks = banksQuery.data ?? [];
  const bankMap = useMemo(() => new Map(banks.map((bank) => [bank.id, bank])), [banks]);
  const invalidRows = rows.filter((row) => availableForRule(bankMap.get(row.bankId), row) < row.questionCount);
  const totals = useMemo(() => ({
    questions: rows.reduce((sum, row) => sum + (row.questionCount || 0), 0),
    marks: rows.reduce((sum, row) => sum + (row.questionCount || 0) * (row.marksPerQuestion || 0), 0),
    banks: new Set(rows.map((row) => row.bankId)).size,
  }), [rows]);

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", `/api/courses/${courseId}/blueprint`, {
        items: rows.map(({ id: _id, ...row }, index) => ({ ...row, sortOrder: index })),
        changeNote: changeNote.trim() || undefined,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Blueprint could not be saved");
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/blueprint`] });
      setChangeNote("");
      toast({ title: "Assessment blueprint saved", description: "A new auditable blueprint revision was recorded." });
    },
    onError: (error: Error) => toast({ title: "Blueprint could not be saved", description: error.message, variant: "destructive" }),
  });

  const updateRow = (index: number, patch: Partial<BlueprintRow>) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };
  const addRule = () => {
    if (!addBankId) return;
    setRows((current) => [...current, {
      bankId: addBankId,
      topicId: null,
      questionCount: 5,
      difficulty: "mixed",
      marksPerQuestion: 1,
      negativeMarks: 0,
      sortOrder: current.length,
    }]);
  };

  return <DashboardLayout
    role="admin"
    title="Assessment question blueprint"
    description={`Assessment #${courseId} · Assign governed banks, optional topics, and difficulty rules.`}
    breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Assessments", href: "/admin" }, { label: `Assessment #${courseId}` }]}
    actions={<Link href="/admin"><Button size="sm" variant="outline"><ChevronLeft className="mr-1 h-4 w-4" />Back to assessments</Button></Link>}
  >
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div><CardTitle>Question-pool rules</CardTitle><CardDescription>Each rule draws questions from one bank. Choose a topic only when the assessment requires a topic-level quota.</CardDescription></div>
              <div className="flex min-w-0 gap-2">
                <Select value={addBankId ? String(addBankId) : ""} onValueChange={(value) => setAddBankId(Number(value))}><SelectTrigger className="w-56"><SelectValue placeholder="Choose a bank" /></SelectTrigger><SelectContent>{banks.map((bank) => <SelectItem key={bank.id} value={String(bank.id)}>{bank.name}</SelectItem>)}</SelectContent></Select>
                <Button variant="outline" onClick={addRule} disabled={!addBankId}><Plus className="mr-1 h-4 w-4" />Add rule</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {banksQuery.isLoading || blueprintQuery.isLoading ? <div className="py-16 text-center text-sm text-slate-500">Loading governed question pools…</div> : banksQuery.isError || blueprintQuery.isError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">The blueprint or bank inventory could not be loaded. Please retry.</div> : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center"><Database className="mx-auto h-9 w-9 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-950">No question pool assigned</h3><p className="mt-1 text-sm text-slate-600">Choose a governed bank and add the first selection rule. This assessment cannot be published until its blueprint is valid.</p><Button className="mt-4" onClick={addRule} disabled={!addBankId}><Plus className="mr-1 h-4 w-4" />Add first rule</Button></div> : <div className="space-y-3">
              {rows.map((row, index) => {
                const bank = bankMap.get(row.bankId);
                const available = availableForRule(bank, row);
                const invalid = available < row.questionCount;
                return <div key={row.id ?? `${row.bankId}-${index}`} className={`rounded-2xl border p-4 ${invalid ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white"}`}>
                  <div className="mb-3 flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-950">Rule {index + 1}</span><Badge variant="outline">{bank?.bankKind?.replaceAll("_", " ") || "bank"}</Badge>{bank?.status && <Badge variant={bank.status === "active" ? "default" : "secondary"} className="capitalize">{bank.status}</Badge>}</div><p className="mt-1 text-xs text-slate-500">{bank?.slug || `Bank #${row.bankId}`}</p></div><Button size="icon" variant="ghost" aria-label={`Remove rule ${index + 1}`} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4 text-rose-700" /></Button></div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(13rem,2fr)_minmax(10rem,1.5fr)_8rem_8rem_7rem_7rem]">
                    <div><Label>Question bank</Label><Select value={String(row.bankId)} onValueChange={(value) => updateRow(index, { bankId: Number(value), topicId: null })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{banks.map((option) => <SelectItem key={option.id} value={String(option.id)}>{option.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Topic scope</Label><Select value={row.topicId ? String(row.topicId) : "all"} onValueChange={(value) => updateRow(index, { topicId: value === "all" ? null : Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All topics</SelectItem>{bank?.topics.map((topic) => <SelectItem key={topic.id} value={String(topic.id)}>{topic.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Difficulty</Label><Select value={row.difficulty} onValueChange={(value) => updateRow(index, { difficulty: value as Difficulty })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mixed">Mixed</SelectItem><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select></div>
                    <div><Label>Questions</Label><Input type="number" min={1} max={500} value={row.questionCount} onChange={(event) => updateRow(index, { questionCount: Number(event.target.value) })} /></div>
                    <div><Label>Marks each</Label><Input type="number" min={1} max={100} value={row.marksPerQuestion} onChange={(event) => updateRow(index, { marksPerQuestion: Number(event.target.value) })} /></div>
                    <div><Label>Negative</Label><Input type="number" min={0} max={100} value={row.negativeMarks} onChange={(event) => updateRow(index, { negativeMarks: Number(event.target.value) })} /></div>
                  </div>
                  <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 text-xs ${invalid ? "text-amber-900" : "text-slate-500"}`}><span>{row.questionCount} requested · {available.toLocaleString()} approved and active available</span>{bank && <Link href={`/admin/question-banks/${bank.id}`} className="font-semibold text-slate-700 underline-offset-4 hover:underline">Manage this bank</Link>}</div>
                </div>;
              })}
            </div>}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base">Revision note</CardTitle><CardDescription>Every save creates an immutable audit snapshot. Record why this mix changed.</CardDescription></CardHeader><CardContent><Label htmlFor="blueprint-change-note">Change note</Label><Textarea id="blueprint-change-note" value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Example: Updated the SSC CGL 2026 mix to 30% easy, 50% medium, and 20% hard after SME review." /></CardContent></Card>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:h-max">
        <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base">Blueprint summary</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Questions</p><p className="text-xl font-black">{totals.questions}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Total marks</p><p className="text-xl font-black">{totals.marks}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Banks</p><p className="text-xl font-black">{totals.banks}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Est. minutes</p><p className="text-xl font-black">{Math.max(1, Math.round(totals.questions * 1.2))}</p></div></div>
          {invalidRows.length ? <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{invalidRows.length} rule(s) request more questions than their approved inventory.</span></div> : rows.length ? <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Every rule has enough approved inventory for a randomized attempt.</span></div> : null}
          <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending || invalidRows.length > 0}><Save className="mr-1 h-4 w-4" />{save.isPending ? "Saving revision…" : "Save blueprint"}</Button>
        </CardContent></Card>
        <Card className="border-slate-200 bg-slate-950 text-white shadow-sm"><CardContent className="p-4"><p className="text-sm font-semibold">Enterprise rule</p><p className="mt-2 text-xs leading-5 text-slate-300">Banks define ownership and syllabus scope. Topics define coverage. Difficulty defines selection. Assessments only store the quota—not 100,000 question IDs.</p></CardContent></Card>
      </aside>
    </div>
  </DashboardLayout>;
}
