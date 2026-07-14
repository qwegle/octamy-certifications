import { useState } from "react";
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
import { CheckCircle2, Database, Edit, EyeOff, Plus, Search, Trash2 } from "lucide-react";

interface BankPage {
  items: Array<{ id: number; name: string; slug: string; description?: string; ownerType: string; visibility: string; questionCount: number; topicCount: number; updatedAt: string }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function AdminQuestionBanksManagement() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankPage["items"][number] | null>(null);
  const [form, setForm] = useState({ name: "", description: "", visibility: "private" });
  const query = useQuery<BankPage>({
    queryKey: ["/api/admin/question-banks", page, search],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/question-banks?page=${page}&pageSize=25&search=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error("Question banks could not be loaded");
      return response.json();
    },
  });
  const items = query.data?.items ?? [];
  const pagination = query.data?.pagination;
  const save = useMutation({ mutationFn: async () => editing ? (await apiRequest("PATCH", `/api/admin/question-banks/${editing.id}`, form)).json() : (await apiRequest("POST", "/api/admin/question-banks", form)).json(), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["/api/admin/question-banks"] }); setDialogOpen(false); toast({ title: editing ? "Question bank updated" : "Question bank created" }); }, onError: (error: Error) => toast({ title: "Bank could not be saved", description: error.message, variant: "destructive" }) });
  const review = useMutation({ mutationFn: async ({ id, action }: { id: number; action: "approve" | "deactivate" }) => { if (!window.confirm(action === "approve" ? "Approve and activate every pending, rights-verified question in this bank?" : "Deactivate all active questions in this bank?")) throw new Error("Cancelled"); return (await apiRequest("POST", `/api/admin/question-banks/${id}/bulk-review`, { action, confirmation: action === "approve" ? "APPROVE" : "DEACTIVATE" })).json(); }, onSuccess: async (result) => { await queryClient.invalidateQueries({ queryKey: ["/api/admin/question-banks"] }); toast({ title: "Question inventory updated", description: `${result.affected.toLocaleString()} questions changed.` }); }, onError: (error: Error) => { if (error.message !== "Cancelled") toast({ title: "Bulk review failed", description: error.message, variant: "destructive" }); } });
  const remove = useMutation({ mutationFn: async (id: number) => { if (!window.confirm("Delete this empty question bank? Imported banks retain provenance and cannot be deleted.")) throw new Error("Cancelled"); return (await apiRequest("DELETE", `/api/admin/question-banks/${id}`)).json(); }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["/api/admin/question-banks"] }); toast({ title: "Question bank deleted" }); }, onError: (error: Error) => { if (error.message !== "Cancelled") toast({ title: "Bank could not be deleted", description: error.message, variant: "destructive" }); } });
  const openCreate = () => { setEditing(null); setForm({ name: "", description: "", visibility: "private" }); setDialogOpen(true); };
  const openEdit = (bank: BankPage["items"][number]) => { setEditing(bank); setForm({ name: bank.name, description: bank.description || "", visibility: bank.visibility }); setDialogOpen(true); };

  return <Card className="border-slate-200 shadow-sm">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><CardTitle>Question-bank library</CardTitle><CardDescription>A 100,000-question bank is a reusable source pool. An assessment only draws the smaller number configured in its blueprint.</CardDescription></div>
        <div className="flex w-full gap-2 sm:w-auto"><div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search bank name or slug" className="pl-9" /></div><Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" />New bank</Button></div>
      </div>
    </CardHeader>
    <CardContent>
      {query.isLoading ? <div className="py-12 text-center text-sm text-slate-500">Loading question banks…</div> : query.isError ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Question banks could not be loaded. Please retry.</div> : <>
        <div className="overflow-x-auto rounded-lg border border-slate-200"><Table><TableHeader><TableRow><TableHead>Bank</TableHead><TableHead>Owner</TableHead><TableHead>Topics</TableHead><TableHead>Source pool</TableHead><TableHead>Visibility</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
          {items.map((bank) => <TableRow key={bank.id}><TableCell><div className="flex items-start gap-3"><div className="rounded-lg bg-slate-100 p-2"><Database className="h-4 w-4 text-slate-600" /></div><div><div className="font-semibold text-slate-950">{bank.name}</div><div className="text-xs text-slate-500">{bank.slug}</div><div className="mt-1 max-w-xl text-xs text-slate-500">{bank.description}</div></div></div></TableCell><TableCell className="capitalize">{bank.ownerType}</TableCell><TableCell>{Number(bank.topicCount).toLocaleString()}</TableCell><TableCell><span className="font-semibold">{Number(bank.questionCount).toLocaleString()}</span><div className="text-xs text-slate-500">available inventory</div></TableCell><TableCell><Badge variant={bank.visibility === "private" ? "secondary" : "default"} className="capitalize">{bank.visibility}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => openEdit(bank)}><Edit className="h-4 w-4" /></Button><Button size="sm" variant="outline" title="Approve pending questions" disabled={review.isPending} onClick={() => review.mutate({ id: bank.id, action: "approve" })}><CheckCircle2 className="h-4 w-4 text-emerald-700" /></Button><Button size="sm" variant="outline" title="Deactivate questions" disabled={review.isPending} onClick={() => review.mutate({ id: bank.id, action: "deactivate" })}><EyeOff className="h-4 w-4" /></Button><Button size="sm" variant="outline" title="Delete empty bank" disabled={remove.isPending} onClick={() => remove.mutate(bank.id)}><Trash2 className="h-4 w-4 text-red-700" /></Button></div></TableCell></TableRow>)}
          {!items.length && <TableRow><TableCell colSpan={6} className="py-12 text-center text-slate-500">No question banks match this search.</TableCell></TableRow>}
        </TableBody></Table></div>
        {pagination && <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-slate-600"><span>{pagination.total.toLocaleString()} banks · Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
      </>}
    </CardContent>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Edit question bank" : "Create question bank"}</DialogTitle><DialogDescription>Banks organize reusable questions. Assign topics from an assessment blueprint after creation.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Name</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div><Label>Description</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><div><Label>Visibility</Label><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button disabled={save.isPending || form.name.length < 3} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save bank"}</Button></DialogFooter></DialogContent></Dialog>
  </Card>;
}
