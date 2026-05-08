import { Link } from "wouter";
import {
  ShieldCheck,
  Lock,
  BadgeCheck,
  CreditCard,
  FileCheck,
  Mail,
  Phone,
  Linkedin,
  Twitter,
  Instagram,
  Youtube,
  ArrowRight,
} from "lucide-react";
import octamyLogoLight from "@/assets/image_1750054465427.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const COMPANY_NAME = "Octamy Solutions Private Limited";
const SUPPORT_EMAIL =
  import.meta.env.VITE_COMPANY_SUPPORT_EMAIL || "support@octamy.com";
const GRIEVANCE_EMAIL =
  import.meta.env.VITE_COMPANY_GRIEVANCE_EMAIL || "grievance@octamy.com";
const LEGAL_EMAIL =
  import.meta.env.VITE_COMPANY_LEGAL_EMAIL || "legal@octamy.com";
const SUPPORT_PHONE = import.meta.env.VITE_COMPANY_SUPPORT_PHONE || "";
const COMPANY_CIN = import.meta.env.VITE_COMPANY_CIN || "";
const COMPANY_GSTIN = import.meta.env.VITE_COMPANY_GSTIN || "";
const COMPANY_ADDRESS = import.meta.env.VITE_COMPANY_ADDRESS || "";
const ISO_NUMBER = import.meta.env.VITE_COMPANY_ISO_NUMBER || "";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const year = new Date().getFullYear();

  const onSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast({
        title: "Enter a valid email",
        description: "We'll only send useful updates — never spam.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      // Best-effort: hits /api/contact-submission if present, otherwise gracefully no-ops.
      await fetch("/api/contact-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Newsletter signup",
          email,
          subject: "Newsletter subscription",
          message: `Subscribe to Octamy newsletter — ${email}`,
        }),
      }).catch(() => null);
      toast({
        title: "You're in.",
        description: "We'll keep you posted on new assessments and partner news.",
      });
      setEmail("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-slate-950 text-slate-300">
      {/* Trust strip */}
      <div className="border-b border-white/10 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 items-stretch">
            <TrustBadge
              icon={<BadgeCheck className="h-5 w-5" />}
              label="ISO 9001:2015"
              sub="Certified Operations"
            />
            <TrustBadge
              icon={<CreditCard className="h-5 w-5" />}
              label="PayU Secure"
              sub="Encrypted Payments"
            />
            <TrustBadge
              icon={<ShieldCheck className="h-5 w-5" />}
              label="GST Registered"
              sub="Compliant Invoicing"
            />
            <TrustBadge
              icon={<Lock className="h-5 w-5" />}
              label="256-bit SSL"
              sub="HTTPS Everywhere"
            />
            <TrustBadge
              icon={<FileCheck className="h-5 w-5" />}
              label="DPDP Aligned"
              sub="Indian Data Law"
            />
            <TrustBadge
              icon={<BadgeCheck className="h-5 w-5" />}
              label="MSME Registered"
              sub="Govt. of India"
            />
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand + newsletter */}
          <div className="md:col-span-5">
            <Link href="/" aria-label="Octamy home">
              <img src={octamyLogoLight} alt="Octamy" className="h-9" />
            </Link>
            <p className="mt-5 text-slate-400 max-w-md leading-relaxed">
              India's assessment-first skill verification platform. Take certifications
              for free — pay only when you pass. Trusted by candidates, recruiters and
              partners across India.
            </p>

            <form onSubmit={onSubscribe} className="mt-7">
              <label htmlFor="footer-newsletter" className="text-sm font-semibold text-white">
                Get product updates
              </label>
              <p className="text-xs text-slate-400 mt-1">
                New assessments, partner programs and platform updates. No spam.
              </p>
              <div className="mt-3 flex gap-2 max-w-md">
                <Input
                  id="footer-newsletter"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Your email address"
                  className="bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus-visible:ring-sky-500"
                />
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-sky-600 hover:bg-sky-500 text-white shrink-0"
                >
                  {submitting ? "Sending…" : (
                    <>
                      Subscribe <ArrowRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-7 flex items-center gap-4">
              <SocialLink
                href="https://linkedin.com/company/octamy"
                label="Octamy on LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </SocialLink>
              <SocialLink
                href="https://twitter.com/octamy"
                label="Octamy on Twitter / X"
              >
                <Twitter className="h-5 w-5" />
              </SocialLink>
              <SocialLink
                href="https://instagram.com/octamy"
                label="Octamy on Instagram"
              >
                <Instagram className="h-5 w-5" />
              </SocialLink>
              <SocialLink
                href="https://youtube.com/@octamy"
                label="Octamy on YouTube"
              >
                <Youtube className="h-5 w-5" />
              </SocialLink>
            </div>
          </div>

          {/* Platform */}
          <FooterColumn title="Platform" className="md:col-span-2">
            <ul className="space-y-2.5">
              <FooterLink to="/courses">Skill Assessments</FooterLink>
              <FooterLink to="/virtual-internships">Virtual Internships</FooterLink>
              <FooterLink to="/business-certifications">Business Certifications</FooterLink>
              <FooterLink to="/learning-paths">Learning Paths</FooterLink>
              <FooterLink to="/verify">Verify Certificate</FooterLink>
            </ul>
          </FooterColumn>

          {/* Company */}
          <FooterColumn title="Company" className="md:col-span-2">
            <ul className="space-y-2.5">
              <FooterLink to="/about">About Us</FooterLink>
              <FooterLink to="/partners">Partner Program</FooterLink>
              <FooterLink to="/sponsor">Sponsor a Talent</FooterLink>
              <FooterLink to="/contact">Contact</FooterLink>
              <FooterLink to="/help-center">Help Center</FooterLink>
            </ul>
          </FooterColumn>

          {/* Legal */}
          <FooterColumn title="Legal & Trust" className="md:col-span-3">
            <div className="grid grid-cols-2 gap-x-4">
              <ul className="space-y-2.5">
                <FooterLink to="/trust">Trust & Compliance</FooterLink>
                <FooterLink to="/privacy-policy">Privacy Policy</FooterLink>
                <FooterLink to="/terms-of-service">Terms of Service</FooterLink>
                <FooterLink to="/refund-policy">Refund Policy</FooterLink>
                <FooterLink to="/cookie-policy">Cookie Policy</FooterLink>
              </ul>
              <ul className="space-y-2.5">
                <FooterLink to="/disclaimer">Disclaimer</FooterLink>
                <FooterLink to="/acceptable-use">Acceptable Use</FooterLink>
                <FooterLink to="/reseller-agreement">Reseller Agreement</FooterLink>
                <FooterLink to="/accessibility">Accessibility</FooterLink>
                <li>
                  <a
                    href={`mailto:${GRIEVANCE_EMAIL}`}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    Grievance Officer
                  </a>
                </li>
              </ul>
            </div>

            <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Mail className="h-4 w-4" /> Contact us
              </div>
              <ul className="mt-2 space-y-1.5 text-slate-400">
                <li>
                  Support:&nbsp;
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-sky-400 hover:text-sky-300"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </li>
                <li>
                  Legal:&nbsp;
                  <a
                    href={`mailto:${LEGAL_EMAIL}`}
                    className="text-sky-400 hover:text-sky-300"
                  >
                    {LEGAL_EMAIL}
                  </a>
                </li>
                {SUPPORT_PHONE && (
                  <li className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {SUPPORT_PHONE}
                  </li>
                )}
              </ul>
            </div>
          </FooterColumn>
        </div>
      </div>

      {/* Compliance + bottom bar */}
      <div className="border-t border-white/10 bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs text-slate-400">
            <div className="lg:col-span-7 space-y-1.5">
              <p className="font-semibold text-slate-200 text-sm">{COMPANY_NAME}</p>
              <p>
                {COMPANY_CIN ? `CIN: ${COMPANY_CIN}` : "CIN: Available on request"}
                {" · "}
                {COMPANY_GSTIN ? `GSTIN: ${COMPANY_GSTIN}` : "GSTIN: Available on request"}
                {ISO_NUMBER ? ` · ISO 9001:2015 Cert No. ${ISO_NUMBER}` : " · ISO 9001:2015 — Cert. on request"}
              </p>
              <p>{COMPANY_ADDRESS || "Registered office details available on request."}</p>
              <p className="italic max-w-3xl pt-1">
                Skill-Verification Internship Programs on this platform are assessment
                and skill-certification initiatives only and do not constitute
                employment, payroll engagement, or any guarantee of placement.
              </p>
            </div>
            <div className="lg:col-span-5 lg:text-right space-y-1.5">
              <p className="text-slate-200">
                Payments processed securely via PayU. Refunds per{" "}
                <Link href="/refund-policy" className="text-sky-400 hover:text-sky-300 underline">
                  refund policy
                </Link>
                .
              </p>
              <p>Disputes are subject to the exclusive jurisdiction of Indian courts.</p>
              <p className="pt-2 text-slate-500">
                © {year} {COMPANY_NAME}. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function TrustBadge({
  icon,
  label,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="text-sky-400 shrink-0">{icon}</div>
      <div className="leading-tight">
        <div className="text-xs font-semibold text-white">{label}</div>
        <div className="text-[11px] text-slate-400">{sub}</div>
      </div>
    </div>
  );
}

function FooterColumn({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h4 className="text-sm font-semibold text-white tracking-wide uppercase">
        {title}
      </h4>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={to}
        className="text-slate-400 hover:text-white transition-colors text-sm"
      >
        {children}
      </Link>
    </li>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-white/15 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/25 transition-colors"
    >
      {children}
    </a>
  );
}
