import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { APP_CONFIG } from '../../constants/api';

interface ExamResultScreenProps {
  route: {
    params: {
      result: {
        examAttempt: any;
        passed: boolean;
        message: string;
        certificate?: any;
      };
      courseId: number;
    };
  };
  navigation: any;
}

const ExamResultScreen: React.FC<ExamResultScreenProps> = ({ route, navigation }) => {
  const { result } = route.params;
  const { examAttempt, passed, message, certificate } = result;

  const handleGoHome = () => {
    navigation.navigate('Home');
  };

  const handleViewCertificate = () => {
    if (certificate) {
      navigation.navigate('CertificateViewScreen', { 
        certificateId: certificate.certificateNumber 
      });
    }
  };

  const handleRetakeExam = () => {
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={[
          styles.statusIndicator,
          { backgroundColor: passed ? '#10b981' : '#ef4444' }
        ]}>
          <Text style={styles.statusText}>
            {passed ? '✓' : '✗'}
          </Text>
        </View>
        <Text style={styles.resultTitle}>
          {passed ? 'Congratulations!' : 'Better Luck Next Time'}
        </Text>
        <Text style={styles.resultMessage}>{message}</Text>
      </View>

      <View style={styles.scoreSection}>
        <Text style={styles.scoreLabel}>Your Score</Text>
        <Text style={styles.scoreValue}>
          {examAttempt.score}%
        </Text>
        <Text style={styles.scoreDetails}>
          {examAttempt.correctAnswers} out of {examAttempt.totalQuestions} correct
        </Text>
      </View>

      <View style={styles.detailsSection}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Time Taken</Text>
          <Text style={styles.detailValue}>
            {Math.floor((examAttempt.timeTaken || 0) / 60)} minutes
          </Text>
        </View>
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Passing Score</Text>
          <Text style={styles.detailValue}>{examAttempt.passingScore || 60}%</Text>
        </View>
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Attempt Date</Text>
          <Text style={styles.detailValue}>
            {new Date(examAttempt.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.actionsSection}>
        {passed && certificate && (
          <TouchableOpacity 
            style={styles.certificateButton} 
            onPress={handleViewCertificate}
          >
            <Text style={styles.certificateButtonText}>View Certificate</Text>
          </TouchableOpacity>
        )}

        {!passed && (
          <TouchableOpacity 
            style={styles.retakeButton} 
            onPress={handleRetakeExam}
          >
            <Text style={styles.retakeButtonText}>Retake Exam</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
          <Text style={styles.homeButtonText}>Go to Home</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    padding: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statusIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 8,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
    textAlign: 'center',
  },
  scoreSection: {
    alignItems: 'center',
    padding: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  scoreLabel: {
    fontSize: 18,
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: APP_CONFIG.ACCENT_COLOR,
    marginBottom: 8,
  },
  scoreDetails: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
  },
  detailsSection: {
    padding: 20,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  detailLabel: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
  },
  actionsSection: {
    padding: 20,
    gap: 12,
  },
  certificateButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  certificateButtonText: {
    color: APP_CONFIG.SECONDARY_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
  retakeButton: {
    backgroundColor: APP_CONFIG.ACCENT_COLOR,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: APP_CONFIG.PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
  homeButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  homeButtonText: {
    color: APP_CONFIG.SECONDARY_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ExamResultScreen;