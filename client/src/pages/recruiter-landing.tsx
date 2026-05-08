import { Link } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Filter, Download, Check } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/motion-primitives';
import { motion } from 'framer-motion';

const tiers = [
  { name: 'Starter', price: '₹2,999/mo', views: '50 profile views/mo', searches: '10 saved searches', features: ['Email candidate', 'Score filter', 'Badge filter'] },
  { name: 'Growth', price: '₹9,999/mo', views: '200 profile views/mo', searches: 'Unlimited saved searches', highlight: true, features: ['CSV export', 'ATS webhook', 'Team seats (3)'] },
  { name: 'Enterprise', price: 'Custom', views: 'Unlimited', searches: 'Unlimited', features: ['Bulk credit packs', 'Dedicated CSM', 'Custom integrations'] },
];

const faqs = [
  { q: 'How are candidates verified?', a: 'Every score on Octamy is from a proctored, time-bounded exam. Candidates can\'t edit their scores — only re-take and improve.' },
  { q: 'Can we export to our ATS?', a: 'Yes — Growth includes a webhook that pushes shortlisted candidates to Greenhouse, Lever, Zoho Recruit and others.' },
  { q: 'Do you handle outreach?', a: 'You can email candidates directly from the dashboard. Bulk outreach is on the Enterprise plan.' },
  { q: 'How is pricing calculated?', a: 'Per-seat monthly subscription with included profile views. Top up with credit packs at any time.' },
];

export default function RecruiterLanding() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO
        title="Hire candidates verified by skill"
        description="Filter on verified scores and badges, not resumes. ATS export, team seats, dedicated CSM."
        path="/for-recruiters"
      />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden py-24 px-4 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-slate [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
          <div aria-hidden className="pointer-events-none absolute -top-20 left-1/4 h-[420px] w-[420px] rounded-full bg-indigo-300/25 blur-3xl animate-blob" />
          <div aria-hidden className="pointer-events-none absolute -top-10 right-10 h-[320px] w-[320px] rounded-full bg-sky-300/25 blur-3xl animate-blob-slow" />
          <div className="relative max-w-3xl mx-auto">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 bg-white/80 backdrop-blur border border-indigo-200 rounded-full px-3 py-1.5 shadow-sm"
            >
              <ShieldCheck className="w-3 h-3" /> For recruiters & hiring teams
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight"
            >
              Hire candidates{' '}
              <span className="bg-gradient-to-r from-indigo-700 via-sky-700 to-emerald-600 bg-clip-text text-transparent">verified by skill</span>
              , not resumes
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-5 text-lg text-slate-600"
            >
              Filter on proctored exam scores, badges and skill levels. Export to your ATS. No more CV roulette.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex justify-center gap-3"
            >
              <Link href="/register?role=recruiter">
                <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
                  <Button className="cta-pulse bg-slate-900 hover:bg-black text-white rounded-full px-6 shadow-xl shadow-slate-900/20">Start hiring</Button>
                </motion.span>
              </Link>
              <Link href="/pricing">
                <motion.span whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
                  <Button variant="outline" className="rounded-full px-6 bg-white/80 backdrop-blur">See pricing</Button>
                </motion.span>
              </Link>
            </motion.div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Three pillars</Reveal>
            <Stagger className="grid md:grid-cols-3 gap-6 mt-10">
              {[
                { icon: ShieldCheck, t: 'Verified scores', d: 'Every score is from a proctored exam. Tamper-proof, exportable, third-party verifiable.' },
                { icon: Filter, t: 'Live skill filters', d: 'Search by skill, score, percentile, badges and recency in real time.' },
                { icon: Download, t: 'ATS export', d: 'Push shortlisted candidates to Greenhouse, Lever, Zoho Recruit via webhook.' },
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
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 text-center">Recruiter pricing</h2>
            <div className="grid md:grid-cols-3 gap-6 mt-10">
              {tiers.map((t) => (
                <Card key={t.name} className={`border ${t.highlight ? 'border-slate-900 shadow-md' : 'border-slate-200'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-baseline justify-between">
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      {t.highlight && <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">Popular</span>}
                    </div>
                    <div className="text-3xl font-semibold text-slate-900 mt-2">{t.price}</div>
                    <div className="text-sm text-slate-600 mt-1">{t.views} · {t.searches}</div>
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                      {t.features.map((f) => (
                        <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />{f}</li>
                      ))}
                    </ul>
                    <Link href={t.name === 'Enterprise' ? '/contact' : `/register?role=recruiter&plan=${t.name.toLowerCase()}`}>
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

        <section className="py-16 px-4">
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
