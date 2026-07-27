import { StyleSheet, View } from 'react-native';

import { Badge, Card, Heading, Screen, Text } from '@/components/ui';
import { spacing } from '@/theme';

interface FeaturePlaceholderProps {
  description: string;
  eyebrow: string;
  note: string;
  title: string;
}

export function FeaturePlaceholder({ description, eyebrow, note, title }: FeaturePlaceholderProps) {
  return (
    <Screen>
      <View style={styles.hero}>
        <Badge label={eyebrow} tone="accent" />
        <Heading>{title}</Heading>
        <Text muted>{description}</Text>
      </View>
      <Card>
        <Heading level={3}>Foundation ready</Heading>
        <Text>{note}</Text>
        <Text muted variant="small">No network request is made on this screen.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.md, paddingVertical: spacing.lg },
});
