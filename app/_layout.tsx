/**
 * Root layout — sets up the gateway connection context and navigation.
 */
import 'react-native-get-random-values';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { AppState, AppStateStatus, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { gateway, GatewayClient, ConnectionState } from '../lib/gateway';
import { getGatewayUrl, getSessionKey } from '../lib/storage';
import { registerForPushNotifications } from '../lib/notifications';

interface GatewayContextValue {
  client: GatewayClient;
  connectionState: ConnectionState;
  connectionError?: string;
  gatewayUrl: string;
  sessionKey: string;
  reconnect: (url?: string) => Promise<void>;
  setSessionKey: (key: string) => void;
}

const GatewayContext = createContext<GatewayContextValue>({
  client: gateway,
  connectionState: 'disconnected',
  gatewayUrl: '',
  sessionKey: 'main',
  reconnect: async () => {},
  setSessionKey: () => {},
});

export function useGateway() {
  return useContext(GatewayContext);
}

export default function RootLayout() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [sessionKey, setSessionKey] = useState('main');

  useEffect(() => {
    // Load saved settings and connect
    const init = async () => {
      const url = await getGatewayUrl();
      const key = await getSessionKey();
      setGatewayUrl(url);
      setSessionKey(key);

      // Register push notifications
      await registerForPushNotifications();

      // Connect to gateway
      try {
        await gateway.connect(url);
        await gateway.subscribeSession(key);
      } catch (e) {
        console.log('[App] Initial connection failed:', e);
      }
    };

    // Listen for connection state changes
    const unsub = gateway.onStateChange((state, error) => {
      setConnectionState(state);
      setConnectionError(error);
    });

    init();

    // Handle app foreground/background
    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      gateway.setAppActive(state === 'active');
    });

    return () => {
      unsub();
      appStateSub.remove();
    };
  }, []);

  const reconnect = async (url?: string) => {
    const targetUrl = url ?? gatewayUrl;
    if (url) setGatewayUrl(url);
    try {
      await gateway.connect(targetUrl);
      await gateway.subscribeSession(sessionKey);
    } catch (e) {
      console.log('[App] Reconnect failed:', e);
    }
  };

  const handleSetSessionKey = (key: string) => {
    setSessionKey(key);
  };

  return (
    <SafeAreaProvider>
      <GatewayContext.Provider
        value={{
          client: gateway,
          connectionState,
          connectionError,
          gatewayUrl,
          sessionKey,
          reconnect,
          setSessionKey: handleSetSessionKey,
        }}
      >
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#f1f5f9',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: '#0a0a0a' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
        </Stack>
      </GatewayContext.Provider>
    </SafeAreaProvider>
  );
}
