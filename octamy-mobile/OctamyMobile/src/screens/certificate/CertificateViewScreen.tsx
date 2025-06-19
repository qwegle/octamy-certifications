import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchCertificateDetail } from '../../store/slices/certificatesSlice';
import { APP_CONFIG } from '../../constants/api';

interface CertificateViewScreenProps {
  route: {
    params: {
      certificateId: string;
    };
  };
  navigation: any;
}

const CertificateViewScreen: React.FC<CertificateViewScreenProps> = ({ route, navigation }) => {
  const dispatch = useAppDispatch();
  const { selectedCertificate, isLoading } = useAppSelector((state) => state.certificates);
  const { certificateId } = route.params;

  useEffect(() => {
    dispatch(fetchCertificateDetail(certificateId));
  }, [dispatch, certificateId]);

  const handleShare = async () => {
    if (!selectedCertificate) return;

    try {
      const shareMessage = `🎉 I just earned my ${selectedCertificate.courseName} certification from Octamy!

📜 Certificate: ${selectedCertificate.certificateNumber}
🎯 Score: ${selectedCertificate.score}%
✅ Verified by Octamy Solutions

View certificate: ${APP_CONFIG.BASE_URL}/certificate/${selectedCertificate.certificateNumber}

#Octamy #Certification #ProfessionalDevelopment`;

      await Share.share({
        message: shareMessage,
        title: 'My Octamy Certification',
      });
    } catch (error) {
      console.error('Error sharing certificate:', error);
    }
  };

  const handleDownload = () => {
    Alert.alert(
      'Download Certificate',
      'Certificate download functionality will be available in the next update.',
      [{ text: 'OK' }]
    );
  };

  if (isLoading || !selectedCertificate) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading certificate...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.certificateContainer}>
        <View style={styles.certificateHeader}>
          <Text style={styles.certificateTitle}>Certificate of Completion</Text>
          <Text style={styles.companyName}>Octamy Solutions Private Limited</Text>
        </View>

        <View style={styles.certificateBody}>
          <Text style={styles.recipientLabel}>This is to certify that</Text>
          <Text style={styles.recipientName}>{selectedCertificate.recipientName}</Text>
          <Text style={styles.courseLabel}>has successfully completed</Text>
          <Text style={styles.courseName}>{selectedCertificate.courseName}</Text>
          
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Score Achieved</Text>
            <Text style={styles.scoreValue}>{selectedCertificate.score}%</Text>
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Certificate Number:</Text>
              <Text style={styles.detailValue}>{selectedCertificate.certificateNumber}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Issue Date:</Text>
              <Text style={styles.detailValue}>
                {new Date(selectedCertificate.issuedAt).toLocaleDateString()}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Verification:</Text>
              <Text style={[styles.detailValue, styles.verificationStatus]}>
                {selectedCertificate.isPaid ? 'Verified ✓' : 'Pending Payment'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.certificateFooter}>
          <Text style={styles.footerText}>Digitally Signed & Verified</Text>
          <Text style={styles.footerSubtext}>
            Verify at: octamy.com/verify/{selectedCertificate.certificateNumber}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>Share Certificate</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
          <Text style={styles.downloadButtonText}>Download PDF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.PRIMARY_COLOR,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.PRIMARY_COLOR,
  },
  loadingText: {
    color: APP_CONFIG.SECONDARY_COLOR,
    fontSize: 16,
  },
  certificateContainer: {
    flex: 1,
    backgroundColor: APP_CONFIG.SECONDARY_COLOR,
    borderRadius: 12,
    padding: 24,
    margin: 8,
    borderWidth: 2,
    borderColor: '#d4af37',
  },
  certificateHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#d4af37',
    paddingBottom: 16,
    marginBottom: 24,
  },
  certificateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.PRIMARY_COLOR,
    marginBottom: 8,
  },
  companyName: {
    fontSize: 16,
    color: APP_CONFIG.PRIMARY_COLOR,
    opacity: 0.8,
  },
  certificateBody: {
    flex: 1,
    alignItems: 'center',
  },
  recipientLabel: {
    fontSize: 16,
    color: APP_CONFIG.PRIMARY_COLOR,
    marginBottom: 8,
  },
  recipientName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#d4af37',
    marginBottom: 16,
    textAlign: 'center',
  },
  courseLabel: {
    fontSize: 16,
    color: APP_CONFIG.PRIMARY_COLOR,
    marginBottom: 8,
  },
  courseName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: APP_CONFIG.PRIMARY_COLOR,
    marginBottom: 24,
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    minWidth: 120,
  },
  scoreLabel: {
    fontSize: 14,
    color: APP_CONFIG.PRIMARY_COLOR,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#d4af37',
  },
  detailsContainer: {
    width: '100%',
    marginTop: 'auto',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: APP_CONFIG.PRIMARY_COLOR,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: APP_CONFIG.PRIMARY_COLOR,
  },
  verificationStatus: {
    color: '#10b981',
  },
  certificateFooter: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#d4af37',
    paddingTop: 16,
    marginTop: 24,
  },
  footerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: APP_CONFIG.PRIMARY_COLOR,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 10,
    color: APP_CONFIG.PRIMARY_COLOR,
    opacity: 0.6,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#1da1f2',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  shareButtonText: {
    color: APP_CONFIG.SECONDARY_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadButton: {
    flex: 1,
    backgroundColor: APP_CONFIG.ACCENT_COLOR,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: APP_CONFIG.PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CertificateViewScreen;