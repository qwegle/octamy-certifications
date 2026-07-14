import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Accent = 'fuchsia' | 'emerald' | 'indigo';

interface PortalLandingHeroProps {
  accent: Accent;
  eyebrow: string;
  eyebrowIcon: ReactNode;
  title: ReactNode;
  description: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  preview: {
    label: string;
    title: string;
    status: string;
    metrics: Array<{ label: string; value: string }>;
    activity: Array<{ title: string; meta: string }>;
  };
}

const accents = {
  fuchsia: {
    glow: 'from-fuchsia-300/35 via-violet-200/20 to-sky-300/35',
    eyebrow: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
    icon: 'bg-fuchsia-100 text-fuchsia-700',
    metric: 'from-fuchsia-50 to-white',
  },
  emerald: {
    glow: 'from-emerald-300/35 via-teal-200/20 to-sky-300/35',
    eyebrow: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: 'bg-emerald-100 text-emerald-700',
    metric: 'from-emerald-50 to-white',
  },
  indigo: {
    glow: 'from-indigo-300/35 via-blue-200/20 to-cyan-300/35',
    eyebrow: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    icon: 'bg-indigo-100 text-indigo-700',
    metric: 'from-indigo-50 to-white',
  },
} satisfies Record<Accent, Record<string, string>>;

export default function PortalLandingHero(props: PortalLandingHeroProps) {
  const palette = accents[props.accent];

  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-white px-4 pb-14 pt-8 sm:pb-16 sm:pt-10 lg:pt-12">
      <div aria-hidden className={`absolute inset-x-0 top-0 h-[520px] bg-gradient-to-br ${palette.glow} blur-3xl opacity-80`} />
      <div aria-hidden className="absolute inset-0 bg-grid-slate [mask-image:radial-gradient(ellipse_at_top,black_35%,transparent_75%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_.98fr] lg:gap-16">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${palette.eyebrow}`}>
            {props.eyebrowIcon}{props.eyebrow}
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.03] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
            {props.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">{props.description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-slate-950 px-7 text-white shadow-lg shadow-slate-950/10 hover:bg-black">
              <Link href={props.primary.href}>{props.primary.label}<ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-slate-300 bg-white/70 px-7 backdrop-blur">
              <Link href={props.secondary.href}>{props.secondary.label}</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" />Role-based workspace</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />No card to create an account</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12 }} className="relative">
          <div aria-hidden className="absolute -inset-5 rounded-[2.2rem] bg-white/35 blur-2xl" />
          <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-50 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.55)]">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Illustrative preview · {props.preview.label}</p>
                <p className="mt-0.5 text-sm font-semibold">{props.preview.title}</p>
              </div>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">{props.preview.status}</span>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2.5">
                {props.preview.metrics.map((metric) => (
                  <div key={metric.label} className={`rounded-xl border border-slate-200 bg-gradient-to-br ${palette.metric} p-3`}>
                    <p className="text-xl font-extrabold text-slate-950 sm:text-2xl">{metric.value}</p>
                    <p className="mt-1 text-[10px] leading-tight text-slate-500">{metric.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Recent activity</p>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                  {props.preview.activity.map((item) => (
                    <div key={item.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${palette.icon}`}><CheckCircle2 className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                        <p className="truncate text-xs text-slate-500">{item.meta}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
