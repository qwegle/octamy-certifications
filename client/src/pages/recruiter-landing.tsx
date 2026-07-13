import { Link } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Filter, BookmarkCheck, Check } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/motion-primitives';
import { motion } from 'framer-motion';
import PortalLandingHero from '@/components/portal-landing-hero';

const tiers = [
  { name: 'Explore', price: '₹1,000', views: '100 credits', searches: 'Pay as you use', features: ['Candidate filters', 'Saved searches', 'Credential evidence'] },
  { name: 'Hiring', price: '₹4,500', views: '500 credits', searches: '10% pack saving', highlight: true, features: ['Profile access', 'Protected CV access', 'Interview evidence'] },
  { name: 'Scale', price: '₹8,000', views: '1,000 credits', searches: '20% pack saving', features: ['Full search workspace', 'Activity analytics', 'Transaction history'] },
];

const faqs = [
  { q: 'How is candidate evidence verified?', a: 'Octamy links a completed, scored assessment to a credential ID and public verification record. Candidates cannot edit issued results.' },
  { q: 'What does a credit unlock?', a: 'Credits unlock protected actions such as profile views, CV downloads and interview evidence. The exact cost is shown before access.' },
  { q: 'Can anyone browse private candidate data?', a: 'No. Recruiters complete company verification before search access, and protected actions are logged.' },
  { q: 'How is pricing calculated?', a: 'There is no recurring commitment for recruiter access. Purchase a credit pack and use credits only for protected actions.' },
];

export default function RecruiterLanding() {
  return (
    <div className="min-h-screen bg-cream-soft flex flex-col">
      <SEO
        title="Hire candidates verified by skill"
        description="Filter candidates using verified assessment and credential evidence, with privacy-aware profile access and saved searches."
        path="/for-recruiters"
      />
      <Header />
      <main className="flex-1">
        <PortalLandingHero
          accent="indigo"
          eyebrow="For recruiters & hiring teams"
          eyebrowIcon={<ShieldCheck className="h-3.5 w-3.5" />}
          title={<>Move from profile claims to <span className="bg-gradient-to-r from-indigo-700 via-blue-600 to-cyan-600 bg-clip-text text-transparent">verified skill evidence</span></>}
          description="Search candidates by skills, experience and completed evidence. Save useful searches and unlock protected profiles, CVs or interview evidence only when relevant."
          primary={{ label: 'Start hiring', href: '/recruiter/register' }}
          secondary={{ label: 'See credit packs', href: '/pricing' }}
          preview={{
            label: 'Recruiter workspace', title: 'Evidence-led search', status: 'Company verified',
            metrics: [
              { label: 'Saved searches', value: '12' }, { label: 'Profile views', value: '38' }, { label: 'Credits', value: '500' },
            ],
            activity: [
              { title: 'Cloud engineer search saved', meta: 'Skills · experience · availability' },
              { title: 'Credential evidence reviewed', meta: 'Verified assessment result' },
              { title: 'Candidate CV unlocked', meta: 'Access recorded in activity' },
            ],
          }}
        />

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <Reveal as="h2" className="text-2xl md:text-3xl font-bold text-slate-900 text-center">Three pillars</Reveal>
            <Stagger className="grid md:grid-cols-3 gap-6 mt-10">
              {[
                { icon: ShieldCheck, t: 'Verifiable evidence', d: 'Review completed assessment results and credentials with public verification records.' },
                { icon: Filter, t: 'Useful filters', d: 'Narrow candidates by skills, evidence, experience, availability and work preference.' },
                { icon: BookmarkCheck, t: 'Repeatable discovery', d: 'Save useful filter combinations and reopen the same search from your workspace.' },
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
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 text-center">Recruiter credit packs</h2>
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
                    <Link href="/recruiter/register">
                      <Button className={`w-full mt-6 ${t.highlight ? 'bg-slate-900 hover:bg-black text-white' : ''}`} variant={t.highlight ? 'default' : 'outline'}>
                        Create recruiter account
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
