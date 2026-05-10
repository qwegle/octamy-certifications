import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { Plus, Copy, Calendar, Clock, ShieldCheck, Pencil, Trash2, ExternalLink, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

type Institute = { id: number; name: string; status: string };
type Instance = {
  id: number;
  title: string;
  shareCode: string;
  shareUrl: string;
  durationMin: number;
  passingScore: number;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
};

export default function InstituteExams() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<Instance | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data: institute } = useQuery<Institute>({
    queryKey: ["/api/me/institute"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/me/institute")).json(),
  });

  const { data: instances = [], isLoading } = useQuery<Instance[]>({
    queryKey: ["/api/exam-instances", institute?.id],
    enabled: !!institute?.id,
    queryFn: async () =>
      (await apiRequest("GET", `/api/exam-instances?ownerType=institute&ownerId=${institute!.id}`)).json(),
  });

  const closeM = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("PATCH", `/api/exam-instances/${id}`, { status: "closed" });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-instances"] });
      toast({ title: "Exam closed" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const reopenM = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("PATCH", `/api/exam-instances/${id}`, { status: "live" });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-instances"] });
      toast({ title: "Exam reopened" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteM = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("DELETE", `/api/exam-instances/${id}`);
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.message || "Failed");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-instances"] });
      toast({ title: "Exam deleted" });
      setConfirmDelete(null);
    },
    onError: (e: any) => toast({ title: "Cannot delete", description: e.message, variant: "destructive" }),
  });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout
      role="institute"
      title="Exams"
      description="Create and manage cohort exams. Each exam has a unique share link."
      breadcrumbs={[{ label: "Institute", href: "/institute/dashboard" }, { label: "Exams" }]}
      actions={
        <Button onClick={() => setLocation("/institute/exams/new")} className="bg-slate-900 text-white">
          <Plus className="w-4 h-4 mr-2" /> Create exam
        </Button>
      }
    >
      <SEO title="Exams · Institute" description="Create and manage cohort exams." path="/institute/exams" />

      {institute?.status !== "verified" && (
        <Card className="border-amber-200 bg-amber-50 mb-4">
          <CardContent className="pt-4 text-sm text-amber-900">
            Your institute is still <strong>{institute?.status || "unverified"}</strong>. Some features may be limited until an admin approves your institute.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-slate-500">Loading exams…</div>
      ) : instances.length === 0 ? (
        <Card className="border-dashed border-cream-deep">
          <CardContent className="py-12 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto text-slate-400 mb-3" />
            <h3 className="text-lg font-medium text-slate-900">No exams yet</h3>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              Create your first exam, share the link with a cohort, and we'll auto-collect attempts and pass/fail results.
            </p>
            <Button onClick={() => setLocation("/institute/exams/new")} className="mt-4 bg-slate-900 text-white">
              <Plus className="w-4 h-4 mr-2" /> Create exam
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {instances.map((x) => (
            <Card key={x.id} className="border-cream-deep hover:border-slate-300 transition-colors">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-slate-900 truncate">{x.title}</h3>
                    <Badge
                      variant="outline"
                      className={`text-xs uppercase ${
                        x.status === "live"
                          ? "border-green-300 text-green-700 bg-green-50"
                          : x.status === "closed"
                          ? "border-slate-300 text-slate-600 bg-slate-50"
                          : "border-amber-300 text-amber-700 bg-amber-50"
                      }`}
                    >
                      {x.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1.5">
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {x.durationMin} min</span>
                    <span>Pass ≥ {x.passingScore}%</span>
                    {x.startsAt ? <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(x.startsAt).toLocaleString()}</span> : null}
                    <code className="px-1.5 py-0.5 bg-cream-deep rounded text-[11px]">/x/{x.shareCode}</code>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => copy(x.shareUrl)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy link
                  </Button>
                  <Link href={`/x/${x.shareCode}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Preview
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="px-2">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLocation(`/institute/exams/${x.id}/edit`)}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      {x.status === "live" ? (
                        <DropdownMenuItem onClick={() => closeM.mutate(x.id)}>
                          <ShieldCheck className="w-4 h-4 mr-2" /> Close exam
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => reopenM.mutate(x.id)}>
                          <ShieldCheck className="w-4 h-4 mr-2" /> Reopen exam
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setConfirmDelete(x)} className="text-red-600 focus:text-red-700">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete exam?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" will be permanently removed. This cannot be undone. Exams with submitted attempts cannot be deleted — close them instead to preserve student records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteM.mutate(confirmDelete.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteM.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
