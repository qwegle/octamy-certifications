import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Download,
  Loader2,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Header from "@/components/header";
import PayUMoneyForm from "@/components/payumoney-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

interface Address {
  id: number;
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phoneNumber: string;
  isDefault: boolean;
}

interface ActivationCheckout {
  certificateId: string;
  certificateNumber: string;
  userName: string;
  courseTitle: string;
  score: number;
  badge: string;
  issuedAt: string;
  expiresAt: string;
  status: "ready" | "activated" | "revoked";
  isPaid: boolean;
  isActive: boolean;
  pricing: {
    currency: "INR";
    digital: string;
    physicalShipping: string;
    originalDigital: string | null;
    isOnSale: boolean;
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function Payment() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [includesPhysicalCopy, setIncludesPhysicalCopy] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const checkoutQuery = useQuery<ActivationCheckout>({
    queryKey: [`/api/certificates/${encodeURIComponent(certificateId || "")}/activation`],
    enabled: Boolean(certificateId && isAuthenticated),
  });
  const { data: addresses = [] } = useQuery<Address[]>({
    queryKey: ["/api/user/addresses"],
    enabled: Boolean(isAuthenticated && checkoutQuery.data?.status === "ready"),
  });

  useEffect(() => {
    const defaultAddress = addresses.find((address) => address.isDefault);
    if (defaultAddress && selectedAddressId == null) {
      setSelectedAddressId(defaultAddress.id);
    }
  }, [addresses, selectedAddressId]);

  const pricing = useMemo(() => {
    const digital = Number(checkoutQuery.data?.pricing.digital || 0);
    const shipping = includesPhysicalCopy
      ? Number(checkoutQuery.data?.pricing.physicalShipping || 0)
      : 0;
    return { digital, shipping, total: digital + shipping };
  }, [checkoutQuery.data?.pricing, includesPhysicalCopy]);

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Loader2 className="h-7 w-7 animate-spin text-slate-700" aria-label="Loading account" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 py-12">
          <Card className="w-full border-slate-200 bg-white shadow-sm">
            <CardContent className="p-8 text-center sm:p-10">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                <LockKeyhole className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 className="mt-5 text-2xl font-semibold text-slate-950">Sign in to activate your credential</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Activation is available only from the learner account that owns the passing assessment record.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button onClick={() => setLocation("/login")}>Sign in securely</Button>
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>Back to dashboard</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (checkoutQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto grid min-h-[65vh] max-w-5xl place-items-center px-4 py-12">
          <div className="text-center text-slate-600">
            <Loader2 className="mx-auto h-7 w-7 animate-spin" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">Verifying your credential…</p>
          </div>
        </main>
      </div>
    );
  }

