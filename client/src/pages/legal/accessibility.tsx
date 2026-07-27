import { LegalLayout, COMPANY } from "./_shared";

export default function Accessibility() {
  return (
    <LegalLayout title="Accessibility Statement">
      <p>{COMPANY.legalName} is committed to making {COMPANY.brandName} usable for everyone, including people with disabilities. We aim to conform to <strong>WCAG 2.1 Level AA</strong>.</p>

      <h2>Conformance status</h2>
      <p>The platform is currently <strong>partially conformant</strong> with WCAG 2.1 AA. Some areas are still being audited and remediated. We perform automated and manual audits each release cycle.</p>

      <h2>Measures taken</h2>
      <ul>
        <li>Semantic HTML and ARIA roles for assistive technologies.</li>
        <li>Keyboard navigation and visible focus states.</li>
        <li>Respect for <code>prefers-reduced-motion</code>.</li>
        <li>Minimum 4.5:1 contrast for body text.</li>
        <li>Form fields with explicit labels and error messages.</li>
      </ul>

      <h2>Known limitations</h2>
      <ul>
        <li>Some dense administration tables and third-party checkout surfaces are still being audited for keyboard flow, zoom, and contrast.</li>
        <li>Certain interactive charts have not yet been audited for screen-reader compatibility.</li>
      </ul>

      <h2>Feedback</h2>
      <p>Report accessibility issues to <a href={`mailto:${COMPANY.support.email}`}>{COMPANY.support.email}</a> with subject <em>"Accessibility"</em>. We aim to respond within 5 business days.</p>
    </LegalLayout>
  );
}
