import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchCourseDetail } from '../../store/slices/coursesSlice';
import { startExam } from '../../store/slices/examSlice';
import { APP_CONFIG } from '../../constants/api';

interface CourseDetailScreenProps {
  route: {
    params: {
      courseId: number;
    };
  };
  navigation: any;
}

const CourseDetailScreen: React.FC<CourseDetailScreenProps> = ({ route, navigation }) => {
  const dispatch = useAppDispatch();
  const { selectedCourse, isLoading } = useAppSelector((state) => state.courses);
  const { courseId } = route.params;

  useEffect(() => {
    dispatch(fetchCourseDetail(courseId));
  }, [dispatch, courseId]);

  const handleStartExam = () => {
    if (!selectedCourse) return;

    Alert.alert(
      'Start Exam',
      `Are you ready to start the ${selectedCourse.title} exam? Duration: ${selectedCourse.duration} minutes`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => {
            dispatch(startExam({
              course: selectedCourse,
              duration: selectedCourse.duration || 60
            }));
            navigation.navigate('ExamScreen', { courseId });
          }
        }
      ]
    );
  };

  if (isLoading || !selectedCourse) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading course details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{selectedCourse.title}</Text>
        <Text style={styles.category}>{selectedCourse.categoryName}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>{selectedCourse.description}</Text>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>{selectedCourse.duration} minutes</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Questions</Text>
            <Text style={styles.infoValue}>{selectedCourse.totalQuestions}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Passing Score</Text>
            <Text style={styles.infoValue}>{selectedCourse.passingScore}%</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Price</Text>
            <Text style={styles.infoValue}>₹{selectedCourse.price}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.startButton} onPress={handleStartExam}>
          <Text style={styles.startButtonText}>Start Exam</Text>
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
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 8,
  },
  category: {
    fontSize: 16,
    color: APP_CONFIG.ACCENT_COLOR,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    lineHeight: 24,
    marginBottom: 24,
  },
  infoSection: {
    marginBottom: 32,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  infoLabel: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
  },
  startButton: {
    backgroundColor: APP_CONFIG.ACCENT_COLOR,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: APP_CONFIG.PRIMARY_COLOR,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CourseDetailScreen;