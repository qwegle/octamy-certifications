import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Archive, CheckCircle2, Database, Edit, EyeOff, FolderCog, Plus, Search } from "lucide-react";

type BankItem = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  ownerType: string;
  visibility: string;
  bankPurpose: "certification" | "practice";
  bankKind: "assessment_pool" | "subject_pool" | "master" | "custom";
  status: "draft" | "active" | "archived";
  subject?: string | null;
  examFamily?: string | null;
  gradeBand?: string | null;
  syllabusVersion?: string | null;
  questionCount: number;
  topicCount: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  assessmentCount: number;
  updatedAt: string;
};

interface BankPage {
  items: BankItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const emptyForm = {
  name: "",
  description: "",
  bankPurpose: "certification" as BankItem["bankPurpose"],
  visibility: "private",
  bankKind: "assessment_pool" as BankItem["bankKind"],
  status: "draft" as BankItem["status"],
  subject: "",
  examFamily: "",
  gradeBand: "",
  syllabusVersion: "",
};

function kindLabel(kind: BankItem["bankKind"]) {
  return ({ assessment_pool: "Assessment pool", subject_pool: "Subject pool", master: "Master source", custom: "Custom" })[kind];
}

export function AdminQuestionBanksManagement() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [purpose, setPurpose] = useState<BankItem["bankPurpose"]>("certification");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("current");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankItem | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [form, setForm] = useState(emptyForm);

