import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, BrandLockup, Button, Card, Heading, Screen, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { useFeedback } from '@/lib/feedback';
import { radii, spacing, useAppTheme } from '@/theme';

const certificationsHref = '/(tabs)/certifications' as Href;
const practiceHref = '/(tabs)/practice' as Href;
const interviewHref = '/(tabs)/interview' as Href;

const journey = [
  ['01', 'LEARN'],
  ['02', 'VALIDATE'],
  ['03', 'CERTIFY'],
] as const;

export default function HomeScreen() {
  const { signOut, status, user } = useSession();
  const { showToast } = useFeedback();
  const { colors } = useAppTheme();
  const [signingOut, setSigningOut] = useState(false);

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      showToast({ message: 'Local sign-out completed, but some device cleanup may need another attempt.', title: 'Signed out locally', tone: 'warning' });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen>
      <View style={styles.topbar}>
        <BrandLockup compact />
        <View style={styles.accountCopy}>
          <Text muted variant="caption">LEARNER WORKSPACE</Text>
          <Text variant="bodyStrong">{user?.name ?? 'Learner'}</Text>
        </View>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={styles.heroCopy}>
          <Text style={{ color: colors.onPrimary }} variant="caption">SKILL EVIDENCE PASSPORT</Text>
          <Text style={[styles.heroTitle, { color: colors.onPrimary }]} variant="display">Turn capability into credible proof.</Text>
          <Text style={{ color: colors.onPrimary, opacity: 0.76 }}>
            Build assessment-backed career evidence and decide exactly when recruiters can discover it.
          </Text>
        </View>
        <View style={[styles.journey, { borderColor: colors.onPrimary }]}>
          {journey.map(([number, label]) => (
            <View key={number} style={styles.journeyItem}>
              <Text style={{ color: colors.onPrimary, opacity: 0.56 }} variant="caption">{number}</Text>
              <Text style={{ color: colors.onPrimary }} variant="label">{label}</Text>
            </View>
          ))}
        </View>
        <Button label="Explore career certifications" onPress={() => router.push(certificationsHref)} variant="secondary" />
      </View>

      {status === 'authenticatedOffline' ? (
        <Banner message="Your previously validated account is shown read-only. Server changes resume after Octamy reconnects." title="Offline session" tone="warning" />
      ) : null}

      <View style={styles.sectionHeading}>
        <Text variant="caption">YOUR PROFESSIONAL TOOLKIT</Text>
        <Heading level={2}>Choose the next move</Heading>
      </View>

      <View style={styles.grid}>
        <Card style={styles.grow}>
          <Text muted variant="caption">01 / CERTIFICATION</Text>
          <Heading level={3}>Validate a career skill</Heading>
          <Text muted>Browse reviewed assessments and create server-verifiable evidence of capability.</Text>
          <Button label="Browse certifications" onPress={() => router.push(certificationsHref)} variant="secondary" />
        </Card>
        <Card style={styles.grow}>
          <Text muted variant="caption">02 / PRACTICE PASS</Text>
          <Heading level={3}>Prepare without pressure</Heading>
          <Text muted>Build confidence through low-stakes practice kept separate from certification evidence.</Text>
          <Button label="Open practice" onPress={() => router.push(practiceHref)} variant="secondary" />
        </Card>
        <Card style={styles.grow}>
          <Text muted variant="caption">03 / INTERVIEW STUDIO</Text>
          <Heading level={3}>Rehearse in private</Heading>
          <Text muted>Practice structured responses; optional rehearsal video remains only on this device.</Text>
          <Button label="Open interview studio" onPress={() => router.push(interviewHref)} variant="secondary" />
        </Card>
      </View>

      <View style={[styles.trustStrip, { borderColor: colors.border }]}>
        <Text variant="caption">OCTAMY TRUST MODEL</Text>
        <Text muted style={styles.trustCopy}>Private by default · server-verified outcomes · learner-controlled recruiter visibility</Text>
      </View>

      <Card>
        <Text variant="bodyStrong">Signed in as {user?.email}</Text>
        <Text muted variant="small">Sign out removes the local token and Octamy data stored by this app on this device.</Text>
        <Button label={signingOut ? 'Signing out…' : 'Sign out on this device'} loading={signingOut} onPress={() => void logout()} variant="ghost" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCopy: { alignItems: 'flex-end', gap: spacing.xxs },
  grid: { gap: spacing.md },
  grow: { flex: 1 },
  hero: { borderRadius: radii.lg, gap: spacing.xl, padding: spacing['2xl'] },
  heroCopy: { gap: spacing.md, maxWidth: 720 },
  heroTitle: { maxWidth: 720 },
  journey: { borderBottomWidth: 1, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, paddingVertical: spacing.lg },
  journeyItem: { gap: spacing.xs, minWidth: 88 },
  sectionHeading: { gap: spacing.sm },
  topbar: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'space-between' },
  trustCopy: { flex: 1, minWidth: 220 },
  trustStrip: { alignItems: 'center', borderBottomWidth: 1, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, paddingVertical: spacing.lg },
});
