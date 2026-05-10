import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/seo';
import { apiRequest } from '@/lib/queryClient';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Token comes from email link as ?token=... — works for /reset-password and /reset-password/:token.
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('token') || '';
    const fromPath = window.location.pathname.match(/\/reset-password\/(.+)$/)?.[1] || '';
    setToken(fromQuery || fromPath);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast({ title: 'Missing token', description: 'Open the link from your email.', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Password too short', description: 'At least 8 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiRequest('POST', '/api/auth/reset-password', { token, password });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'Failed to reset password');
      setDone(true);
      toast({ title: 'Password updated', description: 'You can now sign in.' });
      setTimeout(() => setLocation('/login'), 1500);
    } catch (err: any) {
      toast({ title: 'Reset failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-soft flex flex-col">
      <SEO title="Reset password" description="Set a new Octamy password." path="/reset-password" noIndex />
      <Header />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-slate-900">Set a new password</h1>
            {!token && <p className="mt-2 text-sm text-red-600">No reset token in URL. Use the link from your email.</p>}
          </div>
          <Card className="border-cream-deep">
            <CardContent className="pt-6">
              {done ? (
                <p className="text-sm text-slate-700">
                  Password updated. <Link href="/login"><a className="text-slate-900 font-medium hover:underline">Sign in</a></Link>.
                </p>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <Label className="text-slate-700">New password</Label>
                    <Input className="mt-1" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-slate-700">Confirm password</Label>
                    <Input className="mt-1" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={submitting || !token} className="w-full bg-slate-900 hover:bg-black text-white">{submitting ? 'Updating…' : 'Update password'}</Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
