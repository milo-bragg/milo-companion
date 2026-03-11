/**
 * Push notification utilities using Expo Notifications.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are displayed when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Request notification permissions and return the Expo push token */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (e) {
    console.log('Could not get push token:', e);
    return null;
  }
}

/** Send a local notification for a new chat message */
export async function notifyNewMessage(senderRole: string, content: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: senderRole === 'assistant' ? '🐾 Milo' : 'New Message',
      body: content.length > 100 ? content.substring(0, 97) + '...' : content,
      sound: true,
    },
    trigger: null, // Send immediately
  });
}

/** Clear all pending notifications */
export async function clearNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
}
