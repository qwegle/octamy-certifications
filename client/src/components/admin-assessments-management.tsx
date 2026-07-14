import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminAssessmentsManagement() {
  const [page, setPage] = useState(1); const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/assessments", page, search], queryFn: async () => (await apiRequest("GET", `/api/admin/assessments?page=${page}&pageSize=25&search=${encodeURIComponent(search)}`)).json() });
  const items = data?.items || []; const pagination = data?.pagination;
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>In-house assessments</CardTitle><CardDescription>Review every exam shell, category, slug, and publication state.</CardDescription></div><Input className="w-64" placeholder="Search exams…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div></CardHeader><CardContent>{isLoading ? <p className="py-8 text-center">Loading assessments…</p> : <><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Assessment</TableHead><TableHead>Category</TableHead><TableHead>Questions</TableHead><TableHead>State</TableHead></TableRow></TableHeader><TableBody>{items.map((item: any) => <TableRow key={item.id}><TableCell><div className="font-medium">{item.title}</div><div className="text-xs text-muted-foreground">/{item.slug}</div></TableCell><TableCell>{item.category?.name || "Uncategorised"}</TableCell><TableCell>{Number(item.questionCount || 0).toLocaleString()}</TableCell><TableCell><Badge variant={item.isActive && item.visibility === "public" && item.reviewStatus === "approved" ? "default" : "secondary"}>{item.isActive && item.visibility === "public" && item.reviewStatus === "approved" ? "Published" : `${item.reviewStatus || "draft"} · ${item.visibility || "private"}`}</Badge></TableCell></TableRow>)}{!items.length && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No assessments found.</TableCell></TableRow>}</TableBody></Table></div>{pagination && <div className="flex items-center justify-between border-t px-2 py-3 text-sm"><span>{pagination.total.toLocaleString()} assessments · Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div></div>}</>}</CardContent></Card>;
}
