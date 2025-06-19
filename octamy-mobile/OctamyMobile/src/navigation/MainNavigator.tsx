import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { TabParamList, RootStackParamList } from '../types';
import { APP_CONFIG } from '../constants/api';

// Tab Screens
import HomeScreen from '../screens/main/HomeScreen';
import CoursesScreen from '../screens/main/CoursesScreen';
import CertificatesScreen from '../screens/main/CertificatesScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

// Additional screens
import CourseDetailScreen from '../screens/course/CourseDetailScreen';
import ExamScreen from '../screens/exam/ExamScreen';
import ExamResultScreen from '../screens/exam/ExamResultScreen';
import CertificateViewScreen from '../screens/certificate/CertificateViewScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Courses') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Certificates') {
            iconName = focused ? 'medal' : 'medal-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: APP_CONFIG.ACCENT_COLOR,
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: APP_CONFIG.PRIMARY_COLOR,
          borderTopColor: '#333',
        },
        headerStyle: {
          backgroundColor: APP_CONFIG.PRIMARY_COLOR,
        },
        headerTintColor: APP_CONFIG.SECONDARY_COLOR,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Courses" component={CoursesScreen} />
      <Tab.Screen name="Certificates" component={CertificatesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CourseDetailScreen"
        component={CourseDetailScreen}
        options={{
          title: 'Course Details',
          headerStyle: { backgroundColor: APP_CONFIG.PRIMARY_COLOR },
          headerTintColor: APP_CONFIG.SECONDARY_COLOR,
        }}
      />
      <Stack.Screen
        name="ExamScreen"
        component={ExamScreen}
        options={{
          title: 'Exam',
          headerStyle: { backgroundColor: APP_CONFIG.PRIMARY_COLOR },
          headerTintColor: APP_CONFIG.SECONDARY_COLOR,
          headerLeft: () => null, // Disable back button during exam
        }}
      />
      <Stack.Screen
        name="ExamResultScreen"
        component={ExamResultScreen}
        options={{
          title: 'Exam Results',
          headerStyle: { backgroundColor: APP_CONFIG.PRIMARY_COLOR },
          headerTintColor: APP_CONFIG.SECONDARY_COLOR,
          headerLeft: () => null, // Disable back button on results
        }}
      />
      <Stack.Screen
        name="CertificateViewScreen"
        component={CertificateViewScreen}
        options={{
          title: 'Certificate',
          headerStyle: { backgroundColor: APP_CONFIG.PRIMARY_COLOR },
          headerTintColor: APP_CONFIG.SECONDARY_COLOR,
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;