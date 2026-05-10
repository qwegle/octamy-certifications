import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/dashboard-layout";
import { useDashboardRole } from "@/lib/use-dashboard-role";
import { Plus, Database, Lock, Globe, EyeOff, Building2, User, Shield } from "lucide-react";
import type { QuestionBank } from "@shared/schema";

interface RolesResponse {
  isAdmin: boolean;
  isCreator: boolean;
  isInstituteMember: boolean;
}

export default function QuestionBanksList() {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const role = useDashboardRole();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  if (!isLoading && !token) {
    setLocation("/login");
  }

  const banksQuery = useQuery<QuestionBank[]>({
    queryKey: ["/api/question-banks", search],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/question-banks${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      return r.json();
    },
    enabled: !!token,
  });

  const rolesQuery = useQuery<RolesResponse>({
    queryKey: ["/api/me/roles"],
    queryFn: async () => (await apiRequest("GET", "/api/me/roles")).json(),
    enabled: !!token,
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    visibility: "private" as "private" | "unlisted" | "public",
  });
  const createMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/question-banks", form);
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: (data: QuestionBank) => {
      qc.invalidateQueries({ queryKey: ["/api/question-banks"] });
      setCreateOpen(false);
      setForm({ name: "", description: "", visibility: "private" });
      toast({ title: "Bank created", description: data.name });
      setLocation(`/question-banks/${data.id}`);
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const ownerBadge = (bank: QuestionBank) => {
    const map: Record<string, { label: string; icon: any; className: string }> = {
      admin: { label: "Admin", icon: Shield, className: "bg-purple-100 text-purple-700" },
      creator: { label: "Creator", icon: User, className: "bg-blue-100 text-blue-700" },
      institute: { label: "Institute", icon: Building2, className: "bg-emerald-100 text-emerald-700" },
    };
    const m = map[bank.ownerType] || map.admin;
    const Icon = m.icon;
    return (
      <Badge className={`${m.className} font-medium`} variant="secondary">
        <Icon className="w-3 h-3 mr-1" />
        {m.label}
      </Badge>
    );
  };

  const visIcon = (v: string) => {
    if (v === "public") return <Globe className="w-3.5 h-3.5" />;
    if (v === "unlisted") return <EyeOff className="w-3.5 h-3.5" />;
    return <Lock className="w-3.5 h-3.5" />;
  };

  return (
    <DashboardLayout
      role={role}
      title="Question banks"
      description="Reusable pools of questions for your courses, exams, and skill verifications."
      breadcrumbs={[{ label: "Question banks" }]}
      actions={
        <>
          <Input
            placeholder="Search banks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64"
          />
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="w-4 h-4 mr-1" /> Create bank
          </Button>
        </>
      }
    >
        {banksQuery.isLoading ? (
          <div className="text-center py-12 text-slate-500">Loading banks…</div>
        ) : banksQuery.data && banksQuery.data.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {banksQuery.data.map((bank) => (
              <Link key={bank.id} href={`/question-banks/${bank.id}`}>
                <Card className="hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,0.9)] transition-all cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      {ownerBadge(bank)}
                      <span className="text-slate-400 flex items-center gap-1 text-xs uppercase tracking-wide">
                        {visIcon(bank.visibility)}
                        {bank.visibility}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg mb-1 line-clamp-1 text-slate-900">{bank.name}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2 min-h-[2.5rem]">
                      {bank.description || "No description"}
                    </p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-cream-deep text-xs text-slate-500">
                      <span>{bank.questionCount} questions</span>
                      <span>
                        Updated{" "}
                        {bank.updatedAt
                          ? new Date(bank.updatedAt).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold mb-1 text-slate-900">No question banks yet</h3>
              <p className="text-sm text-slate-600 mb-4">
                Create your first bank to start building a reusable pool of questions.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Create bank
              </Button>
            </CardContent>
          </Card>
        )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Question Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Algebra Fundamentals"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Visibility</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) =>
                  setForm({ ...form, visibility: v as typeof form.visibility })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private — only editors</SelectItem>
                  <SelectItem value="unlisted">Unlisted — anyone with link</SelectItem>
                  <SelectItem value="public">Public — discoverable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {rolesQuery.data && !rolesQuery.data.isAdmin && !rolesQuery.data.isCreator && !rolesQuery.data.isInstituteMember && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                You need a creator or institute profile to create banks. Onboard first from your dashboard.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!form.name || createMut.isPending}
            >
              {createMut.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
