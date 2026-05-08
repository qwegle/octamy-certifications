import { useState } from "react";
import { Link } from "wouter";
import { useSellerAuth } from "@/lib/sellerAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { useSellerGoogleAuthHandler } from "@/utils/google-auth-handler";
import {
  Eye,
  EyeOff,
  TrendingUp,
  Wallet,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
  CheckCircle2,
  IndianRupee,
} from "lucide-react";
import { SEO } from "@/components/seo";

export default function SellerAuth() {
  const [isLogin, setIsLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);

  const { login, register } = useSellerAuth();
  const { toast } = useToast();

  useSellerGoogleAuthHandler();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && !acceptedAgreement) {
      toast({
        title: "Please accept the agreement",
        description: "Tick the Reseller / Affiliate Agreement to create an account.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast({ title: "Welcome back!", description: "Signed in successfully." });
      } else {
        await register(
          formData.email,
          formData.password,
          formData.name,
          formData.phone,
          acceptedAgreement
        );
        toast({
          title: "You're in 🎉",
          description: "Account created. Our team will approve you within 24h.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Something went wrong",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Become an Octamy Partner — Earn ₹ for every certificate sold"
        description="Join the Octamy Partner Program. Share your referral code, earn 10% commission on every certification sold, get paid weekly to UPI or bank. No targets, no inventory, no upfront cost."
        path="/partners"
      />

      {/* Top bar — minimal, just brand and home link */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">OCTAMY</span>
            <span className="hidden sm:inline-block text-xs uppercase tracking-widest text-slate-500 border-l border-slate-300 pl-3 ml-1">
              Partner Program
            </span>
          </Link>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← Back to site
          </Link>
        </div>
      </header>

      {/* Hero + form: 2-column on desktop */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-16 grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
        {/* LEFT: pitch */}
        <section className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Now accepting partners — Q2 2026 cohort
          </div>

          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.05] tracking-tight">
            Earn <span className="text-sky-700">10% commission</span><br className="hidden sm:block" />
            on every certificate you refer.
          </h1>

          <p className="mt-5 text-lg text-slate-600 max-w-xl leading-relaxed">
            Octamy is an Indian skill-verification & certification platform. Share your unique referral
            link with students, freshers and working pros — when they earn a verified certificate,
            you earn a recurring commission. Paid weekly to UPI or bank.
          </p>

          {/* Headline numbers */}
          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-6 max-w-xl">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-2xl sm:text-3xl font-bold text-slate-900">10%</div>
              <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Commission rate</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-2xl sm:text-3xl font-bold text-slate-900">₹500</div>
              <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Min payout</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-2xl sm:text-3xl font-bold text-slate-900">7 days</div>
              <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Payout cycle</div>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-5">
              How it works
            </h2>
            <ol className="space-y-5">
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    Sign up free <Share2 className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    Get an instant referral code & share-ready dashboard. No upfront cost, no targets.
                  </div>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    Share your link <TrendingUp className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    WhatsApp, college groups, LinkedIn, YouTube descriptions, Insta bio — share where your audience already is.
                  </div>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    Get paid <IndianRupee className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    10% on every certificate purchased through your link. Withdraw to UPI or bank weekly once you cross ₹500.
                  </div>
                </div>
              </li>
            </ol>
          </div>

          {/* Earnings calculator */}
          <EarningsCalculator />

          {/* Why partners pick Octamy */}
          <div className="mt-10 grid sm:grid-cols-2 gap-3">
            {[
              { icon: ShieldCheck, label: "Indian company, GST-registered, TDS §194H compliant" },
              { icon: Wallet, label: "Direct UPI / bank withdrawal, no third-party wallet" },
              { icon: Trophy, label: "Real-time dashboard with conversion analytics" },
              { icon: CheckCircle2, label: "Free assessments — easy to convince your audience" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-200"
              >
                <Icon className="w-5 h-5 text-sky-700 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT: auth card — sticky on desktop */}
        <section className="lg:col-span-5 lg:sticky lg:top-8">
          <Card className="border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
            {/* Tabs */}
            <div className="grid grid-cols-2 text-sm font-medium border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`py-4 transition-colors ${
                  !isLogin
                    ? "bg-white text-slate-900 border-b-2 border-sky-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Become a Partner
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`py-4 transition-colors ${
                  isLogin
                    ? "bg-white text-slate-900 border-b-2 border-sky-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Partner Sign In
              </button>
            </div>

            <CardContent className="p-6 sm:p-8">
              {!isLogin && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Create your free partner account</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Approval typically within 24 hours. No credit card required.
                  </p>
                </div>
              )}
              {isLogin && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Welcome back</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Sign in to your partner dashboard.
                  </p>
                </div>
              )}

              {/* Google first — higher conversion */}
              <GoogleAuthButton type="seller" isLoading={isLoading} />

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wider">
                  <span className="bg-white px-3 text-slate-400">or with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                        Full name
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="h-11"
                        placeholder="Riya Sharma"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
                        WhatsApp number <span className="text-slate-400 font-normal">(optional)</span>
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="h-11"
                        placeholder="+91 9XXXXXXXXX"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="h-11"
                    placeholder="you@email.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      value={formData.password}
                      onChange={handleInputChange}
                      className="h-11 pr-12"
                      placeholder={isLogin ? "Your password" : "At least 8 characters"}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {!isLogin && (
                  <label className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={acceptedAgreement}
                      onChange={(e) => setAcceptedAgreement(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
                      aria-label="Accept reseller agreement"
                    />
                    <span>
                      I agree to the{" "}
                      <a href="/reseller-agreement" target="_blank" rel="noopener noreferrer" className="text-sky-700 underline font-medium">
                        Reseller Agreement
                      </a>
                      ,{" "}
                      <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">
                        Terms
                      </a>{" "}
                      &amp;{" "}
                      <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">
                        Privacy Policy
                      </a>
                      . I am an independent marketing affiliate; payouts subject to KYC, TDS §194H and a ₹500 minimum threshold.
                    </span>
                  </label>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || (!isLogin && !acceptedAgreement)}
                  className="w-full h-12 text-base font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                >
                  {isLoading
                    ? "Please wait…"
                    : isLogin
                    ? "Sign in"
                    : "Create partner account"}
                </Button>

                <p className="text-center text-xs text-slate-500 pt-2">
                  {isLogin ? (
                    <>
                      New to Octamy?{" "}
                      <button type="button" onClick={() => setIsLogin(false)} className="text-sky-700 font-medium hover:underline">
                        Become a partner
                      </button>
                    </>
                  ) : (
                    <>
                      Already a partner?{" "}
                      <button type="button" onClick={() => setIsLogin(true)} className="text-sky-700 font-medium hover:underline">
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </form>
            </CardContent>
          </Card>

          <p className="mt-4 text-xs text-slate-500 text-center">
            🔒 Your data is protected. We never share your contact details.
          </p>
        </section>
      </main>

      {/* FAQ band */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8">Common questions</h2>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
            {[
              {
                q: "Is there any joining fee?",
                a: "No. The Octamy Partner Program is completely free to join. We only make money when you do.",
              },
              {
                q: "How and when do I get paid?",
                a: "Earnings are credited within 24h of a successful certificate purchase. Withdraw to UPI or bank account once you cross ₹500. Payouts run weekly.",
              },
              {
                q: "Do I need a GST number?",
                a: "No. You can register and earn as an individual. We deduct TDS §194H per Indian tax law and provide a Form-26AS reflecting credit.",
              },
              {
                q: "Who is this for?",
                a: "Career mentors, edtech YouTubers, college placement coordinators, LinkedIn creators, study-abroad consultants, freelance trainers, and anyone with an audience that cares about skill verification.",
              },
              {
                q: "Can I share by WhatsApp?",
                a: "Yes — your referral works on WhatsApp, Instagram, LinkedIn, Telegram, YouTube, your website, anywhere.",
              },
              {
                q: "What does the candidate pay?",
                a: "Octamy assessments are free. Candidates pay only if they pass and choose to claim the verified certificate. Pricing is transparent and shown upfront.",
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-semibold text-slate-900">{q}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance footer strip */}
      <footer className="bg-slate-900 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Octamy Solutions Private Limited. The Partner Program is an independent marketing-affiliate arrangement, not employment.</p>
          <div className="flex gap-4">
            <Link href="/reseller-agreement" className="hover:text-white">Agreement</Link>
            <Link href="/privacy-policy" className="hover:text-white">Privacy</Link>
            <Link href="/help-center" className="hover:text-white">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function EarningsCalculator() {
  const [referrals, setReferrals] = useState(20);
  const avgPrice = 999;
  const commissionRate = 0.1;
  const monthly = Math.round(referrals * avgPrice * commissionRate);
  const yearly = monthly * 12;

  return (
    <div className="mt-10 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900">Estimate your monthly earnings</h3>
        <Sparkles className="w-5 h-5 text-sky-600" />
      </div>
      <label htmlFor="ref-slider" className="text-sm text-slate-600 block mb-2">
        I can refer roughly <span className="font-bold text-slate-900">{referrals}</span> certificates per month
      </label>
      <input
        id="ref-slider"
        type="range"
        min={1}
        max={500}
        step={1}
        value={referrals}
        onChange={(e) => setReferrals(parseInt(e.target.value, 10))}
        className="w-full accent-sky-700"
      />
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-lg bg-white border border-slate-200 p-4">
          <div className="text-xs uppercase tracking-wider text-slate-500">You earn / month</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            ₹{monthly.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 text-white p-4">
          <div className="text-xs uppercase tracking-wider text-slate-300">You earn / year</div>
          <div className="mt-1 text-2xl font-bold">
            ₹{yearly.toLocaleString("en-IN")}
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-3">
        Estimate at avg certificate price ₹999 × 10% commission. Actual price varies by program.
      </p>
    </div>
  );
}
