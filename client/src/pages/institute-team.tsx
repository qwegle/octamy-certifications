import { useEffect, useState } from "react";
import DashboardLayout from '@/components/dashboard-layout';
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { SEO } from "@/components/seo";
import { UserPlus, Trash2, Crown } from "lucide-react";
import { useDashboardRoles } from "@/lib/use-dashboard-role";

type Member = {
  id: number;
  role: string;
  status: string;
  invited_at: string | null;
  joined_at: string | null;
  user_id: number | null;
  name: string | null;
  email: string | null;
};

export default function InstituteTeam() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: roles } = useDashboardRoles();
  const canManage = roles?.isAdmin || roles?.instituteRole === "owner" || roles?.instituteRole === "admin";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "teacher" | "staff">("teacher");

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data: members = [], isLoading, isError, refetch } = useQuery<Member[]>({
    queryKey: ["/api/institute/team"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/institute/team")).json(),
  });

  const invite = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/institute/team/invite", { email, role });
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Invite sent", description: `${email} will be added when they sign up.` });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["/api/institute/team"] });
    },
    onError: (e: any) => toast({ title: "Invite was not sent", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (memberId: number) => {
      const r = await apiRequest("DELETE", `/api/institute/team/${memberId}`);
      if (!r.ok) throw new Error((await r.json()).message || "Failed");
      return true;
    },
    onSuccess: () => {
      toast({ title: "Member removed" });
      qc.invalidateQueries({ queryKey: ["/api/institute/team"] });
    },
    onError: (e: any) => toast({ title: "Member was not removed", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <DashboardLayout role="institute" title="Team" breadcrumbs={[{ label: 'Institute', href: '/institute/dashboard' }, { label: 'Team' }]}>
      <SEO title="Team · Institute" description="Manage teachers and admins for your institute." path="/institute/team" />
        {canManage ? <Card className="mb-6 border-slate-200">
          <CardHeader><CardTitle className="text-base">Invite a teammate</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3">
              <div>
                <Label htmlFor="team-email">Email</Label>
                <Input id="team-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.edu" autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="team-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger id="team-role" className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => invite.mutate()}
                  disabled={!email.includes("@") || invite.isPending}
                  className="bg-slate-900 text-white w-full sm:w-auto"
                >
                  <UserPlus className="w-4 h-4 mr-2" /> {invite.isPending ? "Sending…" : "Invite"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              If the user already has an Octamy account they'll appear in the list immediately. Otherwise they'll be linked when they sign up with this email.
            </p>
          </CardContent>
        </Card> : (
          <Card className="mb-6 border-slate-200 bg-slate-50/70">
            <CardContent className="p-4 text-sm leading-6 text-slate-950">You can view the institute roster. Only owners and admins can invite or remove team members.</CardContent>
          </Card>
        )}

        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-base">Members</CardTitle></CardHeader>
          <CardContent>
            {isError ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-sm text-slate-950">The team roster could not be loaded.</p>
                <Button type="button" variant="outline" className="mt-3" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : isLoading ? (
              <div className="space-y-2" aria-label="Loading team members">{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
            ) : members.length === 0 ? (
              <div className="text-sm text-slate-500 py-6 text-center">{canManage ? "No members yet — invite your first teammate above." : "No active members are visible."}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="text-left font-medium py-2">Name</th>
                      <th className="text-left font-medium py-2">Email</th>
                      <th className="text-left font-medium py-2">Role</th>
                      <th className="text-left font-medium py-2">Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 text-slate-900 flex items-center gap-1">
                          {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-slate-500" />}
                          {m.name || "—"}
                        </td>
                        <td className="py-2 text-slate-700">{m.email || "—"}</td>
                        <td className="py-2 capitalize">{m.role}</td>
                        <td className="py-2">
                          <Badge variant="outline" className="capitalize">{m.status}</Badge>
                        </td>
                        <td className="py-2 text-right">
                          {canManage && m.role !== "owner" && (
                            <Button size="icon" variant="ghost" onClick={() => remove.mutate(m.id)} disabled={remove.isPending} aria-label={`Remove ${m.name || m.email || "team member"}`}>
                              <Trash2 className="w-3.5 h-3.5 text-slate-600" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
  );
}
