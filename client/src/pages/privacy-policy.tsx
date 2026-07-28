import { Link } from "wouter";
import { COMPANY, LegalLayout } from "./legal/_shared";

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" effective="28 July 2026">
      <p>
        This policy explains how {COMPANY.legalName} (“Octamy”, “we”, “us”) handles
        personal data when learners, creators, institutes, recruiters, and visitors
        use octamy.com or the Octamy mobile application.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account and profile data:</strong> name, email address, role, password hash, profile details, skills, portfolio links, and your visibility choices.</li>
        <li><strong>Assessment data:</strong> issued question-set identifiers, answers, scores, timing, attempt history, certificate status, and integrity evidence described before an attempt begins.</li>
        <li><strong>Creator and institute data:</strong> workspace membership, courses, exams, question banks, cohorts, learner assignments, payouts, and support records.</li>
        <li><strong>Recruiter data:</strong> account verification, searches, saved profiles, evidence grants, access history, and contact activity.</li>
        <li><strong>Transaction data:</strong> order, payment status, invoice and refund information. Payment-card or UPI credentials are handled by the payment provider and are not stored by Octamy.</li>
        <li><strong>Technical data:</strong> IP address, device/browser information, security logs, cookies, session identifiers, crash and performance information.</li>
        <li><strong>Communications:</strong> support, grievance, deletion, and other messages you send us.</li>
      </ul>

      <h2>2. Assessment and browser evidence</h2>
      <p>
        Timed attempts record consent, answer submission, timing, recovery events, and
        connection status. When an exam owner enables Browser Evidence, Octamy also
        records the occurrence and time of tab visibility changes, window focus changes,
        fullscreen changes, and paste attempts. Mobile exams may record when the Octamy
        app becomes inactive or enters the background. These signals provide context to
        an authorised reviewer; they do not alter a score or make an automated finding
        of misconduct.
      </p>
      <p>
        Browser Evidence does not collect screen contents, clipboard contents,
        keystrokes, webcam video, microphone audio, or the identity of another app you
        opened. Practice exams do not create recruiter evidence.
      </p>

      <h2>3. AI Interview Practice and code execution</h2>
      <p>
        Interview Practice is private unless you explicitly choose otherwise. Camera,
        microphone, transcription, and AI processing are disclosed separately before use.
        Local rehearsal video remains in app-controlled, backup-excluded device storage
        and is not uploaded by the current mobile flow. If you request transcription or
        AI feedback, submitted text or audio is processed only to provide that feature.
        Code submitted for test execution is sent to an isolated execution service with
        networking disabled. Octamy does not score facial appearance, emotion, gaze,
        accent, or protected characteristics.
      </p>

      <h2>4. How and why we use data</h2>
      <ul>
        <li>Provide accounts, assessments, courses, practice products, certificates, workspaces, and recruiter features.</li>
        <li>Save, recover, score, review, and validate legitimate assessment attempts.</li>
        <li>Process orders, credential activation, subscriptions, vouchers, payouts, refunds, and tax records.</li>
        <li>Apply the profile, evidence-passport, and recruiter-sharing choices you make.</li>
        <li>Secure the platform, prevent fraud and abuse, troubleshoot failures, and enforce published rules.</li>
        <li>Respond to support, legal, privacy, and grievance requests.</li>
        <li>Meet legal, accounting, regulatory, and dispute-resolution obligations.</li>
      </ul>

      <h2>5. When data is shared</h2>
      <p>We do not sell personal data. We share only what is needed with:</p>
      <ul>
        <li>Service providers that host, secure, communicate, process payments, or operate requested AI and code-execution features under appropriate contracts.</li>
        <li>An institute or exam owner administering an assessment, including its results and disclosed integrity evidence.</li>
        <li>Recruiters only within your visibility settings or a specific evidence grant you authorise.</li>
        <li>The public when you make an evidence passport public or when limited certificate details are required for credential verification.</li>
        <li>Authorities or other parties where required by law, necessary to protect rights and safety, or connected to a lawful corporate transaction.</li>
      </ul>

      <h2>6. Storage and retention</h2>
      <p>
        We retain data only as long as reasonably necessary for the service, security,
        legal, accounting, and dispute purposes for which it was collected. Assessment
        and credential records may need to be retained to preserve result integrity,
        prevent duplicate or fraudulent issuance, and keep an issued credential
        verifiable. Mobile recovery data remains on that device until successful
        submission, explicit cleanup, sign-out, or uninstall, subject to operating-system
        storage behaviour. Interview Practice server data follows the retention disclosed
        in that feature and can be deleted from its session controls.
      </p>

      <h2>7. Your choices and rights</h2>
      <p>
        Depending on applicable law, you may request access, correction, a copy,
        restriction, withdrawal of consent, or deletion of eligible personal data. You
        can control recruiter discovery, public evidence-passport visibility, and
        individual recruiter evidence grants from your profile settings. Withdrawing a
        choice does not make earlier lawful processing invalid.
      </p>
      <p>
        See the <Link href="/user-deletion">User Deletion Policy</Link> for the request
        process, verification steps, exclusions, and expected handling.
      </p>

      <h2>8. Security and international processing</h2>
      <p>
        We use access controls, encryption where appropriate, audit records, and
        operational safeguards designed for the sensitivity of the data. No internet
        service can guarantee absolute security. Some contracted providers may process
        data outside your state or country; where required, we use contractual and other
        lawful safeguards.
      </p>

      <h2>9. Children</h2>
      <p>
        Octamy is a professional learning and assessment platform and is not directed to
        children under 13. Institutes assigning the service to minors must have authority
        to do so and provide any notices or consent required by applicable law.
      </p>

      <h2>10. Cookies and updates</h2>
      <p>
        We use strictly necessary cookies and local storage for authentication, security,
        preferences, assessment recovery, and core functionality. See our
        <Link href="/cookie-policy"> Cookie Policy</Link> for details. We may update this
        policy as products or legal requirements change; the effective date above shows
        the current version.
      </p>

      <h2>11. Contact and complaints</h2>
      <p>
        Privacy questions can be sent to <a href={`mailto:${COMPANY.dpo.email}`}>{COMPANY.dpo.email}</a>.
        Complaints can be escalated to {COMPANY.grievanceOfficer.name} at{" "}
        <a href={`mailto:${COMPANY.grievanceOfficer.email}`}>{COMPANY.grievanceOfficer.email}</a>.
      </p>
    </LegalLayout>
  );
}
