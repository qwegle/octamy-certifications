import { LegalLayout, COMPANY } from "./_shared";

export default function Disclaimer() {
  return (
    <LegalLayout title="Assessment & Program Disclaimer">
      <p className="font-semibold">
        {COMPANY.brandName} is an assessment and skill-certification platform. It is <strong>not</strong> an employer, recruitment agency, or staffing firm.
      </p>

      <h2>1. Skill-Verification Internship Programs</h2>
      <p>
        Programs labelled "Internship" on {COMPANY.brandName} are <strong>Skill-Verification Internship Programs</strong> — structured, project-based assessments that allow candidates to demonstrate capability in a domain. They:
      </p>
      <ul>
        <li>do <strong>not</strong> create an employer-employee relationship between the candidate and {COMPANY.legalName} or any third party;</li>
        <li>do <strong>not</strong> entitle the candidate to wages, stipend, PF/ESI, leave, or any statutory employment benefit;</li>
        <li>do <strong>not</strong> guarantee placement, hiring, or interview opportunities with any company;</li>
        <li>do <strong>not</strong> represent participation as paid or formal industrial training under the Apprentices Act, 1961.</li>
      </ul>

      <h2>2. Certificates</h2>
      <p>Certificates issued certify only that the named candidate has <strong>passed the assessment requirements</strong> of the program on the stated date. They are not testimonials of employment, work-experience, or character. Each certificate carries a unique ID and is verifiable at <code>octamy.com/verify</code>.</p>

      <h2>3. Optional certificate fee</h2>
      <p>Taking the assessment is <strong>free</strong>. After passing, candidates may <strong>optionally</strong> purchase a verified digital certificate. The fee covers verification, certificate issuance, evaluation overhead, and platform/admin costs. Fees are disclosed before payment and are subject to our <a className="underline" href="/refund-policy">Refund Policy</a>.</p>

      <h2>4. No professional advice</h2>
      <p>Content on {COMPANY.brandName} (course material, sample questions, feedback) is for educational purposes only and does not constitute professional, legal, medical, or financial advice.</p>

      <h2>5. Limitation of liability</h2>
      <p>To the maximum extent permitted by law, {COMPANY.legalName} disclaims all warranties and shall not be liable for any indirect, incidental, or consequential damages arising from the use of the platform or reliance on assessment results.</p>
    </LegalLayout>
  );
}
