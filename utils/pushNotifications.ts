import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Register the device for push notifications and obtain the Expo push token.
 * Handles permission requests and Android channel configuration.
 * Returns the token string or undefined if registration fails.
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  // Push notifications only work on a physical device
  if (!Device.isDevice) {
    console.warn('Push notifications are only supported on physical devices');
    return undefined;
  }

  // Get existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // If not granted, ask for permission
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // If still not granted, exit
  if (finalStatus !== 'granted') {
    console.warn('Failed to get push token permission');
    return undefined;
  }

  // Get the Expo push token
  const response = await Notifications.getExpoPushTokenAsync();
  const token = response.data;

  // Android specific configuration
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}
