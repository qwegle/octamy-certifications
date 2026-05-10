import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/header";
import Footer from "@/components/footer";
import Breadcrumbs from "@/components/breadcrumbs";
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

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "teacher" | "staff">("teacher");

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data: members = [], isLoading } = useQuery<Member[]>({
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
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
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
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO title="Team · Institute" description="Manage teachers and admins for your institute." path="/institute/team" />
      <Header />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Breadcrumbs items={[{ label: "Institute", href: "/institute/dashboard" }, { label: "Team" }]} />
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-6">Team</h1>

        <Card className="border-slate-200 mb-6">
          <CardHeader><CardTitle className="text-base">Invite a teammate</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.edu" />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger id="role"><SelectValue /></SelectTrigger>
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
        </Card>

        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-base">Members</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-slate-500 py-6 text-center">Loading…</div>
            ) : members.length === 0 ? (
              <div className="text-sm text-slate-500 py-6 text-center">No members yet — invite your first teammate above.</div>
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
                          {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                          {m.name || "—"}
                        </td>
                        <td className="py-2 text-slate-700">{m.email || "—"}</td>
                        <td className="py-2 capitalize">{m.role}</td>
                        <td className="py-2">
                          <Badge variant="outline" className="capitalize">{m.status}</Badge>
                        </td>
                        <td className="py-2 text-right">
                          {m.role !== "owner" && (
                            <Button size="sm" variant="ghost" onClick={() => remove.mutate(m.id)} disabled={remove.isPending}>
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
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
      </main>
      <Footer />
    </div>
  );
}
