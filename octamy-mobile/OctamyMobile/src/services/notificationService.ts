import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;

  async initialize() {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    // Get push token
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      this.expoPushToken = token.data;
      console.log('Expo Push Token:', this.expoPushToken);
    } catch (error) {
      console.error('Error getting push token:', error);
    }

    // Configure channels for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      await Notifications.setNotificationChannelAsync('exam-reminders', {
        name: 'Exam Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      await Notifications.setNotificationChannelAsync('certificates', {
        name: 'Certificates',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }

  getExpoPushToken() {
    return this.expoPushToken;
  }

  async scheduleExamReminder(courseTitle: string, examTime: Date) {
    const trigger = new Date(examTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours before

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Exam Reminder',
        body: `Don't forget! Your ${courseTitle} exam is tomorrow.`,
        data: { type: 'exam-reminder', courseTitle },
        sound: true,
      },
      trigger,
    });
  }

  async sendCertificateNotification(courseName: string, score: number) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Certificate Available!',
        body: `Congratulations! Your ${courseName} certificate is ready. Score: ${score}%`,
        data: { type: 'certificate', courseName, score },
        sound: true,
      },
      trigger: { seconds: 1 },
    });
  }

  async sendLocalNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: { seconds: 1 },
    });
  }

  addNotificationListener(listener: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(listener);
  }

  addNotificationResponseListener(listener: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }
}

export const notificationService = new NotificationService();