import type { ReactNode } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth.tsx";
import { apiRequest } from "@/lib/queryClient";
import { INSTITUTE_ROLE_RANK, requiredInstituteRole } from "@/lib/institute-route-policy";

export type WorkspaceRoles = {
  isLearner: boolean;
  isCreator: boolean;
  isInstituteMember: boolean;
  isRecruiter: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  instituteRole?: "owner" | "admin" | "teacher" | "staff" | null;
};

type Requirement = "authenticated" | "creator" | "institute" | "question-bank" | null;

function requirementFor(path: string): Requirement {
  if (
    path === "/dashboard" ||
    path === "/my-certificates" ||
    path === "/progress" ||
    path === "/preferences" ||
    path === "/profile" ||
    path === "/profile-edit"
  ) return "authenticated";

  if (path === "/question-banks" || path.startsWith("/question-banks/")) return "question-bank";

  if (
    path.startsWith("/creator/") &&
    !path.startsWith("/creator/login") &&
    !path.startsWith("/creator/register")
  ) return "creator";

  if (
    path.startsWith("/institute/") &&
    !path.startsWith("/institute/login") &&
    !path.startsWith("/institute/register")
  ) return "institute";

  return null;
}

function hasAccess(requirement: Requirement, roles: WorkspaceRoles | undefined) {
  if (!requirement || requirement === "authenticated") return true;
  if (!roles) return false;
  // Platform administration does not grant silent access to tenant data. An
  // admin must also own/join the selected workspace, matching backend tenancy.
  if (requirement === "creator") return roles.isCreator;
  if (requirement === "institute") return roles.isInstituteMember;
  return roles.isCreator || roles.isInstituteMember || roles.isAdmin;
}

export function WorkspaceAccessGate({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();
  const path = location.split("?")[0];
  const requirement = requirementFor(path);
  const instituteMinimum = requiredInstituteRole(path);
  const needsRoles = requirement === "creator" || requirement === "institute" || requirement === "question-bank";

  const rolesQuery = useQuery<WorkspaceRoles>({
    queryKey: ["/api/me/roles"],
    enabled: !!user && !!token && needsRoles,
    queryFn: async () => (await apiRequest("GET", "/api/me/roles")).json(),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!requirement || authLoading || user) return;
    const next = `${window.location.pathname}${window.location.search}`;
    setLocation(`/login?next=${encodeURIComponent(next)}`);
  }, [authLoading, requirement, setLocation, user]);

  if (!requirement) return <>{children}</>;

  if (authLoading || (!user && !token)) {
    return <WorkspaceLoader label={user ? "Opening your workspace" : "Taking you to secure sign in"} />;
  }

  if (needsRoles && rolesQuery.isLoading) return <WorkspaceLoader label="Checking workspace access" />;

  if (needsRoles && rolesQuery.isError) {
    return (
      <WorkspaceMessage
        icon={<AlertCircle className="h-6 w-6" />}
        title="We couldn't verify workspace access"
        description="Your session is still active. Retry the access check before continuing."
        action={<Button onClick={() => rolesQuery.refetch()}>Retry access check</Button>}
      />
    );
  }

  if (!hasAccess(requirement, rolesQuery.data)) {
    const isCreator = requirement === "creator";
    const isInstitute = requirement === "institute";
    const title = isCreator
      ? "Creator workspace not set up"
      : isInstitute
        ? "Institute workspace not available"
        : "Question banks need a creator or institute workspace";
    const description = isCreator
      ? "Add a creator workspace to this Octamy identity before publishing courses or assessments."
      : isInstitute
        ? "You are not an active member of an institute workspace. Create one or ask an institute administrator for an invitation."
        : "Learner accounts can take assessments, but question-bank authoring is available to approved creator and institute workspaces.";
    const role = isCreator ? "creator" : "institute";

    return (
      <WorkspaceMessage
        icon={<ShieldCheck className="h-6 w-6" />}
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={`/register?role=${role}&mode=add`}>
                Add {role} workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline"><Link href="/dashboard">Back to learner home</Link></Button>
          </div>
        }
      />
    );
  }

  if (
    instituteMinimum &&
    (!rolesQuery.data?.instituteRole ||
      INSTITUTE_ROLE_RANK[rolesQuery.data.instituteRole] < INSTITUTE_ROLE_RANK[instituteMinimum])
  ) {
    return (
      <WorkspaceMessage
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Additional institute permission required"
        description={`This area requires an institute ${instituteMinimum} role. Your membership is still active, but an institute owner or admin must update your access before you can continue.`}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild><Link href="/dashboard">Open learner workspace</Link></Button>
            <Button asChild variant="outline"><Link href="/help-center">Get help</Link></Button>
          </div>
        }
      />
    );
  }

  return <>{children}</>;
}

function WorkspaceLoader({ label }: { label: string }) {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center bg-slate-50 px-6" tabIndex={-1}>
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> {label}…
      </div>
    </main>
  );
}

function WorkspaceMessage({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action: ReactNode }) {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center bg-slate-50 px-6 py-16" tabIndex={-1}>
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5" aria-labelledby="workspace-message-title">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white">{icon}</div>
        <h1 id="workspace-message-title" className="mt-5 text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">{description}</p>
        <div className="mt-7">{action}</div>
      </section>
    </main>
  );
}
