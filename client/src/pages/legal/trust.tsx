import { LegalLayout, COMPANY } from "./_shared";
import { Link } from "wouter";

export default function TrustPage() {
  return (
    <LegalLayout title="Trust & Compliance">
      <p>
        {COMPANY.brandName} is operated by <strong>{COMPANY.legalName}</strong>, an Indian company committed to building a trustworthy assessment and skill-verification platform. This page summarises the legal, security, and compliance posture of the platform.
      </p>

      <h2>Company information</h2>
      <ul>
        <li><strong>Legal name:</strong> {COMPANY.legalName}</li>
        <li><strong>CIN:</strong> {COMPANY.cin}</li>
        <li><strong>GSTIN:</strong> {COMPANY.gstin}</li>
        <li><strong>Registered office:</strong> {COMPANY.registeredAddress}</li>
        <li><strong>Customer support:</strong> <a href={`mailto:${COMPANY.support.email}`}>{COMPANY.support.email}</a> · {COMPANY.support.phone}</li>
      </ul>

      <h2>Certifications</h2>
      <ul>
        <li><strong>{COMPANY.iso.standard}</strong> — Certificate {COMPANY.iso.certificateNumber}. Scope: {COMPANY.iso.scope}.</li>
        <li>Certificate of Incorporation issued by the Ministry of Corporate Affairs, Government of India.</li>
      </ul>

      <h2>Grievance Officer (DPDP Act 2023, IT Rules 2021)</h2>
      <p>
        In accordance with Section 10 of the Digital Personal Data Protection Act, 2023 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021:
      </p>
      <ul>
        <li><strong>Name:</strong> {COMPANY.grievanceOfficer.name}</li>
        <li><strong>Email:</strong> <a href={`mailto:${COMPANY.grievanceOfficer.email}`}>{COMPANY.grievanceOfficer.email}</a></li>
        <li>Acknowledgement within 24 hours; resolution within 15 calendar days.</li>
      </ul>

      <h2>Data Protection Officer</h2>
      <ul>
        <li><strong>Name:</strong> {COMPANY.dpo.name}</li>
        <li><strong>Email:</strong> <a href={`mailto:${COMPANY.dpo.email}`}>{COMPANY.dpo.email}</a></li>
      </ul>

      <h2>Security</h2>
      <p>
        Report a security vulnerability privately to <a href={`mailto:${COMPANY.security.email}`}>{COMPANY.security.email}</a>. We follow responsible disclosure (no public disclosure for 90 days; safe-harbour for good-faith research). Our <code>/.well-known/security.txt</code> is published.
      </p>

      <h2>Compliance frameworks</h2>
      <ul>
        <li>Digital Personal Data Protection Act, 2023 (India)</li>
        <li>Information Technology Act, 2000 (and §43A, §72A) — reasonable security practices</li>
        <li>Consumer Protection (E-Commerce) Rules, 2020</li>
        <li>Goods &amp; Services Tax Act, 2017 — GST-compliant tax invoices</li>
        <li>Income Tax Act, 1961 — TDS §194H on partner commissions</li>
        <li>{COMPANY.iso.standard} — Information security management system</li>
        <li>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA — target</li>
      </ul>

      <h2>Policies</h2>
      <ul>
        <li><Link className="underline" href="/privacy-policy">Privacy Policy</Link></li>
        <li><Link className="underline" href="/terms-of-service">Terms of Service</Link></li>
        <li><Link className="underline" href="/refund-policy">Refund &amp; Cancellation Policy</Link></li>
        <li><Link className="underline" href="/cookie-policy">Cookie Policy</Link></li>
        <li><Link className="underline" href="/acceptable-use">Acceptable Use Policy</Link></li>
        <li><Link className="underline" href="/disclaimer">Assessment Disclaimer</Link></li>
        <li><Link className="underline" href="/reseller-agreement">Reseller / Affiliate Agreement</Link></li>
        <li><Link className="underline" href="/accessibility">Accessibility Statement</Link></li>
      </ul>

      <h2>Document downloads</h2>
      <p className="text-sm text-gray-500">
        Certificate of Incorporation and ISO certificate are available on request from <a className="underline" href={`mailto:${COMPANY.support.email}`}>{COMPANY.support.email}</a>. (Public PDF links to be added once uploaded.)
      </p>
    </LegalLayout>
  );
}