  if (checkoutQuery.error || !checkoutQuery.data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-4 py-12">
          <Card className="w-full border-amber-200 bg-white shadow-sm" role="alert">
            <CardContent className="p-8 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <h1 className="mt-5 text-xl font-semibold text-slate-950">Activation could not be loaded</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {checkoutQuery.error instanceof Error
                  ? checkoutQuery.error.message
                  : "This credential is not available in your account."}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button onClick={() => void checkoutQuery.refetch()}>Try again</Button>
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>Back to dashboard</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const credential = checkoutQuery.data;
  if (credential.status !== "ready") {
    const isActivated = credential.status === "activated";
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-4 py-12">
          <Card className="w-full border-slate-200 bg-white shadow-sm">
            <CardContent className="p-8 text-center sm:p-10">
              <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${isActivated ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                {isActivated ? <CheckCircle2 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
              </span>
              <h1 className="mt-5 text-2xl font-semibold text-slate-950">
                {isActivated ? "Credential already active" : "Credential cannot be activated"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {isActivated
                  ? "Your credential is already verified and available from your learner dashboard."
                  : "This credential has been revoked. No checkout was created or payment requested."}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                {isActivated && (
                  <Button onClick={() => window.open(`/api/certificates/${encodeURIComponent(credential.certificateId)}/download?format=pdf`, "_blank")}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download credential
                  </Button>
                )}
                <Button variant="outline" onClick={() => setLocation("/dashboard")}>Back to dashboard</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Button variant="ghost" className="mb-5 -ml-3 text-slate-600" onClick={() => setLocation("/dashboard")}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to learner dashboard
        </Button>

        <div className="mb-8 max-w-3xl">
          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">Optional credential activation</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Make your assessment evidence recruiter-ready</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            You have already passed. Activation adds a downloadable certificate and a live verification status to your Evidence Passport.
          </p>
        </div>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="h-fit border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                <Award className="h-5 w-5 text-sky-700" aria-hidden="true" />
                Passing evidence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="rounded-2xl bg-slate-950 p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">Assessment passed</p>
                <h2 className="mt-3 text-2xl font-semibold leading-tight">{credential.courseTitle}</h2>
                <p className="mt-4 text-sm text-slate-300">Awarded to</p>
                <p className="mt-1 font-semibold">{credential.userName}</p>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
                  <div>
                    <p className="text-xs text-slate-400">Score</p>
                    <p className="mt-1 text-2xl font-semibold">{credential.score}%</p>
                  </div>
                  <Badge className="border-0 bg-sky-300 text-slate-950 hover:bg-sky-300">{credential.badge}</Badge>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Credential ID</span>
                  <code className="truncate text-xs font-medium text-slate-800">{credential.certificateId}</code>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Activation validity</span>
                  <span className="font-medium text-slate-800">12 months from activation</span>
                </div>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
                  <p>Pricing and learner identity are verified by Octamy on the server. The payment provider activates this record only after a verified callback.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-lg text-slate-950">Choose your format</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-3">
                <button
                  type="button"
                  aria-pressed={!includesPhysicalCopy}
                  className={`flex min-h-24 w-full items-start gap-4 rounded-2xl border p-4 text-left transition ${!includesPhysicalCopy ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500" : "border-slate-200 hover:border-slate-300"}`}
                  onClick={() => setIncludesPhysicalCopy(false)}
                >
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${!includesPhysicalCopy ? "border-sky-700 bg-sky-700 text-white" : "border-slate-300 bg-white"}`} aria-hidden="true">
                    {!includesPhysicalCopy && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold text-slate-950"><Download className="h-4 w-4" />Digital credential</span>
                    <span className="mt-1 block text-sm leading-5 text-slate-600">Instant PDF download and live verification record.</span>
                  </span>
                  <span className="shrink-0 font-semibold text-slate-950">{formatCurrency(pricing.digital)}</span>
                </button>

                <button
                  type="button"
                  aria-pressed={includesPhysicalCopy}
                  className={`flex min-h-24 w-full items-start gap-4 rounded-2xl border p-4 text-left transition ${includesPhysicalCopy ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500" : "border-slate-200 hover:border-slate-300"}`}
                  onClick={() => setIncludesPhysicalCopy(true)}
                >
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${includesPhysicalCopy ? "border-sky-700 bg-sky-700 text-white" : "border-slate-300 bg-white"}`} aria-hidden="true">
                    {includesPhysicalCopy && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold text-slate-950"><Truck className="h-4 w-4" />Digital + physical</span>
                    <span className="mt-1 block text-sm leading-5 text-slate-600">Digital access plus a printed certificate sent to your address.</span>
                  </span>
                  <span className="shrink-0 font-semibold text-slate-950">{formatCurrency(pricing.digital + Number(credential.pricing.physicalShipping))}</span>
                </button>
              </div>

              {includesPhysicalCopy && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <Label htmlFor="shipping-address" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    Shipping address
                  </Label>
                  {addresses.length > 0 ? (
                    <Select value={selectedAddressId?.toString()} onValueChange={(value) => setSelectedAddressId(Number(value))}>
                      <SelectTrigger id="shipping-address" className="min-h-11 bg-white">
                        <SelectValue placeholder="Choose an address" />
                      </SelectTrigger>
                      <SelectContent>
                        {addresses.map((address) => (
                          <SelectItem key={address.id} value={String(address.id)}>
                            {address.fullName} · {address.addressLine1}, {address.city} {address.postalCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center">
                      <p className="text-sm text-slate-600">Add a shipping address before selecting a physical copy.</p>
                      <Button variant="outline" className="mt-3" onClick={() => setLocation("/profile-edit")}>Add address</Button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 border-y border-slate-100 py-5 text-sm">
                <div className="flex justify-between gap-4 text-slate-600">
                  <span>Credential activation</span>
                  <span>{formatCurrency(pricing.digital)}</span>
                </div>
                {pricing.shipping > 0 && (
                  <div className="flex justify-between gap-4 text-slate-600">
                    <span>Print and shipping</span>
                    <span>{formatCurrency(pricing.shipping)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4 pt-2 text-lg font-semibold text-slate-950">
                  <span>Total</span>
                  <span>{formatCurrency(pricing.total)}</span>
                </div>
              </div>

              <PayUMoneyForm
                certificateId={credential.certificateId}
                amount={pricing.total.toFixed(2)}
                courseTitle={credential.courseTitle}
                includesPhysicalCopy={includesPhysicalCopy}
                selectedAddressId={selectedAddressId}
                sellerCode={localStorage.getItem("referralCode")}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
