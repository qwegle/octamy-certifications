import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Award,
  ArrowRight,
  Medal,
  Trophy,
  Crown,
  Sparkles,
  ShieldCheck,
  FileCheck2,
  Building2,
  BadgeCheck,
  UserPlus,
  ClipboardCheck,
  CheckCircle2,
  FileBadge,
  Code,
  Cpu,
  LineChart,
  Cloud,
  Briefcase,
  Megaphone,
  Database,
  Palette,
  Layers,
  GraduationCap,
  Wallet,
  Users,
  Search as SearchIcon,
} from "lucide-react";
import CourseCard from "@/components/course-card";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { Reveal, Stagger, StaggerItem, MagneticCard, CountUp } from "@/components/motion-primitives";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/header";
import Footer from "@/components/footer";
import type { Category, Course } from "@shared/schema";
import { SEO } from "@/components/seo";
import { publicAssessmentCategoryPath } from "@shared/public-assessment-routes";

const PREMIUM_CATEGORY_SLUGS: string[] = (
  import.meta.env.VITE_PREMIUM_CATEGORY_SLUGS || ""
)
  .split(",")
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);

// ---------- Recent / sample certifications ----------
const SAMPLE_CERTS = [
  { name: "Aarav Shah",   company: "Sample credential", course: "Python Developer",           badge: "Gold",     score: 86, color: "from-amber-500 to-amber-700" },
  { name: "Priya Iyer",   company: "Sample credential", course: "Generative AI Foundations",  badge: "Platinum", score: 92, color: "from-slate-900 to-slate-700" },
  { name: "Rahul Verma",  company: "Sample credential", course: "AWS Cloud Practitioner",     badge: "Silver",   score: 74, color: "from-slate-500 to-slate-700" },
  { name: "Ananya Reddy", company: "Sample credential", course: "Cybersecurity Analyst",      badge: "Gold",     score: 81, color: "from-amber-500 to-amber-700" },
  { name: "Vikram Singh", company: "Sample credential", course: "Full-Stack JavaScript",      badge: "Platinum", score: 95, color: "from-slate-900 to-slate-700" },
  { name: "Meera Nair",   company: "Sample credential", course: "Data Science Essentials",    badge: "Silver",   score: 71, color: "from-slate-500 to-slate-700" },
];

