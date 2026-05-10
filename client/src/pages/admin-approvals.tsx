import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/header";
import Breadcrumbs from "@/components/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { CheckCircle2, XCircle, Clock, GraduationCap, Building2, Briefcase } from "lucide-react";

type Tab = "creators" | "institutes" | "recruiters";

const ADMIN_TOKEN_KEY = "octamy.admin.token";
function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem("auth_token");
}

async function adminFetch(method: string, url: string, body?: any) {
  const t = getAdminToken();
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export default function AdminApprovals() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("creators");

  const { data: summary } = useQuery({
    queryKey: ["/api/admin/approvals/summary"],
    queryFn: async () => (await adminFetch("GET", "/api/admin/approvals/summary")).json(),
  });

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/admin/${tab}`, "pending"],
    queryFn: async () => {
      const path = tab === "recruiters"
        ? `/api/admin/recruiters?status=pending`
        : `/api/admin/${tab}?status=pending`;
      const r = await adminFetch("GET", path);
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          toast({ title: "Admin login required", variant: "destructive" });
          setLocation("/admin");
          return [];
        }
        return [];
      }
      return r.json();
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const path = tab === "recruiters" ? `/api/admin/recruiters/${id}/kyc-status` : `/api/admin/${tab}/${id}/status`;
      const r = await adminFetch("PATCH", path, { status });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/admin/${tab}`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/approvals/summary"] });
      toast({ title: "Updated" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const TABS: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: "creators", label: "Creators", icon: GraduationCap, count: summary?.creators ?? 0 },
    { key: "institutes", label: "Institutes", icon: Building2, count: summary?.institutes ?? 0 },
    { key: "recruiters", label: "Recruiters", icon: Briefcase, count: summary?.recruiters ?? 0 },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SEO title="Approval queue · Admin" description="Approve creators, institutes, recruiters" path="/admin/approvals" noIndex />
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: "Admin", href: "/qwegle/dashboard" }, { label: "Approvals" }]} />
        <h1 className="text-3xl font-semibold text-slate-900">Approval queue</h1>
        <p className="text-sm text-slate-600 mt-1 mb-6">Review and approve pending creators, institutes, and recruiters.</p>

        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pill flex items-center gap-2 transition-all ${tab === key ? "bg-slate-900 text-white border-slate-900" : "hover:bg-cream-deep"}`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {count > 0 && (
                <Badge className={`ml-1 ${tab === key ? "bg-white text-slate-900" : "bg-amber-100 text-amber-900"}`}>{count}</Badge>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : rows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
              <h3 className="text-lg font-medium">All caught up</h3>
              <p className="text-sm text-slate-600 mt-1">No pending {tab} right now.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <Card key={r.id} className="neo-soft">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {tab === "creators" && (r.display_name || r.username || r.email)}
                        {tab === "institutes" && r.name}
                        {tab === "recruiters" && (r.full_name || r.email)}
                      </h3>
                      <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" />{r.status || r.kyc_status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {tab === "creators" && (<>id #{r.id} · {r.email} · {r.slug}</>)}
                      {tab === "institutes" && (<>id #{r.id} · {r.contact_email} · {r.industry || "—"} · {r.size_range || "—"}</>)}
                      {tab === "recruiters" && (<>id #{r.id} · {r.email} · {r.company_name || "—"}</>)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => update.mutate({ id: r.id, status: "rejected" })}
                      disabled={update.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => update.mutate({ id: r.id, status: tab === "institutes" ? "verified" : "approved" })}
                      disabled={update.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
