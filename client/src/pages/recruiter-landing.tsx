import { Link } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Filter, Download, Check } from 'lucide-react';

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
        <section className="py-20 px-4 text-center bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-semibold text-slate-900 tracking-tight">
              Hire candidates verified by skill, not resumes
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Filter on proctored exam scores, badges and skill levels. Export to your ATS. No more CV roulette.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/register?role=recruiter">
                <Button className="bg-slate-900 hover:bg-black text-white rounded-full px-6">Start hiring</Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" className="rounded-full px-6">See pricing</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 text-center">Three pillars</h2>
            <div className="grid md:grid-cols-3 gap-6 mt-10">
              {[
                { icon: ShieldCheck, t: 'Verified scores', d: 'Every score is from a proctored exam. Tamper-proof, exportable, third-party verifiable.' },
                { icon: Filter, t: 'Live skill filters', d: 'Search by skill, score, percentile, badges and recency in real time.' },
                { icon: Download, t: 'ATS export', d: 'Push shortlisted candidates to Greenhouse, Lever, Zoho Recruit via webhook.' },
              ].map(({ icon: I, t, d }) => (
                <Card key={t} className="border-slate-200">
                  <CardContent className="pt-6">
                    <I className="w-6 h-6 text-slate-700" />
                    <div className="text-lg font-semibold text-slate-900 mt-3">{t}</div>
                    <div className="text-sm text-slate-600 mt-2">{d}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
