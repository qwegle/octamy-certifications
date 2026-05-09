import { useState } from 'react';
import { Link } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/seo';
import { apiRequest } from '@/lib/queryClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await apiRequest('POST', '/api/auth/forgot-password', { email });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to send reset email');
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO title="Forgot password" description="Reset your Octamy password." path="/forgot-password" />
      <Header />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-slate-900">Forgot password?</h1>
            <p className="mt-2 text-sm text-slate-600">We'll send a reset link to your email.</p>
          </div>
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              {sent ? (
                <p className="text-sm text-slate-700">
                  If an account exists for <span className="font-medium">{email}</span>, you'll receive an email shortly with reset instructions.
                </p>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <Label className="text-slate-700">Email</Label>
                    <Input className="mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button type="submit" disabled={submitting} className="w-full bg-slate-900 hover:bg-black text-white">{submitting ? 'Sending…' : 'Send reset link'}</Button>
                </form>
              )}
            </CardContent>
          </Card>
          <p className="text-center text-sm text-slate-600">
            <Link href="/login"><a className="text-slate-900 font-medium hover:underline">Back to sign in</a></Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
