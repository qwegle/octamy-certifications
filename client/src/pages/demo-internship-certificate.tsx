import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileSearch,
  Fingerprint,
  ListChecks,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const evidence = [
  { label: "Assessment score", value: "86%", icon: BarChart3 },
  { label: "Passing threshold", value: "50%", icon: CheckCircle2 },
  { label: "Questions scored", value: "40", icon: ListChecks },
  { label: "Recorded duration", value: "52 min", icon: Clock3 },
];

const boundaries = [
  "This record represents a scored online assessment, not employment or an internship placement.",
  "It does not claim supervised work experience, mentor validation, accreditation, or identity verification.",
  "A live record shows its current activation, expiry, and revocation status at verification time.",
];

export default function DemoInternshipCertificate() {
  return (
    <div className="min-h-screen bg-[#f5f2ea] text-slate-950">
      <SEO
        title="Assessment Program Record Preview"
        description="See exactly what an Octamy assessment record proves—and what it does not."
        path="/demo-internship-certificate"
        noIndex
      />
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-slate-900/10 bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(56,189,248,.28),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(167,139,250,.24),transparent_32%)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <Link href="/virtual-internships">
              <Button
                variant="ghost"
                className="mb-8 -ml-3 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Assessment programs
              </Button>
            </Link>
            <div className="max-w-3xl">
              <Badge className="mb-5 border border-sky-300/30 bg-sky-300/10 text-sky-100 hover:bg-sky-300/10">
                Illustrative preview · not a live credential
              </Badge>
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
                Evidence that says exactly what happened.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                Octamy records a learner&apos;s assessment result, status, and evidence boundaries. It never turns an online test into a claim of employment or work experience.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.65fr)]">
            <article className="overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white shadow-[0_30px_80px_-36px_rgba(15,23,42,.4)]">
              <div className="flex flex-col gap-5 border-b border-white/10 bg-slate-950 px-6 py-7 text-white sm:flex-row sm:items-start sm:justify-between sm:px-10">
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-lg font-black text-slate-950">
                    O
                  </div>
                  <div>
                    <p className="font-bold tracking-wide">OCTAMY</p>
                    <p className="text-sm text-slate-400">Assessment program record</p>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-[.2em] text-slate-400">Preview reference</p>
                  <p className="mt-1 font-mono text-sm">SAMPLE-DS-2026</p>
                </div>
              </div>

              <div className="px-6 py-10 sm:px-10 sm:py-14">
                <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[.2em] text-violet-700">Assessment passed</p>
                    <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Data Science Skills</h2>
                    <p className="mt-5 text-slate-600">Illustrative learner: <span className="font-bold text-slate-900">Aarav Mehta</span></p>
                  </div>
                  <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-[10px] border-emerald-100 bg-emerald-600 text-center text-white shadow-inner">
                    <div>
                      <span className="block text-3xl font-black">86</span>
                      <span className="text-xs font-bold uppercase tracking-wider">percent</span>
                    </div>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {evidence.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <Icon className="h-5 w-5 text-violet-700" />
                      <p className="mt-5 text-2xl font-black">{value}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <Fingerprint className="mt-0.5 h-6 w-6 shrink-0 text-violet-700" />
                    <div>
                      <h3 className="font-bold">Recorded evidence</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Score, passing threshold, assessment title, attempt timestamp, and current credential status. A public verifier sees only the fields approved for sharing.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <span>Illustrative status: activated and valid</span>
                  </div>
                  <span>Example completion: 14 July 2026</span>
                </div>
              </div>
            </article>

            <aside className="space-y-5">
              <Card className="rounded-[1.75rem] border-amber-300/60 bg-amber-50 shadow-none">
                <CardContent className="p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <CircleAlert className="h-6 w-6 text-amber-700" />
                    <h2 className="text-lg font-black">Evidence boundaries</h2>
                  </div>
                  <ul className="mt-5 space-y-4">
                    {boundaries.map((item) => (
                      <li key={item} className="flex gap-3 text-sm leading-6 text-amber-950/80">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="rounded-[1.75rem] border-slate-200 shadow-none">
                <CardContent className="p-6 sm:p-7">
                  <FileSearch className="h-7 w-7 text-violet-700" />
                  <h2 className="mt-5 text-xl font-black">Verification is live, not decorative</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    A real verification page distinguishes an activated record from one that is pending payment, expired, revoked, or unknown.
                  </p>
                  <Link href="/verify">
                    <Button variant="outline" className="mt-6 w-full rounded-xl border-slate-300">
                      Open verifier
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="rounded-[1.75rem] border-0 bg-violet-700 text-white shadow-xl shadow-violet-900/15">
                <CardContent className="p-6 sm:p-7">
                  <LockKeyhole className="h-7 w-7 text-violet-200" />
                  <h2 className="mt-5 text-xl font-black">Prove first. Decide later.</h2>
                  <p className="mt-3 text-sm leading-6 text-violet-100">
                    Take an assessment without buying a credential. If you pass, choose whether to activate and share the evidence.
                  </p>
                  <Link href="/exams">
                    <Button className="mt-6 w-full rounded-xl bg-white text-violet-800 hover:bg-violet-50">
                      Browse assessments
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </aside>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
