import { useQuery } from '@tanstack/react-query';
import { type Href, Link } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AuthShell, Banner, Button, Input, Text } from '@/components/ui';
import { getGoogleStatus, openGoogleWebsiteHandoff, useSession } from '@/features/auth';
import { asApiError } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { queryKeys } from '@/lib/query-keys';
import { spacing, useAppTheme } from '@/theme';

const registerHref: Href = '/(auth)/register';
const forgotPasswordHref = '/(auth)/forgot-password' as Href;
const verifyCertificateHref = '/certificate/verify' as Href;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginErrors {
  email?: string;
  password?: string;
}

export default function LoginScreen() {
  const { signIn } = useSession();
  const { showToast } = useFeedback();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openingGoogle, setOpeningGoogle] = useState(false);
  const googleStatus = useQuery({
    meta: { silentError: true },
    queryFn: getGoogleStatus,
    queryKey: queryKeys.auth.googleStatus,
    staleTime: 5 * 60_000,
  });

  const submit = async () => {
    if (submitting) return;
    const nextErrors: LoginErrors = {};
    if (!emailPattern.test(email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Enter your password.';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) {
      void AccessibilityInfo.announceForAccessibility('Review the highlighted sign-in fields.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn({ email, password });
      showToast({ message: 'Your secure session is ready.', title: 'Signed in', tone: 'success' });
    } catch (error) {
      const apiError = asApiError(error);
      const message = apiError.status === 401
        ? 'The email or password is incorrect.'
        : apiError.status === 429
          ? 'Sign-in is temporarily unavailable after several attempts. Please wait and try again.'
          : apiError.message;
      setFormError(message);
      void AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setSubmitting(false);
    }
  };

  const continueWithGoogle = async () => {
    if (openingGoogle) return;
    setOpeningGoogle(true);
    try {
      await openGoogleWebsiteHandoff();
      showToast({
        durationMs: 8_000,
        message: 'The website flow cannot create a native app session yet. Return here to use email and password.',
        title: 'Website handoff closed',
        tone: 'info',
      });
    } catch (error) {
      const message = asApiError(error).message;
      setFormError(message);
      void AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setOpeningGoogle(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <AuthShell
        description="Access certifications, private practice, and your portable Skill Evidence Passport."
        eyebrow="SECURE LEARNER ACCESS"
        footer={(
          <View style={styles.footer}>
            <Text muted>New to Octamy?</Text>
            <Link asChild href={registerHref}>
              <Button label="Create a learner account" variant="secondary" />
            </Link>
          </View>
        )}
        title="Continue your professional journey">
        {formError ? <Banner message={formError} title="Sign-in problem" tone="error" /> : null}
        <Input
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email}
          keyboardType="email-address"
          label="Work or personal email"
          onChangeText={setEmail}
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />
        <Input
          autoComplete="current-password"
          error={errors.password}
          label="Password"
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          returnKeyType="done"
          secureTextEntry
          textContentType="password"
          value={password}
        />
        <Button label={submitting ? 'Signing in…' : 'Sign in securely'} loading={submitting} onPress={() => void submit()} />
        <Link asChild href={forgotPasswordHref}>
          <Button label="Forgot password" variant="ghost" />
        </Link>

        {googleStatus.data?.enabled ? (
          <View style={[styles.utility, { borderTopColor: colors.border }]}>
            <Text muted variant="caption">WEBSITE SIGN-IN</Text>
            <Button
              label={openingGoogle ? 'Opening Octamy website…' : 'Continue with Google on the website'}
              loading={openingGoogle}
              onPress={() => void continueWithGoogle()}
              variant="secondary"
            />
            <Text muted variant="small">Google currently completes on Octamy’s website and cannot create a native session.</Text>
          </View>
        ) : null}

        <View style={[styles.utility, { borderTopColor: colors.border }]}>
          <Text muted variant="caption">PUBLIC CREDENTIAL SERVICE</Text>
          <Text muted variant="small">Check an Octamy certificate without signing in.</Text>
          <Link asChild href={verifyCertificateHref}>
            <Button label="Verify a certificate" variant="secondary" />
          </Link>
        </View>
      </AuthShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: spacing.sm },
  utility: { borderTopWidth: 1, gap: spacing.md, paddingTop: spacing.lg },
});
