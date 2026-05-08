import { LegalLayout, COMPANY } from "./_shared";

export default function AcceptableUse() {
  return (
    <LegalLayout title="Acceptable Use Policy">
      <p>By using {COMPANY.brandName} you agree to use the platform only for lawful, ethical, and assessment-integrity-respecting purposes. Violations may result in suspension, certificate revocation, and / or legal action.</p>

      <h2>1. You will not</h2>
      <ul>
        <li>Impersonate another person, share accounts, or take an assessment on behalf of another candidate.</li>
        <li>Use AI tools, screen-sharing, second devices, or any unauthorised aid to obtain answers during a proctored assessment, unless explicitly permitted.</li>
        <li>Copy, leak, or redistribute assessment questions, answer keys, or proprietary content.</li>
        <li>Forge, modify, or misrepresent any certificate, badge, score, or transcript issued by {COMPANY.brandName}.</li>
        <li>Use the platform to harass, defame, threaten, or send unsolicited communications.</li>
        <li>Upload malware, scrape data at scale, or attempt to breach the security of the platform or other users.</li>
        <li>Use the platform to violate Indian law or the law of the jurisdiction where you reside.</li>
      </ul>

      <h2>2. Assessment integrity</h2>
      <p>Assessments may include identity verification, behavioural signals, and post-hoc statistical review. Anomalies trigger a manual review and we may invalidate scores or revoke certificates.</p>

      <h2>3. Resellers and partners</h2>
      <p>Resellers must additionally comply with the <a href="/reseller-agreement" className="underline">Reseller Agreement</a> and must not engage in self-referrals, fake conversions, or misleading marketing claims (e.g. promising employment).</p>

      <h2>4. Reporting abuse</h2>
      <p>Report violations to <a href={`mailto:${COMPANY.grievanceOfficer.email}`}>{COMPANY.grievanceOfficer.email}</a>.</p>
    </LegalLayout>
  );
}
