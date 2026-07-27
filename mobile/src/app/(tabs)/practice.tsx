import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, EmptyState, ErrorState, Heading, Input, PageHeader, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import {
  createPracticeCheckout,
  EntitlementSummary,
  getCheckoutStatus,
  getPracticeCatalog,
  getPracticeSubscription,
  hasActivePracticePass,
  PracticeCatalogCard,
  PracticeCatalogSkeleton,
} from '@/features/practice';
import { queryKeys } from '@/lib/query-keys';
import { asApiError } from '@/lib/api-client';
import { openCashfreeCheckout } from '@/lib/cashfree-checkout';
import { queryStaleTime } from '@/lib/query';
import { minimumTouchTarget, radii, spacing, useAppTheme } from '@/theme';

type HandoffState =
  | { kind: 'idle' }
  | { kind: 'opening'; cycle: 'monthly' | 'yearly' }
  | { kind: 'confirmed' }
  | { kind: 'cancelled'; orderId: string }
  | { kind: 'failed'; orderId: string }
  | { kind: 'pending'; orderId: string }
  | { kind: 'error'; message: string };

function checkoutFeedback(state: HandoffState) {
  switch (state.kind) {
    case 'confirmed':
      return <Banner title="Access confirmed" message="The Octamy server confirms that your Practice Pass is active." tone="success" />;
    case 'cancelled':
      return <Banner title="Checkout cancelled" message="The web checkout was cancelled. The server did not grant Practice Pass access." tone="warning" />;
    case 'failed':
      return <Banner title="Payment not completed" message="The payment status reports that this checkout did not complete. Practice Pass access was not granted." tone="error" />;
    case 'pending':
      return <Banner title="Confirmation pending" message="Octamy has not confirmed Practice Pass access yet. A checkout return alone is not payment confirmation; use Check payment status after the provider finishes processing." tone="warning" />;
    case 'error':
      return <Banner title="Checkout unavailable" message={state.message} tone="error" />;
    default:
      return null;
  }
}

function isFailedStatus(status: string | null): boolean {
  if (!status) return false;
  return ['fail', 'cancel', 'declin', 'expir'].some((part) => status.toLowerCase().includes(part));
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function FilterChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        { backgroundColor: selected ? colors.foreground : colors.surface, borderColor: selected ? colors.foreground : colors.border },
        pressed && styles.pressed,
      ]}>
      <Text style={{ color: selected ? colors.background : colors.foreground }} variant="label">{label}</Text>
    </Pressable>
  );
}

function durationBand(value: number | string | null | undefined): 'quick' | 'standard' | null {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return null;
  return minutes <= 30 ? 'quick' : 'standard';
}

