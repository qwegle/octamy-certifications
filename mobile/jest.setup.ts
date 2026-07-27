process.env.EXPO_PUBLIC_API_URL ??= 'https://api.octamy.test';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-camera', () => {
  const grantedPermission = { canAskAgain: true, granted: true, status: 'granted' };
  const pendingPermission = { canAskAgain: true, granted: false, status: 'undetermined' };
  return {
    CameraView: 'CameraView',
    useCameraPermissions: jest.fn(() => [pendingPermission, jest.fn(async () => grantedPermission)]),
    useMicrophonePermissions: jest.fn(() => [pendingPermission, jest.fn(async () => grantedPermission)]),
  };
});

jest.mock('expo-web-browser', () => ({
  dismissBrowser: jest.fn(async () => undefined),
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })),
  openBrowserAsync: jest.fn(async () => ({ type: 'cancel' })),
}));

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(async () => ({ assets: null, canceled: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ assets: null, canceled: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: false })),
}), { virtual: true });
