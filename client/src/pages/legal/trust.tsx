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

      <h2>Independent certifications</h2>
      {COMPANY.iso.certificateNumber && COMPANY.iso.standard ? (
        <p><strong>{COMPANY.iso.standard}</strong> — Certificate {COMPANY.iso.certificateNumber}{COMPANY.iso.scope ? `; scope: ${COMPANY.iso.scope}` : ''}.</p>
      ) : (
        <p>Octamy does not currently display an independently verifiable ISO certification on this page. Any future certification will be shown with its standard, certificate number and scope.</p>
      )}

      <h2>Grievance Officer (DPDP Act 2023, IT Rules 2021)</h2>
      <p>
        Privacy or grievance questions can be sent to the contact below. Statutory response timelines apply where the relevant law requires them.
      </p>
      <ul>
        <li><strong>Name:</strong> {COMPANY.grievanceOfficer.name}</li>
        <li><strong>Email:</strong> <a href={`mailto:${COMPANY.grievanceOfficer.email}`}>{COMPANY.grievanceOfficer.email}</a></li>
      </ul>

      <h2>Data Protection Officer</h2>
      <ul>
        <li><strong>Name:</strong> {COMPANY.dpo.name}</li>
        <li><strong>Email:</strong> <a href={`mailto:${COMPANY.dpo.email}`}>{COMPANY.dpo.email}</a></li>
      </ul>

      <h2>Security</h2>
      <p>
        Report a security vulnerability privately to <a href={`mailto:${COMPANY.security.email}`}>{COMPANY.security.email}</a>. Please avoid accessing other people's data and allow us time to investigate before public disclosure.
      </p>

      <h2>Compliance commitments and targets</h2>
      <ul>
        <li>Privacy processes designed for applicable Indian data-protection requirements</li>
        <li>Consumer disclosures, cancellation terms and tax invoices where applicable</li>
        <li>Role-based access, audit logging and least-data public responses in the application</li>
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
        Supporting company documents can be requested from <a className="underline" href={`mailto:${COMPANY.support.email}`}>{COMPANY.support.email}</a>. Octamy will not represent a certification here until its verifiable reference is configured.
      </p>
    </LegalLayout>
  );
}
