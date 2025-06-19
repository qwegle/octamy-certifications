import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchCourses, fetchCategories } from '../../store/slices/coursesSlice';
import { APP_CONFIG } from '../../constants/api';

interface CoursesScreenProps {
  navigation: any;
}

const CoursesScreen: React.FC<CoursesScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { courses, categories, isLoading } = useAppSelector((state) => state.courses);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  useEffect(() => {
    dispatch(fetchCourses());
    dispatch(fetchCategories());
  }, [dispatch]);

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? course.categoryId === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  const handleCoursePress = (courseId: number) => {
    navigation.navigate('CourseDetailScreen', { courseId });
  };

  const renderCourseItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.courseCard}
      onPress={() => handleCoursePress(item.id)}
    >
      <View style={styles.courseHeader}>
        <Text style={styles.courseTitle}>{item.title}</Text>
        <Text style={styles.coursePrice}>₹{item.price}</Text>
      </View>
      <Text style={styles.courseDescription} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.courseFooter}>
        <Text style={styles.courseDuration}>{item.duration} min</Text>
        <Text style={styles.courseQuestions}>{item.totalQuestions} questions</Text>
        <Text style={styles.courseScore}>{item.passingScore}% to pass</Text>
      </View>
    </TouchableOpacity>
  );

  const renderCategoryItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.categoryChip,
        selectedCategory === item.id && styles.selectedCategoryChip
      ]}
      onPress={() => setSelectedCategory(selectedCategory === item.id ? null : item.id)}
    >
      <Text style={[
        styles.categoryText,
        selectedCategory === item.id && styles.selectedCategoryText
      ]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading courses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search courses..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      <View style={styles.coursesSection}>
        <Text style={styles.sectionTitle}>
          {selectedCategory 
            ? `${categories.find(c => c.id === selectedCategory)?.name} Courses` 
            : 'All Courses'
          } ({filteredCourses.length})
        </Text>
        <FlatList
          data={filteredCourses}
          renderItem={renderCourseItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.coursesList}
          showsVerticalScrollIndicator={false}
        />
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: APP_CONFIG.SECONDARY_COLOR,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoriesSection: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  categoriesList: {
    paddingHorizontal: 16,
  },
  categoryChip: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedCategoryChip: {
    backgroundColor: APP_CONFIG.ACCENT_COLOR,
    borderColor: APP_CONFIG.ACCENT_COLOR,
  },
  categoryText: {
    color: APP_CONFIG.SECONDARY_COLOR,
    fontSize: 14,
    fontWeight: '500',
  },
  selectedCategoryText: {
    color: APP_CONFIG.PRIMARY_COLOR,
    fontWeight: 'bold',
  },
  coursesSection: {
    flex: 1,
    paddingBottom: 16,
  },
  coursesList: {
    paddingHorizontal: 16,
  },
  courseCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_CONFIG.SECONDARY_COLOR,
    flex: 1,
    marginRight: 8,
  },
  coursePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_CONFIG.ACCENT_COLOR,
  },
  courseDescription: {
    fontSize: 14,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.8,
    lineHeight: 20,
    marginBottom: 12,
  },
  courseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  courseDuration: {
    fontSize: 12,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.6,
  },
  courseQuestions: {
    fontSize: 12,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.6,
  },
  courseScore: {
    fontSize: 12,
    color: APP_CONFIG.SECONDARY_COLOR,
    opacity: 0.6,
  },
});

export default CoursesScreen;