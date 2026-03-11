/**
 * Main chat screen.
 * Full chat UI with message history, auto-scroll, voice input, session switcher.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGateway } from '../_layout';
import { ChatBubble } from '../../components/ChatBubble';
import { VoiceButton } from '../../components/VoiceButton';
import type { ChatMessage, GatewaySession } from '../../lib/gateway';
import { saveSessionKey } from '../../lib/storage';

let messageIdCounter = 0;
function localId() {
  return `local-${++messageIdCounter}-${Date.now()}`;
}

export default function ChatScreen() {
  const { client, connectionState, sessionKey, setSessionKey } = useGateway();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Load history when connected
  useEffect(() => {
    if (connectionState === 'connected') {
      loadHistory();
      loadSessions();
    }
  }, [connectionState, sessionKey]);

  // Subscribe to incoming messages
  useEffect(() => {
    const unsub = client.onMessage((msg) => {
      if (msg.sessionKey !== sessionKey) return;

      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setIsLoading(false);
      scrollToBottom();
    });

    return unsub;
  }, [client, sessionKey]);

  const loadHistory = async () => {
    setIsFetchingHistory(true);
    try {
      const history = await client.fetchHistory(sessionKey, 50);
      setMessages(history);
      setTimeout(scrollToBottom, 100);
    } catch (e) {
      console.log('[Chat] Failed to load history:', e);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const loadSessions = async () => {
    try {
      const list = await client.listSessions();
      setSessions(list.length > 0 ? list : [{ key: 'main', label: 'Main' }]);
    } catch {
      setSessions([{ key: 'main', label: 'Main' }]);
    }
  };

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || connectionState !== 'connected') return;

    const userMsg: ChatMessage = {
      id: localId(),
      role: 'user',
      content: text,
      sessionKey,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    scrollToBottom();

    try {
      await client.sendMessage(text, sessionKey);
    } catch (e) {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: localId(),
          role: 'system',
          content: `Failed to send: ${String(e)}`,
          sessionKey,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setInputText(text);
  };

  const switchSession = async (key: string) => {
    setShowSessionModal(false);
    if (key === sessionKey) return;

    setSessionKey(key);
    await saveSessionKey(key);
    setMessages([]);

    try {
      await client.subscribeSession(key);
    } catch (e) {
      console.log('[Chat] Failed to subscribe to session:', e);
    }
  };

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <ChatBubble message={item} />
  ), []);

  const isDisabled = connectionState !== 'connected';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Session switcher bar */}
      <View style={styles.sessionBar}>
        <TouchableOpacity
          style={styles.sessionButton}
          onPress={() => setShowSessionModal(true)}
        >
          <Ionicons name="git-branch-outline" size={14} color="#94a3b8" />
          <Text style={styles.sessionButtonText}>
            {sessions.find((s) => s.key === sessionKey)?.label ?? sessionKey}
          </Text>
          <Ionicons name="chevron-down" size={12} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {isFetchingHistory ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#3b82f6" />
            <Text style={styles.loadingText}>Loading messages…</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            onContentSizeChange={scrollToBottom}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🐾</Text>
                <Text style={styles.emptyTitle}>Hey Jason!</Text>
                <Text style={styles.emptySubtitle}>
                  {isDisabled
                    ? 'Connecting to Milo…'
                    : 'Send a message to start chatting with Milo.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Typing indicator */}
        {isLoading && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>🐾 Milo is thinking…</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <VoiceButton
            onTranscript={handleVoiceTranscript}
            disabled={isDisabled}
          />
          <TextInput
            style={[styles.input, isDisabled && styles.inputDisabled]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={isDisabled ? 'Connecting…' : 'Message Milo…'}
            placeholderTextColor="#4b5563"
            multiline
            maxLength={4000}
            returnKeyType="default"
            editable={!isDisabled}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isDisabled) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isDisabled}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() && !isDisabled ? '#ffffff' : '#4b5563'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Session switcher modal */}
      <Modal
        visible={showSessionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSessionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch Session</Text>
              <TouchableOpacity onPress={() => setShowSessionModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {sessions.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.sessionItem,
                    s.key === sessionKey && styles.sessionItemActive,
                  ]}
                  onPress={() => switchSession(s.key)}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={18}
                    color={s.key === sessionKey ? '#3b82f6' : '#94a3b8'}
                  />
                  <Text
                    style={[
                      styles.sessionItemText,
                      s.key === sessionKey && styles.sessionItemTextActive,
                    ]}
                  >
                    {s.label ?? s.key}
                  </Text>
                  {s.key === sessionKey && (
                    <Ionicons name="checkmark" size={18} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  flex: {
    flex: 1,
  },
  sessionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  sessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  sessionButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingVertical: 12,
    paddingBottom: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  typingText: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 16,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#1e293b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sessionItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  sessionItemText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 16,
  },
  sessionItemTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});
