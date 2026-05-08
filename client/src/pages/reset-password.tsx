import { useState } from 'react';
import { Link, useRoute } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/seo';

export default function ResetPassword() {
  const [, params] = useRoute('/reset-password/:token');
  const token = params?.token || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'At least 6 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    // TODO: wire up real reset endpoint. Token: {token}
    void token;
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO title="Reset password" description="Set a new Octamy password." path="/reset-password" noIndex />
      <Header />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-slate-900">Set a new password</h1>
          </div>
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              {done ? (
                <p className="text-sm text-slate-700">
                  Password updated. <Link href="/login"><a className="text-slate-900 font-medium hover:underline">Sign in</a></Link>.
                </p>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <Label className="text-slate-700">New password</Label>
                    <Input className="mt-1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-slate-700">Confirm password</Label>
                    <Input className="mt-1" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full bg-slate-900 hover:bg-black text-white">Update password</Button>
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
