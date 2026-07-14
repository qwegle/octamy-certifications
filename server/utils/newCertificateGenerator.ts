import puppeteer from "puppeteer";

export interface CertificateData {
  certificateId: string;
  userName: string;
  courseTitle: string;
  issueDate: Date;
  completionDate: Date;
  expiryDate?: Date | null;
  passingScore: number;
  userScore: number;
  courseLevel: string;
  verificationUrl?: string;
  coIssuerName?: string | null;
  coIssuerLogoUrl?: string | null;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeAssetUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith("/api/media/files/")) return escapeHtml(value);
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:" || (process.env.NODE_ENV !== "production" && parsed.protocol === "http:")) {
      return escapeHtml(parsed.toString());
    }
  } catch {
    // Invalid URLs are omitted from the credential rather than interpolated.
  }
  return null;
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "Not set";
  return value.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function generateCertificateHTML(data: CertificateData): string {
  const learner = escapeHtml(data.userName || "Credential holder");
  const assessment = escapeHtml(data.courseTitle || "Skill assessment");
  const credentialId = escapeHtml(data.certificateId || "N/A");
  const level = escapeHtml(data.courseLevel || "Not specified");
  const score = Math.max(0, Math.min(100, Math.round(Number(data.userScore) || 0)));
  const threshold = Math.max(0, Math.min(100, Math.round(Number(data.passingScore) || 0)));
  const coIssuerName = data.coIssuerName ? escapeHtml(data.coIssuerName) : null;
  const coIssuerLogo = safeAssetUrl(data.coIssuerLogoUrl);
  const verificationUrl = data.verificationUrl ? escapeHtml(data.verificationUrl) : "https://octamy.com/verify";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Assessment credential ${credentialId}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #e8e6e0; color: #0f172a; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { display: grid; place-items: center; padding: 28px; }
    .credential { position: relative; width: 1123px; min-height: 794px; overflow: hidden; border-radius: 26px; background: #fbfaf7; box-shadow: 0 30px 90px rgba(15,23,42,.20); }
    .credential:before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 2% 0%, rgba(14,165,233,.18), transparent 30%), radial-gradient(circle at 98% 4%, rgba(139,92,246,.17), transparent 31%), radial-gradient(circle at 55% 105%, rgba(16,185,129,.13), transparent 32%); pointer-events: none; }
    .rail { position: absolute; inset: 0 auto 0 0; width: 12px; background: linear-gradient(180deg,#0ea5e9,#7c3aed 48%,#10b981); }
    .content { position: relative; min-height: 794px; padding: 54px 64px 48px 76px; display: flex; flex-direction: column; }
    .brands { display: flex; justify-content: space-between; align-items: flex-start; gap: 36px; }
    .octamy { display: flex; align-items: center; gap: 14px; }
    .mark { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 15px; background: #0f172a; color: white; font-size: 24px; font-weight: 900; }
    .wordmark { font-size: 20px; font-weight: 900; letter-spacing: .08em; }
    .company { margin-top: 3px; color: #64748b; font-size: 11px; }
    .coissuer { min-height: 50px; max-width: 340px; display: flex; align-items: center; justify-content: flex-end; gap: 13px; text-align: right; }
    .coissuer img { max-width: 116px; max-height: 48px; object-fit: contain; }
    .coissuer-label { color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .coissuer-name { margin-top: 4px; font-size: 14px; font-weight: 800; }
    .hero { margin-top: 68px; max-width: 880px; }
    .eyebrow { color: #6d28d9; font-size: 12px; font-weight: 900; letter-spacing: .22em; text-transform: uppercase; }
    h1 { margin: 16px 0 0; font-size: 54px; line-height: 1.02; letter-spacing: -.045em; }
    .statement { margin: 22px 0 0; max-width: 800px; color: #475569; font-size: 18px; line-height: 1.65; }
    .assessment { color: #0f172a; font-weight: 800; }
    .metrics { margin-top: 42px; display: grid; grid-template-columns: 1fr 1fr 1fr 1.45fr; gap: 12px; }
    .metric { min-height: 94px; padding: 17px 18px; border: 1px solid #dbe1e8; border-radius: 17px; background: rgba(255,255,255,.70); }
    .metric-label { color: #64748b; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .metric-value { margin-top: 9px; font-size: 22px; font-weight: 900; }
    .metric-value.active { color: #047857; }
    .footer { margin-top: auto; padding-top: 33px; border-top: 1px solid #dbe1e8; display: grid; grid-template-columns: 1.25fr 1fr; gap: 38px; align-items: end; }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; color: #64748b; font-size: 11px; line-height: 1.5; }
    .facts strong { color: #334155; }
    .verify { padding: 16px 18px; border-radius: 16px; background: #0f172a; color: white; }
    .verify-title { font-size: 12px; font-weight: 900; }
    .verify-url { margin-top: 5px; overflow-wrap: anywhere; color: #cbd5e1; font-size: 10px; }
    .boundary { margin-top: 9px; color: #94a3b8; font-size: 9px; line-height: 1.45; }
    @media (max-width: 900px) { body { padding: 0; display: block; overflow-x: auto; } .credential { border-radius: 0; transform-origin: top left; } }
    @media print { @page { size: A4 landscape; margin: 0; } html, body { width: 297mm; height: 210mm; background: white; padding: 0; } .credential { width: 297mm; min-height: 210mm; border-radius: 0; box-shadow: none; } .content { min-height: 210mm; } }
  </style>
</head>
<body>
  <article class="credential" aria-label="Octamy skill assessment credential">
    <div class="rail"></div>
    <div class="content">
      <header class="brands">
        <div class="octamy">
          <div class="mark">O</div>
          <div><div class="wordmark">OCTAMY</div><div class="company">Octamy Solutions Private Limited</div></div>
        </div>
        <div class="coissuer">
          ${coIssuerLogo ? `<img src="${coIssuerLogo}" alt="${coIssuerName || "Institute"} logo" />` : ""}
          <div>
            <div class="coissuer-label">${coIssuerName ? "Co-issued with" : "Digital assessment record"}</div>
            <div class="coissuer-name">${coIssuerName || "Live status verification"}</div>
          </div>
        </div>
      </header>

      <section class="hero">
        <div class="eyebrow">Skill assessment credential</div>
        <h1>${learner}</h1>
        <p class="statement">met the published passing threshold for <span class="assessment">${assessment}</span> in a scored online assessment recorded by Octamy.</p>
      </section>

      <section class="metrics" aria-label="Credential evidence">
        <div class="metric"><div class="metric-label">Assessment score</div><div class="metric-value">${score}%</div></div>
        <div class="metric"><div class="metric-label">Passing threshold</div><div class="metric-value">${threshold}%</div></div>
        <div class="metric"><div class="metric-label">Level</div><div class="metric-value">${level}</div></div>
        <div class="metric"><div class="metric-label">Status at generation</div><div class="metric-value active">Active</div></div>
      </section>

      <footer class="footer">
        <div class="facts">
          <div><strong>Credential ID</strong><br />${credentialId}</div>
          <div><strong>Assessment completed</strong><br />${formatDate(data.completionDate)}</div>
          <div><strong>Activated</strong><br />${formatDate(data.issueDate)}</div>
          <div><strong>Expires</strong><br />${formatDate(data.expiryDate)}</div>
        </div>
        <div class="verify">
          <div class="verify-title">Verify the current status</div>
          <div class="verify-url">${verificationUrl}</div>
          <div class="boundary">This credential records assessment performance. It does not by itself prove identity, accreditation, employment, work experience, or future job performance.</div>
        </div>
      </footer>
    </div>
  </article>
</body>
</html>`;
}

export async function generateCertificatePDF(data: CertificateData): Promise<Buffer> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  const browser = await puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(generateCertificateHTML(data), { waitUntil: "networkidle0", timeout: 30_000 });
    return Buffer.from(await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    }));
  } finally {
    await browser.close();
  }
}
