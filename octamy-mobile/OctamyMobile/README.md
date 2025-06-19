# Octamy Mobile App

A React Native mobile application for the Octamy Professional Certification Platform.

## Features

- **User Authentication**: Login and registration with JWT tokens
- **Course Management**: Browse and enroll in professional certification courses
- **Exam System**: Take timed exams with offline capabilities
- **Certificate Management**: View, download, and share certificates
- **Payment Integration**: PayUMoney payment gateway integration
- **Push Notifications**: Real-time notifications for exam reminders and updates
- **Offline Support**: Cache courses and certificates for offline viewing

## Technology Stack

- **Framework**: React Native with Expo managed workflow
- **State Management**: Redux Toolkit with RTK Query
- **Navigation**: React Navigation v6
- **UI Components**: React Native Elements
- **Authentication**: JWT tokens with AsyncStorage
- **Push Notifications**: Expo Notifications
- **Offline Storage**: AsyncStorage + SQLite

## Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
│   ├── auth/           # Authentication screens
│   ├── main/           # Main tab screens
│   ├── course/         # Course-related screens
│   ├── exam/           # Exam screens
│   ├── certificate/    # Certificate screens
│   └── payment/        # Payment screens
├── navigation/         # Navigation configuration
├── store/             # Redux store and slices
├── services/          # API services
├── constants/         # App constants and configuration
├── types/             # TypeScript type definitions
├── utils/             # Helper functions
└── hooks/             # Custom React hooks
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure API endpoint in `src/constants/api.ts`:
```typescript
export const API_CONFIG = {
  BASE_URL: 'https://your-web-app-url.replit.app',
  TIMEOUT: 10000,
};
```

3. Start the development server:
```bash
npm start
```

## Development

### Running on Device/Simulator

1. **iOS Simulator**:
   - Press `i` in the terminal or scan QR code with Camera app

2. **Android Emulator**:
   - Press `a` in the terminal or scan QR code with Expo Go app

3. **Physical Device**:
   - Install Expo Go app and scan QR code

### Building for Production

1. **Create build**:
```bash
eas build --platform all
```

2. **Submit to stores**:
```bash
eas submit --platform all
```

## Configuration

### Environment Variables

Create `app.config.js`:
```javascript
export default {
  expo: {
    name: "Octamy",
    slug: "octamy-mobile",
    version: "1.0.0",
    // ... other config
  }
};
```

### Push Notifications

1. Configure push notifications in `app.json`
2. Set up notification handlers in `src/services/notifications.ts`
3. Register device token with backend API

## API Integration

The app integrates with the existing Octamy web platform APIs:

- **Authentication**: `/api/auth/*`
- **Courses**: `/api/courses/*`
- **Exams**: `/api/exam/*`
- **Certificates**: `/api/certificates/*`
- **Payments**: `/api/payment/*`

## Features Implementation Status

### Phase 1: Foundation ✅
- [x] Project setup with Expo
- [x] Redux store configuration
- [x] Navigation structure
- [x] Authentication screens
- [x] API service setup

### Phase 2: Core Features (In Progress)
- [ ] Home screen with dashboard
- [ ] Course listing and details
- [ ] Exam interface
- [ ] Certificate viewing

### Phase 3: Advanced Features (Planned)
- [ ] Payment integration
- [ ] Push notifications
- [ ] Offline capabilities
- [ ] Real-time features

### Phase 4: Enhancement (Planned)
- [ ] Performance optimization
- [ ] Advanced caching
- [ ] Analytics integration
- [ ] App store deployment

## Contributing

1. Follow the existing code structure and naming conventions
2. Use TypeScript for all new files
3. Implement proper error handling
4. Add loading states for async operations
5. Test on both iOS and Android platforms

## Deployment

1. **Development**: Use Expo Go for testing
2. **Staging**: EAS Build for internal distribution
3. **Production**: App Store and Google Play Store via EAS Submit

## Support

For issues and questions:
- Check existing documentation
- Review API integration in web platform
- Contact development team for platform-specific issues