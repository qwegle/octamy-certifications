import { LegalLayout, COMPANY } from "./_shared";

export default function CookiePolicy() {
  return (
    <LegalLayout title="Cookie Policy">
      <p>This Cookie Policy explains how {COMPANY.legalName} uses cookies and similar technologies on {COMPANY.brandName} (<code>octamy.com</code>).</p>

      <h2>1. What are cookies?</h2>
      <p>Cookies are small text files placed on your device by a website. They allow the site to remember your actions and preferences for a period of time.</p>

      <h2>2. Categories of cookies we use</h2>
      <ul>
        <li><strong>Strictly necessary</strong> — authentication, session, CSRF, load-balancing. These cannot be disabled.</li>
        <li><strong>Functional</strong> — preferences such as theme and language.</li>
        <li><strong>Analytics</strong> — anonymous usage statistics. Set only after you grant consent.</li>
        <li><strong>Payment</strong> — set by PayU at checkout, to comply with payment-gateway requirements.</li>
      </ul>
      <p>We do <strong>not</strong> use third-party advertising or cross-site tracking cookies.</p>

      <h2>3. Managing your consent</h2>
      <p>On your first visit you will see a consent banner. You can change your choice at any time by clearing your browser storage for this domain.</p>

      <h2>4. Browser controls</h2>
      <p>All major browsers let you block or delete cookies. Disabling strictly-necessary cookies will prevent core functionality such as login and checkout from working.</p>

      <h2>5. Contact</h2>
      <p>Questions about cookies: <a href={`mailto:${COMPANY.dpo.email}`}>{COMPANY.dpo.email}</a>.</p>
    </LegalLayout>
  );
}
