import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { Plus, Copy, Calendar, Clock, ShieldCheck, Pencil, Trash2, ExternalLink, MoreVertical, BarChart3, AlertCircle, RefreshCw, Mail, RotateCw, Users } from "lucide-react";
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
  proctorMode: "standard" | "browser_evidence";
  accessMode: "public_link" | "cohort_invite";
  cohortId: number | null;
  cohortName: string | null;
  fundingActive: boolean;
  candidateCharge: false;
  invitationSummary: { total: number; delivered: number; failed: number; started: number };
};

export default function InstituteExams() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<Instance | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const {
    data: institute,
    isLoading: instituteLoading,
    error: instituteError,
    refetch: refetchInstitute,
  } = useQuery<Institute>({
    queryKey: ["/api/me/institute"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/me/institute")).json(),
  });

  const {
    data: instances = [],
    isLoading,
    error: instancesError,
    refetch: refetchInstances,
  } = useQuery<Instance[]>({
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

  const invitationM = useMutation({
    mutationFn: async ({ id, mode }: { id: number; mode: "unsent" | "failed" | "all" }) => {
      const response = await apiRequest("POST", `/api/exam-instances/${id}/invitations/send`, { mode, limit: 50 });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exam-instances"] });
      toast({
        title: data.failed ? "Invitation batch completed with delivery issues" : "Invitations updated",
        description: `${data.message}${data.hasMore ? " Send the next batch to continue." : ""}`,
      });
    },
    onError: (error: any) => toast({
      title: "Invitations were not sent",
      description: error.message,
      variant: "destructive",
    }),
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

      {institute && institute.status !== "verified" && (
        <Card className="border-slate-200 bg-slate-50 mb-4">
          <CardContent className="p-4 text-sm text-slate-900">
            Your institute is still <strong>{institute?.status || "unverified"}</strong>. Some features may be limited until an admin approves your institute.
          </CardContent>
        </Card>
      )}

      {instances.some((instance) => !instance.fundingActive) && (
        <Card className="mb-4 border-slate-200 bg-slate-50/70">
          <CardContent className="p-4 text-sm text-slate-950">
            Institute assessments are funded by the workspace and candidates are never charged. Drafts remain editable, but publishing, invitation delivery and candidate access stay locked until an active institute subscription is verified.
          </CardContent>
        </Card>
      )}

      {instituteError || instancesError ? (
        <Card className="border-slate-200 bg-slate-50/60">
          <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-slate-900">We couldn't load your exams</h2>
                <p className="mt-1 text-sm text-slate-600">Check your connection and try again. Your existing exam data is safe.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                void refetchInstitute();
                void refetchInstances();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : isLoading || instituteLoading ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading exams">
          {[0, 1, 2].map((item) => (
            <Card key={item}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-48 max-w-[60%]" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full max-w-xl" />
                <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                  <Skeleton className="h-11 w-full sm:w-24" />
                  <Skeleton className="h-11 w-full sm:w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : instances.length === 0 ? (
        <Card className="border-dashed border-slate-300 bg-white/70">
          <CardContent className="py-12 text-center">
            <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-600">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold text-slate-900">Create your first verified assessment</h2>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              Create your first exam, share the link with a cohort, and we'll auto-collect attempts and pass/fail results.
            </p>
            <Button onClick={() => setLocation("/institute/exams/new")} className="mt-5 w-full bg-slate-900 text-white sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Create exam
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {instances.map((x) => (
            <Card key={x.id} className="transition-colors hover:border-slate-300">
              <CardContent className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="min-w-0 truncate font-semibold text-slate-900">{x.title}</h2>
                    <Badge
                      variant="outline"
                      className={`text-xs uppercase ${
                        x.status === "live"
                          ? "border-slate-300 text-slate-700 bg-slate-50"
                          : x.status === "closed"
                          ? "border-slate-300 text-slate-600 bg-slate-50"
                          : "border-slate-300 text-slate-700 bg-slate-50"
                      }`}
                    >
                      {x.status}
                    </Badge>
                    {x.proctorMode === "browser_evidence" && (
                      <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-700">
                        Browser evidence
                      </Badge>
                    )}
                    {x.accessMode === "cohort_invite" && (
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-xs text-slate-700">
                        Private cohort
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {x.durationMin} min</span>
                    <span>Pass score: {x.passingScore}%</span>
                    {x.startsAt ? <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" aria-hidden="true" /> {new Date(x.startsAt).toLocaleString()}</span> : null}
                    {x.cohortName ? <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" /> {x.cohortName}</span> : null}
                    {x.accessMode === "public_link" ? (
                      <code className="max-w-full truncate rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">/x/{x.shareCode}</code>
                    ) : (
                      <span>{x.invitationSummary.delivered} delivered · {x.invitationSummary.started} started{x.invitationSummary.failed ? ` · ${x.invitationSummary.failed} failed` : ""}</span>
                    )}
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:shrink-0">
                  <Button asChild variant="outline" className="w-full lg:w-auto">
                    <Link href={`/institute/exams/${x.id}/results`} aria-label={`View results for ${x.title}`}>
                      <BarChart3 className="mr-2 h-4 w-4" aria-hidden="true" /> Results
                    </Link>
                  </Button>
                  {x.accessMode === "cohort_invite" ? (
                    <Button
                      variant="outline"
                      className="w-full lg:w-auto"
                      onClick={() => invitationM.mutate({ id: x.id, mode: "unsent" })}
                      disabled={x.status !== "live" || !x.fundingActive || (invitationM.isPending && invitationM.variables?.id === x.id)}
                      aria-label={`Send private cohort invitations for ${x.title}`}
                    >
                      <Mail className="mr-2 h-4 w-4" aria-hidden="true" /> Send invites
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" className="w-full lg:w-auto" onClick={() => copy(x.shareUrl)} aria-label={`Copy share link for ${x.title}`}>
                        <Copy className="mr-2 h-4 w-4" aria-hidden="true" /> Copy link
                      </Button>
                      <Button asChild variant="outline" className="w-full lg:w-auto">
                        <Link href={`/x/${x.shareCode}`} aria-label={`Preview ${x.title}`}>
                          <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" /> Preview
                        </Link>
                      </Button>
                    </>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full px-3 lg:w-11" aria-label={`More actions for ${x.title}`}>
                        <MoreVertical className="h-4 w-4" aria-hidden="true" />
                        <span className="ml-2 lg:sr-only">More</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLocation(`/institute/exams/${x.id}/results`)}>
                        <BarChart3 className="w-4 h-4 mr-2" /> View results
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation(`/institute/exams/${x.id}/edit`)}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      {x.accessMode === "cohort_invite" && x.status === "live" && (
                        <>
                          {x.invitationSummary.failed > 0 && (
                            <DropdownMenuItem onClick={() => invitationM.mutate({ id: x.id, mode: "failed" })}>
                              <RotateCw className="mr-2 h-4 w-4" /> Retry failed invitations
                            </DropdownMenuItem>
                          )}
                          {x.invitationSummary.total > 0 && (
                            <DropdownMenuItem onClick={() => invitationM.mutate({ id: x.id, mode: "all" })}>
                              <Mail className="mr-2 h-4 w-4" /> Resend all invitations
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
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
