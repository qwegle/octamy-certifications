import { type Href, Link } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AuthShell, Banner, Button, Input, Text } from '@/components/ui';
import { requestPasswordReset } from '@/features/auth';
import { asApiError } from '@/lib/api-client';
import { spacing } from '@/theme';

const loginHref: Href = '/(auth)/login';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    if (!emailPattern.test(email.trim())) {
      setEmailError('Enter a valid email address.');
      void AccessibilityInfo.announceForAccessibility('Enter a valid email address.');
      return;
    }
    setEmailError(undefined);
    setFormError(undefined);
    setSubmitting(true);
    try {
      const neutralMessage = await requestPasswordReset(email);
      setMessage(neutralMessage);
      void AccessibilityInfo.announceForAccessibility(neutralMessage);
    } catch (error) {
      const nextMessage = asApiError(error).message;
      setFormError(nextMessage);
      void AccessibilityInfo.announceForAccessibility(nextMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <AuthShell
        description="Enter your account email. If eligible, Octamy sends a secure reset link to the verified address."
        eyebrow="ACCOUNT RECOVERY"
        footer={(
          <View style={styles.footer}>
            <Text muted>Remembered your password?</Text>
            <Link asChild href={loginHref}><Button label="Back to secure sign in" variant="secondary" /></Link>
          </View>
        )}
        title="Recover access with confidence">
        {message ? <Banner message={message} title="Check your email" tone="success" /> : null}
        {formError ? <Banner message={formError} title="Request problem" tone="error" /> : null}
        <Input autoCapitalize="none" autoComplete="email" error={emailError} keyboardType="email-address" label="Account email" onChangeText={setEmail} onSubmitEditing={() => void submit()} returnKeyType="send" textContentType="emailAddress" value={email} />
        <Button label={submitting ? 'Sending secure link…' : 'Email reset link'} loading={submitting} onPress={() => void submit()} />
        <Text muted variant="small">The reset page opens on Octamy’s website. The app never reads or stores your reset token.</Text>
      </AuthShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { gap: spacing.sm },
});
