import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchUserCertificates } from '../../store/slices/certificatesSlice';
import { APP_CONFIG } from '../../constants/api';

interface CertificatesScreenProps {
  navigation: any;
}

const CertificatesScreen: React.FC<CertificatesScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { certificates, isLoading } = useAppSelector((state) => state.certificates);
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchUserCertificates());
    }
  }, [dispatch, isAuthenticated]);

  const handleCertificatePress = (certificateNumber: string) => {
    navigation.navigate('CertificateViewScreen', { certificateId: certificateNumber });
  };

  const renderCertificateItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.certificateCard}
      onPress={() => handleCertificatePress(item.certificateNumber)}
    >
      <View style={styles.certificateHeader}>
        <Text style={styles.courseName}>{item.courseName}</Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.isPaid ? '#10b981' : '#f59e0b' }
        ]}>
          <Text style={styles.statusText}>
            {item.isPaid ? 'Verified' : 'Pending'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.recipientName}>{item.recipientName}</Text>
      
      <View style={styles.certificateDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Score</Text>
          <Text style={styles.detailValue}>{item.score}%</Text>
        </View>
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Issue Date</Text>
          <Text style={styles.detailValue}>
            {new Date(item.issuedAt).toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Certificate #</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {item.certificateNumber}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageTitle}>Authentication Required</Text>
        <Text style={styles.messageText}>Please log in to view your certificates</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.loadingText}>Loading certificates...</Text>
      </View>
    );
  }

  if (certificates.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageTitle}>No Certificates Yet</Text>
        <Text style={styles.messageText}>
          Complete courses and pass exams to earn certificates
        </Text>
        <TouchableOpacity 
          style={styles.browseCourseButton}
          onPress={() => navigation.navigate('Courses')}
        >
          <Text style={styles.browseCourseText}>Browse Courses</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Certificates</Text>
        <Text style={styles.subtitle}>{certificates.length} certificate(s)</Text>
      </View>

      <FlatList
        data={certificates}
        renderItem={renderCertificateItem}
        keyExtractor={(item) => item.certificateNumber}
        contentContainerStyle={styles.certificatesList}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.PRIMARY_COLOR,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.PRIMARY_COLOR,
    padding: 32,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
  },
  loadingText: {
    color: APP_CONFIG.SECONDARY_COLOR,
    fontSize: 16,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 8,
    textAlign: 'center',
  },
  messageText: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  browseCourseButton: {
    backgroundColor: APP_CONFIG.ACCENT_COLOR,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  browseCourseText: {
    color: APP_CONFIG.PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
  certificatesList: {
    padding: 16,
  },
  certificateCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  certificateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: APP_CONFIG.SECONDARY_COLOR,
    fontSize: 12,
    fontWeight: 'bold',
  },
  recipientName: {
    fontSize: 16,
    color: APP_CONFIG.ACCENT_COLOR,
    fontWeight: '600',
    marginBottom: 12,
  },
  certificateDetails: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_CONFIG.SECONDARY_COLOR,
    flex: 1,
    textAlign: 'right',
  },
});

export default CertificatesScreen;