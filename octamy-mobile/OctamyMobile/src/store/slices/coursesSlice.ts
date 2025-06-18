import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiService } from '../../services/api';
import { API_ENDPOINTS } from '../../constants/api';
import { Course, Category } from '../../types';

interface CoursesState {
  courses: Course[];
  categories: Category[];
  selectedCourse: Course | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: CoursesState = {
  courses: [],
  categories: [],
  selectedCourse: null,
  isLoading: false,
  error: null,
};

export const fetchCourses = createAsyncThunk(
  'courses/fetchCourses',
  async () => {
    return await apiService.get<Course[]>(API_ENDPOINTS.COURSES);
  }
);

export const fetchCategories = createAsyncThunk(
  'courses/fetchCategories',
  async () => {
    return await apiService.get<Category[]>(API_ENDPOINTS.CATEGORIES);
  }
);

export const fetchCourseDetail = createAsyncThunk(
  'courses/fetchCourseDetail',
  async (courseId: number) => {
    return await apiService.get<Course>(API_ENDPOINTS.COURSE_DETAIL(courseId));
  }
);

const coursesSlice = createSlice({
  name: 'courses',
  initialState,
  reducers: {
    clearSelectedCourse: (state) => {
      state.selectedCourse = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch courses
      .addCase(fetchCourses.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCourses.fulfilled, (state, action) => {
        state.isLoading = false;
        state.courses = action.payload;
      })
      .addCase(fetchCourses.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch courses';
      })
      
      // Fetch categories
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      })
      
      // Fetch course detail
      .addCase(fetchCourseDetail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCourseDetail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedCourse = action.payload;
      })
      .addCase(fetchCourseDetail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch course details';
      });
  },
});

export const { clearSelectedCourse, clearError } = coursesSlice.actions;
export default coursesSlice.reducer;