export default function PracticeScreen() {
  const { canMutate } = useSession();
  const [handoff, setHandoff] = useState<HandoffState>({ kind: 'idle' });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [duration, setDuration] = useState<'all' | 'quick' | 'standard'>('all');

  const catalogQuery = useQuery({
    queryKey: queryKeys.practice.catalog,
    queryFn: ({ signal }) => getPracticeCatalog(signal),
    staleTime: queryStaleTime.catalog,
  });
  const subscriptionQuery = useQuery({
    queryKey: queryKeys.practice.subscription,
    queryFn: ({ signal }) => getPracticeSubscription(signal),
    staleTime: queryStaleTime.active,
  });

  const confirmCheckout = async (orderId: string, attempts = 1): Promise<'confirmed' | 'failed' | 'pending'> => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const orderStatus = await getCheckoutStatus(orderId).catch(() => null);
      const renewsAt = Date.parse(orderStatus?.renewsAt ?? '');
      const exactOrderActive = orderStatus?.orderId === orderId
        && orderStatus.ownerType === 'learner'
        && orderStatus.plan === 'all_access'
        && orderStatus.status === 'active'
        && Number.isFinite(renewsAt)
        && renewsAt > Date.now();
      if (exactOrderActive) {
        await subscriptionQuery.refetch();
        setHandoff({ kind: 'confirmed' });
        return 'confirmed';
      }
      if (isFailedStatus(orderStatus?.status ?? null)) {
        setHandoff({ kind: 'failed', orderId });
        return 'failed';
      }
      if (attempt < attempts - 1) await wait(1_500);
    }
    setHandoff({ kind: 'pending', orderId });
    return 'pending';
  };

  const startCheckout = async (cycle: 'monthly' | 'yearly') => {
    if (handoff.kind === 'opening' || !canMutate) return;
    setHandoff({ kind: 'opening', cycle });
    try {
      const checkout = await createPracticeCheckout(cycle);
      const browserResult = await openCashfreeCheckout({
        paymentLink: checkout.paymentLink,
        paymentSessionId: checkout.paymentSessionId,
      });
      const outcome = await confirmCheckout(checkout.orderId, browserResult.type === 'cancel' ? 1 : 5);
      if (outcome === 'pending' && browserResult.type === 'cancel') {
        setHandoff({ kind: 'cancelled', orderId: checkout.orderId });
      }
    } catch (error) {
      setHandoff({ kind: 'error', message: asApiError(error).message });
    }
  };

  const entitlementActive = hasActivePracticePass(subscriptionQuery.data);
  const pendingOrderId = 'orderId' in handoff ? handoff.orderId : null;
  const catalogItems = catalogQuery.data?.items ?? [];
  const representedCategories = useMemo(() => [...new Set(catalogItems.map((item) => item.category?.name).filter((value): value is string => Boolean(value)))].sort(), [catalogItems]);
  const representedDurationBands = useMemo(() => new Set(catalogItems.map((item) => durationBand(item.duration)).filter((value): value is 'quick' | 'standard' => value !== null)), [catalogItems]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return catalogItems.filter((item) => {
      const matchesSearch = !query || [item.title, item.description, item.category?.name, item.originLabel]
        .some((value) => value?.toLocaleLowerCase().includes(query));
      const matchesCategory = category === 'all' || item.category?.name === category;
      const matchesDuration = duration === 'all' || durationBand(item.duration) === duration;
      return matchesSearch && matchesCategory && matchesDuration;
    });
  }, [catalogItems, category, duration, search]);
  const filtersActive = Boolean(search.trim()) || category !== 'all' || duration !== 'all';

  return (
    <Screen>
      <PageHeader
        description="Build confidence with low-stakes assessments kept separate from your official certification record."
        eyebrow="PRACTICE PASS"
        title="Practice with purpose"
      />

      <Card tone="marketing">
        <View style={styles.planHeader}>
          <View style={styles.planCopy}>
            <Text variant="label">PREMIUM PRACTICE PASS</Text>
            <Heading level={2}>One pass. Every published practice exam.</Heading>
            <Text muted>Build exam rhythm with low-stakes attempts, instant answer review, and new eligible assessments while your plan is active.</Text>
          </View>
          <View style={styles.priceBadge}>
            <Text variant="h2">₹299</Text>
            <Text muted variant="small">per month</Text>
          </View>
        </View>
        <View style={styles.benefits}>
          <Text variant="small">✓ All eligible practice categories</Text>
          <Text variant="small">✓ Timed attempts and answer review</Text>
          <Text variant="small">✓ ₹2,990 yearly — save ₹598 versus 12 monthly payments</Text>
        </View>
        <View style={styles.accessHeading}>
          <Heading level={3}>Your current plan</Heading>
          <Text muted variant="small">Plan and access are confirmed only by Octamy.</Text>
        </View>
        {subscriptionQuery.isPending ? (
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Checking Practice Pass access" style={styles.stack}>
            <Skeleton height={24} width={132} />
            <Skeleton height={20} width="72%" />
            <Skeleton height={18} />
          </View>
        ) : subscriptionQuery.isError ? (
          <ErrorState
            description="Octamy could not verify your Practice Pass. Access is never inferred on this device."
            onRetry={() => void subscriptionQuery.refetch()}
            retryLabel="Retry access check"
            title="Access not verified"
          />
        ) : subscriptionQuery.data ? (
          <EntitlementSummary subscription={subscriptionQuery.data} />
        ) : null}

        {checkoutFeedback(handoff)}

        {!entitlementActive && subscriptionQuery.data ? (
          <View style={styles.stack}>
            <Text variant="bodyStrong">Continue in a secure web checkout</Text>
            <Text muted variant="small">Cashfree checkout opens in your browser. Returning to the app does not prove payment; Octamy rechecks the server before granting access.</Text>
            <Button
              disabled={!canMutate}
              label={handoff.kind === 'opening' && handoff.cycle === 'monthly' ? 'Opening web checkout…' : 'Continue to monthly web checkout — ₹299'}
              loading={handoff.kind === 'opening' && handoff.cycle === 'monthly'}
              onPress={() => void startCheckout('monthly')}
            />
            <Button
              disabled={!canMutate}
              label={handoff.kind === 'opening' && handoff.cycle === 'yearly' ? 'Opening web checkout…' : 'Continue to yearly web checkout — ₹2,990'}
              loading={handoff.kind === 'opening' && handoff.cycle === 'yearly'}
              onPress={() => void startCheckout('yearly')}
              variant="secondary"
            />
            {!canMutate ? <Text muted variant="small">Reconnect and validate your session before starting checkout.</Text> : null}
          </View>
        ) : null}

        {pendingOrderId && !entitlementActive ? (
          <Button label="Check payment status" onPress={() => void confirmCheckout(pendingOrderId, 1)} variant="secondary" />
        ) : null}
        <Button label="Refresh access from server" onPress={() => void subscriptionQuery.refetch()} variant="ghost" />
      </Card>

      <View style={styles.sectionHeading}>
        <Heading level={2}>Find your next practice exam</Heading>
        <Text muted>Search by exam or category. Filters include only values represented in the current catalog.</Text>
      </View>

      {!catalogQuery.isPending && !catalogQuery.isError && catalogItems.length > 0 ? (
        <Card>
          <Input
            accessibilityLabel="Search practice exams"
            autoCapitalize="none"
            autoCorrect={false}
            label="Search practice exams"
            onChangeText={setSearch}
            placeholder="Try SSC, banking, railway…"
            value={search}
          />
          <View style={styles.filterGroup}>
            <Text variant="bodyStrong">Category</Text>
            <ScrollView contentContainerStyle={styles.filterRail} horizontal showsHorizontalScrollIndicator={false}>
              <FilterChip label="All categories" onPress={() => setCategory('all')} selected={category === 'all'} />
              {representedCategories.map((value) => <FilterChip key={value} label={value} onPress={() => setCategory(value)} selected={category === value} />)}
            </ScrollView>
          </View>
          <View style={styles.filterGroup}>
            <Text variant="bodyStrong">Duration</Text>
            <View style={styles.filterRail}>
              <FilterChip label="Any length" onPress={() => setDuration('all')} selected={duration === 'all'} />
              {representedDurationBands.has('quick') ? <FilterChip label="30 min or less" onPress={() => setDuration('quick')} selected={duration === 'quick'} /> : null}
              {representedDurationBands.has('standard') ? <FilterChip label="Over 30 min" onPress={() => setDuration('standard')} selected={duration === 'standard'} /> : null}
            </View>
          </View>
          <View style={styles.resultsRow}>
            <Text accessibilityLiveRegion="polite" muted variant="small">{filteredItems.length} of {catalogItems.length} exams shown</Text>
            {filtersActive ? <Button label="Clear filters" onPress={() => { setSearch(''); setCategory('all'); setDuration('all'); }} variant="ghost" /> : null}
          </View>
        </Card>
      ) : null}

      {catalogQuery.isPending ? (
        <PracticeCatalogSkeleton />
      ) : catalogQuery.isError ? (
        <ErrorState
          description="The practice catalog could not be loaded."
          onRetry={() => void catalogQuery.refetch()}
          retryLabel="Retry catalog"
          title="Catalog unavailable"
        />
      ) : catalogItems.length === 0 ? (
        <EmptyState
          actionLabel="Refresh catalog"
          description="There are no published practice assessments right now."
          onAction={() => void catalogQuery.refetch()}
          title="No practice exams yet"
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          actionLabel="Clear filters"
          description="No represented practice exam matches this search and filter combination."
          onAction={() => { setSearch(''); setCategory('all'); setDuration('all'); }}
          title="No matching practice exams"
        />
      ) : (
        <View style={styles.stack}>
          {filteredItems.map((item, index) => <PracticeCatalogCard index={index} item={item} key={item.id} />)}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  accessHeading: { gap: spacing.xs, marginTop: spacing.sm },
  benefits: { gap: spacing.sm },
  filterChip: { alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, justifyContent: 'center', minHeight: minimumTouchTarget, paddingHorizontal: spacing.md },
  filterGroup: { gap: spacing.sm },
  filterRail: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingRight: spacing.sm },
  hero: { gap: spacing.md, paddingBottom: spacing.sm, paddingTop: spacing.lg },
  planCopy: { flex: 1, gap: spacing.sm, minWidth: 220 },
  planHeader: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  pressed: { opacity: 0.68 },
  priceBadge: { alignItems: 'flex-end', gap: spacing.xs },
  resultsRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  sectionHeading: { gap: spacing.sm, marginTop: spacing.sm },
  stack: { gap: spacing.md },
});
