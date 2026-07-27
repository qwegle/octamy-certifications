import { useQuery } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, EmptyState, ErrorState, Heading, Input, PageHeader, Skeleton, Text } from '@/components/ui';
import { getCertifications, type CertificationFilters } from '@/features/certifications/api';
import { formatDuration, formatPrice } from '@/features/certifications/format';
import type { CertificationSummary } from '@/features/certifications/types';
import { queryKeys } from '@/lib/query-keys';
import { layout, minimumTouchTarget, motion, spacing, useAppReducedMotion, useAppTheme } from '@/theme';

const certificatesHref = '/certificate' as Href;
const verifyHref = '/certificate/verify' as Href;

function CatalogSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading certifications" accessibilityRole="progressbar" style={styles.listContent}>
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index}>
          <Skeleton width="35%" />
          <Skeleton height={24} width="80%" />
          <Skeleton height={48} />
          <Skeleton width="55%" />
        </Card>
      ))}
    </View>
  );
}

function CertificationCard({ item, index }: { index: number; item: CertificationSummary }) {
  const reduceMotion = useAppReducedMotion();
  const href = { pathname: '/certification/[slug]', params: { slug: item.slug } } as Href;
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index * 35, 140)).duration(motion.duration.enter).easing(motion.easing.enter)}
      style={styles.cardWrapper}>
      <Card>
        <View style={styles.badges}>
          <Badge label={item.certificationLabel} tone="accent" />
          {item.level ? <Badge label={item.level} /> : null}
        </View>
        <Heading level={3}>{item.title}</Heading>
        <Text muted numberOfLines={3}>{item.description}</Text>
        <Text variant="small">
          {formatDuration(item.duration)} · Passing score {item.passingScore ?? 'not published'}% · {formatPrice(item.price)} credential
        </Text>
        <Button label={`View ${item.title}`} onPress={() => router.push(href)} variant="secondary" />
      </Card>
    </Animated.View>
  );
}

export default function CertificationsScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const phone = width < 640;
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<CertificationFilters>({});
  const query = useQuery({
    queryKey: queryKeys.certifications.catalog(filters),
    queryFn: ({ signal }) => getCertifications(filters, signal),
  });

  const categories = useMemo(() => {
    const represented = new Map(
      (query.data?.items ?? [])
        .map((item) => item.category)
        .filter((category): category is NonNullable<typeof category> => Boolean(category))
        .map((category) => [category.slug, category]),
    );
    if (filters.category && !represented.has(filters.category)) {
      const selected = query.data?.facets.categories.find((category) => category.slug === filters.category);
      if (selected) represented.set(selected.slug, selected);
    }
    return Array.from(represented.values());
  }, [filters.category, query.data]);
  const levels = query.data?.facets.levels ?? [];
  const hasFilters = Boolean(filters.search || filters.category || filters.level);
  const countLabel = useMemo(() => {
    const count = query.data?.pagination.total ?? 0;
    return `${count} certification${count === 1 ? '' : 's'}`;
  }, [query.data?.pagination.total]);

  const applySearch = () => setFilters((current) => ({ ...current, search: searchDraft.trim() || undefined }));
  const clearFilters = () => {
    setSearchDraft('');
    setFilters({});
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <FlatList
        contentContainerStyle={[styles.listContent, phone ? styles.listContentPhone : null]}
        data={query.data?.items ?? []}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponentStyle={styles.fullWidth}
        style={styles.list}
        ListHeaderComponent={(
          <View style={styles.header}>
            <PageHeader
              actions={(
                <View style={[styles.actions, phone ? styles.actionsPhone : null]}>
                  <Button label="My certificates" onPress={() => router.push(certificatesHref)} variant="secondary" />
                  <Button label="Verify a certificate" onPress={() => router.push(verifyHref)} variant="ghost" />
                </View>
              )}
              description="Validate career capability through reviewed assessments and build evidence employers can inspect."
              eyebrow="CAREER CERTIFICATION"
              title="Certifications"
            />
            <View style={styles.searchRow}>
              <View style={styles.searchInput}>
                <Input
                  autoCapitalize="none"
                  label="Search certifications"
                  onChangeText={setSearchDraft}
                  onSubmitEditing={applySearch}
                  placeholder="Title or skill"
                  returnKeyType="search"
                  value={searchDraft}
                />
              </View>
              <Button label="Search" onPress={applySearch} />
            </View>
            {categories.length > 0 || levels.length > 0 ? (
              <ScrollView
                accessibilityLabel="Certification filters"
                contentContainerStyle={[styles.filters, phone ? styles.filtersPhone : null]}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRail}>
                {categories.map((category) => {
                  const selected = filters.category === category.slug;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={`category-${category.slug}`}
                      onPress={() => setFilters((current) => ({ ...current, category: selected ? undefined : category.slug }))}
                      style={[styles.filter, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border }]}>
                      <Text style={selected ? { color: colors.accent } : undefined} variant="label">{category.name}</Text>
                    </Pressable>
                  );
                })}
                {levels.map((level) => {
                  const selected = filters.level === level;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={`level-${level}`}
                      onPress={() => setFilters((current) => ({ ...current, level: selected ? undefined : level }))}
                      style={[styles.filter, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border }]}>
                      <Text style={selected ? { color: colors.accent } : undefined} variant="label">{level}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            {hasFilters ? <Button label="Clear all filters" onPress={clearFilters} variant="ghost" /> : null}
            {query.data ? <Text accessibilityLiveRegion="polite" muted variant="small">{countLabel}</Text> : null}
          </View>
        )}
        ListEmptyComponent={query.isPending ? <CatalogSkeleton /> : query.isError ? (
          <ErrorState description="The certification catalog could not be loaded." onRetry={() => void query.refetch()} />
        ) : (
          <EmptyState
            actionLabel={hasFilters ? 'Clear filters' : undefined}
            description={hasFilters ? 'Try a broader search or remove a filter.' : 'No career certifications are currently published.'}
            onAction={hasFilters ? clearFilters : undefined}
            title="No certifications found"
          />
        )}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isPending} onRefresh={() => void query.refetch()} tintColor={colors.accent} />}
        renderItem={({ item, index }) => <CertificationCard index={index} item={item} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionsPhone: { flexDirection: 'column', width: '100%' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardWrapper: { width: '100%' },
  filter: { borderRadius: 2, borderWidth: 1, justifyContent: 'center', minHeight: minimumTouchTarget, paddingHorizontal: spacing.lg },
  filterRail: { maxWidth: '100%', width: '100%' },
  filters: { gap: spacing.sm },
  filtersPhone: { paddingRight: spacing.lg },
  fullWidth: { width: '100%' },
  header: { gap: spacing.lg, paddingBottom: spacing.lg, width: '100%' },
  list: { width: '100%' },
  listContent: { alignSelf: 'center', flexGrow: 1, gap: spacing.lg, maxWidth: layout.contentMaxWidth, paddingBottom: spacing['3xl'], paddingHorizontal: spacing.xl, paddingTop: spacing.xl, width: '100%' },
  listContentPhone: { gap: spacing.md, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  safeArea: { flex: 1 },
  searchInput: { width: '100%' },
  searchRow: { gap: spacing.sm, width: '100%' },
});
