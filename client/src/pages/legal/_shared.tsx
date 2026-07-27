import { Link } from "wouter";

export const COMPANY = {
  legalName: "Octamy Solutions Private Limited",
  brandName: "Octamy",
  // Legal identifiers are populated from environment configuration. When an
  // identifier is absent, the page directs users to the legal contact instead.
  cin: import.meta.env.VITE_COMPANY_CIN || "Available on request — write to legal@octamy.com",
  gstin: import.meta.env.VITE_COMPANY_GSTIN || "Available on request — write to legal@octamy.com",
  registeredAddress:
    import.meta.env.VITE_COMPANY_ADDRESS ||
    "Registered office details available on request — write to legal@octamy.com",
  iso: {
    certificateNumber: import.meta.env.VITE_COMPANY_ISO_NUMBER || "",
    standard: import.meta.env.VITE_COMPANY_ISO_STANDARD || "",
    scope: import.meta.env.VITE_COMPANY_ISO_SCOPE || "",
  },
  grievanceOfficer: {
    name: import.meta.env.VITE_COMPANY_GRIEVANCE_OFFICER || "Grievance Officer, Octamy",
    email: "grievance@octamy.com",
  },
  dpo: {
    name: import.meta.env.VITE_COMPANY_DPO || "Data Protection Officer, Octamy",
    email: "dpo@octamy.com",
  },
  support: {
    email: "support@octamy.com",
    phone: import.meta.env.VITE_COMPANY_SUPPORT_PHONE || "support@octamy.com (email only)",
  },
  security: {
    email: "security@octamy.com",
  },
  jurisdictionCity: import.meta.env.VITE_COMPANY_JURISDICTION || "Bengaluru, Karnataka, India",
  effectiveDate: "08 May 2026",
};

interface LegalLayoutProps {
  title: string;
  effective?: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, effective, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-cream-soft">
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
