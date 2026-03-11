/**
 * Tab navigator layout.
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { ConnectionStatus } from '../../components/ConnectionStatus';
import { useGateway } from '../_layout';

export default function TabLayout() {
  const { connectionState, reconnect } = useGateway();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f1f5f9',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerRight: () => (
          <View style={{ marginRight: 12 }}>
            <ConnectionStatus
              state={connectionState}
              onReconnect={reconnect}
            />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Milo',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
