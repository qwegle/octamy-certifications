import { Link } from "wouter";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  Fingerprint,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const journey = [
  {
    step: "01",
    title: "Learn",
    sentence: "Build capability through digital lessons, creator-led courses, and institute learning programs.",
    detail: "Educators can organise video, PDF, text, link, and quiz lessons into a reusable online curriculum.",
    icon: BookOpenCheck,
    color: "bg-sky-500",
  },
  {
    step: "02",
    title: "Validate",
    sentence: "Turn learning into measurable evidence through a scored, time-bound assessment.",
    detail: "The record preserves the score, threshold, attempt context, and declared proctoring signals without overstating what they prove.",
    icon: Fingerprint,
    color: "bg-violet-600",
  },
  {
    step: "03",
    title: "Certify",
    sentence: "Activate a digital credential only after the learner has met the published passing standard.",
    detail: "Every activated credential has a live status. Institute programs can be co-branded while Octamy remains the digital credential platform.",
    icon: Award,
    color: "bg-amber-500",
  },
  {
    step: "04",
    title: "Get recruited",
    sentence: "Let approved recruiters discover evidence—not just claims—when the learner and their institute allow it.",
    detail: "Discovery is opt-in and does not guarantee interviews, offers, placement, or job performance.",
    icon: BriefcaseBusiness,
    color: "bg-emerald-600",
  },
];

const values = [
  { title: "Secure by design", text: "Least-privilege access, tenant boundaries, explicit sharing controls, and auditable sensitive actions.", icon: LockKeyhole },
  { title: "Authentic status", text: "Verification reports whether a record is active, pending activation, expired, revoked, or unknown.", icon: ShieldCheck },
  { title: "Evidence boundaries", text: "A score is not identity verification, employment, accreditation, or a guarantee of future performance.", icon: Eye },
  { title: "Digital-first", text: "Learning, assessment, evidence, credential status, and recruiter discovery are designed as online workflows.", icon: Network },
];

export default function VisionPage() {
  return (
    <div className="min-h-screen bg-[#f6f3eb] text-slate-950">
      <SEO
        title="Our Vision"
        description="Octamy's vision: Learn, Validate, Certify, and Get recruited through consent-based digital skill evidence."
        path="/vision"
      />
      <Header />
      <main id="main-content">
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_15%_0%,rgba(14,165,233,.25),transparent_32%),radial-gradient(circle_at_80%_15%,rgba(139,92,246,.27),transparent_34%),radial-gradient(circle_at_55%_100%,rgba(16,185,129,.14),transparent_35%)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <Badge className="border border-white/15 bg-white/10 text-white hover:bg-white/10">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Octamy&apos;s product vision
            </Badge>
            <h1 className="mt-7 max-w-5xl text-5xl font-black leading-[.95] tracking-[-.045em] sm:text-7xl lg:text-8xl">
              Learn. Validate. Certify. <span className="text-emerald-400">Get recruited.</span>
            </h1>
            <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
              We want every learner to carry inspectable skill evidence from education into opportunity—without paying before proving, and without losing control of who can discover them.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/get-certified"><Button size="lg" className="w-full rounded-xl bg-white text-slate-950 hover:bg-slate-100 sm:w-auto">Explore certifications <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link href="/institute"><Button size="lg" variant="outline" className="w-full rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto">Build an institute workspace</Button></Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[.2em] text-violet-700">The evidence journey</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">One connected path, with honest gates.</h2>
          </div>

          <div className="relative mt-12 grid gap-5 lg:grid-cols-4">
            <div className="absolute left-[12.5%] right-[12.5%] top-9 hidden h-px bg-slate-300 lg:block" />
            {journey.map(({ step, title, sentence, detail, icon: Icon, color }) => (
              <article key={title} className="relative rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,.5)] sm:p-7">
                <div className={"relative z-10 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg " + color}><Icon className="h-6 w-6" /></div>
                <p className="mt-8 text-xs font-black tracking-[.2em] text-slate-400">STEP {step}</p>
                <h3 className="mt-2 text-2xl font-black">{title}</h3>
                <p className="mt-4 font-semibold leading-7 text-slate-800">{sentence}</p>
                <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
            <div>
              <p className="text-sm font-black uppercase tracking-[.2em] text-emerald-700">What we value</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight">Trust is a product behavior.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                “Secure” and “authentic” are not decorative badges. They require controls a learner, institute, and recruiter can inspect and understand.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {values.map(({ title, text, icon: Icon }) => (
                <article key={title} className="rounded-2xl border border-slate-200 bg-[#f8f6f0] p-6">
                  <Icon className="h-6 w-6 text-violet-700" />
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h2 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">A vision, not a job guarantee.</h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Octamy can make evidence clearer and discovery more efficient. It cannot guarantee that an assessment predicts job performance or that a learner will be hired. We will measure our progress through valid assessments, trusted issuers, learner consent, and real hiring outcomes.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
