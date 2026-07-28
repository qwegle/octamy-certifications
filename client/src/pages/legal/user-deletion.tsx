import { COMPANY, LegalLayout } from "./_shared";

export default function UserDeletionPolicy() {
  return (
    <LegalLayout title="User Deletion Policy" effective="28 July 2026">
      <p>
        Octamy users may request deletion of an account and personal data that is no
        longer required. This public page applies to accounts created on octamy.com and
        in the Octamy mobile application.
      </p>

      <h2>1. How to request deletion</h2>
      <ol>
        <li>In the mobile app, open <strong>Profile → Privacy &amp; evidence → Request account deletion</strong>, or email <a href={`mailto:${COMPANY.support.email}?subject=Account%20deletion%20request`}>{COMPANY.support.email}</a>.</li>
        <li>Send the request from the email address registered to your Octamy account and use the subject <em>Account deletion request</em>.</li>
        <li>If you cannot access that mailbox, explain this in the request. We will ask for proportionate information to confirm account ownership and protect you from unauthorised deletion.</li>
      </ol>
      <p>
        Do not send a password, one-time code, government ID, payment-card number, or
        other unnecessary sensitive document by email.
      </p>

      <h2>2. What is deleted or de-identified</h2>
      <p>After verification and subject to the exceptions below, we will delete or de-identify:</p>
      <ul>
        <li>Account profile fields and optional biography, skill, portfolio, and social details.</li>
        <li>Authentication sessions and identifiers that are no longer needed for security records.</li>
        <li>Recruiter-discovery visibility, public evidence-passport access, saved searches, and active evidence grants associated with the account.</li>
        <li>Unsubmitted device-local exam/practice recovery data when you also clear app data, sign out where the app provides cleanup, or uninstall the app.</li>
        <li>Private Interview Practice sessions and local rehearsal recordings eligible for deletion under their feature controls.</li>
        <li>Marketing preferences and support data that is not needed to document or fulfil the request.</li>
      </ul>

      <h2>3. Records that may be retained</h2>
      <p>We may retain the minimum information necessary to:</p>
      <ul>
        <li>Meet tax, accounting, payment, refund, chargeback, anti-fraud, regulatory, or legal obligations.</li>
        <li>Preserve the integrity and verification status of an issued credential or completed institute assessment. Where feasible, the retained record will be minimised or de-identified.</li>
        <li>Resolve disputes, enforce rights, investigate abuse, or maintain security audit evidence.</li>
        <li>Record that a deletion request was completed and prevent the deleted account from being inadvertently restored.</li>
        <li>Maintain content an institute, creator, or organisation owns independently of your personal account, subject to removal or anonymisation of personal fields where appropriate.</li>
      </ul>
      <p>
        Backup copies may persist for a limited backup rotation and are protected from
        ordinary use until overwritten, unless restoration is required for disaster
        recovery.
      </p>

      <h2>4. Timing and confirmation</h2>
      <p>
        We will acknowledge the request and tell you if verification or additional scope
        information is needed. We aim to complete eligible deletion within 30 days after
        verification, or within another period required by applicable law. Complex or
        legally restricted requests may take longer; if so, we will explain the reason
        and expected next step. A completion notice will be sent to the verified contact
        address.
      </p>

      <h2>5. Consequences</h2>
      <p>
        Deletion is permanent. You will lose access to the account, private learning and
        practice history, unpublished content, preferences, and other deleted data.
        Previously issued credentials may remain minimally verifiable or may show a
        privacy-preserving holder/status record where retention is required. Purchases
        are not automatically refunded by account deletion; the published refund policy
        continues to apply.
      </p>

      <h2>6. Questions or complaints</h2>
      <p>
        Ask questions at <a href={`mailto:${COMPANY.dpo.email}`}>{COMPANY.dpo.email}</a>.
        If you believe a request was not handled properly, contact{" "}
        <a href={`mailto:${COMPANY.grievanceOfficer.email}`}>{COMPANY.grievanceOfficer.email}</a>.
      </p>
    </LegalLayout>
  );
}
