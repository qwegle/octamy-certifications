import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Clock3,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  LockKeyhole,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Certificate } from "@shared/schema";
import DashboardLayout from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth.tsx";
import { cn } from "@/lib/utils";

type CredentialStatus = "active" | "pending" | "expired" | "revoked";

type ProfileSummary = {
  profileCompleteness?: number;
};

type EvidenceLink = {
  path: string;
  isPublic: boolean;
};

type NextAction = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  label: string;
};

const credentialStatusMeta: Record<CredentialStatus, {
  label: string;
  icon: LucideIcon;
  badgeClassName: string;
  iconClassName: string;
}> = {
  active: {
    label: "Verified",
    icon: ShieldCheck,
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  pending: {
    label: "Ready to activate",
    icon: Clock3,
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
    iconClassName: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  expired: {
    label: "Expired",
    icon: RotateCcw,
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
    iconClassName: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  revoked: {
    label: "Revoked",
    icon: XCircle,
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
    iconClassName: "bg-rose-50 text-rose-700 ring-rose-100",
  },
};

function getCredentialStatus(certificate: Certificate): CredentialStatus {
  if (!certificate.isActive) return "revoked";
  if (!certificate.isPaid) return "pending";
  return new Date(certificate.expiresAt).getTime() <= Date.now() ? "expired" : "active";
}

function formatDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  loading = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  helper: string;
  loading?: boolean;
}) {
  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600">{label}</p>
            {loading ? (
              <div className="mt-2 h-8 w-16 animate-pulse rounded-lg bg-slate-200" aria-hidden="true" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{value}</p>
            )}
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

function CredentialCard({
  certificate,
  onDownload,
  onShare,
}: {
  certificate: Certificate;
  onDownload: (certificate: Certificate) => void;
  onShare: (certificate: Certificate) => void;
}) {
  const status = getCredentialStatus(certificate);
  const meta = credentialStatusMeta[status];
  const StatusIcon = meta.icon;

  return (
    <Card className="flex h-full flex-col overflow-hidden border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", meta.badgeClassName)}>
            {meta.label}
          </Badge>
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1", meta.iconClassName)}>
            <StatusIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-4 min-w-0">
          <h4 className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">
            {certificate.courseTitle}
          </h4>
          <p className="mt-1 truncate text-xs text-slate-500" title={certificate.certificateNumber}>
            Credential {certificate.certificateNumber}
          </p>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4">
          <div>
            <dt className="text-xs font-medium text-slate-500">Assessment score</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              {certificate.score}%
              {certificate.mastered && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                  Mastery
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">
              {status === "expired"
                ? "Expired on"
                : status === "pending"
                  ? "Passed on"
                  : status === "revoked"
                    ? "Original expiry"
                    : "Valid until"}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {status === "pending" ? formatDate(certificate.issuedAt) : formatDate(certificate.expiresAt)}
            </dd>
          </div>
        </dl>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          <Button asChild variant="outline" className="min-h-11 px-3">
            <a
              href={`/certificate/${encodeURIComponent(certificate.certificateId)}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`View ${certificate.courseTitle} credential in a new tab`}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              View
            </a>
          </Button>

          {status === "active" && (
            <Button
              type="button"
              className="min-h-11 px-3"
              onClick={() => onDownload(certificate)}
              aria-label={`Download ${certificate.courseTitle} credential`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </Button>
          )}

          {status === "pending" && (
            <Button asChild className="min-h-11 px-3">
              <Link
                href={`/payment/${encodeURIComponent(certificate.certificateId)}`}
                aria-label={`Activate ${certificate.courseTitle} credential`}
              >
                Activate
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          )}

          {(status === "expired" || status === "revoked") && (
            <Button asChild className="min-h-11 px-3">
              <Link href="/get-certified" aria-label={`Browse certifications to refresh ${certificate.courseTitle}`}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Retake
              </Link>
            </Button>
          )}

          {status === "active" && (
            <Button
              type="button"
              variant="outline"
              className="col-span-2 min-h-11 px-3"
              onClick={() => onShare(certificate)}
              aria-label={`Share ${certificate.courseTitle} credential`}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share verified credential
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CredentialSection({
  id,
  title,
  description,
  certificates,
  onDownload,
  onShare,
}: {
  id: string;
  title: string;
  description: string;
  certificates: Certificate[];
  onDownload: (certificate: Certificate) => void;
  onShare: (certificate: Certificate) => void;
}) {
  if (certificates.length === 0) return null;

  return (
    <section aria-labelledby={id}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 id={id} className="text-lg font-semibold text-slate-950">{title}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {certificates.length}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {certificates.map((certificate) => (
          <CredentialCard
            key={certificate.id}
            certificate={certificate}
            onDownload={onDownload}
            onShare={onShare}
          />
        ))}
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading learner dashboard">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-36 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <span className="sr-only">Loading your credentials and profile progress.</span>
    </div>
  );
}

export default function Dashboard() {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [passportCopied, setPassportCopied] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
  }, [isLoading, user, setLocation]);

  const certificatesQuery = useQuery<Certificate[]>({
    queryKey: ["/api/user/certificates"],
    enabled: Boolean(user && token),
  });

  const profileQuery = useQuery<ProfileSummary>({
    queryKey: ["/api/user/profile"],
    enabled: Boolean(user && token),
  });

  const evidenceQuery = useQuery<EvidenceLink>({
    queryKey: ["/api/user/evidence-passport-link"],
    enabled: Boolean(user && token),
  });

  const certificates = certificatesQuery.data ?? [];
  const profileCompleteness = Math.max(0, Math.min(100, profileQuery.data?.profileCompleteness ?? 0));

  const groupedCredentials = useMemo(() => {
    const active: Certificate[] = [];
    const pending: Certificate[] = [];
    const historical: Certificate[] = [];

    for (const certificate of certificates) {
      const status = getCredentialStatus(certificate);
      if (status === "active") active.push(certificate);
      else if (status === "pending") pending.push(certificate);
      else historical.push(certificate);
    }

    return { active, pending, historical };
  }, [certificates]);

  const averageScore = certificates.length > 0
    ? Math.round(certificates.reduce((total, certificate) => total + certificate.score, 0) / certificates.length)
    : 0;

  const passportSteps = [
    {
      label: "Build your profile",
      helper: profileCompleteness >= 70 ? "Core career details are ready" : "Reach 70% profile strength",
      complete: profileCompleteness >= 70,
      unavailable: Boolean(profileQuery.error),
    },
    {
      label: "Validate a skill",
      helper: certificates.length > 0 ? "Assessment evidence recorded" : "Complete your first assessment",
      complete: certificates.length > 0,
      unavailable: Boolean(certificatesQuery.error),
    },
    {
      label: "Activate a credential",
      helper: groupedCredentials.active.length > 0 ? "Verified credential available" : "Add verified proof to your passport",
      complete: groupedCredentials.active.length > 0,
      unavailable: Boolean(certificatesQuery.error),
    },
    {
      label: "Enable secure sharing",
      helper: evidenceQuery.data?.isPublic ? "Recruiter-ready link enabled" : "You control when your passport is visible",
      complete: evidenceQuery.data?.isPublic === true,
      unavailable: Boolean(evidenceQuery.error),
    },
  ];
  const completedPassportSteps = passportSteps.filter((step) => step.complete).length;
  const passportReadiness = Math.round((completedPassportSteps / passportSteps.length) * 100);
  const passportLoading = certificatesQuery.isLoading || profileQuery.isLoading || evidenceQuery.isLoading;
  const passportHasError = passportSteps.some((step) => step.unavailable);

  const nextAction = useMemo<NextAction>(() => {
    const pendingCredential = groupedCredentials.pending[0];
    if (pendingCredential) {
      return {
        eyebrow: "Credential ready",
        title: `Activate ${pendingCredential.courseTitle}`,
        description: `You passed with ${pendingCredential.score}%. Activate the credential to add verified proof to your Evidence Passport.`,
        href: `/payment/${encodeURIComponent(pendingCredential.certificateId)}`,
        label: "Activate credential",
      };
    }

    if (!certificatesQuery.isLoading && !certificatesQuery.error && certificates.length === 0) {
      return {
        eyebrow: "Start your evidence journey",
        title: "Validate your first skill",
        description: "Choose an assessment, demonstrate what you know, and create evidence employers can independently verify.",
        href: "/assessments",
        label: "Explore assessments",
      };
    }

    if (!profileQuery.isLoading && !profileQuery.error && profileCompleteness < 100) {
      return {
        eyebrow: "Strengthen your profile",
        title: "Give your skills the right context",
        description: `Your profile is ${profileCompleteness}% complete. Add career details so employers understand where your verified skills fit.`,
        href: "/profile-edit",
        label: "Complete profile",
      };
    }

    if (!evidenceQuery.isLoading && !evidenceQuery.error && !evidenceQuery.data?.isPublic) {
      return {
        eyebrow: "You stay in control",
        title: "Make your Evidence Passport shareable",
        description: "Enable your secure public link when you are ready to share verified skills with recruiters and employers.",
        href: "/profile-edit",
        label: "Review sharing settings",
      };
    }

    if (groupedCredentials.historical.length > 0) {
      return {
        eyebrow: "Keep evidence current",
        title: "Refresh a historical skill credential",
        description: "Retake an assessment to replace expired or revoked evidence with a current, independently verifiable result.",
        href: "/assessments",
        label: "Find an assessment",
      };
    }

    return {
      eyebrow: "Continue building",
      title: "Add another verified skill",
      description: "Broaden your Evidence Passport with an assessment that supports your next role or learning goal.",
      href: "/assessments",
      label: "Browse assessments",
    };
  }, [
    certificates,
    certificatesQuery.error,
    certificatesQuery.isLoading,
    evidenceQuery.data?.isPublic,
    evidenceQuery.error,
    evidenceQuery.isLoading,
    groupedCredentials.historical,
    groupedCredentials.pending,
    profileCompleteness,
    profileQuery.error,
    profileQuery.isLoading,
  ]);

  const copyPassportLink = async () => {
    const evidenceLink = evidenceQuery.data;
    if (!evidenceLink?.path || !evidenceLink.isPublic) return;

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${evidenceLink.path}`);
      setPassportCopied(true);
      toast({ title: "Passport link copied", description: "Your secure Evidence Passport link is ready to share." });
      window.setTimeout(() => setPassportCopied(false), 1800);
    } catch {
      toast({
        title: "Link was not copied",
        description: "Your browser blocked clipboard access. Open the passport and copy its address instead.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = (certificate: Certificate) => {
    const opened = window.open(
      `/api/certificates/${encodeURIComponent(certificate.certificateId)}/download?format=pdf`,
      "_blank",
    );

    if (opened) {
      opened.opener = null;
    } else {
      toast({
        title: "Download window was blocked",
        description: "Allow pop-ups for Octamy, then try the download again.",
      });
    }
  };

  const handleShare = async (certificate: Certificate) => {
    const shareUrl = `${window.location.origin}/certificate/${encodeURIComponent(certificate.certificateId)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${certificate.courseTitle} — verified credential`,
          text: `View my verified ${certificate.courseTitle} credential on Octamy.`,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Credential link copied", description: "The verification link is ready to share." });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({
        title: "Credential was not shared",
        description: "Open the credential and copy its address to share it manually.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-6" role="status">
        <div className="text-center">
          <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" aria-hidden="true" />
          <p className="mt-4 text-sm font-medium text-slate-600">Opening your learner workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
        <Card className="mx-auto max-w-xl border-slate-200 bg-white shadow-sm">
          <CardContent className="px-6 py-12 text-center sm:px-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
              <LockKeyhole className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-xl font-semibold text-slate-950">Your credentials are waiting</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Sign in to view your assessments, credentials, profile progress, and Evidence Passport.
            </p>
            <Button asChild className="mt-6">
              <Link href="/login">Sign in securely</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const pageIsLoading = certificatesQuery.isLoading && !certificatesQuery.data;

  return (
    <DashboardLayout
      role="learner"
      title={`Welcome back, ${firstName}`}
      description="Turn learning into trusted evidence and keep your next career step visible."
      actions={(
        <Button asChild variant="outline">
          <Link href="/profile-edit">
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            {profileCompleteness >= 100 ? "Edit profile" : "Complete profile"}
          </Link>
        </Button>
      )}
    >
      {pageIsLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-8">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]" aria-label="Recommended next action and Evidence Passport progress">
            <Card className="relative overflow-hidden border-slate-800 bg-slate-950 text-white shadow-lg">
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" aria-hidden="true" />
              <CardContent className="relative flex h-full min-h-[260px] flex-col p-6 sm:p-8">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {nextAction.eyebrow}
                </div>
                <h2 className="mt-5 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {nextAction.title}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  {nextAction.description}
                </p>
                <div className="mt-auto flex flex-col gap-2 pt-7 sm:flex-row sm:flex-wrap">
                  <Button asChild className="border-white bg-white text-slate-950 hover:bg-slate-100">
                    <Link href={nextAction.href}>
                      {nextAction.label}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  {nextAction.href !== "/assessments" && (
                    <Button asChild variant="outline" className="border-slate-700 bg-slate-900 text-white hover:border-slate-600 hover:bg-slate-800 hover:text-white">
                      <Link href="/get-certified">
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                        Browse assessments
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Evidence Passport</p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">Recruiter readiness</h2>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>

                {passportLoading ? (
                  <div className="mt-6 space-y-3" role="status" aria-label="Loading Evidence Passport readiness">
                    <div className="h-2 animate-pulse rounded-full bg-slate-200" />
                    {[1, 2, 3, 4].map((item) => <div key={item} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}
                  </div>
                ) : (
                  <>
                    <div className="mt-5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-600">{completedPassportSteps} of {passportSteps.length} steps complete</span>
                        <span className="font-semibold text-slate-950">{passportReadiness}%</span>
                      </div>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-label="Evidence Passport readiness"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={passportReadiness}
                      >
                        <div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${passportReadiness}%` }} />
                      </div>
                    </div>

                    <ul className="mt-5 space-y-3">
                      {passportSteps.map((step) => (
                        <li key={step.label} className="flex items-start gap-3">
                          <span className={cn(
                            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                            step.complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400",
                          )}>
                            {step.complete ? <Check className="h-3 w-3" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-800">{step.label}</span>
                            <span className="block text-xs leading-5 text-slate-500">
                              {step.unavailable ? "Status temporarily unavailable" : step.helper}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>

                    {passportHasError && (
                      <button
                        type="button"
                        className="mt-4 min-h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none ring-1 ring-slate-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900"
                        onClick={() => void Promise.all([
                          certificatesQuery.refetch(),
                          profileQuery.refetch(),
                          evidenceQuery.refetch(),
                        ])}
                      >
                        Refresh passport status
                      </button>
                    )}

                    {!passportHasError && evidenceQuery.data?.isPublic && evidenceQuery.data.path ? (
                      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-5">
                        <Button asChild variant="outline" className="min-h-11 px-3">
                          <Link href={evidenceQuery.data.path}>
                            View
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </Button>
                        <Button type="button" className="min-h-11 px-3" onClick={copyPassportLink}>
                          <Share2 className="h-4 w-4" aria-hidden="true" />
                          {passportCopied ? "Copied" : "Copy link"}
                        </Button>
                      </div>
                    ) : !passportHasError ? (
                      <Button asChild variant="outline" className="mt-5 w-full">
                        <Link href="/profile-edit">
                          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                          Review sharing settings
                        </Link>
                      </Button>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="progress-summary-title">
            <div className="mb-4">
              <h2 id="progress-summary-title" className="text-lg font-semibold text-slate-950">Progress summary</h2>
              <p className="mt-1 text-sm text-slate-600">A focused view of the signals that make your evidence useful.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard
                icon={ShieldCheck}
                label="Verified credentials"
                value={certificatesQuery.error ? "—" : groupedCredentials.active.length}
                helper={certificatesQuery.error
                  ? "Credential status is temporarily unavailable"
                  : groupedCredentials.active.length === 1
                    ? "Active proof employers can verify"
                    : "Active proofs employers can verify"}
                loading={certificatesQuery.isLoading}
              />
              <MetricCard
                icon={TrendingUp}
                label="Average score"
                value={!certificatesQuery.error && certificates.length > 0 ? `${averageScore}%` : "—"}
                helper={certificatesQuery.error
                  ? "Assessment results are temporarily unavailable"
                  : certificates.length > 0
                    ? `Across ${certificates.length} completed assessment${certificates.length === 1 ? "" : "s"}`
                    : "Complete an assessment to set a baseline"}
                loading={certificatesQuery.isLoading}
              />
              <MetricCard
                icon={UserRoundCheck}
                label="Profile strength"
                value={profileQuery.error ? "—" : `${profileCompleteness}%`}
                helper={profileCompleteness >= 70 ? "Enough context to support your evidence" : "Add role, skills, and career context"}
                loading={profileQuery.isLoading}
              />
              <MetricCard
                icon={Clock3}
                label="Pending activation"
                value={certificatesQuery.error ? "—" : groupedCredentials.pending.length}
                helper={certificatesQuery.error
                  ? "Activation status is temporarily unavailable"
                  : groupedCredentials.pending.length > 0
                    ? "Passed credentials ready to activate"
                    : "No credential actions waiting"}
                loading={certificatesQuery.isLoading}
              />
            </div>
          </section>

          <section aria-labelledby="credentials-title">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="credentials-title" className="text-xl font-semibold text-slate-950">Your credential portfolio</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">View, activate, download, and share your assessment-backed credentials.</p>
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/get-certified">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Browse assessments
                </Link>
              </Button>
            </div>

            {certificatesQuery.error ? (
              <Card className="border-rose-200 bg-white shadow-sm" role="alert">
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-100">
                      <AlertCircle className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-950">Your credentials could not be loaded</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">Your records are safe. Check your connection and try again.</p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void certificatesQuery.refetch()}>
                    Try again
                  </Button>
                </CardContent>
              </Card>
            ) : certificates.length === 0 ? (
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="px-6 py-12 text-center sm:px-10 sm:py-14">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                    <FileCheck2 className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-slate-950">Build your first proof of skill</h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
                    Complete an assessment to create a scored evidence record. Activate the credential when you are ready to share it.
                  </p>
                  <Button asChild className="mt-6 w-full sm:w-auto">
                    <Link href="/get-certified">
                      Explore assessments
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                <CredentialSection
                  id="active-credentials-title"
                  title="Verified and active"
                  description="Current credentials with live verification records."
                  certificates={groupedCredentials.active}
                  onDownload={handleDownload}
                  onShare={handleShare}
                />
                <CredentialSection
                  id="pending-credentials-title"
                  title="Ready to activate"
                  description="You passed these assessments; activation adds them to your verified portfolio."
                  certificates={groupedCredentials.pending}
                  onDownload={handleDownload}
                  onShare={handleShare}
                />
                <CredentialSection
                  id="credential-history-title"
                  title="Credential history"
                  description="Expired or revoked records remain visible for transparency."
                  certificates={groupedCredentials.historical}
                  onDownload={handleDownload}
                  onShare={handleShare}
                />
              </div>
            )}
          </section>

          <Card className="overflow-hidden border-slate-200 bg-sky-50/70 shadow-sm">
            <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="flex min-w-0 items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-sky-700 ring-1 ring-sky-100">
                  <Award className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold text-slate-950">Learn → Validate → Certify → Get recruited</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                    Your Evidence Passport keeps the journey digital, verifiable, and under your sharing control.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full bg-white sm:w-auto">
                <Link href="/profile-edit">
                  Manage your profile
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
