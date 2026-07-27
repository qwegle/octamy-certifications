import { type Href, Link } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AuthShell, Banner, Button, Input, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { asApiError } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { spacing } from '@/theme';

const loginHref: Href = '/(auth)/login';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterErrors {
  confirmPassword?: string;
  email?: string;
  name?: string;
  password?: string;
}

export default function RegisterScreen() {
  const { register } = useSession();
  const { showToast } = useFeedback();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const nextErrors: RegisterErrors = {};
    if (name.trim().length < 2) nextErrors.name = 'Enter your full name.';
    if (!emailPattern.test(email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (password.length < 8) nextErrors.password = 'Use at least 8 characters. The server may require a stronger password.';
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) {
      void AccessibilityInfo.announceForAccessibility('Review the highlighted account fields.');
      return;
    }

    setSubmitting(true);
    try {
      await register({ email, name, password, ...(phone.trim() ? { phone } : {}) });
      showToast({ message: 'Your account and secure session are ready.', title: 'Account created', tone: 'success' });
    } catch (error) {
      const apiError = asApiError(error);
      const message = apiError.status === 429
        ? 'Account creation is temporarily unavailable. Please wait and try again.'
        : apiError.message;
      setFormError(message);
      void AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <AuthShell
        description="Create a learner identity for certification results, credentials, and consent-controlled career evidence."
        eyebrow="LEARNER ONBOARDING"
        footer={(
          <View style={styles.footer}>
            <Text muted>Already have an Octamy account?</Text>
            <Link asChild href={loginHref}><Button label="Return to sign in" variant="secondary" /></Link>
          </View>
        )}
        title="Build evidence that speaks for your skills">
        {formError ? <Banner message={formError} title="Account problem" tone="error" /> : null}
        <Input autoComplete="name" error={errors.name} label="Full name" onChangeText={setName} textContentType="name" value={name} />
        <Input autoCapitalize="none" autoComplete="email" error={errors.email} keyboardType="email-address" label="Email" onChangeText={setEmail} textContentType="emailAddress" value={email} />
        <Input autoComplete="tel" hint="Optional" keyboardType="phone-pad" label="Phone" onChangeText={setPhone} textContentType="telephoneNumber" value={phone} />
        <Input autoComplete="new-password" error={errors.password} hint="Use at least 8 characters. Octamy also applies its server password policy." label="Create password" onChangeText={setPassword} secureTextEntry textContentType="newPassword" value={password} />
        <Input autoComplete="new-password" error={errors.confirmPassword} label="Confirm password" onChangeText={setConfirmPassword} onSubmitEditing={() => void submit()} returnKeyType="done" secureTextEntry textContentType="newPassword" value={confirmPassword} />
        <Button label={submitting ? 'Creating secure account…' : 'Create learner account'} loading={submitting} onPress={() => void submit()} />
        <Text muted variant="small">By creating an account, you can keep recruiter discovery and public evidence sharing off until you explicitly choose otherwise.</Text>
      </AuthShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: spacing.sm },
});
