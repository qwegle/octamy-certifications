import { Link } from "wouter";
import { COMPANY, LegalLayout } from "./legal/_shared";

export default function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" effective="28 July 2026">
      <p>
        These Terms govern your use of Octamy’s websites, mobile application,
        assessments, practice products, courses, creator and institute workspaces,
        recruiter tools, and related services. By creating an account, purchasing a
        product, or using the service, you agree to these Terms and the policies linked
        below.
      </p>

      <h2>1. Eligibility and accounts</h2>
      <p>
        You must have legal capacity to accept these Terms. If you act for an institute,
        company, or other organisation, you confirm that you are authorised to bind it.
        You must provide accurate information, protect your credentials, use your own
        account, and promptly report suspected unauthorised access.
      </p>

      <h2>2. Octamy’s services and roles</h2>
      <ul>
        <li><strong>Learners</strong> may take assessments and practice exams, activate eligible credentials, take courses, and control permitted evidence sharing.</li>
        <li><strong>Creators</strong> may publish and sell courses or videos subject to content review, commercial terms, and applicable policies.</li>
        <li><strong>Institutes and exam owners</strong> may create exams, use authorised question banks, add their own questions, assign learners, and review disclosed results and evidence.</li>
        <li><strong>Recruiters</strong> may discover and contact learners only through the access, verification, credit, purpose, and learner-consent controls provided by Octamy.</li>
      </ul>
      <p>
        Unless expressly stated, an Octamy assessment or certificate is evidence of a
        platform result, not a government licence, university award, employment
        guarantee, vendor-issued certification, or accreditation by a third party.
      </p>

      <h2>3. Assessment integrity</h2>
      <p>
        You must follow the rules displayed for each exam, answer independently unless
        collaboration is expressly allowed, and not copy, distribute, scrape, sell, or
        reconstruct protected question content. Exam owners must publish accurate rules
        and use integrity signals proportionately. Browser or mobile activity evidence is
        contextual, can have legitimate explanations, and must not be treated as an
        automatic misconduct decision.
      </p>
      <p>
        Attempt limits, duration, passing score, review timing, cooldowns, question count,
        and credential conditions are assessment-specific and are the values displayed
        for that assessment—not a platform-wide promise.
      </p>

      <h2>4. Credentials and verification</h2>
      <p>
        An eligible credential is issued only after the platform records the required
        result and any clearly disclosed activation requirement is satisfied. Limited
        credential information may be publicly verifiable. We may mark a credential
        expired, suspended, or revoked where its published validity ends, the result is
        invalidated, fraud is established, payment is reversed, or correction is required.
        We will maintain an appropriate record of material status changes.
      </p>

      <h2>5. Purchases, subscriptions, and refunds</h2>
      <p>
        The checkout page shows the product, billing period, sale price, original price
        where applicable, taxes, and payment terms before confirmation. Paid access is
        personal and non-transferable unless an institute voucher or written agreement
        says otherwise. Refund and cancellation eligibility is governed by the{" "}
        <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> and mandatory
        consumer law.
      </p>

      <h2>6. Creator, institute, and recruiter responsibilities</h2>
      <ul>
        <li>Only upload content and personal data you are authorised to use.</li>
        <li>Do not publish placeholder, misleading, unlawful, infringing, discriminatory, unsafe, or unrelated assessment material.</li>
        <li>Do not claim that Octamy, a vendor, government body, or regulator endorses content unless a written authorisation permits that claim.</li>
        <li>Institutes must give candidates required notices, choose proportionate evidence settings, and use results fairly.</li>
        <li>Recruiters must use learner data only for the disclosed legitimate purpose, honour grant expiry and revocation, and must not resell or build shadow profiles.</li>
      </ul>

      <h2>7. Intellectual property</h2>
      <p>
        Octamy and its licensors retain rights in the platform, software, brand, and
        first-party content. Creators and exam owners retain rights they lawfully hold in
        their submitted content and grant Octamy the non-exclusive rights needed to host,
        process, display, secure, distribute, and sell that content through the service.
        You may not reverse engineer, bypass access controls, or exploit the platform
        except where applicable law expressly permits it.
      </p>

      <h2>8. Acceptable use and suspension</h2>
      <p>
        You must comply with the <Link href="/acceptable-use">Acceptable Use Policy</Link>.
        We may restrict, suspend, or terminate access where reasonably necessary to
        investigate fraud, protect users or systems, comply with law, prevent continued
        breach, or address non-payment. Where appropriate, we will provide notice and an
        opportunity to contact support.
      </p>

      <h2>9. Privacy and deletion</h2>
      <p>
        The <Link href="/privacy-policy">Privacy Policy</Link> explains data handling and
        your controls. The <Link href="/user-deletion">User Deletion Policy</Link> explains
        how to request deletion and why limited records may need to be retained.
      </p>

      <h2>10. Availability, warranties, and liability</h2>
      <p>
        We work to provide a reliable service, but uninterrupted availability cannot be
        guaranteed. To the extent permitted by law, the service is provided without
        implied warranties beyond those that cannot lawfully be excluded. Nothing in
        these Terms excludes liability that applicable law does not allow us to exclude.
        Otherwise, neither party is liable for indirect or consequential loss that was
        not reasonably foreseeable. Any contractual cap or remedy in a signed business
        agreement takes priority for that customer.
      </p>

      <h2>11. Changes and governing law</h2>
      <p>
        We may update these Terms for product, security, legal, or operational reasons.
        Material changes will be communicated as appropriate and apply prospectively.
        These Terms are governed by the laws of India. Subject to mandatory consumer
        rights and dispute forums, courts at {COMPANY.jurisdictionCity} have jurisdiction.
      </p>

      <h2>12. Contact</h2>
      <p>
        Contact <a href={`mailto:${COMPANY.support.email}`}>{COMPANY.support.email}</a> for
        product support or <a href="mailto:legal@octamy.com">legal@octamy.com</a> for legal
        questions. Complaints may be escalated to{" "}
        <a href={`mailto:${COMPANY.grievanceOfficer.email}`}>{COMPANY.grievanceOfficer.email}</a>.
      </p>
    </LegalLayout>
  );
}
