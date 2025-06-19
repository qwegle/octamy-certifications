import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchCourses } from '../../store/slices/coursesSlice';
import { fetchUserCertificates } from '../../store/slices/certificatesSlice';
import { APP_CONFIG } from '../../constants/api';

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { courses } = useAppSelector((state) => state.courses);
  const { certificates } = useAppSelector((state) => state.certificates);

  useEffect(() => {
    dispatch(fetchCourses());
    if (isAuthenticated) {
      dispatch(fetchUserCertificates());
    }
  }, [dispatch, isAuthenticated]);

  const navigateToCourses = () => {
    navigation.navigate('Courses');
  };

  const navigateToCertificates = () => {
    navigation.navigate('Certificates');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Welcome{isAuthenticated && user ? `, ${user.name}` : ''}!
        </Text>
        <Text style={styles.subtitle}>Professional Certification Platform</Text>
      </View>

      {isAuthenticated && (
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{certificates.length}</Text>
            <Text style={styles.statLabel}>Certificates</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{courses.length}</Text>
            <Text style={styles.statLabel}>Available Courses</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <TouchableOpacity style={styles.actionCard} onPress={navigateToCourses}>
          <Text style={styles.actionTitle}>Browse Courses</Text>
          <Text style={styles.actionDescription}>Explore professional certification courses</Text>
        </TouchableOpacity>

        {isAuthenticated && (
          <TouchableOpacity style={styles.actionCard} onPress={navigateToCertificates}>
            <Text style={styles.actionTitle}>View Certificates</Text>
            <Text style={styles.actionDescription}>Access your earned certificates</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionCard}>
          <Text style={styles.actionTitle}>Featured Courses</Text>
          <Text style={styles.actionDescription}>Check out our most popular certifications</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Platform Features</Text>
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>✓ Professional Certifications</Text>
          <Text style={styles.featureItem}>✓ Timed Examinations</Text>
          <Text style={styles.featureItem}>✓ Verified Certificates</Text>
          <Text style={styles.featureItem}>✓ Multiple Choice Questions</Text>
          <Text style={styles.featureItem}>✓ Instant Results</Text>
          <Text style={styles.featureItem}>✓ PDF Certificate Download</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.PRIMARY_COLOR,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
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
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 16,
  },
  actionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.6,
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.ACCENT_COLOR,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
  },
  featureList: {
    gap: 8,
  },
  featureItem: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.9,
  },
});

export default HomeScreen;