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
  Lock,
  FileCheck2,
  Building2,
  BadgeCheck,
  Receipt,
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

const PREMIUM_CATEGORY_SLUGS: string[] = (
  import.meta.env.VITE_PREMIUM_CATEGORY_SLUGS || ""
)
  .split(",")
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);

// ---------- Recent / sample certifications ----------
const SAMPLE_CERTS = [
  { name: "Aarav Shah",     company: "Acme Corp",       course: "Python Developer",          badge: "Gold",     score: 86, color: "from-amber-500 to-amber-700" },
  { name: "Priya Iyer",     company: "Infosys",          course: "Generative AI Foundations", badge: "Platinum", score: 92, color: "from-slate-900 to-slate-700" },
  { name: "Rahul Verma",    company: "TCS",              course: "AWS Cloud Practitioner",    badge: "Silver",   score: 74, color: "from-slate-500 to-slate-700" },
  { name: "Ananya Reddy",   company: "Flipkart",         course: "Cybersecurity Analyst",     badge: "Gold",     score: 81, color: "from-amber-500 to-amber-700" },
  { name: "Vikram Singh",   company: "Razorpay",         course: "Full-Stack JavaScript",     badge: "Platinum", score: 95, color: "from-slate-900 to-slate-700" },
  { name: "Meera Nair",     company: "Wipro",            course: "Data Science Essentials",   badge: "Silver",   score: 71, color: "from-slate-500 to-slate-700" },
];

