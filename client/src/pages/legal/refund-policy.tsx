import { LegalLayout, COMPANY } from "./_shared";

export default function RefundPolicy() {
  return (
    <LegalLayout title="Refund & Cancellation Policy">
      <p>
        Most of {COMPANY.brandName}'s services on the platform are <strong>assessments</strong> that you can take for free. Payment is collected only after a pass when you choose to activate a credential or purchase another clearly labelled paid service.
      </p>

      <h2>1. Refund eligibility</h2>
      <ul>
        <li><strong>Credential activation fee:</strong> Eligible for review where a duplicate charge, failed activation, materially incorrect deliverable, or other platform error occurred. An activated and successfully delivered digital credential is otherwise non-refundable except where applicable law requires a refund.</li>
        <li><strong>Paid Skill-Verification Internship Program:</strong> Refundable on a pro-rata basis within the first 7 days from enrolment, less a non-refundable platform/admin component (up to 15% of the fee).</li>
        <li><strong>Business / B2B subscriptions:</strong> Governed by the master service agreement signed with the customer.</li>
      </ul>

      <h2>2. Non-refundable items</h2>
      <ul>
        <li>Verification or re-issuance of an already-issued certificate.</li>
        <li>Failed payment-gateway charges or third-party convenience fees.</li>
        <li>Promotional, discounted, or gifted access where so stated at the point of sale.</li>
      </ul>

      <h2>3. Failed assessments</h2>
      <p>Assessments are <strong>free</strong>. If you do not pass, you owe nothing and the current product does not ask you to pay for that attempt.</p>

      <h2>4. Cancellation</h2>
      <p>You may abandon checkout before payment is confirmed. For a confirmed payment, email <a href={`mailto:${COMPANY.support.email}`}>{COMPANY.support.email}</a> from your registered email address and the request will be assessed under the eligibility rules above.</p>

      <h2>5. How to request a refund</h2>
      <ol>
        <li>Email <a href={`mailto:${COMPANY.support.email}`}>{COMPANY.support.email}</a> with subject <em>"Refund request — &lt;Order ID&gt;"</em>.</li>
        <li>We respond within 2 business days and process eligible refunds within <strong>7–10 business days</strong> to the original payment instrument.</li>
        <li>For PayU/UPI/credit-card refunds, your bank may take additional time to credit your account.</li>
      </ol>

      <h2>6. Disputes</h2>
      <p>Unresolved disputes may be escalated to our Grievance Officer at <a href={`mailto:${COMPANY.grievanceOfficer.email}`}>{COMPANY.grievanceOfficer.email}</a>. Consumers may also approach the relevant District Consumer Disputes Redressal Commission under the Consumer Protection Act, 2019.</p>
    </LegalLayout>
  );
}
