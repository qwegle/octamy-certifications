import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { APP_CONFIG } from './src/constants/api';
import { notificationService } from './src/services/notificationService';
import { offlineService } from './src/services/offlineService';

export default function App() {
  useEffect(() => {
    // Initialize services
    const initializeServices = async () => {
      try {
        await notificationService.initialize();
        await offlineService.initialize();
        console.log('Services initialized successfully');
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    };

    initializeServices();
  }, []);

  return (
    <Provider store={store}>
      <StatusBar style="light" backgroundColor={APP_CONFIG.PRIMARY_COLOR} />
      <AppNavigator />
    </Provider>
  );
}