function CertificateSlider() {
  const { data: liveCerts = [] } = useQuery<any[]>({
    queryKey: ["/api/recent-certificates"],
  });

  const showLive = liveCerts.length > 0;
  const items = showLive ? liveCerts : SAMPLE_CERTS;

  return (
    <section className="bg-cream-deep py-16 sm:py-20 border-y border-cream-deep">
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
              : "Every passed exam mints a verifiable, recruiter-checkable certificate. Yours can be next."}
          </p>
        </Reveal>

        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.slice(0, 6).map((cert, idx) => (
            <StaggerItem key={`${cert.name}-${idx}`}>
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
                    QR-verifiable · {cert.company || "Octamy.com"}
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
            <Link href="/exams">
              <Button className="mt-4 bg-slate-900 hover:bg-black text-white rounded-full px-6">
                Take a free assessment <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
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
    a: "Octamy certificates are skill-verification credentials that record your assessment score and badge tier. Recruiters can verify any certificate at octamy.com/verify. They are an independent signal of competence — not a degree or government qualification.",
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
    a: "Each certificate has a unique ID and QR code. Anyone — employers, agencies, institutions — can paste the ID at octamy.com/verify to confirm the holder, score, badge tier and issue date in real time.",
  },
  {
    q: "Can institutes / companies bulk-certify their teams?",
    a: "Yes. Partner organisations can co-brand certificates and bulk-enrol candidates. Reach out via the Partners page for volume pricing and an analytics dashboard.",
  },
  {
    q: "Is there a refund policy?",
    a: "Because the assessment itself is free and payment only happens after a passing score, certificate purchases are generally final. For genuine technical issues we review on a case-by-case basis — contact support within 7 days.",
  },
  {
    q: "What ID / proof is needed?",
    a: "You register with a verified email and the name you want printed on the certificate. For premium tracks we may ask for a government-issued ID at the verification step.",
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

  // Trust strip items (no vendor logos — lucide only)
  const trustItems = [
    { icon: BadgeCheck, label: "ISO 9001:2015" },
    { icon: Lock, label: "PayU Secure" },
    { icon: Receipt, label: "GST Registered" },
    { icon: ShieldCheck, label: "256-bit SSL" },
    { icon: FileCheck2, label: "DPDP Aligned" },
    { icon: Building2, label: "MSME Registered" },
  ];
  const heroBanners = [
    { icon: Sparkles, title: "New", text: "AI & Cloud assessment tracks updated weekly" },
    { icon: ShieldCheck, title: "Trusted", text: "Recruiter-verifiable credentials with QR validation" },
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
      target: "https://octamy.com/exams?q={search_term_string}",
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
        title="Octamy — Skill Verification & Certification Platform"
        description="Take free skill-verification assessments in AI, Development, Cloud, Cybersecurity and more. Pay only for verified certificates. Industry-recognized credentials trusted by recruiters across India."
        path="/"
        jsonLd={[websiteJsonLd, faqJsonLd]}
      />
      <Header />

      {/* 1. HERO — reflective black left rail · clean white right ---------- */}
      <section className="relative overflow-hidden bg-cream-soft">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pt-14 sm:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">

            {/* LEFT — glossy black hero panel */}
            <div className="lg:col-span-8">
              <div className="glossy-black relative overflow-hidden rounded-3xl px-6 sm:px-10 py-12 sm:py-16 min-h-[480px] flex flex-col justify-between">
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
                    The Udemy for skill verification
                  </motion.p>

                  <motion.h1
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-6 text-4xl sm:text-5xl md:text-[56px] leading-[1.05] font-extrabold tracking-tight text-white"
                  >
                    Take the exam.
                    <br />
                    <span className="text-chrome">Earn the credential.</span>
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="mt-5 max-w-xl text-base sm:text-lg text-white/70 leading-relaxed"
                  >
                    Free assessments. Pay only when you pass. Verified by recruiters across India — across AI, development, cloud, security and business.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.35 }}
                    className="mt-8 flex flex-col sm:flex-row gap-3"
                  >
                    <Link href="/exams">
                      <Button size="lg" className="bg-cream-soft text-slate-900 hover:bg-slate-100 rounded-full px-6 py-6 text-base font-semibold shadow-xl shadow-black/30">
                        Browse 50+ exams
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
                    <a href="#how">
                      <Button size="lg" variant="outline" className="rounded-full px-6 py-6 text-base border-white/20 bg-cream-soft/[0.04] text-white hover:bg-cream-soft/[0.1] backdrop-blur">
                        How it works
                      </Button>
                    </a>
                  </motion.div>
                </div>

                {/* Live stats anchored bottom-left */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="relative z-10 mt-10 grid grid-cols-3 gap-3 max-w-xl"
                >
                  {[
                    { v: 50, s: "+", l: "Live exams" },
                    { v: 12, s: "k+", l: "Assessments taken" },
                    { v: 300, s: "+", l: "Recruiters verifying" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl border border-white/10 bg-cream-soft/[0.04] backdrop-blur px-4 py-3">
                      <p className="text-2xl font-bold text-white tabular-nums">
                        <CountUp to={s.v} suffix={s.s} />
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-white/50 mt-1">{s.l}</p>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* RIGHT — clean auth card (no rotating border) */}
            <div className="lg:col-span-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="h-full"
              >
                <div className="h-full rounded-3xl border border-cream-deep bg-cream-soft p-6 sm:p-7 shadow-xl shadow-slate-900/5 flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                      Get started — free
                    </p>
                  </div>
                  <h3 className="mt-3 text-2xl font-bold text-slate-900 leading-tight">
                    Create your account
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    One account for learners, creators, institutes &amp; recruiters.
                  </p>
                  <div className="mt-5 space-y-2.5">
                    <GoogleAuthButton type="user" />
                    <Link href="/register">
                      <Button className="w-full bg-slate-900 hover:bg-black text-white rounded-full h-11">
                        Continue with email
                      </Button>
                    </Link>
                  </div>
                  <div className="my-4 flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    ALREADY ON OCTAMY?
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                  <Link href="/login">
                    <Button variant="outline" className="w-full rounded-full border-slate-300 h-11">
                      Sign in
                    </Button>
                  </Link>

                  <div className="mt-auto pt-5 flex items-center gap-2 text-[11px] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    256-bit SSL · DPDP aligned · No card required
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Category chip rail — Udemy-style "popular topics" */}
          {categories.length > 0 && (
            <Reveal as="div" delay={0.05} className="mt-10">
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Popular categories</p>
                <Link href="/exams" className="text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1">
                  See all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="chip-rail flex gap-2 overflow-x-auto pb-1">
                {categories.slice(0, 14).map((c) => (
                  <Link key={c.id} href={`/exams?category=${c.slug}`}>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cream-deep bg-cream-soft px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900 transition-colors">
                      {c.name}
                    </span>
                  </Link>
                ))}
              </div>
            </Reveal>
          )}

          {/* Onboarding strip — explicit CTAs for every persona */}
          <Reveal as="div" delay={0.1} className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { href: "/exams", title: "I want to get certified", sub: "Take a free assessment", icon: GraduationCap },
              { href: "/creator", title: "Teach on Octamy", sub: "Sell courses & exams", icon: Sparkles },
              { href: "/institute", title: "For institutes", sub: "Run cohorts & banks", icon: Building2 },
              { href: "/for-recruiters", title: "For recruiters", sub: "Hire verified talent", icon: Users },
            ].map((cta) => (
              <Link key={cta.href} href={cta.href}>
                <motion.div
                  whileHover={{ y: -3 }}
                  className="group h-full rounded-2xl border border-cream-deep bg-cream-soft px-5 py-4 hover:border-slate-900 hover:shadow-lg transition-all flex items-start gap-3"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <cta.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{cta.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{cta.sub}</p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
                </motion.div>
              </Link>
            ))}
          </Reveal>

          {/* Trusted-at strip — compressed */}
          <Reveal as="div" delay={0.15} className="mt-8 rounded-2xl border border-cream-deep bg-cream-deep px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 mr-2">Trusted at</p>
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

      {/* 2. HOW OCTAMY WORKS ---------------------------------------------- */}
      <section id="how" className="py-16 sm:py-24 bg-cream-deep border-y border-cream-deep">
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

          <Stagger className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
                desc: "Pick from 50+ exams across modern career tracks.",
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
                desc: "Optional: claim a verified certificate with QR-based check.",
                Icon: FileBadge,
              },
            ].map((step) => (
              <StaggerItem key={step.n}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 240, damping: 18 }}
                  className="relative rounded-xl border border-cream-deep bg-cream-soft p-6 transition-shadow hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-7 px-2 items-center rounded-full bg-sky-50 text-[11px] font-bold tracking-[0.2em] text-sky-700 ring-1 ring-sky-200">
                      {step.n}
                    </span>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                      <step.Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">
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
      <section className="py-16 sm:py-20 bg-cream-soft">
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
      <section className="py-16 sm:py-24 bg-cream-deep border-y border-cream-deep">
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

          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" step={0.06}>
            {featuredTracks.map((cat) => {
              const Icon = cat.Icon;
              const baseCard =
                "group relative flex flex-col h-full rounded-xl border p-6 transition-all hover:-translate-y-1 hover:shadow-xl";
              const cardClass = cat.isPremium
                ? `${baseCard} bg-gradient-to-br from-amber-50 to-white border-amber-200 ring-1 ring-amber-200`
                : `${baseCard} bg-cream-soft border-cream-deep hover:border-slate-900`;
              return (
                <StaggerItem key={cat.id} className="h-full">
                  <Link href={`/category/${cat.slug}`} className={cardClass}>
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
                  <Link href="/exams" className="group relative flex flex-col h-full rounded-xl border border-cream-deep bg-cream-soft p-6 transition-all hover:-translate-y-1 hover:border-slate-900 hover:shadow-xl">
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
              <Link href="/exams">
                <Button
                  variant="outline"
                  className="border-slate-300 text-slate-700 rounded-full"
                >
                  View all {categories.length} tracks
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </Reveal>
          )}
        </div>
      </section>

      {/* 5. WHY OCTAMY / 3 PILLARS --------------------------------------- */}
      <section className="py-16 sm:py-24 bg-cream-soft">
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
                title: "Verified",
                body: "Every certificate carries a unique ID and QR. Recruiters check it instantly at octamy.com/verify — no email back-and-forth.",
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
        className="py-16 sm:py-24 bg-cream-soft border-t border-cream-deep"
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
                label="Top 10% globally"
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCourses.slice(0, 12).map((course) => (
              <CourseCard key={course.id} course={course} />
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
                Showing {Math.min(12, filteredCourses.length)} of{" "}
                {filteredCourses.length}
                {filteredCourses.length === 1 ? " exam" : " exams"}
              </p>
              <Link href={isAuthenticated ? "/exams" : "/exams"}>
                <Button
                  size="lg"
                  className="bg-slate-900 hover:bg-black text-white rounded-full px-8"
                >
                  Browse all {filteredCourses.length} exams
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 9. RECRUITERS / SELLERS SPLIT CTA ------------------------------- */}
      <section className="relative overflow-hidden py-16 sm:py-24 bg-slate-900">
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
                <Link href="/recruiter/login">
                  <Button
                    variant="outline"
                    className="mt-6 border-white/30 bg-transparent text-white hover:bg-cream-soft hover:text-slate-900 rounded-full"
                  >
                    Hiring? Verify candidates
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
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
                <Link href="/partners">
                  <Button
                    variant="outline"
                    className="mt-6 border-white/30 bg-transparent text-white hover:bg-cream-soft hover:text-slate-900 rounded-full"
                  >
                    Sell assessments? Earn commission
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
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
            <Link href="/exams">
              <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
                <Button
                  size="lg"
                  className="bg-cream-soft text-slate-900 hover:bg-slate-100 rounded-full px-8 py-6 text-base font-semibold shadow-2xl shadow-sky-500/20"
                >
                  Browse exams
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </motion.span>
            </Link>
            <a
              href="#how"
              className="text-sm font-medium text-slate-300 hover:text-white"
            >
              How it works →
            </a>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
