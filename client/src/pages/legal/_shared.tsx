import { Link } from "wouter";

export const COMPANY = {
  legalName: "Octamy Solutions Private Limited",
  brandName: "Octamy",
  cin: "[TODO: insert CIN]",
  gstin: "[TODO: insert GSTIN]",
  registeredAddress: "[TODO: insert registered address]",
  iso: {
    certificateNumber: "[TODO: insert ISO certificate number]",
    standard: "ISO 9001 / ISO 27001",
    scope: "[TODO: insert ISO scope]",
  },
  grievanceOfficer: {
    name: "[TODO: insert Grievance Officer name]",
    email: "grievance@octamy.com",
  },
  dpo: {
    name: "[TODO: insert Data Protection Officer name]",
    email: "dpo@octamy.com",
  },
  support: {
    email: "support@octamy.com",
    phone: "[TODO: insert support phone]",
  },
  security: {
    email: "security@octamy.com",
  },
  effectiveDate: "08 May 2026",
};

interface LegalLayoutProps {
  title: string;
  effective?: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, effective, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm text-gray-500 hover:text-black">← Home</Link>
        <h1 className="text-4xl font-bold mt-4 mb-2">{title}</h1>
        <p className="text-sm text-gray-500 mb-8">
          Effective: {effective || COMPANY.effectiveDate} · {COMPANY.legalName}
        </p>
        <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-p:leading-relaxed prose-li:my-1">
          {children}
        </article>
        <div className="mt-12 pt-6 border-t text-sm text-gray-500">
          For questions about this policy, contact <a className="underline" href={`mailto:${COMPANY.grievanceOfficer.email}`}>{COMPANY.grievanceOfficer.email}</a>.
        </div>
      </div>
    </div>
  );
}
