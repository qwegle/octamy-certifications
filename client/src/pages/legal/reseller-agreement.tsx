import { LegalLayout, COMPANY } from "./_shared";

export default function ResellerAgreement() {
  return (
    <LegalLayout title="Reseller / Affiliate Agreement">
      <p>This Reseller / Affiliate Agreement ("Agreement") governs your participation in the {COMPANY.brandName} reseller program and is binding upon your registration at <code>/seller-auth</code>.</p>

      <h2>1. Eligibility</h2>
      <ul>
        <li>You are a resident of India or are otherwise permitted to receive commercial income from Indian companies.</li>
        <li>You are at least 18 years old and have legal capacity to contract under the Indian Contract Act, 1872.</li>
        <li>If applying as a registered entity, you are duly incorporated and authorised to enter into this Agreement.</li>
      </ul>

      <h2>2. Scope</h2>
      <p>You are an independent <strong>marketing affiliate</strong> of {COMPANY.legalName}. Nothing in this Agreement creates an employment, partnership, joint venture, agency, or franchise relationship.</p>

      <h2>3. Commercial terms</h2>
      <ul>
        <li><strong>Commission:</strong> A percentage of the net invoice value (excluding GST and gateway charges) of qualifying sales attributed to your unique referral link, as stated in your dashboard.</li>
        <li><strong>Attribution:</strong> First-click, 30-day cookie window. Self-referrals are <strong>not</strong> eligible.</li>
        <li><strong>Payout schedule:</strong> Monthly, after a 30-day refund-clearance period, subject to a minimum threshold of ₹500.</li>
        <li><strong>Deductions:</strong> Payouts are subject to TDS under §194H of the Income Tax Act, 1961 (currently 5%) and any other statutory levies.</li>
        <li><strong>Form 16A:</strong> Issued quarterly upon payout.</li>
        <li><strong>Refunds and chargebacks:</strong> Reversed from your pending balance.</li>
      </ul>

      <h2>4. KYC requirements</h2>
      <p>Before the first payout you must submit:</p>
      <ul>
        <li>PAN (mandatory).</li>
        <li>GSTIN (if registered).</li>
        <li>Bank account number, IFSC, and a cancelled cheque or bank-statement screenshot.</li>
        <li>Address proof matching the registration name.</li>
      </ul>

      <h2>5. Marketing rules</h2>
      <p>You will <strong>not</strong>:</p>
      <ul>
        <li>Make false or misleading claims (including any guarantee of employment or hiring).</li>
        <li>Bid on the {COMPANY.brandName} brand name or close variants in paid search.</li>
        <li>Send unsolicited bulk email (spam) or SMS in violation of TRAI / DLT regulations.</li>
        <li>Use coupon, cashback, or reward sites without prior written approval.</li>
        <li>Operate fake accounts, fraudulent traffic, or self-referral schemes.</li>
      </ul>

      <h2>6. Intellectual property</h2>
      <p>{COMPANY.legalName} grants a limited, non-exclusive, revocable licence to use the {COMPANY.brandName} marks and approved creatives only for marketing the platform. All goodwill arising from such use vests in {COMPANY.legalName}.</p>

      <h2>7. Term and termination</h2>
      <p>Either party may terminate this Agreement on 7 days' written notice. {COMPANY.legalName} may suspend or terminate immediately for fraud, breach of integrity, violation of law, or breach of this Agreement, and may forfeit unpaid commissions in such cases.</p>

      <h2>8. Confidentiality &amp; data</h2>
      <p>You will treat customer information accessed through the platform as Confidential Information and will not retain, copy, or share it. You will comply with the Digital Personal Data Protection Act, 2023.</p>

      <h2>9. Indemnity</h2>
      <p>You agree to indemnify {COMPANY.legalName} against any third-party claims, fines, or losses arising from your breach of this Agreement, your marketing activities, or your violation of law.</p>

      <h2>10. Governing law and jurisdiction</h2>
      <p>This Agreement is governed by the laws of India. Courts at [TODO: insert seat of jurisdiction] have exclusive jurisdiction.</p>

      <h2>11. Contact</h2>
      <p>For questions write to <a href={`mailto:${COMPANY.support.email}`}>{COMPANY.support.email}</a>.</p>
    </LegalLayout>
  );
}
