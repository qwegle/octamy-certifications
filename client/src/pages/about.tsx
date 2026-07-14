import { Helmet } from 'react-helmet-async';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Award, Users2, Globe2 } from 'lucide-react';

export default function About() {
  return (
    <>
      <Helmet>
        <title>About Octamy — Skill Verification & Certification Platform</title>
        <meta
          name="description"
          content="Octamy is an Indian assessment-first credential platform. Take assessments free, pay only after passing, and share an inspectable evidence record when you choose."
        />
        <link rel="canonical" href="https://octamy.com/about" />
      </Helmet>
      <Header />
      <main id="main-content" className="bg-cream-soft text-slate-900">
        <section className="border-b border-cream-deep bg-gradient-to-b from-sky-50 to-white">
          <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
            <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">About Octamy</p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight">
              Skill verification you can trust — pay only after you pass.
            </h1>
            <p className="mt-5 text-lg text-slate-700 max-w-3xl">
              Octamy is an Indian skill-assessment and certification platform built around a simple
              principle: candidates take assessments for free and only pay if they want an activated
              credential after passing. We record assessment evidence that individuals can share,
              while recruiters can inspect the score and current credential status.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/courses">
                <Button className="bg-sky-700 hover:bg-sky-800 text-white">Browse assessments</Button>
              </Link>
              <Link href="/partners/login">
                <Button variant="outline" className="border-slate-300">Become a partner</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold">What we do</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <Feature
              icon={<ShieldCheck className="w-6 h-6 text-sky-700" />}
              title="Verified credentials"
              body="Every certificate ties back to an actual assessment record. Recruiters and employers can verify any credential publicly at /verify."
            />
            <Feature
              icon={<Award className="w-6 h-6 text-sky-700" />}
              title="Assessment-first model"
              body="Assessments are free. Certificates are optional and paid only after passing — no upfront 'internship fee' or hidden cost."
            />
            <Feature
              icon={<Users2 className="w-6 h-6 text-sky-700" />}
              title="Partner program"
              body="Educators, communities and creators can refer candidates and earn 10% commission on every certificate purchased through their referral."
            />
            <Feature
              icon={<Globe2 className="w-6 h-6 text-sky-700" />}
              title="Built in India"
              body="Built and operated from India under Indian law. GST-compliant invoicing, TDS §194H on partner payouts, INR-first checkout."
            />
          </div>
        </section>

        <section className="bg-cream-deep border-y border-cream-deep">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold">Compliance & legal</h2>
            <p className="mt-4 text-slate-700 max-w-3xl">
              Octamy is operated by Octamy Solutions Private Limited. Our Skill-Verification
              Internship Programs are assessment and certification initiatives only and do not
              constitute employment, payroll engagement, or guarantee of placement. Corporate
              registration details, GST/CIN and ISO documentation are available on request to{' '}
              <a className="text-sky-700 underline" href="mailto:legal@octamy.com">legal@octamy.com</a>.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Link href="/trust" className="text-sky-700 hover:underline">Trust & Compliance</Link>
              <Link href="/privacy-policy" className="text-sky-700 hover:underline">Privacy Policy</Link>
              <Link href="/terms-of-service" className="text-sky-700 hover:underline">Terms of Service</Link>
              <Link href="/refund-policy" className="text-sky-700 hover:underline">Refund Policy</Link>
              <Link href="/disclaimer" className="text-sky-700 hover:underline">Disclaimer</Link>
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold">Get in touch</h2>
          <ul className="mt-4 space-y-2 text-slate-700">
            <li>General support: <a className="text-sky-700 underline" href="mailto:support@octamy.com">support@octamy.com</a></li>
            <li>Grievance officer: <a className="text-sky-700 underline" href="mailto:grievance@octamy.com">grievance@octamy.com</a></li>
            <li>Legal & compliance: <a className="text-sky-700 underline" href="mailto:legal@octamy.com">legal@octamy.com</a></li>
            <li>Partnerships: <a className="text-sky-700 underline" href="mailto:partners@octamy.com">partners@octamy.com</a></li>
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-cream-deep p-6 bg-cream-soft">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-sky-50 p-2">{icon}</div>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-slate-600 text-sm leading-relaxed">{body}</p>
    </div>
  );
}
