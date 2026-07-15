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
import { AlertTriangle, CheckCircle2, Edit, Link2, Plus, Search, Trash2, EyeOff } from "lucide-react";

type AssessmentPurpose = "certification" | "practice";
type Assessment = {
  id: number;
  title: string;
  slug: string;
  description?: string;
  duration?: number;
  passingScore?: number;
  assessmentPurpose: AssessmentPurpose;
  isActive: boolean;
  visibility: string;
  reviewStatus: string;
  questionCount: number;
  approvedQuestionInventory: number;
  requiredQuestionInventory: number;
  bankCount: number;
  bankNames: string[];
  difficultyRules: string[];
  category?: { id: number; name: string; slug: string };
};
type AssessmentPage = { items: Assessment[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type Category = { id: number; name: string; slug?: string; isActive?: boolean };

const blankForm = { title: "", description: "", categoryId: "", duration: "30", passingScore: "60", visibility: "private" };

export function AdminAssessmentsManagement() {
  const { toast } = useToast();
  const [purpose, setPurpose] = useState<AssessmentPurpose>("certification");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);

  const query = useQuery<AssessmentPage>({
    queryKey: ["/api/admin/assessments", purpose, page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ purpose, page: String(page), pageSize: "25", search });
      return (await apiRequest("GET", `/api/admin/assessments?${params}`)).json();
    },
  });
  const categoriesQuery = useQuery<Category[]>({ queryKey: ["/api/admin/categories"], queryFn: async () => (await apiRequest("GET", "/api/admin/categories")).json() });
  const items = query.data?.items ?? [];
  const pagination = query.data?.pagination;
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const selectedLabel = useMemo(() => `${selected.size} selected`, [selected.size]);
  const purposeLabel = purpose === "certification" ? "career certification" : "practice exam";

  const save = useMutation({
    mutationFn: async () => {
      const common = {
        title: form.title,
        description: form.description,
        categoryId: Number(form.categoryId),
        duration: Number(form.duration),
        passingScore: Number(form.passingScore),
        visibility: form.visibility,
        assessmentPurpose: purpose,
        certificationMode: purpose === "practice" ? "none" : "octamy",
        subscriptionEligible: purpose === "practice",
      };
      if (editing) return (await apiRequest("PUT", `/api/admin/courses/${editing.id}`, common)).json();
      return (await apiRequest("POST", "/api/admin/courses", {
        ...common,
        productType: "assessment",
        price: purpose === "practice" ? 0 : 99,
        contentPrice: null,
        originalPrice: null,
        isOnSale: false,
        level: "novice",
        isActive: false,
        isInternship: false,
        language: "en",
        defaultReviewPolicy: "immediate",
        resellerEligible: false,
        thumbnailUrl: null,
        useBlueprintEngine: true,
      })).json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/assessments"] });
      setFormOpen(false);
      setEditing(null);
      setForm(blankForm);
      toast({ title: editing ? "Assessment updated" : "Assessment created", description: "Assign its question blueprint before publishing." });
    },
    onError: (error: Error) => toast({ title: "Assessment could not be saved", description: error.message, variant: "destructive" }),
  });

  const bulk = useMutation({
    mutationFn: async (action: "publish" | "unpublish" | "delete") => {
      if (!selected.size) throw new Error("Select at least one assessment");
      if (action === "delete" && !window.confirm(`Permanently delete ${selected.size} selected assessment(s)?`)) throw new Error("Deletion cancelled");
      return (await apiRequest("POST", "/api/admin/assessments/bulk-action", { ids: Array.from(selected), action, ...(action === "delete" ? { confirmation: "DELETE" } : {}) })).json();
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/assessments"] });
      setSelected(new Set());
      toast({ title: "Assessments updated", description: `${result.affected} assessment(s) changed${result.skipped ? `; ${result.skipped} skipped because they have no complete blueprint` : ""}.` });
    },
    onError: (error: Error) => { if (error.message !== "Deletion cancelled") toast({ title: "Bulk action failed", description: error.message, variant: "destructive" }); },
  });

  const switchPurpose = (next: AssessmentPurpose) => {
    setPurpose(next);
    setPage(1);
    setSelected(new Set());
  };
  const openCreate = () => { setEditing(null); setForm(blankForm); setFormOpen(true); };
  const openEdit = (item: Assessment) => {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description || "Assessment description",
      categoryId: String(item.category?.id || ""),
      duration: String(item.duration || 30),
      passingScore: String(item.passingScore || 60),
      visibility: item.visibility || "private",
    });
    setFormOpen(true);
  };

  return <Card className="border-slate-200 shadow-sm">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Assessment catalogue</CardTitle>
          <CardDescription>Career certifications are recruiter-relevant credentials. Practice exams are subscription-only preparation and do not appear in recruiter evidence.</CardDescription>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New {purpose === "certification" ? "certification" : "practice exam"}</Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={purpose === "certification" ? "default" : "outline"} onClick={() => switchPurpose("certification")}>Career certifications</Button>
        <Button size="sm" variant={purpose === "practice" ? "default" : "outline"} onClick={() => switchPurpose("practice")}>Practice exams</Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder={`Search ${purposeLabel}s`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <Badge variant="secondary">{selectedLabel}</Badge>
        <Button size="sm" disabled={!selected.size || bulk.isPending} onClick={() => bulk.mutate("publish")}><CheckCircle2 className="mr-1 h-4 w-4" />Publish</Button>
        <Button size="sm" variant="outline" disabled={!selected.size || bulk.isPending} onClick={() => bulk.mutate("unpublish")}><EyeOff className="mr-1 h-4 w-4" />Unpublish</Button>
        <Button size="sm" variant="outline" className="text-red-700" disabled={!selected.size || bulk.isPending} onClick={() => bulk.mutate("delete")}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
      </div>
    </CardHeader>
    <CardContent>
      {query.isLoading ? <p className="py-12 text-center text-sm text-slate-500">Loading assessments…</p> : query.isError ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Assessments could not be loaded. <Button size="sm" variant="outline" className="ml-2" onClick={() => query.refetch()}>Retry</Button></div> : <>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead className="w-10"><input aria-label="Select page" type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))} /></TableHead><TableHead>Assessment</TableHead><TableHead>Category</TableHead><TableHead>Bank readiness</TableHead><TableHead>State</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((item) => <TableRow key={item.id}>
                <TableCell><input aria-label={`Select ${item.title}`} type="checkbox" checked={selected.has(item.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })} /></TableCell>
                <TableCell><div className="font-semibold">{item.title}</div><div className="text-xs text-slate-500">/{item.slug}</div><Badge variant="outline" className="mt-1 capitalize">{item.assessmentPurpose}</Badge></TableCell>
                <TableCell>{item.category?.name || "Uncategorised"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2"><span className="font-semibold">{Number(item.approvedQuestionInventory || 0).toLocaleString()}</span><span className="text-xs text-slate-500">approved</span></div>
                  <div className="text-xs text-slate-500">Draw {Number(item.questionCount || 0).toLocaleString()} · {item.bankCount || 0} bank(s)</div>
                  {Number(item.approvedQuestionInventory || 0) >= Number(item.requiredQuestionInventory || 0)
                    ? <Badge className="mt-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Ready</Badge>
                    : <Badge variant="outline" className="mt-1 border-amber-300 bg-amber-50 text-amber-800"><AlertTriangle className="mr-1 h-3 w-3" />Needs {Number(item.requiredQuestionInventory || 0).toLocaleString()}+</Badge>}
                </TableCell>
                <TableCell><Badge variant={item.isActive && item.visibility === "public" && item.reviewStatus === "approved" ? "default" : "secondary"}>{item.isActive ? "Published" : `${item.reviewStatus} · ${item.visibility}`}</Badge></TableCell>
                <TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(item)}><Edit className="mr-1 h-4 w-4" />Edit</Button><Button asChild size="sm" variant="outline"><Link href={`/admin/courses/${item.id}/blueprint`}><Link2 className="mr-1 h-4 w-4" />Assign questions</Link></Button></div></TableCell>
              </TableRow>)}
              {!items.length && <TableRow><TableCell colSpan={6} className="py-12 text-center text-slate-500">No {purposeLabel}s found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        {pagination && <div className="flex items-center justify-between pt-4 text-sm text-slate-600"><span>{pagination.total.toLocaleString()} {purposeLabel}s · Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
      </>}
    </CardContent>
    <Dialog open={formOpen} onOpenChange={setFormOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Edit assessment" : `Create ${purposeLabel}`}</DialogTitle><DialogDescription>Save the exam definition, then assign its question blueprint before publishing.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
          <div><Label>Category</Label><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Select category</option>{categoriesQuery.data?.filter((item) => item.isActive !== false).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          <div><Label>Visibility</Label><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></div>
          <div><Label>Duration (minutes)</Label><Input type="number" min="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></div>
          <div><Label>Passing score (%)</Label><Input type="number" min="1" max="100" value={form.passingScore} onChange={(event) => setForm({ ...form, passingScore: event.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button disabled={save.isPending || !form.title || form.description.length < 10 || !form.categoryId} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save assessment"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>;
}
