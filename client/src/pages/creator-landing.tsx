import { Link } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, BookOpen, Users, Layers, IndianRupee, Check } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/motion-primitives';
import { motion } from 'framer-motion';

const tiers = [
  { name: 'Starter', price: 'Free', courses: '1 active course', fee: '30% platform fee', features: ['Basic analytics', 'Octamy-branded checkout'] },
  { name: 'Pro', price: '₹499/mo', courses: '10 active courses', fee: '20% platform fee', highlight: true, features: ['Custom subdomain', 'Drip release', 'Coupon codes', 'Priority review'] },
  { name: 'Premium', price: '₹1,999/mo', courses: 'Unlimited', fee: '10% platform fee', features: ['White-label', 'Video transcoding', 'Affiliate commissioning', 'API access'] },
];

const faqs = [
  { q: 'How much do I keep per sale?', a: 'You keep 70% on Starter, 80% on Pro, and 90% on Premium after Octamy platform fees. Payment processing is handled via Cashfree.' },
  { q: 'When do I get paid?', a: 'Weekly payouts to your verified bank account, with full transaction history in your dashboard.' },
  { q: 'Can I bring my existing audience?', a: 'Yes — custom subdomain (Pro+) and affiliate links let you keep your brand front and centre.' },
  { q: 'Do I need to be approved?', a: 'New creators get reviewed within 48 hours. Priority review for Pro and Premium plans.' },
];

export default function CreatorLanding() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO
        title="Sell your courses on Octamy"
        description="Reach 10,000+ verified learners. Keep up to 90% revenue. Cashfree payouts, custom subdomain, full creator dashboard."
        path="/creator"
      />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden py-24 px-4 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-slate [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
          <div aria-hidden className="pointer-events-none absolute -top-20 left-1/4 h-[420px] w-[420px] rounded-full bg-fuchsia-300/20 blur-3xl animate-blob" />
          <div aria-hidden className="pointer-events-none absolute -top-10 right-10 h-[320px] w-[320px] rounded-full bg-sky-300/25 blur-3xl animate-blob-slow" />
          <div className="relative max-w-3xl mx-auto">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-700 bg-white/80 backdrop-blur border border-fuchsia-200 rounded-full px-3 py-1.5 shadow-sm"
            >
              <Sparkles className="w-3 h-3" /> For creators & coaches
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight"
            >
              Sell your courses on{' '}
              <span className="bg-gradient-to-r from-fuchsia-600 via-sky-700 to-indigo-700 bg-clip-text text-transparent">Octamy</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-5 text-lg text-slate-600"
            >
              Reach 10,000+ learners. Keep up to 90% revenue. Cashfree payouts, custom subdomain, zero infra.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex justify-center gap-3"
            >
              <Link href="/register?role=creator">
                <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
                  <Button className="cta-pulse bg-slate-900 hover:bg-black text-white rounded-full px-6 shadow-xl shadow-slate-900/20">Become a creator</Button>
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
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">How it works</Reveal>
            <Stagger className="grid md:grid-cols-3 gap-6 mt-10">
              {[
                { n: '01', t: 'Apply', d: 'Sign up in 60 seconds and tell us what you teach.' },
                { n: '02', t: 'Build', d: 'Upload modules, attach assessments, set pricing and coupons.' },
                { n: '03', t: 'Earn', d: 'We promote, host, certify and pay you out weekly.' },
              ].map((s) => (
                <StaggerItem key={s.n}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  >
                    <Card className="border-slate-200 hover:shadow-lg transition-shadow h-full">
                      <CardContent className="pt-6">
                        <div className="inline-flex h-7 px-2 items-center rounded-full bg-sky-50 text-[11px] font-bold tracking-[0.2em] text-sky-700 ring-1 ring-sky-200">{s.n}</div>
                        <div className="text-lg font-semibold text-slate-900 mt-3">{s.t}</div>
                        <div className="text-sm text-slate-600 mt-2">{s.d}</div>
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
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">What you can sell</Reveal>
            <Stagger className="grid md:grid-cols-4 gap-4 mt-10" step={0.06}>
              {[
                { icon: BookOpen, t: 'Courses' },
                { icon: Users, t: 'Cohort programs' },
                { icon: Sparkles, t: 'Webinars' },
                { icon: Layers, t: 'Bundles' },
              ].map(({ icon: I, t }) => (
                <StaggerItem key={t}>
                  <motion.div
                    whileHover={{ y: -4, scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  >
                    <Card className="border-slate-200 h-full transition-shadow hover:shadow-lg">
                      <CardContent className="pt-6 text-center">
                        <I className="w-6 h-6 mx-auto text-slate-700" />
                        <div className="mt-3 font-medium text-slate-900">{t}</div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Creator pricing</Reveal>
            <Reveal as="p" delay={0.1} className="text-center text-slate-600 mt-2">Start free. Upgrade when you scale.</Reveal>
            <Stagger className="grid md:grid-cols-3 gap-6 mt-10">
              {tiers.map((t) => (
                <StaggerItem key={t.name}>
                  <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="h-full">
                    <Card className={`border h-full ${t.highlight ? 'border-slate-900 shadow-xl ring-1 ring-slate-900/5' : 'border-slate-200'}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-baseline justify-between">
                          <div className="font-semibold text-slate-900">{t.name}</div>
                          {t.highlight && <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-full">Popular</span>}
                        </div>
                        <div className="text-3xl font-bold text-slate-900 mt-2 flex items-center">
                          {t.price !== 'Free' && <IndianRupee className="w-5 h-5" />}
                          <span>{t.price.replace('₹', '')}</span>
                        </div>
                        <div className="text-sm text-slate-600 mt-1">{t.courses} · {t.fee}</div>
                        <ul className="mt-4 space-y-2 text-sm text-slate-700">
                          {t.features.map((f) => (
                            <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{f}</li>
                          ))}
                        </ul>
                        <Link href={`/register?role=creator&plan=${t.name.toLowerCase()}`}>
                          <Button className={`w-full mt-6 ${t.highlight ? 'bg-slate-900 hover:bg-black text-white' : ''}`} variant={t.highlight ? 'default' : 'outline'}>
                            Choose {t.name}
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="py-16 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Frequently asked</Reveal>
            <Reveal as="div" delay={0.1} className="mt-8 space-y-3">
              {faqs.map((f) => (
                <details key={f.q} className="bg-white border border-slate-200 rounded-xl p-4 group hover:shadow-sm transition-shadow">
                  <summary className="cursor-pointer font-medium text-slate-900 list-none flex justify-between items-center">
                    {f.q}<span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-600">{f.a}</p>
                </details>
              ))}
            </Reveal>
            <div className="text-center mt-10">
              <Link href="/register?role=creator">
                <motion.span whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
                  <Button className="bg-slate-900 hover:bg-black text-white rounded-full px-6">Become a creator</Button>
                </motion.span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
