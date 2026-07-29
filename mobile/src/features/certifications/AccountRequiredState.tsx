import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { Badge, Banner, Button, Card, Heading, Input, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { asApiError } from '@/lib/api-client';
import { spacing } from '@/theme';

type AccountMode = 'register' | 'signIn' | null;

interface AccountRequiredStateProps {
  interrupted?: boolean;
  onAuthenticated: () => void;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AccountRequiredState({ interrupted = false, onAuthenticated }: AccountRequiredStateProps) {
  const { register, signIn } = useSession();
  const [mode, setMode] = useState<AccountMode>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const chooseMode = (nextMode: Exclude<AccountMode, null>) => {
    setError(null);
    setMode(nextMode);
  };

  const submit = async () => {
    if (!mode || submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    let validationError: string | null = null;
    if (mode === 'register' && name.trim().length < 2) validationError = 'Enter your full name.';
    else if (!emailPattern.test(normalizedEmail)) validationError = 'Enter a valid email address.';
    else if (mode === 'register' && password.length < 8) validationError = 'Use at least 8 characters for your password.';
    else if (!password) validationError = 'Enter your password.';

    if (validationError) {
      setError(validationError);
      void AccessibilityInfo.announceForAccessibility(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'register') {
        await register({ email: normalizedEmail, name: name.trim(), password });
      } else {
        await signIn({ email: normalizedEmail, password });
      }
      onAuthenticated();
    } catch (cause) {
      const message = asApiError(cause).status === 401
        ? 'The email or password is incorrect.'
        : asApiError(cause).message;
      setError(message);
      void AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Badge label={interrupted ? 'Attempt safely paused' : 'Free attempt'} tone="accent" />
      <Heading>{interrupted ? 'Sign in to continue your saved attempt' : 'Create an account or sign in before you start'}</Heading>
      <Text>This exam attempt is free. An account saves your attempt and enables credential activation when your result is eligible.</Text>
      {interrupted ? (
        <Banner
          message="Your questions, answers, flags, and app-exit evidence remain saved on this device. Sign in with the account that started the attempt, then retry without beginning again."
          title="Your work is still here"
          tone="warning"
        />
      ) : (
        <Banner
          message="Authentication returns you to this same assessment, ready to review consent and start. There is no exam-attempt charge."
          title="You will come right back"
        />
      )}

      {mode ? (
        <Card>
          <Heading level={2}>{mode === 'register' ? 'Create your learner account' : 'Sign in to Octamy'}</Heading>
          {error ? <Banner message={error} title="Account problem" tone="error" /> : null}
          {mode === 'register' ? (
            <Input autoComplete="name" label="Full name" onChangeText={setName} textContentType="name" value={name} />
          ) : null}
          <Input
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            textContentType="emailAddress"
            value={email}
          />
          <Input
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            label="Password"
            onChangeText={setPassword}
            onSubmitEditing={() => void submit()}
            secureTextEntry
            textContentType={mode === 'register' ? 'newPassword' : 'password'}
            value={password}
          />
          <Button
            label={submitting ? (mode === 'register' ? 'Creating account…' : 'Signing in…') : (mode === 'register' ? 'Create account and continue' : 'Sign in and continue')}
            loading={submitting}
            onPress={() => void submit()}
          />
          <Button label="Back to account options" onPress={() => setMode(null)} variant="ghost" />
        </Card>
      ) : (
        <View style={styles.actions}>
          <Button label="Create account" onPress={() => chooseMode('register')} />
          <Button label="Sign in" onPress={() => chooseMode('signIn')} variant="secondary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  container: { gap: spacing.lg },
});
