import { Link } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, GraduationCap, Briefcase, Check } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/motion-primitives';
import { motion } from 'framer-motion';

const tiers = [
  { name: 'Starter', price: '₹2,999/mo', students: '500 students', cohorts: '5 cohorts', features: ['Bulk CSV enroll', 'Private question banks', 'Results export', 'Your logo on certificates'] },
  { name: 'Growth', price: '₹9,999/mo', students: '5,000 students', cohorts: 'Unlimited cohorts', highlight: true, features: ['White-label certificates', 'Scheduled exam windows', 'API access', 'Priority support'] },
  { name: 'Enterprise', price: 'Custom', students: 'Unlimited', cohorts: 'Unlimited', features: ['SSO', 'Dedicated success manager', 'On-prem options', 'Custom SLA'] },
];

const faqs = [
  { q: 'Can students retake exams?', a: 'Yes — configure attempt limits and cool-down windows per cohort.' },
  { q: 'Do you support our own question bank?', a: 'Yes. Upload private question banks per cohort or department, with version control.' },
  { q: 'How do certificates show our brand?', a: 'Starter adds your logo. Growth and Enterprise are fully white-label with your domain.' },
  { q: 'Do you have an API?', a: 'Growth and Enterprise plans include REST API access for SIS / LMS integration.' },
];

export default function InstituteLanding() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO
        title="Skill verification for institutes"
        description="Verify your students' skills with industry-grade exams. Bulk CSV enroll, private question banks, white-label certificates."
        path="/institute"
      />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden py-24 px-4 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-slate [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
          <div aria-hidden className="pointer-events-none absolute -top-20 left-1/4 h-[420px] w-[420px] rounded-full bg-emerald-300/20 blur-3xl animate-blob" />
          <div aria-hidden className="pointer-events-none absolute -top-10 right-10 h-[320px] w-[320px] rounded-full bg-sky-300/25 blur-3xl animate-blob-slow" />
          <div className="relative max-w-3xl mx-auto">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 bg-white/80 backdrop-blur border border-emerald-200 rounded-full px-3 py-1.5 shadow-sm"
            >
              <GraduationCap className="w-3 h-3" /> For institutes & corporates
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight"
            >
              Verify your students' skills with{' '}
              <span className="bg-gradient-to-r from-emerald-700 via-sky-700 to-indigo-700 bg-clip-text text-transparent">industry-grade exams</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-5 text-lg text-slate-600"
            >
              Bulk-enroll cohorts. Run scheduled exam windows. Issue white-label certificates with your logo.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex justify-center gap-3"
            >
              <Link href="/register?role=institute">
                <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
                  <Button className="cta-pulse bg-slate-900 hover:bg-black text-white rounded-full px-6 shadow-xl shadow-slate-900/20">Get started</Button>
                </motion.span>
              </Link>
              <Link href="/contact">
                <motion.span whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
                  <Button variant="outline" className="rounded-full px-6 bg-white/80 backdrop-blur">Talk to sales</Button>
                </motion.span>
              </Link>
            </motion.div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Built for schools, colleges, coaching</Reveal>
            <Stagger className="grid md:grid-cols-3 gap-6 mt-10">
              {[
                { icon: GraduationCap, t: 'Schools & colleges', d: 'Run end-of-term skill assessments and issue verifiable certificates.' },
                { icon: Building2, t: 'Coaching & test-prep', d: 'Benchmark students against national cohorts and produce ranked results.' },
                { icon: Briefcase, t: 'Corporate L&D', d: 'Verify employee upskilling with measurable, exportable evidence.' },
              ].map(({ icon: I, t, d }) => (
                <StaggerItem key={t}>
                  <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
                    <Card className="border-slate-200 h-full transition-shadow hover:shadow-lg">
                      <CardContent className="pt-6">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                          <I className="w-5 h-5" />
                        </div>
                        <div className="text-lg font-semibold text-slate-900 mt-4">{t}</div>
                        <div className="text-sm text-slate-600 mt-2">{d}</div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="py-16 px-4 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 text-center">Features that matter</h2>
            <ul className="mt-10 grid sm:grid-cols-2 gap-3">
              {[
                'Cohort management with multiple programmes',
                'Bulk student enrolment via CSV',
                'Private question banks per cohort',
                'Certificates with your logo and signature',
                'Results export for parents and admins',
                'Scheduled exam windows and proctoring options',
              ].map((f) => (
                <li key={f} className="flex gap-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl p-4">
                  <Check className="w-4 h-4 text-slate-900 shrink-0 mt-0.5" />{f}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 text-center">Institute pricing</h2>
            <div className="grid md:grid-cols-3 gap-6 mt-10">
              {tiers.map((t) => (
                <Card key={t.name} className={`border ${t.highlight ? 'border-slate-900 shadow-md' : 'border-slate-200'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-baseline justify-between">
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      {t.highlight && <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">Popular</span>}
                    </div>
                    <div className="text-3xl font-semibold text-slate-900 mt-2">{t.price}</div>
                    <div className="text-sm text-slate-600 mt-1">{t.students} · {t.cohorts}</div>
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                      {t.features.map((f) => (
                        <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />{f}</li>
                      ))}
                    </ul>
                    <Link href={t.name === 'Enterprise' ? '/contact' : `/register?role=institute&plan=${t.name.toLowerCase()}`}>
                      <Button className={`w-full mt-6 ${t.highlight ? 'bg-slate-900 hover:bg-black text-white' : ''}`} variant={t.highlight ? 'default' : 'outline'}>
                        {t.name === 'Enterprise' ? 'Talk to sales' : `Choose ${t.name}`}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 text-center">Frequently asked</h2>
            <div className="mt-8 space-y-3">
              {faqs.map((f) => (
                <details key={f.q} className="bg-white border border-slate-200 rounded-xl p-4 group">
                  <summary className="cursor-pointer font-medium text-slate-900 list-none flex justify-between items-center">
                    {f.q}<span className="text-slate-400 group-open:rotate-45 transition">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
