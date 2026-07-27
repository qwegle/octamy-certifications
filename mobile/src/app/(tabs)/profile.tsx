import { useQuery } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Banner, Button, Card, EmptyState, ErrorState, Heading, PageHeader, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { getEvidenceSummary, getLearnerProfile } from '@/features/profile';
import { getPracticeSubscription, hasActivePracticePass, practicePlanLabel } from '@/features/practice';
import { useFeedback } from '@/lib/feedback';
import { layout, motion, spacing, useAppReducedMotion, useAppTheme } from '@/theme';

const editHref = '/profile/edit' as Href;
import { queryKeys } from '@/lib/query-keys';
const privacyHref = '/settings/privacy' as Href;
const practiceHref = '/(tabs)/practice' as Href;

function ProfileSkeleton() {
  return (
    <View accessibilityLabel="Loading profile" accessibilityRole="progressbar" style={styles.section}>
      <Skeleton height={28} width="68%" />
      <Skeleton height={20} width="82%" />
      <Skeleton height={136} />
      <Skeleton height={180} />
    </View>
  );
}

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const reduceMotion = useAppReducedMotion();
  const { showToast } = useFeedback();
  const { signOut, status } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile.detail,
    queryFn: getLearnerProfile,
  });
  const evidenceQuery = useQuery({
    queryKey: queryKeys.profile.evidence,
    queryFn: getEvidenceSummary,
  });
  const subscriptionQuery = useQuery({
    queryKey: queryKeys.practice.subscription,
    queryFn: ({ signal }) => getPracticeSubscription(signal),
  });

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([profileQuery.refetch(), evidenceQuery.refetch(), subscriptionQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [evidenceQuery.refetch, profileQuery.refetch, subscriptionQuery.refetch]);

  const performSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      showToast({
        title: 'Sign-out incomplete',
        message: 'You are signed out. Some local learner files could not be removed; Octamy will retry cleanup on a later sign-out.',
        tone: 'warning',
      });
    } finally {
      setSigningOut(false);
    }
  }, [showToast, signOut, signingOut]);

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out on this device?',
      'This removes your Octamy token and learner data stored by this app on this device. It does not sign out other devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void performSignOut() },
      ],
    );
  };

  const entering = reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.enter);
  const profile = profileQuery.data;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.foreground} />}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={entering}>
          <PageHeader
            description="Manage your professional identity, scored evidence, credentials, and recruiter visibility from one place."
            eyebrow="SKILL EVIDENCE PASSPORT"
            title="Profile and evidence"
          />
        </Animated.View>

        {status === 'authenticatedOffline' ? (
          <Banner
            title="Read-only while offline"
            message="Cached identity may be shown. Editing, consent changes, and server refresh resume after your session reconnects."
            tone="warning"
          />
        ) : null}

        {profileQuery.isPending ? <ProfileSkeleton /> : profileQuery.isError || !profile ? (
          <ErrorState
            title="Profile unavailable"
            description="Octamy could not load your learner profile."
            onRetry={() => void profileQuery.refetch()}
          />
        ) : (
          <Animated.View entering={entering} style={styles.section}>
            <Card accessibilityRole="summary">
              <View style={styles.identityRow}>
                <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]} accessible accessibilityLabel={`Profile initial ${profile.name.slice(0, 1).toUpperCase()}`}>
                  <Text style={{ color: colors.accent }} variant="h2">{profile.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.grow}>
                  <Heading level={2}>{profile.name}</Heading>
                  <Text muted>{profile.email}</Text>
                  <Text muted variant="small">Profile {Math.round(profile.profileCompleteness)}% complete</Text>
                </View>
              </View>
              <Text>{profile.currentRole || profile.position || 'Add your current role so your profile reflects your career direction.'}</Text>
              {profile.location ? <Text muted variant="small">Location: {profile.location}</Text> : null}
              <Button label="Edit profile" onPress={() => router.push(editHref)} variant="secondary" />
            </Card>
          </Animated.View>
        )}

        <Animated.View entering={entering} style={styles.section}>
          <View style={styles.sectionHeading}>
            <Heading level={2}>Current plan</Heading>
            <Text muted variant="small">Practice access is read directly from your Octamy subscription record.</Text>
          </View>
          {subscriptionQuery.isPending ? (
            <Card accessibilityLabel="Loading current Practice Pass plan" accessibilityRole="progressbar">
              <Skeleton height={28} width="48%" />
              <Skeleton height={20} width="76%" />
            </Card>
          ) : subscriptionQuery.isError || !subscriptionQuery.data ? (
            <ErrorState
              title="Plan unavailable"
              description="Octamy could not verify your current Practice Pass plan."
              onRetry={() => void subscriptionQuery.refetch()}
            />
          ) : (
            <Card tone="marketing">
              <View style={styles.planRow}>
                <View style={styles.grow}>
                  <Heading level={3}>{hasActivePracticePass(subscriptionQuery.data) ? 'Practice Pass active' : 'Free learner plan'}</Heading>
                  <Text muted>
                    {hasActivePracticePass(subscriptionQuery.data)
                      ? `${practicePlanLabel(subscriptionQuery.data.learner?.plan)} · ${subscriptionQuery.data.learner?.renewsAt ? `active until ${new Date(subscriptionQuery.data.learner.renewsAt).toLocaleDateString()}` : 'active access'}`
                      : 'Upgrade for all eligible low-stakes practice assessments.'}
                  </Text>
                </View>
                <Badge label={hasActivePracticePass(subscriptionQuery.data) ? 'Active' : 'Not active'} tone={hasActivePracticePass(subscriptionQuery.data) ? 'success' : 'neutral'} />
              </View>
              <Button label={hasActivePracticePass(subscriptionQuery.data) ? 'Open Practice Pass' : 'View Practice Pass plans'} onPress={() => router.push(practiceHref)} variant="secondary" />
            </Card>
          )}
        </Animated.View>

        <Animated.View entering={entering} style={styles.section}>
          <View style={styles.sectionHeading}>
            <Heading level={2}>Evidence summary</Heading>
            <Text muted variant="small">Pulled from your scored attempts and issued credential records.</Text>
          </View>
          {evidenceQuery.isPending ? (
            <Card accessibilityLabel="Loading evidence summary" accessibilityRole="progressbar">
              <Skeleton height={72} />
              <Skeleton height={72} />
              <Skeleton height={72} />
            </Card>
          ) : evidenceQuery.isError || !evidenceQuery.data ? (
            <ErrorState
              title="Evidence unavailable"
              description="Your profile is still available, but evidence totals could not be refreshed."
              onRetry={() => void evidenceQuery.refetch()}
            />
          ) : evidenceQuery.data.scoredAttemptCount === 0 && evidenceQuery.data.credentialCount === 0 ? (
            <EmptyState
              title="No scored evidence yet"
              description="Completed certification attempts and issued credentials will appear here. Practice Pass attempts do not issue recruiter-visible credentials."
            />
          ) : (
            <Card accessibilityRole="summary">
              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <Text variant="h2">{evidenceQuery.data.scoredAttemptCount}</Text>
                  <Text muted variant="small">Scored attempts</Text>
                </View>
                <View style={styles.metric}>
                  <Text variant="h2">{evidenceQuery.data.passedAttemptCount}</Text>
                  <Text muted variant="small">Passed attempts</Text>
                </View>
                <View style={styles.metric}>
                  <Text variant="h2">{evidenceQuery.data.credentialCount}</Text>
                  <Text muted variant="small">Credentials</Text>
                </View>
              </View>
            </Card>
          )}
        </Animated.View>

        <Animated.View entering={entering} style={styles.section}>
          <Heading level={2}>Privacy & account</Heading>
          <Card>
            <Heading level={3}>Recruiter evidence consent</Heading>
            <Text muted>Choose separately whether verified recruiters can discover your eligible profile and whether anyone with your evidence link can view your public passport.</Text>
            <Button label="Manage evidence visibility" onPress={() => router.push(privacyHref)} />
          </Card>
          <Card>
            <Heading level={3}>Session</Heading>
            <Text muted variant="small">Octamy stores a learner token on this device. The server does not provide a list of devices or a sign-out-everywhere action.</Text>
            <Button
              disabled={signingOut}
              label={signingOut ? 'Signing out…' : 'Sign out on this device'}
              loading={signingOut}
              onPress={confirmSignOut}
              variant="danger"
            />
          </Card>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  content: { alignSelf: 'center', flexGrow: 1, gap: spacing.xl, maxWidth: layout.contentMaxWidth, paddingBottom: spacing['3xl'], paddingHorizontal: spacing.xl, paddingTop: spacing.xl, width: '100%' },
  grow: { flex: 1, gap: spacing.xs },
  hero: { gap: spacing.md, paddingBottom: spacing.sm, paddingTop: spacing.sm },
  identityRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  metric: { flex: 1, gap: spacing.xs, minWidth: 88 },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  planRow: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  safeArea: { flex: 1 },
  section: { gap: spacing.md },
  sectionHeading: { gap: spacing.xs },
});
