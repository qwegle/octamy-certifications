import { Link } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, GraduationCap, Briefcase, Check } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/motion-primitives';
import { motion } from 'framer-motion';
import PortalLandingHero from '@/components/portal-landing-hero';

const tiers = [
  { name: 'Starter', price: '₹2,999/mo', students: 'Core workspace', cohorts: 'Monthly billing', features: ['Bulk CSV enrolment', 'Private question banks', 'Results export', 'Team roles'] },
  { name: 'Growth', price: '₹9,999/mo', students: 'Expanded workspace', cohorts: 'Monthly billing', highlight: true, features: ['Scheduled exam windows', 'Advanced reports', 'Team access', 'Priority support'] },
  { name: 'Enterprise', price: 'Custom', students: 'Scoped to contract', cohorts: 'Scoped to contract', features: ['Integration discovery', 'Dedicated success manager', 'Security review', 'Custom SLA'] },
];

const faqs = [
  { q: 'Can I bulk add students?', a: 'Yes. Institute admins can import student records by CSV and organise them into cohorts.' },
  { q: 'Do you support our own question bank?', a: 'Yes. Institute members can maintain private question banks and reuse them across assessments.' },
  { q: 'What can institute administrators report on?', a: 'The workspace includes student activity, recent attempts, pass rates and result exports.' },
  { q: 'Do you have an integration API?', a: 'Self-serve API access is not currently public. Contact sales to scope an SIS or LMS integration.' },
];

export default function InstituteLanding() {
  return (
    <div className="min-h-screen bg-cream-soft flex flex-col">
      <SEO
        title="Skill verification for institutes"
        description="Run cohort-based assessments with CSV enrolment, private question banks, scheduled windows and results reporting."
        path="/institute"
      />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <PortalLandingHero
          accent="emerald"
          eyebrow="For institutes & L&D teams"
          eyebrowIcon={<GraduationCap className="h-3.5 w-3.5" />}
          title={<>Turn assessments into <span className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">measurable learner evidence</span></>}
          description="Organise students into cohorts, build private question banks, schedule assessments and review pass rates from one governed institute workspace."
          primary={{ label: 'Create institute account', href: '/register?role=institute' }}
          secondary={{ label: 'Talk to sales', href: '/contact' }}
          preview={{
            label: 'Institute workspace', title: 'Cohort overview', status: 'Workspace preview',
            metrics: [
              { label: 'Students', value: '248' }, { label: 'Cohorts', value: '06' }, { label: 'Active exams', value: '04' },
            ],
            activity: [
              { title: 'Assessment window opened', meta: 'Cloud foundations · Cohort A' },
              { title: 'Student import completed', meta: '42 learners added by CSV' },
              { title: 'Results report updated', meta: 'Pass rate and recent attempts' },
            ],
          }}
        />

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Built for schools, colleges, coaching</Reveal>
            <Stagger className="grid md:grid-cols-3 gap-6 mt-10">
              {[
                { icon: GraduationCap, t: 'Schools & colleges', d: 'Run end-of-term skill assessments and issue verifiable certificates.' },
                { icon: Building2, t: 'Coaching & test-prep', d: 'Group learners into cohorts and compare assessment performance over time.' },
                { icon: Briefcase, t: 'Corporate L&D', d: 'Verify employee upskilling with measurable, exportable evidence.' },
              ].map(({ icon: I, t, d }) => (
                <StaggerItem key={t}>
                  <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
                    <Card className="border-cream-deep h-full transition-shadow hover:shadow-lg">
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

        <section className="py-16 px-4 bg-cream-deep">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 text-center">Features that matter</h2>
            <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                'Cohort management with multiple programmes',
                'Bulk student enrolment via CSV',
                'Private question banks per cohort',
                'Role-based institute team access',
                'Results export for admins',
                'Scheduled assessment windows',
              ].map((f) => (
                <li key={f} className="flex gap-2 text-sm text-slate-700 bg-cream-soft border border-cream-deep rounded-xl p-4">
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
                    <Button asChild className={`w-full mt-6 ${t.highlight ? 'bg-slate-900 hover:bg-black text-white' : ''}`} variant={t.highlight ? 'default' : 'outline'}>
                      <Link href={t.name === 'Enterprise' ? '/contact' : `/register?role=institute&plan=${t.name.toLowerCase()}`}>
                        {t.name === 'Enterprise' ? 'Talk to sales' : `Choose ${t.name}`}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-cream-deep">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 text-center">Frequently asked</h2>
            <div className="mt-8 space-y-3">
              {faqs.map((f) => (
                <details key={f.q} className="bg-cream-soft border border-cream-deep rounded-xl p-4 group">
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
