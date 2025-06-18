import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { APP_CONFIG } from './src/constants/api';

export default function App() {
  return (
    <Provider store={store}>
      <StatusBar style="light" backgroundColor={APP_CONFIG.PRIMARY_COLOR} />
      <AppNavigator />
    </Provider>
  );
}
