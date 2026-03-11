/**
 * Settings screen.
 * Configure gateway URL, view connection status, manage device identity.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGateway } from '../_layout';
import { ConnectionStatus } from '../../components/ConnectionStatus';
import { saveGatewayUrl, clearAll, getGatewayUrl } from '../../lib/storage';
import { getOrCreateKeypair, getDeviceId } from '../../lib/crypto';
import { encodeBase64 } from 'tweetnacl-util';

export default function SettingsScreen() {
  const { connectionState, connectionError, gatewayUrl, reconnect } = useGateway();
  const [urlInput, setUrlInput] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    setUrlInput(gatewayUrl);
    loadDeviceInfo();
  }, [gatewayUrl]);

  const loadDeviceInfo = async () => {
    try {
      const keypair = await getOrCreateKeypair();
      const id = await getDeviceId(keypair);
      setDeviceId(id);
      setPublicKey(encodeBase64(keypair.publicKey));
    } catch (e) {
      console.log('Failed to load device info:', e);
    }
  };

  const handleSaveUrl = async () => {
    const url = urlInput.trim();
    if (!url) {
      Alert.alert('Invalid URL', 'Please enter a valid gateway URL.');
      return;
    }

    setIsSaving(true);
    try {
      await saveGatewayUrl(url);
      await reconnect(url);
    } catch (e) {
      Alert.alert('Connection Failed', `Could not connect to ${url}.\n\n${String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Device Identity',
      'This will clear your device credentials and require re-pairing with the gateway. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await clearAll();
            Alert.alert('Done', 'Device identity cleared. Restart the app to re-pair.');
          },
        },
      ]
    );
  };

  const truncate = (s: string, n = 20) =>
    s.length > n ? `${s.substring(0, n)}…` : s;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Connection Section */}
        <Text style={styles.sectionHeader}>Gateway Connection</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Status</Text>
            <ConnectionStatus state={connectionState} onReconnect={() => reconnect()} />
          </View>
          {connectionError && (
            <View style={styles.cardRow}>
              <Text style={styles.label}>Error</Text>
              <Text style={styles.errorText}>{connectionError}</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionHeader}>Gateway URL</Text>
        <View style={styles.card}>
          <Text style={styles.helperText}>
            Enter the Cloudflare Tunnel URL (*.trycloudflare.com) or LAN address.
            The URL changes on restart — update it here when it does.
          </Text>
          <TextInput
            style={styles.urlInput}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="wss://xxxx.trycloudflare.com"
            placeholderTextColor="#4b5563"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
            onPress={handleSaveUrl}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="link" size={16} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Save & Connect</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Quick LAN connect */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setUrlInput('ws://localhost:18789');
            }}
          >
            <Ionicons name="home-outline" size={14} color="#3b82f6" />
            <Text style={styles.secondaryButtonText}>Use Local (LAN)</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <Text style={styles.sectionHeader}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Push Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#1e293b', true: '#3b82f6' }}
              thumbColor="#ffffff"
            />
          </View>
          <Text style={styles.helperText}>
            Receive notifications when Milo responds while the app is in the background.
          </Text>
        </View>

        {/* Device Identity */}
        <Text style={styles.sectionHeader}>Device Identity</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Device ID</Text>
            <Text style={styles.valueText}>{truncate(deviceId)}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Public Key</Text>
            <Text style={styles.valueText}>{truncate(publicKey)}</Text>
          </View>
          <TouchableOpacity style={styles.dangerButton} onPress={handleReset}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={styles.dangerButtonText}>Reset Device Identity</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <Text style={styles.sectionHeader}>About</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.label}>App</Text>
            <Text style={styles.valueText}>Milo Companion</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.valueText}>1.0.0 (MVP)</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Protocol</Text>
            <Text style={styles.valueText}>OpenClaw v3</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Built by</Text>
            <Text style={styles.valueText}>🐾 Milo</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  sectionHeader: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: '#0f172a',
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 10,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    color: '#94a3b8',
    fontSize: 15,
  },
  valueText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  helperText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  urlInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    borderWidth: 1,
    borderColor: '#334155',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  secondaryButtonText: {
    color: '#3b82f6',
    fontSize: 13,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    gap: 8,
    marginTop: 4,
  },
  dangerButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
});


