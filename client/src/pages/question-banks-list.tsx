import { useEffect, useState } from "react";
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
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/dashboard-layout";
import { useDashboardRole } from "@/lib/use-dashboard-role";
import {
  Plus,
  Database,
  Lock,
  Globe,
  EyeOff,
  Building2,
  User,
  Shield,
  AlertCircle,
  SearchX,
} from "lucide-react";
import type { QuestionBank } from "@shared/schema";

interface RolesResponse {
  isAdmin: boolean;
  isCreator: boolean;
  isInstituteMember: boolean;
}

export default function QuestionBanksList() {
  const { token, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const detectedRole = useDashboardRole();
  const role = location.startsWith("/institute/")
    ? "institute"
    : location.startsWith("/creator/")
      ? "creator"
      : detectedRole;
  const bankBase = role === "institute"
    ? "/institute/question-banks"
    : role === "creator"
      ? "/creator/question-banks"
      : "/question-banks";
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !token) setLocation("/login");
  }, [isLoading, token, setLocation]);

  const banksQuery = useQuery<QuestionBank[]>({
    queryKey: ["/api/question-banks", search],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/question-banks${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Failed to load question banks");
      return r.json();
    },
    enabled: !!token,
  });

  const rolesQuery = useQuery<RolesResponse>({
    queryKey: ["/api/me/roles"],
    queryFn: async () => (await apiRequest("GET", "/api/me/roles")).json(),
    enabled: !!token,
  });

  const instituteQuery = useQuery<{ id: number }>({
    queryKey: ["/api/me/institute"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/me/institute");
      if (!response.ok) throw new Error("Institute workspace unavailable");
      return response.json();
    },
    enabled: !!token && role === "institute",
    retry: false,
  });

  const creatorQuery = useQuery<{ id: number }>({
    queryKey: ["/api/me/creator"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/me/creator");
      if (!response.ok) throw new Error("Creator workspace unavailable");
      return response.json();
    },
    enabled: !!token && role === "creator",
    retry: false,
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    visibility: "private" as "private" | "unlisted" | "public",
  });
  const createMut = useMutation({
    mutationFn: async () => {
      const owner = role === "institute"
        ? { ownerType: "institute", ownerId: instituteQuery.data?.id }
        : role === "creator"
          ? { ownerType: "creator", ownerId: creatorQuery.data?.id }
          : {};
      if ((role === "institute" || role === "creator") && !owner.ownerId) {
        throw new Error("Workspace is still loading. Please try again.");
      }
      const r = await apiRequest("POST", "/api/question-banks", { ...form, ...owner });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: (data: QuestionBank) => {
      qc.invalidateQueries({ queryKey: ["/api/question-banks"] });
      setCreateOpen(false);
      setForm({ name: "", description: "", visibility: "private" });
      toast({ title: "Bank created", description: data.name });
      setLocation(`${bankBase}/${data.id}`);
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
            id="question-bank-search"
            type="search"
            aria-label="Search question banks"
            placeholder="Search banks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64"
          />
          <Button onClick={() => setCreateOpen(true)} className="w-full shrink-0 sm:w-auto">
            <Plus className="w-4 h-4 mr-1" /> Create bank
          </Button>
        </>
      }
    >
        {banksQuery.isError ? (
          <Card role="alert" aria-live="assertive">
            <CardContent className="p-8 text-center sm:p-12">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-600" aria-hidden="true" />
              <h2 className="font-semibold text-slate-900">Question banks could not be loaded</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                {banksQuery.error instanceof Error
                  ? banksQuery.error.message
                  : "Check your connection and try again."}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => banksQuery.refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : banksQuery.isLoading ? (
          <Card role="status" aria-live="polite" aria-label="Loading question banks">
            <CardContent className="p-8 text-center text-sm text-slate-600 sm:p-12">
              <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" aria-hidden="true" />
              Loading question banks…
            </CardContent>
          </Card>
        ) : banksQuery.data && banksQuery.data.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {banksQuery.data.map((bank) => (
              <Link
                key={bank.id}
                href={`${bankBase}/${bank.id}`}
                aria-label={`Open ${bank.name}, ${bank.questionCount} ${bank.questionCount === 1 ? "question" : "questions"}`}
                className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
              >
                <Card className="h-full cursor-pointer transition-colors hover:border-slate-400 hover:bg-slate-50">
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
                      <span>{bank.questionCount} {bank.questionCount === 1 ? "question" : "questions"}</span>
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
            <CardContent className="p-8 text-center sm:p-12">
              {search ? (
                <SearchX className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
              ) : (
                <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
              )}
              <h2 className="font-semibold mb-1 text-slate-900">
                {search ? "No matching question banks" : "No question banks yet"}
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                {search
                  ? `Nothing matched “${search}”. Try a broader search or clear the filter.`
                  : "Create your first bank to start building a reusable pool of questions."}
              </p>
              {search ? (
                <Button variant="outline" onClick={() => setSearch("")}>Clear search</Button>
              ) : (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Create bank
                </Button>
              )}
            </CardContent>
          </Card>
        )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Question Bank</DialogTitle>
            <DialogDescription>Create a reusable, workspace-owned pool of assessment questions.</DialogDescription>
          </DialogHeader>
          <form
            id="create-question-bank-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (form.name.trim()) createMut.mutate();
            }}
          >
            <div>
              <Label htmlFor="question-bank-name">Name</Label>
              <Input
                id="question-bank-name"
                name="name"
                required
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Algebra Fundamentals"
              />
            </div>
            <div>
              <Label htmlFor="question-bank-description">Description (optional)</Label>
              <Textarea
                id="question-bank-description"
                name="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="question-bank-visibility">Visibility</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) =>
                  setForm({ ...form, visibility: v as typeof form.visibility })
                }
              >
                <SelectTrigger id="question-bank-visibility" aria-describedby="question-bank-visibility-help">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private — only editors</SelectItem>
                  <SelectItem value="unlisted">Unlisted — anyone with link</SelectItem>
                  <SelectItem value="public">Public — discoverable</SelectItem>
                </SelectContent>
              </Select>
              <p id="question-bank-visibility-help" className="mt-1.5 text-xs text-slate-500">
                You can change who can discover this bank later.
              </p>
            </div>
            {rolesQuery.data && !rolesQuery.data.isAdmin && !rolesQuery.data.isCreator && !rolesQuery.data.isInstituteMember && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                You need a creator or institute profile to create banks. Onboard first from your dashboard.
              </p>
            )}
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              form="create-question-bank-form"
              disabled={!form.name.trim() || createMut.isPending || (role === "institute" && !instituteQuery.data?.id) || (role === "creator" && !creatorQuery.data?.id)}
            >
              {createMut.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
