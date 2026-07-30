import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  Loader2,
  Printer,
  Share2,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import octamyLogo from "@/assets/image_1750054465427.png";

type CredentialStatus = "active" | "expired" | "revoked" | "pending_activation";

interface PublicCertificate {
  certificateId: string;
  certificateNumber?: string;
  userName: string;
  courseTitle: string;
  score: number;
  badge: string;
  mastered?: boolean;
  issuedAt: string;
  expiresAt: string;
  issuedBy?: string;
  isPaid: boolean;
  isActive: boolean;
  issuer?: {
    platform?: string;
    coIssuer?: { name: string; logoUrl?: string | null } | null;
  };
}

const statusDetails: Record<
  CredentialStatus,
  {
    label: string;
    eyebrow: string;
    description: string;
    icon: typeof CheckCircle2;
    tone: string;
    iconTone: string;
  }
> = {
  active: {
    label: "Credential active",
    eyebrow: "Currently valid",
    description: "This credential is activated and remains within its stated validity period.",
    icon: CheckCircle2,
    tone: "border-slate-200 bg-slate-50 text-slate-950",
    iconTone: "text-slate-700",
  },
  expired: {
    label: "Credential expired",
    eyebrow: "Authentic record · not currently valid",
    description: "The assessment record exists, but its credential validity period has ended.",
    icon: AlertTriangle,
    tone: "border-slate-200 bg-slate-50 text-slate-950",
    iconTone: "text-slate-700",
  },
  revoked: {
    label: "Credential revoked",
    eyebrow: "Authentic record · not currently valid",
    description: "The record exists, but the issuer no longer considers this credential valid.",
    icon: Ban,
    tone: "border-slate-200 bg-slate-50 text-slate-950",
    iconTone: "text-slate-700",
  },
  pending_activation: {
    label: "Not activated",
    eyebrow: "Assessment record found",
    description: "A passing assessment record exists, but the optional credential has not been activated.",
    icon: FileCheck2,
    tone: "border-slate-200 bg-slate-100 text-slate-900",
    iconTone: "text-slate-600",
  },
};

function formatDate(value?: string) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function getCredentialStatus(certificate: PublicCertificate): CredentialStatus {
  if (!certificate.isPaid) return "pending_activation";
  if (!certificate.isActive) return "revoked";
  return new Date(certificate.expiresAt).getTime() <= Date.now() ? "expired" : "active";
}

async function responseMessage(response: Response) {
  const body = await response.clone().json().catch(() => null);
  return body?.message || body?.error || `Request failed (${response.status})`;
}