function CertificateSlider() {
  const { data: liveCerts = [] } = useQuery<any[]>({
    queryKey: ["/api/recent-certificates"],
  });

  const showLive = liveCerts.length > 0;
  const items = showLive ? liveCerts : SAMPLE_CERTS;

  return (
    <section className="bg-cream-deep py-12 sm:py-20 border-y border-cream-deep">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal as="div" className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {showLive ? "Live proof" : "Sample credentials"}
          </p>
          <h3 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
            {showLive ? "Recent certifications" : "What an Octamy credential looks like"}
          </h3>
          <p className="text-slate-600 mt-3">
            {showLive
              ? "Real candidates earning verified credentials."
              : "A passed assessment can become an activated, publicly checkable credential when the learner chooses."}
          </p>
        </Reveal>

        <Stagger className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
          {items.slice(0, 6).map((cert, idx) => (
            <StaggerItem key={`${cert.name}-${idx}`} className="min-w-[86%] snap-start sm:min-w-0">
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="group h-full overflow-hidden rounded-2xl border border-cream-deep bg-cream-soft shadow-sm hover:shadow-xl"
              >
                {/* Mini certificate preview */}
                <div className={`relative h-32 bg-gradient-to-br ${cert.color || "from-slate-900 to-slate-700"} text-white p-5 flex flex-col justify-between overflow-hidden`}>
                  <div aria-hidden className="absolute inset-0 bg-grid-white opacity-30" />
                  <div className="relative flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">Octamy Certified</span>
                    <Award className="h-5 w-5 text-white/90" />
                  </div>
                  <div className="relative">
                    <p className="text-[10px] uppercase tracking-wider text-white/60">Awarded to</p>
                    <p className="text-lg font-bold leading-tight truncate">{cert.name}</p>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-500">Certified in</p>
                  <p className="font-semibold text-slate-900 truncate">{cert.course}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="outline" className="border-slate-300 text-slate-700 text-[11px]">
                      {cert.badge} Badge
                    </Badge>
                    <span className="text-xs font-medium text-slate-600 tabular-nums">
                      {showLive ? "Score: ••%" : `Score: ${cert.score}%`}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Publicly checkable · {cert.company || "Octamy.com"}
                  </div>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </Stagger>

        {!showLive && (
          <Reveal as="div" className="mt-8 text-center">
            <p className="text-xs text-slate-500 italic">
              Sample preview · Live certificates appear here once candidates pass their first exam.
            </p>
            <Button asChild className="mt-4 bg-slate-900 hover:bg-black text-white rounded-full px-6">
              <Link href="/get-certified">
                Take a free assessment <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </Reveal>
        )}
      </div>
    </section>
  );
}

// ---------- Badge tier card ----------
function BadgeTier({
  tier,
  range,
  label,
  icon,
  accent,
}: {
  tier: string;
  range: string;
  label: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className="group rounded-xl border border-cream-deep bg-cream-soft p-6 text-center transition-shadow hover:shadow-lg"
    >
      <div
        className={
          "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ring-1 transition-transform group-hover:scale-110 group-hover:rotate-[6deg] " +
          accent
        }
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 tracking-wide">
        {tier}
      </h3>
      <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
        {range}
      </p>
      <p className="mt-2 text-xs uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </motion.div>
  );
}

// ---------- Category icon mapping ----------
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  development: Code,
  "web-development": Code,
  programming: Code,
  ai: Cpu,
  "artificial-intelligence": Cpu,
  "machine-learning": Cpu,
  "data-science": LineChart,
  data: Database,
  analytics: LineChart,
  cloud: Cloud,
  devops: Cloud,
  cybersecurity: ShieldCheck,
  security: ShieldCheck,
  business: Briefcase,
  management: Briefcase,
  marketing: Megaphone,
  design: Palette,
  "ui-ux": Palette,
  finance: Wallet,
  education: GraduationCap,
  hr: Users,
};

function iconForCategory(slug: string | null | undefined) {
  const key = (slug || "").toLowerCase();
  return CATEGORY_ICONS[key] || Layers;
}

// ---------- FAQ data ----------
const FAQS: { q: string; a: string }[] = [
  {
    q: "Is the certificate recognized by employers?",
    a: "Octamy credentials record an assessment score and badge tier that an employer can inspect. They are an independent signal of assessment performance — not employer accreditation, a degree, government-ID verification or a guarantee of job performance.",
  },
  {
    q: "What happens if I fail an assessment?",
    a: "There is no charge for failing. You simply do not earn a certificate. You can retake the assessment after the cool-off period. We never ask for payment up front.",
  },
  {
    q: "Do I have to pay before taking the test?",
    a: "No. Every assessment is free to attempt. You only pay when you pass with a score of 50% or higher and choose to claim your verified certificate.",
  },
  {
    q: "How is verification done?",
    a: "Each activated credential has a unique ID. Anyone with that ID can check its recorded holder name, score, badge tier, issue date and current active, expired or revoked status at octamy.com/verify.",
  },
  {
    q: "Can institutes / companies bulk-certify their teams?",
    a: "Institute workspaces support cohorts, bulk student enrolment, private question banks, assessment windows and results reporting. Contact us to discuss an institute rollout.",
  },
  {
    q: "Is there a refund policy?",
    a: "Because the assessment itself is free and payment only happens after a passing score, certificate purchases are generally final. For genuine technical issues we review on a case-by-case basis — contact support within 7 days.",
  },
  {
    q: "What ID / proof is needed?",
    a: "Your credential uses the name on your Octamy account. Octamy does not currently perform government-ID verification, so the live record verifies the account's assessment result—not civil identity.",
  },
  {
    q: "Are the assessments timed?",
    a: "Yes. Every assessment has a fixed time limit shown on the exam page before you start. The timer pauses only for sanctioned breaks where applicable.",
  },
];

// ---------- Page ----------
export default function Landing() {
  const [searchQuery] = useState("");
  const [selectedCategory] = useState<number | null>(null);
  const { isAuthenticated } = useAuth();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: courses = [] } = useQuery<(Course & { category: Category })[]>({
    queryKey: ["/api/courses"],
  });

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      !searchQuery ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || course.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Product safeguards only. Corporate certifications are shown elsewhere only
  // when a publishable identifier has been configured.
  const trustItems = [
    { icon: ClipboardCheck, label: "Free to assess" },
    { icon: Wallet, label: "Pay only after passing" },
    { icon: FileCheck2, label: "Server-scored result" },
    { icon: ShieldCheck, label: "Live status verification" },
    { icon: Users, label: "Sharing is opt-in" },
    { icon: BadgeCheck, label: "Clear expiry status" },
  ];
  const heroBanners = [
    { icon: Sparkles, title: "Assess", text: "Start without paying for a credential upfront" },
    { icon: ShieldCheck, title: "Inspect", text: "Live credential status and recorded assessment score" },
    { icon: Trophy, title: "Performance", text: "Bronze to Platinum badge tiers on every pass" },
    { icon: Users, title: "Enterprise", text: "Bulk assessment and verification support for teams" },
  ];

  // 8-tile featured tracks grid (with course counts)
  const featuredTracks = categories.slice(0, 8).map((cat) => ({
    ...cat,
    count: courses.filter((c) => c.categoryId === cat.id).length,
    Icon: iconForCategory(cat.slug),
    isPremium: PREMIUM_CATEGORY_SLUGS.includes((cat.slug || "").toLowerCase()),
  }));

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Octamy",
    url: "https://octamy.com/",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://octamy.com/get-certified?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-cream-soft">
      <SEO
        title="Octamy — Evidence-backed Skill Verification"
        description="Take a scored skill assessment free. Pay only after passing if you want an activated credential, then share the evidence and its live status."
        path="/"
        jsonLd={[websiteJsonLd, faqJsonLd]}
      />
      <Header />
      <main id="main-content" tabIndex={-1}>

      {/* 1. HERO — reflective black left rail · clean white right ---------- */}
      <section className="relative overflow-hidden bg-cream-soft">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pt-14 sm:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">

            {/* LEFT — glossy black hero panel */}
            <div className="lg:col-span-8">
              <div className="glossy-black relative flex min-h-[430px] flex-col justify-between overflow-hidden rounded-3xl px-6 py-10 sm:min-h-[460px] sm:px-10 sm:py-14">
                {/* subtle ambient highlights inside the black panel */}
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-white [mask-image:radial-gradient(ellipse_at_top_right,black_30%,transparent_70%)] opacity-60" />
                <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-[360px] w-[360px] rounded-full bg-cream-soft/[0.06] blur-3xl animate-blob-slow" />
                <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/4 h-[260px] w-[260px] rounded-full bg-cream-soft/[0.04] blur-3xl animate-blob" />

                <div className="relative z-10 max-w-2xl">
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-cream-soft/[0.04] backdrop-blur px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cream-soft/60 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-cream-soft" />
                    </span>
                    Proof before payment
                  </motion.p>

                  <motion.h1
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-6 text-4xl sm:text-5xl md:text-[56px] leading-[1.05] font-extrabold tracking-tight text-white"
                  >
                    Prove first.
                    <br />
                    <span className="text-chrome">Pay only when you pass.</span>
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="mt-5 max-w-xl text-base sm:text-lg text-white/70 leading-relaxed"
                  >
                    Take a scored assessment free. If you pass, choose whether to activate a credential and carry the inspectable result into hiring.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.35 }}
                    className="mt-8 flex flex-col sm:flex-row gap-3"
                  >
                    <Button asChild size="lg" className="rounded-full border-white bg-white px-6 py-6 text-base font-semibold text-slate-950 shadow-xl shadow-black/30 hover:bg-slate-100">
                      <Link href="/get-certified">
                        Take a free assessment
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="rounded-full border-white/20 bg-white/[0.04] px-6 py-6 text-base text-white shadow-none hover:bg-white/[0.1] hover:text-white">
                      <a href="#how">
                        How it works
                      </a>
                    </Button>
                  </motion.div>
                </div>

                {/* Live stats anchored bottom-left */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="relative z-10 mt-8 flex max-w-xl flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5"
                >
                  {[
                    { v: courses.length, s: "", l: "Live exams" },
                    { v: categories.length, s: "", l: "Skill tracks" },
                    { v: 1, s: "", l: "Portable passport" },
                  ].map((s) => (
                    <div key={s.l} className="flex items-baseline gap-1.5">
                      <p className="text-lg font-bold text-white tabular-nums">
                        <CountUp to={s.v} suffix={s.s} />
                      </p>
                      <p className="text-[11px] text-white/55">{s.l}</p>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* RIGHT — glassmorphic auth card */}
            <div className="lg:col-span-4 relative">
              <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-[280px] w-[280px] rounded-full bg-amber-300/40 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-10 -left-6 h-[220px] w-[220px] rounded-full bg-sky-300/40 blur-3xl" />
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="h-full relative"
              >
                <div className="flex h-full flex-col rounded-3xl border border-slate-300 bg-white/80 p-6 shadow-xl shadow-slate-900/10 backdrop-blur-2xl sm:p-7">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                      Get started — free
                    </p>
                  </div>
                  <h3 className="mt-3 text-2xl font-bold text-slate-900 leading-tight">
                    Choose your workspace
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Start free. You can add another role from your profile later.
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Choose account type">
                    {[
                      { label: 'Learner', href: '/register?role=learner', Icon: GraduationCap },
                      { label: 'Creator', href: '/register?role=creator', Icon: Sparkles },
                      { label: 'Institute', href: '/register?role=institute', Icon: Building2 },
                    ].map(({ label, href, Icon }) => (
                      <Link key={label} href={href} className="group rounded-xl border border-slate-200 bg-white/70 px-2 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-slate-900 hover:shadow-sm">
                        <Icon className="mx-auto h-4 w-4 text-slate-500 group-hover:text-slate-950" />
                        <span className="mt-1.5 block text-[11px] font-semibold text-slate-700 group-hover:text-slate-950">{label}</span>
                      </Link>
                    ))}
                  </div>

                  <div className="mt-4 space-y-3">
                    <GoogleAuthButton type="user" hideWhenUnavailable />
                    <Button asChild className="w-full rounded-xl">
                      <Link href="/register">
                        Create account with email
                      </Link>
                    </Button>
                  </div>
                  <div className="my-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    Already have an account?
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                  <Button asChild variant="outline" className="w-full rounded-xl bg-white/70 font-semibold">
                    <Link href="/login">
                      Sign in to Octamy
                    </Link>
                  </Button>

                  <div className="mt-auto pt-4">
                    <Link href="/recruiter/login" className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-950">
                      <span className="inline-flex items-center gap-2"><Briefcase className="h-4 w-4" />Recruiter or hiring team?</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Secure sign-up · No card required
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Trusted-at strip — compressed */}
          <Reveal as="div" delay={0.15} className="mt-8 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 mr-2">How trust works</p>
              {trustItems.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-slate-500 text-xs sm:text-sm font-medium">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  {label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* USP — one evidence layer across learning and hiring ------------ */}
      <section className="py-12 sm:py-24 bg-slate-950 text-white border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            <Reveal as="div" className="lg:col-span-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">The Octamy difference</p>
              <h2 className="mt-4 text-3xl sm:text-5xl font-bold tracking-tight">One evidence trail from assessment to hiring.</h2>
              <p className="mt-5 text-slate-300 leading-relaxed">
                Course platforms often prove completion. Credential tools verify issuance. Hiring tests often keep results inside one employer workflow. Octamy connects a scored attempt, learner-controlled share link, credential status and recruiter inspection in one record.
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500">Today this is assessment-backed account evidence—not government-ID verification, accreditation or proof that someone can perform every part of a job.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button asChild className="rounded-full bg-white text-slate-950 hover:bg-slate-100 px-6">
                  <Link href="/get-certified">Build my passport <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-white/25 bg-transparent text-white hover:bg-white hover:text-slate-950 px-6">
                  <Link href="/institute">For institutions</Link>
                </Button>
              </div>
            </Reveal>
            <Stagger className="lg:col-span-7 grid sm:grid-cols-3 gap-4">
              {[
                { Icon: ClipboardCheck, step: "01", title: "Measured", body: "A scored, timed assessment creates evidence beyond attendance." },
                { Icon: FileCheck2, step: "02", title: "Learner-controlled", body: "A private share link consolidates activated evidence when the learner opts in." },
                { Icon: ShieldCheck, step: "03", title: "Status-aware", body: "The live record shows score, issuer, issue date, expiry and revocation status." },
              ].map((item) => (
                <StaggerItem key={item.title}>
                  <div className="h-full rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur">
                    <div className="flex items-center justify-between">
                      <item.Icon className="h-5 w-5 text-sky-300" />
                      <span className="text-xs font-mono text-white/35">{item.step}</span>
                    </div>
                    <h3 className="mt-8 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* 2. HOW OCTAMY WORKS ---------------------------------------------- */}
      <section id="how" className="py-12 sm:py-24 bg-cream-deep border-y border-cream-deep">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal as="div" className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              How it works
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
              How Octamy works
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Four simple steps from sign-up to a recruiter-verifiable
              certificate.
            </p>
          </Reveal>

          <Stagger className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <div aria-hidden className="hidden lg:block absolute top-9 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent" />
            {[
              {
                n: "01",
                title: "Register free",
                desc: "Create an account in under a minute — no card required.",
                Icon: UserPlus,
              },
              {
                n: "02",
                title: "Take a free assessment",
                desc: "Pick from the live catalog across modern career tracks.",
                Icon: ClipboardCheck,
              },
              {
                n: "03",
                title: "Pass with 50%+ score",
                desc: "Earn a recognition tier — Bronze, Silver, Gold or Platinum.",
                Icon: CheckCircle2,
              },
              {
                n: "04",
                title: "Buy your certificate",
                desc: "Optional: activate a credential with a public status check.",
                Icon: FileBadge,
              },
            ].map((step) => (
              <StaggerItem key={step.n}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 240, damping: 18 }}
                  className="relative rounded-xl border border-cream-deep bg-cream-soft p-4 sm:p-6 transition-shadow hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-7 px-2 items-center rounded-full bg-sky-50 text-[11px] font-bold tracking-[0.2em] text-sky-700 ring-1 ring-sky-200">
                      {step.n}
                    </span>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                      <step.Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <h3 className="mt-4 sm:mt-5 text-base sm:text-lg font-semibold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {step.desc}
                  </p>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>

          <p className="mt-10 text-center text-xs text-slate-500 max-w-2xl mx-auto">
            This program is an assessment and skill-certification initiative
            and does not constitute employment.
          </p>
        </div>
      </section>

      {/* 3. REAL STATS ---------------------------------------------------- */}
      <section className="hidden py-12 sm:py-20 bg-cream-soft" aria-hidden="true">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="rounded-xl border border-cream-deep bg-cream-soft p-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                Live exams
              </p>
              <p className="mt-3 text-5xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                {courses.length}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Skill assessments available right now.
              </p>
            </div>
            <div className="rounded-xl border border-cream-deep bg-cream-soft p-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                Career tracks
              </p>
              <p className="mt-3 text-5xl font-extrabold tracking-tight text-slate-900 tabular-nums">
                {categories.length}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Curated categories spanning tech, business and design.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FEATURED TRACKS GRID ------------------------------------------ */}
      <section className="hidden py-12 sm:py-24 bg-cream-deep border-y border-cream-deep" aria-hidden="true">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal as="div" className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              Browse by track
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
              Featured career tracks
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Pick a discipline and start with a free assessment.
            </p>
          </Reveal>

          <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" step={0.06}>
            {featuredTracks.map((cat) => {
              const Icon = cat.Icon;
              const baseCard =
                "group relative flex flex-col h-full rounded-xl border p-4 sm:p-6 transition-all hover:-translate-y-1 hover:shadow-xl";
              const cardClass = cat.isPremium
                ? `${baseCard} bg-gradient-to-br from-amber-50 to-white border-amber-200 ring-1 ring-amber-200`
                : `${baseCard} bg-cream-soft border-cream-deep hover:border-slate-900`;
              return (
                <StaggerItem key={cat.id} className="h-full">
                  <Link href={publicAssessmentCategoryPath(cat.slug)} className={cardClass}>
                    {cat.isPremium && (
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                        <Sparkles className="w-3 h-3" />
                        Premium
                      </span>
                    )}
                    <div
                      className={
                        "flex h-11 w-11 items-center justify-center rounded-lg transition-transform group-hover:scale-110 " +
                        (cat.isPremium
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-900 text-white")
                      }
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="mt-5 text-base font-semibold text-slate-900">
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {cat.count} {cat.count === 1 ? "exam" : "exams"} · 50–80% to pass
                    </p>
                    <span className="mt-auto pt-4 inline-flex items-center text-sm font-medium text-slate-700 transition-all group-hover:gap-2">
                      Explore <ArrowRight className="ml-1 w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </StaggerItem>
              );
            })}
            {featuredTracks.length === 0 &&
              ["AI", "Development", "Cloud", "Cybersecurity", "Data Science", "Design", "Business", "DevOps"].map((name, i) => (
                <StaggerItem key={name} className="h-full">
                  <Link href="/get-certified" className="group relative flex flex-col h-full rounded-xl border border-cream-deep bg-cream-soft p-4 sm:p-6 transition-all hover:-translate-y-1 hover:border-slate-900 hover:shadow-xl">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <h3 className="mt-5 text-base font-semibold text-slate-900">{name}</h3>
                    <p className="mt-1 text-sm text-slate-500">Free assessment · Pass to certify</p>
                    <span className="mt-auto pt-4 inline-flex items-center text-sm font-medium text-slate-700">
                      Explore <ArrowRight className="ml-1 w-3.5 h-3.5" />
                    </span>
                  </Link>
                </StaggerItem>
              ))
            }
          </Stagger>

          {categories.length > 8 && (
            <Reveal as="div" className="mt-10 text-center">
              <Button
                asChild
                  variant="outline"
                  className="border-slate-300 text-slate-700 rounded-full"
                >
                <Link href="/get-certified">
                  View all {categories.length} tracks
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </Reveal>
          )}
        </div>
      </section>

      {/* 5. WHY OCTAMY / 3 PILLARS --------------------------------------- */}
      <section className="hidden py-16 sm:py-24 bg-cream-soft" aria-hidden="true">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal as="div" className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              Why Octamy
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
              Built for candidates and the people who hire them
            </h2>
          </Reveal>

          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                Icon: ShieldCheck,
                title: "Inspectable",
                body: "Every activated credential carries a unique ID. Recruiters can inspect the score and current status without emailing the issuer.",
              },
              {
                Icon: Wallet,
                title: "Affordable",
                body: "Take any assessment for free. Pay only after you pass — no subscriptions, no upfront fees, no surprises.",
              },
              {
                Icon: BadgeCheck,
                title: "Recruiter-friendly",
                body: "Score and badge tier (Bronze → Platinum) are printed on the certificate, so hiring teams get a real signal of competence.",
              },
            ].map((p) => (
              <StaggerItem key={p.title}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 240, damping: 18 }}
                  className="h-full rounded-xl border border-cream-deep bg-cream-soft p-8 transition-shadow hover:shadow-lg"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <p.Icon className="w-5 h-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {p.body}
                  </p>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 6. RECENT CERTIFICATIONS MARQUEE -------------------------------- */}
      <CertificateSlider />

      {/* 7. PERFORMANCE BADGES ------------------------------------------- */}
      <section
        id="badges"
        className="hidden py-16 sm:py-24 bg-cream-soft border-t border-cream-deep"
        aria-hidden="true"
      >
        <div className="max-w-6xl mx-auto px-6">
          <Reveal as="div" className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              Recognition
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
              Performance-based credentials
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Every certificate carries a recognition tier based on your
              assessment score — a transparent signal of competence for
              employers and recruiters.
            </p>
          </Reveal>

          <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-5" step={0.08}>
            <StaggerItem>
              <BadgeTier
                tier="Bronze"
                range="50–69%"
                label="Verified Pass"
                icon={<Medal className="w-7 h-7" />}
                accent="text-amber-700 bg-amber-50 ring-amber-200"
              />
            </StaggerItem>
            <StaggerItem>
              <BadgeTier
                tier="Silver"
                range="70–79%"
                label="Strong Pass"
                icon={<Award className="w-7 h-7" />}
                accent="text-slate-700 bg-slate-100 ring-slate-300"
              />
            </StaggerItem>
            <StaggerItem>
              <BadgeTier
                tier="Gold"
                range="80–89%"
                label="Distinction"
                icon={<Trophy className="w-7 h-7" />}
                accent="text-yellow-700 bg-yellow-50 ring-yellow-200"
              />
            </StaggerItem>
            <StaggerItem>
              <BadgeTier
                tier="Platinum"
                range="90–100%"
                label="Exceptional score"
                icon={<Crown className="w-7 h-7" />}
                accent="text-sky-800 bg-sky-50 ring-sky-200"
              />
            </StaggerItem>
          </Stagger>

          <p className="mt-10 text-center text-xs text-slate-500">
            Tier is recorded on the certificate and verifiable at{" "}
            <Link href="/verify" className="text-sky-700 hover:underline">
              octamy.com/verify
            </Link>
            .
          </p>
        </div>
      </section>

      {/* 8. FEATURED EXAM CARDS ------------------------------------------ */}
      <section className="py-16 sm:py-24 bg-cream-deep border-y border-cream-deep">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              Featured exams
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
              Start with a free assessment
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              A handpicked selection from across our catalogue.
            </p>
          </div>

          <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3">
            {filteredCourses.slice(0, 6).map((course) => (
              <div key={course.id} className="min-w-[86%] snap-start sm:min-w-[46%] md:min-w-0">
                <CourseCard course={course} />
              </div>
            ))}
          </div>

          {filteredCourses.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                <SearchIcon className="w-5 h-5" />
              </div>
              <p className="text-slate-600">
                No exams available yet — check back shortly.
              </p>
            </div>
          ) : (
            <div className="mt-12 flex flex-col items-center gap-3">
              <p className="text-sm text-slate-500">
                Showing {Math.min(6, filteredCourses.length)} of{" "}
                {filteredCourses.length}
                {filteredCourses.length === 1 ? " exam" : " exams"}
              </p>
              <Button
                asChild
                  size="lg"
                  className="bg-slate-900 hover:bg-black text-white rounded-full px-8"
                >
                <Link href="/get-certified">
                  Browse all {filteredCourses.length} exams
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* 9. RECRUITERS / SELLERS SPLIT CTA ------------------------------- */}
      <section className="hidden relative overflow-hidden py-16 sm:py-24 bg-slate-900" aria-hidden="true">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-slate opacity-20 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div aria-hidden className="pointer-events-none absolute -top-20 left-10 h-[300px] w-[300px] rounded-full bg-sky-500/20 blur-3xl animate-blob" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 right-10 h-[260px] w-[260px] rounded-full bg-indigo-500/20 blur-3xl animate-blob-slow" />
        <div className="relative max-w-7xl mx-auto px-6">
          <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <StaggerItem>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 240, damping: 18 }}
                className="h-full rounded-2xl border border-slate-700/60 bg-slate-800/40 backdrop-blur p-8 hover:border-sky-400/40 transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="mt-5 text-2xl font-bold text-white">
                  For Recruiters
                </h3>
                <p className="mt-2 text-slate-300 leading-relaxed">
                  Verify candidate skills in seconds. Check certificates by ID and
                  shortlist with confidence.
                </p>
                <Button
                  asChild
                    variant="outline"
                    className="mt-6 border-white/30 bg-transparent text-white hover:bg-cream-soft hover:text-slate-900 rounded-full"
                  >
                  <Link href="/recruiter/login">
                    Hiring? Verify candidates
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </motion.div>
            </StaggerItem>
            <StaggerItem>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 240, damping: 18 }}
                className="h-full rounded-2xl border border-slate-700/60 bg-slate-800/40 backdrop-blur p-8 hover:border-fuchsia-400/40 transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h3 className="mt-5 text-2xl font-bold text-white">
                  For Sellers & Partners
                </h3>
                <p className="mt-2 text-slate-300 leading-relaxed">
                  Publish your own assessments on Octamy and earn a commission
                  each time a candidate buys a certificate.
                </p>
                <Button
                  asChild
                    variant="outline"
                    className="mt-6 border-white/30 bg-transparent text-white hover:bg-cream-soft hover:text-slate-900 rounded-full"
                  >
                  <Link href="/partners">
                    Sell assessments? Earn commission
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </motion.div>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* 10. FAQ ---------------------------------------------------------- */}
      <section className="py-16 sm:py-24 bg-cream-soft">
        <div className="max-w-3xl mx-auto px-6">
          <Reveal as="div" className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              Questions
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
              Frequently asked
            </h2>
          </Reveal>
          <Reveal as="div" delay={0.1}>
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="border-cream-deep"
                >
                  <AccordionTrigger className="text-left text-slate-900 hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* 11. FINAL CTA BAND ---------------------------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-black">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-slate opacity-15" />
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-sky-500/20 blur-3xl animate-blob" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-indigo-500/20 blur-3xl animate-blob-slow" />
        <div className="relative max-w-4xl mx-auto px-6 py-20 sm:py-28 text-center">
          <Reveal as="h2" className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Start your first assessment — free.
          </Reveal>
          <Reveal as="p" delay={0.1} className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Pick an exam, prove your skill, and walk away with a recruiter-
            verifiable credential. No subscription, no card required to start.
          </Reveal>
          <Reveal as="div" delay={0.2} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
                <Button
                  asChild
                  size="lg"
                  className="bg-cream-soft text-slate-900 hover:bg-slate-100 rounded-full px-8 py-6 text-base font-semibold shadow-2xl shadow-sky-500/20"
                >
                  <Link href="/get-certified">
                  Browse exams
                  <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
            </motion.div>
            <a
              href="#how"
              className="text-sm font-medium text-slate-300 hover:text-white"
            >
              How it works →
            </a>
          </Reveal>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}
