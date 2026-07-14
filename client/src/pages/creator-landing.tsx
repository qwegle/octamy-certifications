import { Link } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, BookOpen, Users, Layers, IndianRupee, Check } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/motion-primitives';
import { motion } from 'framer-motion';
import PortalLandingHero from '@/components/portal-landing-hero';

const tiers = [
  { name: 'Starter', price: 'Free', courses: '1 active course', fee: 'Publishing workspace', features: ['Basic analytics', 'Octamy-branded assessment pages'] },
  { name: 'Pro', price: '₹499/mo', courses: '10 active courses', fee: 'Expanded workspace', highlight: true, features: ['Curriculum builder', 'Attempt reporting', 'Priority review', 'Question-bank workflow'] },
  { name: 'Premium', price: '₹1,999/mo', courses: 'Unlimited', fee: 'Advanced workspace', features: ['Expanded catalog', 'Question-bank workflow', 'Reporting history', 'Priority support'] },
];

const faqs = [
  { q: 'Can I monetize a course today?', a: 'Approved creators can sell reviewed course access and credential activations through the configured payment gateway. Confirmed payments create auditable revenue-share entries; payout requests are reviewed before transfer.' },
  { q: 'What evidence can a course create?', a: 'Creators can attach assessments and review attempt activity. Octamy does not yet treat creator-issued assessments as independently validated or identity-verified.' },
  { q: 'Can I bring my existing audience?', a: 'Yes. Share your published course and assessment links directly with your existing learners.' },
  { q: 'Do I need to be approved?', a: 'Yes. Creator profiles and submitted courses are reviewed before they become publicly available.' },
];

export default function CreatorLanding() {
  return (
    <div className="min-h-screen bg-cream-soft flex flex-col">
      <SEO
        title="Sell your courses on Octamy"
        description="Build structured course curricula and assessments, submit content for review, and inspect learner attempt activity from a creator workspace."
        path="/creator"
      />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <PortalLandingHero
          accent="fuchsia"
          eyebrow="For creators & coaches"
          eyebrowIcon={<Sparkles className="h-3.5 w-3.5" />}
          title={<>Turn expertise into <span className="bg-gradient-to-r from-fuchsia-600 via-violet-600 to-sky-700 bg-clip-text text-transparent">assessed learning</span></>}
          description="Build video courses and assessments, submit them for review, set access and credential pricing, then track auditable earnings and payout requests in one workspace."
          primary={{ label: 'Become a creator', href: '/register?role=creator' }}
          secondary={{ label: 'See pricing', href: '/pricing' }}
          preview={{
            label: 'Creator workspace', title: 'Course performance', status: 'Ready to publish',
            metrics: [
              { label: 'Courses', value: '08' }, { label: 'Attempts', value: '126' }, { label: 'Certificates', value: '84' },
            ],
            activity: [
              { title: 'Curriculum updated', meta: 'Assessment module · just now' },
              { title: 'Course submitted for review', meta: 'Cloud foundations · today' },
              { title: 'Attempt report ready', meta: 'Current assessment period' },
            ],
          }}
        />

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">How it works</Reveal>
            <Stagger className="grid md:grid-cols-3 gap-6 mt-10">
              {[
                { n: '01', t: 'Apply', d: 'Sign up in 60 seconds and tell us what you teach.' },
                { n: '02', t: 'Build', d: 'Create curriculum modules, attach assessments, and set course pricing.' },
                { n: '03', t: 'Publish & earn', d: 'Submit for review, share your course, and track earnings and payouts.' },
              ].map((s) => (
                <StaggerItem key={s.n}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  >
                    <Card className="border-cream-deep hover:shadow-lg transition-shadow h-full">
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

        <section className="py-16 px-4 bg-cream-deep">
          <div className="max-w-5xl mx-auto">
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Everything in one creator workspace</Reveal>
            <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10" step={0.06}>
              {[
                { icon: BookOpen, t: 'Assessed courses' },
                { icon: Layers, t: 'Curriculum builder' },
                { icon: Users, t: 'Learner activity' },
                { icon: IndianRupee, t: 'Earnings & payouts' },
              ].map(({ icon: I, t }) => (
                <StaggerItem key={t}>
                  <motion.div
                    whileHover={{ y: -4, scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  >
                    <Card className="border-cream-deep h-full transition-shadow hover:shadow-lg">
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
                        <Button asChild className={`w-full mt-6 ${t.highlight ? 'bg-slate-900 hover:bg-black text-white' : ''}`} variant={t.highlight ? 'default' : 'outline'}>
                          <Link href={`/register?role=creator&plan=${t.name.toLowerCase()}`}>
                            Choose {t.name}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="py-16 px-4 bg-cream-deep">
          <div className="max-w-3xl mx-auto">
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Frequently asked</Reveal>
            <Reveal as="div" delay={0.1} className="mt-8 space-y-3">
              {faqs.map((f) => (
                <details key={f.q} className="bg-cream-soft border border-cream-deep rounded-xl p-4 group hover:shadow-sm transition-shadow">
                  <summary className="cursor-pointer font-medium text-slate-900 list-none flex justify-between items-center">
                    {f.q}<span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-slate-600">{f.a}</p>
                </details>
              ))}
            </Reveal>
            <div className="text-center mt-10">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
                <Button asChild className="bg-slate-900 hover:bg-black text-white rounded-full px-6">
                  <Link href="/register?role=creator">Become a creator</Link>
                </Button>
              </motion.div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
