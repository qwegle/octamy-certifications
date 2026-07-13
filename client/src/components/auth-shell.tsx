import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import octamyLogoDark from '@/assets/image_1750054456482.png';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  children: ReactNode;
  wide?: boolean;
}

export function AuthShell({ eyebrow, title, description, highlights, children, wide = false }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#f6f7f9] lg:grid lg:grid-cols-[minmax(360px,0.88fr)_minmax(560px,1.12fr)]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div aria-hidden className="absolute -left-28 top-32 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div aria-hidden className="absolute -right-24 bottom-16 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
        <div aria-hidden className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:40px_40px]" />

        <Link href="/" className="relative inline-flex w-fit items-center rounded-full bg-white px-4 py-2.5 shadow-lg">
          <img src={octamyLogoDark} alt="Octamy" className="h-6 w-auto" />
        </Link>

        <div className="relative my-auto max-w-xl py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200">
            <Sparkles className="h-3.5 w-3.5" /> {eyebrow}
          </span>
          <h2 className="mt-7 text-4xl font-extrabold leading-[1.05] tracking-[-0.045em] xl:text-5xl">{title}</h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">{description}</p>

          <div className="mt-9 space-y-4">
            {highlights.map((highlight) => (
              <div key={highlight} className="flex items-center gap-3 text-sm font-medium text-slate-100">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                {highlight}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Secure, role-aware access for every Octamy workspace
        </div>
      </aside>

      <main id="main-content" className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/" className="inline-flex items-center rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
              <img src={octamyLogoDark} alt="Octamy" className="h-6 w-auto" />
            </Link>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </div>

          <Link href="/" className="absolute right-8 top-8 hidden items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-950 lg:inline-flex">
            <ArrowLeft className="h-4 w-4" /> Back to Octamy
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
