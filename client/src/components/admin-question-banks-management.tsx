import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Database, Search } from "lucide-react";

interface BankPage {
  items: Array<{ id: number; name: string; slug: string; description?: string; ownerType: string; visibility: string; questionCount: number; topicCount: number; updatedAt: string }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function AdminQuestionBanksManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
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

  return <Card className="border-slate-200 shadow-sm">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><CardTitle>Question-bank library</CardTitle><CardDescription>Question banks contain reusable questions and topics. Assessments select from these banks through blueprints.</CardDescription></div>
        <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search bank name or slug" className="pl-9" /></div>
      </div>
    </CardHeader>
    <CardContent>
      {query.isLoading ? <div className="py-12 text-center text-sm text-slate-500">Loading question banks…</div> : query.isError ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Question banks could not be loaded. Please retry.</div> : <>
        <div className="overflow-x-auto rounded-lg border border-slate-200"><Table><TableHeader><TableRow><TableHead>Bank</TableHead><TableHead>Owner</TableHead><TableHead>Topics</TableHead><TableHead>Questions</TableHead><TableHead>Visibility</TableHead></TableRow></TableHeader><TableBody>
          {items.map((bank) => <TableRow key={bank.id}><TableCell><div className="flex items-start gap-3"><div className="rounded-lg bg-slate-100 p-2"><Database className="h-4 w-4 text-slate-600" /></div><div><div className="font-semibold text-slate-950">{bank.name}</div><div className="text-xs text-slate-500">{bank.slug}</div><div className="mt-1 max-w-xl text-xs text-slate-500">{bank.description}</div></div></div></TableCell><TableCell className="capitalize">{bank.ownerType}</TableCell><TableCell>{Number(bank.topicCount).toLocaleString()}</TableCell><TableCell className="font-semibold">{Number(bank.questionCount).toLocaleString()}</TableCell><TableCell><Badge variant={bank.visibility === "private" ? "secondary" : "default"} className="capitalize">{bank.visibility}</Badge></TableCell></TableRow>)}
          {!items.length && <TableRow><TableCell colSpan={5} className="py-12 text-center text-slate-500">No question banks match this search.</TableCell></TableRow>}
        </TableBody></Table></div>
        {pagination && <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-slate-600"><span>{pagination.total.toLocaleString()} banks · Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>}
      </>}
    </CardContent>
  </Card>;
}
