import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { ChevronLeft, Plus, Trash2, Save } from "lucide-react";
import type { CourseBlueprintItem, QuestionBank, QuestionTopic } from "@shared/schema";

interface BlueprintRow {
  id?: number;
  topicId: number;
  questionCount: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  marksPerQuestion: number;
  negativeMarks: number;
  sortOrder: number;
}

export default function BlueprintEditor() {
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<BlueprintRow[]>([]);
  const [bankId, setBankId] = useState<number | null>(null);

  const banksQuery = useQuery<QuestionBank[]>({
    queryKey: ["/api/question-banks"],
    queryFn: async () => (await apiRequest("GET", "/api/question-banks")).json(),
  });

  const topicsQuery = useQuery<QuestionTopic[]>({
    queryKey: [`/api/question-banks/${bankId}/topics`],
    queryFn: async () => (await apiRequest("GET", `/api/question-banks/${bankId}/topics`)).json(),
    enabled: !!bankId,
  });

  const blueprintQuery = useQuery<CourseBlueprintItem[]>({
    queryKey: [`/api/courses/${courseId}/blueprint`],
    queryFn: async () => (await apiRequest("GET", `/api/courses/${courseId}/blueprint`)).json(),
  });

  useEffect(() => {
    if (blueprintQuery.data) {
      setRows(
        blueprintQuery.data.map((r) => ({
          id: r.id,
          topicId: r.topicId,
          questionCount: r.questionCount,
          difficulty: r.difficulty as BlueprintRow["difficulty"],
          marksPerQuestion: r.marksPerQuestion,
          negativeMarks: r.negativeMarks,
          sortOrder: r.sortOrder,
        }))
      );
    }
  }, [blueprintQuery.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PUT", `/api/courses/${courseId}/blueprint`, {
        items: rows.map(({ id: _id, ...rest }) => rest),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/courses/${courseId}/blueprint`] });
      toast({ title: "Blueprint saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const totals = useMemo(() => {
    const totalQuestions = rows.reduce((a, r) => a + (r.questionCount || 0), 0);
    const totalMarks = rows.reduce((a, r) => a + (r.questionCount || 0) * (r.marksPerQuestion || 0), 0);
    return { totalQuestions, totalMarks };
  }, [rows]);

  const topicMap = new Map((topicsQuery.data ?? []).map((t) => [t.id, t.name]));

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/qwegle/dashboard"><Button size="sm" variant="ghost"><ChevronLeft className="w-4 h-4" /></Button></Link>
          <h1 className="text-2xl font-bold">Blueprint — Course #{courseId}</h1>
        </div>

        <Card className="mb-4">
          <CardContent className="p-4 space-y-3">
            <Label>Question bank</Label>
            <Select value={bankId ? String(bankId) : ""} onValueChange={(v) => setBankId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Select a bank to pick topics from" /></SelectTrigger>
              <SelectContent>
                {(banksQuery.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Topic distribution</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const t = topicsQuery.data?.[0];
                  if (!t) {
                    toast({ title: "Pick a bank with topics first", variant: "destructive" });
                    return;
                  }
                  setRows([...rows, { topicId: t.id, questionCount: 5, difficulty: "mixed", marksPerQuestion: 1, negativeMarks: 0, sortOrder: rows.length }]);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Add row
              </Button>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No rows yet. Pick a bank, then "Add row".</p>
            ) : (
              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 text-xs uppercase tracking-wide text-gray-500 px-2">
                  <div>Topic</div><div>Questions</div><div>Difficulty</div><div>Marks/Q</div><div>-Marks</div><div></div>
                </div>
                {rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-white border rounded p-2">
                    <Select value={String(row.topicId)} onValueChange={(v) => {
                      const next = [...rows]; next[i] = { ...next[i], topicId: Number(v) }; setRows(next);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(topicsQuery.data ?? []).map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                        ))}
                        {!topicMap.has(row.topicId) && (
                          <SelectItem value={String(row.topicId)}>Topic #{row.topicId}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Input type="number" min={1} value={row.questionCount} onChange={(e) => {
                      const next = [...rows]; next[i] = { ...next[i], questionCount: Number(e.target.value) }; setRows(next);
                    }} />
                    <Select value={row.difficulty} onValueChange={(v) => {
                      const next = [...rows]; next[i] = { ...next[i], difficulty: v as BlueprintRow["difficulty"] }; setRows(next);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mixed">Mixed</SelectItem>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" value={row.marksPerQuestion} onChange={(e) => {
                      const next = [...rows]; next[i] = { ...next[i], marksPerQuestion: Number(e.target.value) }; setRows(next);
                    }} />
                    <Input type="number" value={row.negativeMarks} onChange={(e) => {
                      const next = [...rows]; next[i] = { ...next[i], negativeMarks: Number(e.target.value) }; setRows(next);
                    }} />
                    <Button size="sm" variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t text-sm">
              <div className="text-gray-700">
                <span className="font-medium">Total questions: {totals.totalQuestions}</span>
                {" · "}
                <span className="font-medium">Total marks: {totals.totalMarks}</span>
                {" · "}
                <span>Estimated time: {Math.max(1, Math.round(totals.totalQuestions * 1.2))} min</span>
              </div>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                <Save className="w-4 h-4 mr-1" />
                {saveMut.isPending ? "Saving…" : "Save Blueprint"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