export default function CertificateView() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const { toast } = useToast();
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  const { data: certificate, isLoading, error } = useQuery<PublicCertificate>({
    queryKey: [`/api/certificates/${encodeURIComponent(certificateId || "")}`],
    enabled: Boolean(certificateId),
    retry: false,
  });

  const status = certificate ? getCredentialStatus(certificate) : null;
  const statusDetail = status ? statusDetails[status] : null;
  const StatusIcon = statusDetail?.icon;
  const isCurrentlyValid = status === "active";
  const verificationPath = certificate
    ? `/verify/${encodeURIComponent(certificate.certificateId)}`
    : "/verify";

  const notifyUnavailable = (action: string) => {
    toast({
      title: `${action} unavailable`,
      description: statusDetail?.description || "This credential is not currently available.",
      variant: "destructive",
    });
  };

  const handleDownload = async () => {
    if (!certificate || !isCurrentlyValid) {
      notifyUnavailable("Download");
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(
        `/api/certificates/${encodeURIComponent(certificate.certificateId)}/download?format=pdf`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `octamy-credential-${certificate.certificateId.replace(/[^a-z0-9_-]/gi, "-")}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast({ title: "PDF downloaded", description: "Your credential document is ready." });
    } catch (downloadError) {
      console.error("Credential download failed:", downloadError);
      toast({
        title: "Download could not be completed",
        description: downloadError instanceof Error ? downloadError.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!isCurrentlyValid) {
      notifyUnavailable("Print");
      return;
    }

    setIsPrinting(true);
    try {
      const previewWindow = previewRef.current?.contentWindow;
      if (!previewWindow) throw new Error("The credential preview is still loading.");
      previewWindow.focus();
      previewWindow.print();
    } catch (printError) {
      console.error("Credential print failed:", printError);
      toast({
        title: "Print could not be started",
        description: printError instanceof Error ? printError.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const copyVerificationLink = async () => {
    if (!certificate) return;
    const shareUrl = `${window.location.origin}${verificationPath}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (clipboardError) {
      const field = document.createElement("textarea");
      field.value = shareUrl;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (!copied) {
        console.error("Credential link copy failed:", clipboardError);
        toast({
          title: "Link could not be copied",
          description: "Open the verification record and copy its address from your browser.",
          variant: "destructive",
        });
        return;
      }
    }

    toast({ title: "Verification link copied", description: "Anyone with the link can inspect the credential's live status." });
  };

  const handleShare = async () => {
    if (!certificate) return;
    const shareUrl = `${window.location.origin}${verificationPath}`;
    const shareText = `${certificate.userName}'s recorded score for ${certificate.courseTitle} is ${certificate.score}%. Check the credential's current status on Octamy.`;

    if (!navigator.share) {
      await copyVerificationLink();
      return;
    }

    try {
      await navigator.share({
        title: `${certificate.courseTitle} assessment credential`,
        text: shareText,
        url: shareUrl,
      });
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") return;
      console.error("Credential share failed:", shareError);
      await copyVerificationLink();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
        <SEO title="Credential record" description="Loading an Octamy assessment credential record." path={`/certificate/${certificateId || ""}`} noIndex />
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6" aria-busy="true" aria-live="polite">
          <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
            <div className="h-[520px] animate-pulse rounded-3xl bg-slate-200" />
            <div className="h-96 animate-pulse rounded-3xl bg-slate-200" />
          </div>
          <span className="sr-only">Loading credential record</span>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !certificate || !statusDetail || !StatusIcon) {
    return (
      <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
        <SEO title="Credential not found" description="No Octamy credential matches this link." path={`/certificate/${certificateId || ""}`} noIndex />
        <Header />
        <main className="mx-auto flex min-h-[62vh] max-w-3xl items-center px-4 py-16 sm:px-6">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_28px_80px_-45px_rgba(15,23,42,.45)] sm:p-12">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><XCircle className="h-7 w-7" /></span>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Credential record not found</h1>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">This link does not match a public Octamy credential record. Check the ID exactly as issued before relying on a certificate image.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="rounded-xl bg-slate-950 text-white hover:bg-slate-800"><Link href="/verify"><ShieldCheck className="mr-2 h-4 w-4" />Verify another ID</Link></Button>
              <Button asChild variant="outline" className="rounded-xl"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Return home</Link></Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const platformIssuer = certificate.issuer?.platform || certificate.issuedBy || "Octamy Solutions Private Limited";
  const coIssuer = certificate.issuer?.coIssuer;

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <SEO
        title={`${certificate.courseTitle} credential record`}
        description={`Inspect the recorded score and current status of ${certificate.userName}'s Octamy assessment credential.`}
        path={`/certificate/${encodeURIComponent(certificate.certificateId)}`}
        noIndex
      />
      <Header />

      <main id="main-content">
        <section className="border-b border-slate-800 bg-slate-950 text-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
            <Link href="/verify" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" /> Credential verification</Link>
            <div className="mt-7 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Assessment credential record</p>
                <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.035em] sm:text-5xl">{certificate.courseTitle}</h1>
                <p className="mt-4 max-w-2xl leading-7 text-slate-300">A scored assessment record with an inspectable issuer, validity window and live status.</p>
              </div>
              <div className={`max-w-md rounded-2xl border p-4 ${statusDetail.tone}`} role="status">
                <div className="flex items-start gap-3">
                  <StatusIcon className={`mt-0.5 h-6 w-6 shrink-0 ${statusDetail.iconTone}`} />
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">{statusDetail.eyebrow}</p><p className="mt-1 font-extrabold">{statusDetail.label}</p><p className="mt-1 text-xs leading-5 opacity-80">{statusDetail.description}</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(310px,.75fr)]">
            <div className="min-w-0 space-y-5">
              <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_-48px_rgba(15,23,42,.5)]">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <h2 className="font-extrabold">Credential document</h2>
                    <p className="mt-1 text-xs text-slate-500">Document access follows the live credential status.</p>
                  </div>
                  <code className="max-w-full truncate rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600">{certificate.certificateId}</code>
                </div>

                {isCurrentlyValid ? (
                  <div className="bg-slate-100 p-2 sm:p-4">
                    <iframe
                      ref={previewRef}
                      src={`/api/certificates/${encodeURIComponent(certificate.certificateId)}/download`}
                      className="h-[420px] w-full rounded-xl border border-slate-200 bg-white sm:h-[610px]"
                      title={`${certificate.courseTitle} credential preview`}
                      onLoad={() => setPreviewReady(true)}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[430px] items-center justify-center bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0)] p-6 sm:min-h-[540px]">
                    <div className="max-w-md text-center">
                      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm"><Award className="h-8 w-8" /></span>
                      <h3 className="mt-6 text-2xl font-extrabold">Document unavailable</h3>
                      <p className="mt-3 leading-7 text-slate-600">{status === "pending_activation" ? "Activate the optional credential to access its issued document. Your assessment result remains recorded." : "This document cannot be downloaded or printed while the credential is not currently valid. The record details remain visible for transparent verification."}</p>
                      {status === "pending_activation" && (
                        <Button asChild className="mt-6 rounded-xl bg-slate-950 text-white hover:bg-slate-800"><Link href={`/payment/${encodeURIComponent(certificate.certificateId)}`}>Review activation</Link></Button>
                      )}
                    </div>
                  </div>
                )}
              </article>

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap">
                <Button onClick={handleDownload} disabled={!isCurrentlyValid || isDownloading} className="rounded-xl bg-slate-950 text-white hover:bg-slate-800">
                  {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{isDownloading ? "Preparing PDF…" : "Download PDF"}
                </Button>
                <Button variant="outline" onClick={handlePrint} disabled={!isCurrentlyValid || !previewReady || isPrinting} className="rounded-xl">
                  {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}Print
                </Button>
                <Button variant="outline" onClick={handleShare} className="rounded-xl"><Share2 className="mr-2 h-4 w-4" />Share verification</Button>
                <Button variant="ghost" onClick={copyVerificationLink} className="rounded-xl sm:ml-auto"><Copy className="mr-2 h-4 w-4" />Copy link</Button>
              </div>
            </div>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-xs font-semibold text-slate-500">Live verification</p><h2 className="font-extrabold">Record details</h2></div></div>
                <dl className="mt-6 divide-y divide-slate-100">
                  {[
                    { icon: User, label: "Account holder", value: certificate.userName },
                    { icon: Award, label: "Recorded score", value: `${certificate.score}% · ${certificate.badge} tier` },
                    { icon: CalendarDays, label: "Issued", value: formatDate(certificate.issuedAt) },
                    { icon: CalendarDays, label: "Valid until", value: formatDate(certificate.expiresAt) },
                  ].map((item) => (
                    <div key={item.label} className="flex gap-3 py-4 first:pt-0 last:pb-0"><item.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0"><dt className="text-xs text-slate-500">{item.label}</dt><dd className="mt-1 break-words text-sm font-bold text-slate-900">{item.value}</dd></div></div>
                  ))}
                </dl>
                <Button asChild variant="outline" className="mt-6 w-full rounded-xl"><Link href={verificationPath}><ExternalLink className="mr-2 h-4 w-4" />Open live verification</Link></Button>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <img src={octamyLogo} alt="Octamy" className="h-10 w-auto shrink-0 object-contain" />
                  <div><p className="text-xs text-slate-500">Platform issuer</p><h2 className="mt-1 text-sm font-extrabold leading-5">{platformIssuer}</h2></div>
                </div>
                {coIssuer && (
                  <div className="mt-5 flex items-start gap-3 border-t border-slate-100 pt-5">
                    {coIssuer.logoUrl ? <img src={coIssuer.logoUrl} alt="" className="h-10 w-10 rounded-lg border border-slate-200 object-contain p-1" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Building2 className="h-5 w-5" /></span>}
                    <div><p className="text-xs text-slate-500">Verified institute co-issuer</p><p className="mt-1 text-sm font-extrabold">{coIssuer.name}</p></div>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-950">
                <h2 className="flex items-center gap-2 text-sm font-extrabold"><FileCheck2 className="h-4 w-4" />What this record proves</h2>
                <p className="mt-3 text-xs leading-6">It reports an Octamy account holder's scored assessment result and the credential's current status. It is not government-ID verification, a degree, a professional licence, work experience, or a guarantee of job performance.</p>
              </section>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
