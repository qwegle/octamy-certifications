import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { APP_CONFIG } from '../constants/api';

const SplashScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_CONFIG.NAME}</Text>
      <Text style={styles.subtitle}>Professional Certification Platform</Text>
      <ActivityIndicator 
        size="large" 
        color={APP_CONFIG.ACCENT_COLOR} 
        style={styles.loader} 
      />
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
    fontSize: 32,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
});

export default SplashScreen;