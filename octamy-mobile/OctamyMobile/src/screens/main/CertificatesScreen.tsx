import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { APP_CONFIG } from '../../constants/api';

const CertificatesScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Certificates</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.PRIMARY_COLOR,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
  },
});

export default CertificatesScreen;