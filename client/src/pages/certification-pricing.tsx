import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowRight, Award, CheckCircle2, Eye, FileCheck2, LockKeyhole, WalletCards } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';

type CatalogPricingResponse = {
  items: Array<{ id: number; price: string | number; title: string; canonicalPath: string }>;
  pagination: { totalPages: number };
};

async function fetchAllCredentialPrices(): Promise<CatalogPricingResponse> {
  const first = await apiRequest('GET', '/api/assessments?page=1&pageSize=48').then((response) => response.json()) as CatalogPricingResponse;
  if (first.pagination.totalPages <= 1) return first;
  const remaining = await Promise.all(
    Array.from({ length: first.pagination.totalPages - 1 }, (_, index) => index + 2).map(async (page) =>
      await apiRequest('GET', `/api/assessments?page=${page}&pageSize=48`).then((response) => response.json()) as CatalogPricingResponse,
    ),
  );
  return { ...first, items: [first, ...remaining].flatMap((response) => response.items) };
}

export default function CertificationPricing() {
  const { data } = useQuery<CatalogPricingResponse>({
    queryKey: ['/api/assessments', 'complete-credential-pricing'],
    queryFn: fetchAllCredentialPrices,
  });
  const currentPrice = useMemo(() => {
    const prices = (data?.items || []).map((item) => Number(item.price)).filter((price) => Number.isFinite(price) && price >= 0);
    if (!prices.length) return 'Price shown on each assessment';
    const minimum = Math.min(...prices);
    const maximum = Math.max(...prices);
    return minimum === maximum
      ? `₹${minimum.toLocaleString('en-IN')} per credential`
      : `₹${minimum.toLocaleString('en-IN')}–₹${maximum.toLocaleString('en-IN')} per credential`;
  }, [data]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-950">
      <SEO title="Certification pricing" description="Take an Octamy certification assessment and see your score free. Detailed review and verified credential activation use a separate one-off payment after passing." path="/pricing/certification" />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="border-b border-slate-200 px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-5xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-800"><Award className="h-4 w-4" />Certification credentials</p>
            <h1 className="mt-6 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Your attempt and score are free.</h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">Browse certification exams as a guest. Register or login when you are ready to start; after passing, choose whether to make one separate payment for the detailed answer review and digitally verifiable credential.</p>
            <div className="mx-auto mt-7 inline-flex rounded-xl border border-black bg-black px-6 py-4 text-lg font-black text-white">{currentPrice}</div>
            <p className="mt-3 text-xs text-slate-500">Loaded from the current certification catalogue. The assessment page is the authoritative price before checkout.</p>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
            <Step number="01" icon={<FileCheck2 className="h-6 w-6" />} title="Attempt free" copy="Choose a certification and complete the assessment. No credential payment is required to start." />
            <Step number="02" icon={<Eye className="h-6 w-6" />} title="See your score free" copy="Your result and pass status are visible without payment. You are never charged automatically." />
            <Step number="03" icon={<WalletCards className="h-6 w-6" />} title="Activate if you choose" copy="After passing, pay the one-off price shown for that assessment to unlock detailed review and the verified credential." />
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-14">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
            <Card className="rounded-xl border border-slate-300 bg-slate-50 shadow-none"><CardContent className="p-7 sm:p-8"><CheckCircle2 className="h-9 w-9 text-black" /><h2 className="mt-5 text-2xl font-black">The one-off credential payment includes</h2><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700"><li>Detailed correct-and-incorrect answer review after a passing result</li><li>Digitally verifiable certificate with live verification</li><li>An evidence-backed credential record you control</li></ul></CardContent></Card>
            <Card className="rounded-xl border border-slate-300 bg-slate-50 shadow-none"><CardContent className="p-7 sm:p-8"><LockKeyhole className="h-9 w-9 text-black" /><h2 className="mt-5 text-2xl font-black">Practice Pass is not certification payment</h2><p className="mt-5 text-sm leading-6 text-slate-700">Practice Pass only unlocks eligible practice exams for its access term. It does not include detailed certification review, a certificate, or any verified credential.</p><Button asChild variant="outline" className="mt-6 rounded-lg border-slate-400 bg-white text-black"><Link href="/pricing/practice-pass">Compare Practice Pass <ArrowRight className="h-4 w-4" /></Link></Button></CardContent></Card>
          </div>
        </section>

        <section className="px-4 py-14 text-center">
          <h2 className="text-3xl font-black tracking-tight">Choose your certification</h2>
          <p className="mt-3 text-sm text-slate-600">Every catalog card shows that the attempt is free and displays its own credential price.</p>
          <Button asChild className="mt-6 min-h-12 rounded-lg bg-black text-white hover:bg-slate-800"><Link href="/get-certified">Browse certifications <ArrowRight className="h-4 w-4" /></Link></Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Step({ number, icon, title, copy }: { number: string; icon: React.ReactNode; title: string; copy: string }) {
  return (
    <Card className="rounded-xl border border-slate-300 bg-white shadow-none">
      <CardContent className="p-7"><div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-lg bg-black text-white">{icon}</span><span className="text-4xl font-black text-slate-300">{number}</span></div><h2 className="mt-6 text-xl font-black">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p></CardContent>
    </Card>
  );
}
