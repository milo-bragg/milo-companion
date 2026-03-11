/**
 * Push notification stubs — expo-notifications temporarily removed for Xcode 26 compatibility.
 * Will be restored once Expo SDK supports Xcode 26 / iOS 26.
 */

export async function registerForPushNotifications(): Promise<string | null> {
  console.log('[Notifications] Push notifications disabled in this build (Xcode 26 compat)');
  return null;
}

export async function notifyNewMessage(_senderRole: string, _content: string): Promise<void> {
  // no-op
}

export async function clearNotifications(): Promise<void> {
  // no-op
}
