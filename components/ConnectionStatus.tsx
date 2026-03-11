/**
 * Persistent connection status indicator.
 * Shows colored dot + label for the current gateway connection state.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ConnectionState } from '../lib/gateway';

interface Props {
  state: ConnectionState;
  onReconnect?: () => void;
}

const STATE_CONFIG: Record<ConnectionState, { color: string; label: string }> = {
  connected: { color: '#22c55e', label: 'Connected' },
  connecting: { color: '#f59e0b', label: 'Connecting…' },
  disconnected: { color: '#6b7280', label: 'Disconnected' },
  error: { color: '#ef4444', label: 'Error' },
};

export function ConnectionStatus({ state, onReconnect }: Props) {
  const config = STATE_CONFIG[state];

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={styles.label}>{config.label}</Text>
      {(state === 'disconnected' || state === 'error') && onReconnect && (
        <TouchableOpacity onPress={onReconnect} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: '#d1d5db',
    fontSize: 12,
    fontWeight: '500',
  },
  retryBtn: {
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#374151',
    borderRadius: 10,
  },
  retryText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '600',
  },
});
