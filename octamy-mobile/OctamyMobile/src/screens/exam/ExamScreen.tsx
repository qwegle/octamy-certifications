import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, BackHandler } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { 
  fetchExamQuestions,
  setAnswer,
  nextQuestion,
  previousQuestion,
  decrementTimer,
  submitExam
} from '../../store/slices/examSlice';
import { APP_CONFIG } from '../../constants/api';

interface ExamScreenProps {
  route: {
    params: {
      courseId: number;
    };
  };
  navigation: any;
}

const ExamScreen: React.FC<ExamScreenProps> = ({ route, navigation }) => {
  const dispatch = useAppDispatch();
  const { 
    questions, 
    currentQuestionIndex, 
    answers, 
    timeRemaining, 
    isSubmitting,
    currentCourse,
    isLoading,
    error
  } = useAppSelector((state) => state.exam);
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { courseId } = route.params;

  useEffect(() => {
    dispatch(fetchExamQuestions(courseId));
  }, [dispatch, courseId]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (timeRemaining > 0) {
        dispatch(decrementTimer());
      } else if (timeRemaining === 0) {
        handleSubmitExam();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Exit Exam',
        'Are you sure you want to exit? Your progress will be lost.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Exit', onPress: () => navigation.goBack() }
        ]
      );
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (optionIndex: number) => {
    dispatch(setAnswer({ questionIndex: currentQuestionIndex, answer: optionIndex }));
  };

  const handleSubmitExam = () => {
    if (!currentCourse) return;

    const examData = {
      courseId: currentCourse.id,
      answers,
      userName: user?.name,
      userEmail: user?.email,
    };

    dispatch(submitExam(examData)).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        navigation.navigate('ExamResultScreen', { 
          result: result.payload,
          courseId 
        });
      }
    });
  };

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading exam...</Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => dispatch(fetchExamQuestions(courseId))}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Add null checking for questions array
  if (!questions || questions.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No questions available</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  if (!currentQuestion) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading question...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
        </View>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {questions?.length || 0}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.questionText}>{currentQuestion.questionText}</Text>

        <View style={styles.optionsContainer}>
          {currentQuestion.options?.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                answers[currentQuestionIndex] === index && styles.selectedOption
              ]}
              onPress={() => handleAnswerSelect(index)}
            >
              <Text style={[
                styles.optionText,
                answers[currentQuestionIndex] === index && styles.selectedOptionText
              ]}>
                {String.fromCharCode(65 + index)}. {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, currentQuestionIndex === 0 && styles.disabledButton]}
          onPress={() => dispatch(previousQuestion())}
          disabled={currentQuestionIndex === 0}
        >
          <Text style={styles.navButtonText}>Previous</Text>
        </TouchableOpacity>

        {currentQuestionIndex === (questions?.length || 1) - 1 ? (
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.disabledButton]}
            onPress={handleSubmitExam}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Exam'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => dispatch(nextQuestion())}
          >
            <Text style={styles.navButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
  timerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.ACCENT_COLOR,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: APP_CONFIG.ACCENT_COLOR,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  questionText: {
    fontSize: 18,
    color: APP_CONFIG.SECONDARY_COLOR,
    lineHeight: 26,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedOption: {
    backgroundColor: APP_CONFIG.ACCENT_COLOR,
    borderColor: APP_CONFIG.ACCENT_COLOR,
  },
  optionText: {
    fontSize: 16,
    color: APP_CONFIG.SECONDARY_COLOR,
  },
  selectedOptionText: {
    color: APP_CONFIG.PRIMARY_COLOR,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  navButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  navButtonText: {
    color: APP_CONFIG.SECONDARY_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    backgroundColor: APP_CONFIG.ACCENT_COLOR,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  submitButtonText: {
    color: APP_CONFIG.PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default ExamScreen;