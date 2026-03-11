/**
 * Persistent storage utilities using Expo SecureStore and AsyncStorage.
 */
import * as SecureStore from 'expo-secure-store';

const DEVICE_TOKEN_KEY = 'milo_device_token';
const GATEWAY_URL_KEY = 'milo_gateway_url';
const SESSION_KEY_KEY = 'milo_current_session';

export const DEFAULT_GATEWAY_URL = 'wss://recipients-medicaid-properly-surgeon.trycloudflare.com';
export const DEFAULT_SESSION_KEY = 'main';

/** Persist the device token received after successful auth */
export async function saveDeviceToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token);
}

/** Retrieve the device token */
export async function getDeviceToken(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
}

/** Save the gateway URL */
export async function saveGatewayUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(GATEWAY_URL_KEY, url);
}

/** Retrieve the gateway URL */
export async function getGatewayUrl(): Promise<string> {
  const url = await SecureStore.getItemAsync(GATEWAY_URL_KEY);
  return url ?? DEFAULT_GATEWAY_URL;
}

/** Save the active session key */
export async function saveSessionKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY_KEY, key);
}

/** Retrieve the active session key */
export async function getSessionKey(): Promise<string> {
  const key = await SecureStore.getItemAsync(SESSION_KEY_KEY);
  return key ?? DEFAULT_SESSION_KEY;
}

/** Clear all stored credentials (for reset/logout) */
export async function clearAll(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY),
    SecureStore.deleteItemAsync(GATEWAY_URL_KEY),
    SecureStore.deleteItemAsync(SESSION_KEY_KEY),
  ]);
}