  const query = useQuery<BankPage>({
    queryKey: ["/api/admin/question-banks", purpose, page, search, status],
    queryFn: async () => {
      const params = new URLSearchParams({ purpose, page: String(page), pageSize: "25", search, status });
      const response = await apiRequest("GET", `/api/admin/question-banks?${params}`);
      if (!response.ok) throw new Error("Question banks could not be loaded");
      return response.json();
    },
  });
  const items = query.data?.items ?? [];
  const pagination = query.data?.pagination;
  const allSelected = items.length > 0 && items.every((bank) => selected.has(bank.id));
  const pageTotals = useMemo(() => items.reduce((totals, bank) => ({
    questions: totals.questions + Number(bank.questionCount || 0),
    assessments: totals.assessments + Number(bank.assessmentCount || 0),
  }), { questions: 0, assessments: 0 }), [items]);

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: ["/api/admin/question-banks"] });
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        subject: form.subject || undefined,
        examFamily: form.examFamily || undefined,
        gradeBand: form.gradeBand || undefined,
        syllabusVersion: form.syllabusVersion || undefined,
      };
      const response = editing
        ? await apiRequest("PATCH", `/api/admin/question-banks/${editing.id}`, payload)
        : await apiRequest("POST", "/api/admin/question-banks", payload);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Bank could not be saved");
      return response.json();
    },
    onSuccess: async () => {
      await invalidate();
      setDialogOpen(false);
      toast({ title: editing ? "Question bank updated" : "Question bank created", description: "The bank is ready for topics, questions, and assessment assignment." });
    },
    onError: (error: Error) => toast({ title: "Bank could not be saved", description: error.message, variant: "destructive" }),
  });
  const bulk = useMutation({
    mutationFn: async (action: "activate" | "draft" | "archive") => {
      if (action === "archive" && !window.confirm("Archive the selected banks? Banks used by live assessments will be skipped.")) throw new Error("Cancelled");
      const response = await apiRequest("POST", "/api/admin/question-banks/bulk-action", {
        ids: Array.from(selected),
        action,
        confirmation: action === "archive" ? "ARCHIVE" : undefined,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Banks could not be updated");
      return response.json();
    },
    onSuccess: async (result) => {
      await invalidate();
      setSelected(new Set());
      toast({ title: "Question banks updated", description: `${result.affected} changed${result.skipped ? ` · ${result.skipped} live bank(s) protected` : ""}.` });
    },
    onError: (error: Error) => { if (error.message !== "Cancelled") toast({ title: "Bulk update failed", description: error.message, variant: "destructive" }); },
  });
  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, bankPurpose: purpose }); setDialogOpen(true); };
  const openEdit = (bank: BankItem) => {
    setEditing(bank);
    setForm({
      name: bank.name,
      description: bank.description || "",
      bankPurpose: bank.bankPurpose,
      visibility: bank.visibility,
      bankKind: bank.bankKind,
      status: bank.status,
      subject: bank.subject || "",
      examFamily: bank.examFamily || "",
      gradeBand: bank.gradeBand || "",
      syllabusVersion: bank.syllabusVersion || "",
    });
    setDialogOpen(true);
  };

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="border-slate-200 shadow-sm"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Banks in view</p><p className="mt-1 text-2xl font-black text-slate-950">{pagination?.total.toLocaleString() || 0}</p></CardContent></Card>
      <Card className="border-slate-200 shadow-sm"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Questions on page</p><p className="mt-1 text-2xl font-black text-slate-950">{pageTotals.questions.toLocaleString()}</p></CardContent></Card>
      <Card className="border-slate-200 shadow-sm"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assessment links</p><p className="mt-1 text-2xl font-black text-slate-950">{pageTotals.assessments.toLocaleString()}</p></CardContent></Card>
    </div>

    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div><CardTitle>Question-bank library</CardTitle><CardDescription>Certification banks power recruiter-relevant tech credentials. Practice banks power preparation products and are not recruiter evidence.</CardDescription></div>
          <Button onClick={openCreate} className="shrink-0"><Plus className="mr-1 h-4 w-4" />New bank</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={purpose === "certification" ? "default" : "outline"} onClick={() => { setPurpose("certification"); setPage(1); setSelected(new Set()); setForm((current) => ({ ...current, bankPurpose: "certification" })); }}>Certification banks</Button>
          <Button size="sm" variant={purpose === "practice" ? "default" : "outline"} onClick={() => { setPurpose("practice"); setPage(1); setSelected(new Set()); setForm((current) => ({ ...current, bankPurpose: "practice" })); }}>Practice banks</Button>
        </div>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search bank name or slug" className="pl-9" /></div>
          <select aria-label="Filter banks by status" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setSelected(new Set()); }}><option value="current">Current banks</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option><option value="all">All statuses</option></select>
        </div>
        <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <Badge variant="secondary">{selected.size} selected</Badge>
          <Button size="sm" disabled={!selected.size || bulk.isPending} onClick={() => bulk.mutate("activate")}><CheckCircle2 className="mr-1 h-4 w-4" />Activate</Button>
          <Button size="sm" variant="outline" disabled={!selected.size || bulk.isPending} onClick={() => bulk.mutate("draft")}><EyeOff className="mr-1 h-4 w-4" />Move to draft</Button>
          <Button size="sm" variant="outline" disabled={!selected.size || bulk.isPending} onClick={() => bulk.mutate("archive")}><Archive className="mr-1 h-4 w-4" />Archive</Button>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? <div className="py-12 text-center text-sm text-slate-500">Loading question banks…</div> : query.isError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Question banks could not be loaded. <Button size="sm" variant="outline" className="ml-2" onClick={() => query.refetch()}>Retry</Button></div> : <>
          <div className="overflow-x-auto rounded-xl border border-slate-200"><Table><TableHeader><TableRow><TableHead className="w-10"><input aria-label="Select page" type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))} /></TableHead><TableHead>Bank</TableHead><TableHead>Classification</TableHead><TableHead>Approved inventory</TableHead><TableHead>Usage</TableHead><TableHead>State</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {items.map((bank) => <TableRow key={bank.id}>
              <TableCell><input aria-label={`Select ${bank.name}`} type="checkbox" checked={selected.has(bank.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(bank.id) ? next.delete(bank.id) : next.add(bank.id); return next; })} /></TableCell>
              <TableCell><div className="flex min-w-72 items-start gap-3"><div className="rounded-lg bg-slate-100 p-2"><Database className="h-4 w-4 text-slate-600" /></div><div><div className="font-semibold text-slate-950">{bank.name}</div><div className="text-xs text-slate-500">{bank.slug}</div><div className="mt-1 line-clamp-2 max-w-lg text-xs text-slate-500">{bank.description || "No description"}</div></div></div></TableCell>
              <TableCell><Badge variant="outline">{kindLabel(bank.bankKind)}</Badge><Badge variant="secondary" className="ml-1 capitalize">{bank.bankPurpose}</Badge><div className="mt-1 text-xs text-slate-600">{[bank.examFamily, bank.subject, bank.gradeBand].filter(Boolean).join(" · ") || "General"}</div>{bank.syllabusVersion && <div className="text-xs text-slate-500">{bank.syllabusVersion}</div>}</TableCell>
              <TableCell><div className="font-semibold text-slate-950">{Number(bank.questionCount).toLocaleString()}</div><div className="mt-1 flex flex-wrap gap-1 text-[11px]"><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">E {Number(bank.easyCount).toLocaleString()}</span><span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-800">M {Number(bank.mediumCount).toLocaleString()}</span><span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-800">H {Number(bank.hardCount).toLocaleString()}</span></div></TableCell>
              <TableCell><span className="font-semibold">{Number(bank.assessmentCount).toLocaleString()}</span><div className="text-xs text-slate-500">assessments</div><div className="text-xs text-slate-500">{Number(bank.topicCount).toLocaleString()} topics</div></TableCell>
              <TableCell><Badge variant={bank.status === "active" ? "default" : "secondary"} className="capitalize">{bank.status}</Badge><div className="mt-1 text-xs capitalize text-slate-500">{bank.visibility}</div></TableCell>
              <TableCell><div className="flex justify-end gap-1"><Button asChild size="sm" variant="outline"><Link href={`/admin/question-banks/${bank.id}`}><FolderCog className="mr-1 h-4 w-4" />Manage and review</Link></Button><Button size="icon" variant="ghost" aria-label={`Edit ${bank.name}`} onClick={() => openEdit(bank)}><Edit className="h-4 w-4" /></Button></div></TableCell>
            </TableRow>)}
            {!items.length && <TableRow><TableCell colSpan={7} className="py-12 text-center text-slate-500">No question banks match these filters.</TableCell></TableRow>}
          </TableBody></Table></div>
          {pagination && <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-slate-600"><span>{pagination.total.toLocaleString()} banks · Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
        </>}
      </CardContent>
    </Card>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Edit question bank" : "Create question bank"}</DialogTitle><DialogDescription>Give the pool a durable business identity. Questions inside it still carry their own topic and difficulty.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label htmlFor="bank-name">Name</Label><Input id="bank-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="SSC CGL Quantitative Aptitude — 2026" /></div>
      <div className="sm:col-span-2"><Label htmlFor="bank-description">Description</Label><Textarea id="bank-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Purpose, syllabus boundary, source policy, and intended assessments." /></div>
      <div><Label htmlFor="bank-purpose">Purpose</Label><select id="bank-purpose" className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.bankPurpose} onChange={(event) => setForm({ ...form, bankPurpose: event.target.value as BankItem["bankPurpose"] })}><option value="certification">Certification / recruiter evidence</option><option value="practice">Practice only</option></select></div>
      <div><Label htmlFor="bank-kind">Bank type</Label><select id="bank-kind" className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.bankKind} onChange={(event) => setForm({ ...form, bankKind: event.target.value as BankItem["bankKind"] })}><option value="assessment_pool">Assessment pool</option><option value="subject_pool">Subject pool</option><option value="master">Master source</option><option value="custom">Custom</option></select></div>
      <div><Label htmlFor="bank-status">Lifecycle</Label><select id="bank-status" className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BankItem["status"] })}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></div>
      <div><Label htmlFor="bank-exam-family">Exam family</Label><Input id="bank-exam-family" value={form.examFamily} onChange={(event) => setForm({ ...form, examFamily: event.target.value })} placeholder="SSC, NEET, JEE…" /></div>
      <div><Label htmlFor="bank-subject">Subject</Label><Input id="bank-subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Mathematics, Physics…" /></div>
      <div><Label htmlFor="bank-grade">Grade / learner band</Label><Input id="bank-grade" value={form.gradeBand} onChange={(event) => setForm({ ...form, gradeBand: event.target.value })} placeholder="Grade 8, competitive…" /></div>
      <div><Label htmlFor="bank-syllabus">Syllabus version</Label><Input id="bank-syllabus" value={form.syllabusVersion} onChange={(event) => setForm({ ...form, syllabusVersion: event.target.value })} placeholder="2026 v1" /></div>
      <div><Label htmlFor="bank-visibility">Visibility</Label><select id="bank-visibility" className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button disabled={save.isPending || form.name.trim().length < 3} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save bank"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
