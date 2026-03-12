/**
 * OpenClaw Gateway WebSocket client.
 * Implements the v3 protocol: challenge → sign → connect → chat.
 */
import { encodeBase64 } from 'tweetnacl-util';
import { getOrCreateKeypair, getDeviceId, signDevicePayload } from './crypto';
import { saveDeviceToken, getDeviceToken, getGatewayAuthToken } from './storage';
import { notifyNewMessage } from './notifications';

// Generate a UUID v4
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sessionKey: string;
  timestamp: number;
}

export interface GatewaySession {
  key: string;
  label?: string;
}

type MessageHandler = (msg: ChatMessage) => void;
type StateHandler = (state: ConnectionState, error?: string) => void;
type SessionListHandler = (sessions: GatewaySession[]) => void;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private pendingRequests: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();
  private messageHandlers: MessageHandler[] = [];
  private stateHandlers: StateHandler[] = [];
  private sessionListHandlers: SessionListHandler[] = [];
  private currentState: ConnectionState = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 3000;
  private maxReconnectDelay = 30000;
  private isAppActive = true;
  private subscribedSessions: Set<string> = new Set();

  /** Connect to the gateway */
  async connect(url: string): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.url = url;
    this.setState('connecting');
    this.reconnectDelay = 3000; // Reset backoff

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = url.replace(/^http/, 'ws').replace(/^https/, 'wss');
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        this.setState('error', String(e));
        reject(e);
        return;
      }

      let connectResolve = resolve;
      let connectReject = reject;

      this.ws.onopen = () => {
        console.log('[Gateway] WebSocket opened');
        // Wait for challenge before resolving
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data as string);
          await this.handleMessage(data);

          // Resolve the connect promise once we're authenticated
          if (data.type === 'res' && data.ok && data.payload?.type === 'hello-ok') {
            this.setState('connected');
            connectResolve?.();
            connectResolve = () => {};
            connectReject = () => {};
          } else if (data.type === 'res' && !data.ok && data.payload?.method === 'connect') {
            const err = new Error(data.payload?.message ?? 'Connection rejected');
            this.setState('error', err.message);
            connectReject?.(err);
            connectResolve = () => {};
            connectReject = () => {};
          }
        } catch (e) {
          console.error('[Gateway] Failed to parse message:', e);
        }
      };

      this.ws.onerror = (e) => {
        console.error('[Gateway] WebSocket error:', e);
        this.setState('error', 'WebSocket error');
        connectReject?.(new Error('WebSocket error'));
        connectResolve = () => {};
        connectReject = () => {};
      };

      this.ws.onclose = (e) => {
        console.log(`[Gateway] WebSocket closed: ${e.code} ${e.reason}`);
        this.setState('disconnected');
        this.scheduleReconnect();
      };

      // Timeout if no response in 15s
      setTimeout(() => {
        if (this.currentState === 'connecting') {
          this.setState('error', 'Connection timeout');
          connectReject?.(new Error('Connection timeout'));
          connectResolve = () => {};
          connectReject = () => {};
        }
      }, 15000);
    });
  }

  /** Disconnect cleanly */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isAppActive = false;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  /** Send a chat message */
  async sendMessage(text: string, sessionKey: string): Promise<void> {
    await this.request('chat.send', { sessionKey, text });
  }

  /** Subscribe to a session's chat feed */
  async subscribeSession(sessionKey: string): Promise<void> {
    if (this.subscribedSessions.has(sessionKey)) return;
    await this.request('chat.subscribe', { sessionKey });
    this.subscribedSessions.add(sessionKey);
  }

  /** Fetch chat history */
  async fetchHistory(sessionKey: string, limit = 50): Promise<ChatMessage[]> {
    const result = await this.request('chat.history', { sessionKey, limit }) as { messages?: unknown[] };
    const raw = result?.messages ?? [];
    return (raw as Array<{ id?: string; role?: string; content?: string; sessionKey?: string; timestamp?: number; ts?: number }>).map((m) => ({
      id: m.id ?? uuidv4(),
      role: (m.role as ChatMessage['role']) ?? 'assistant',
      content: m.content ?? '',
      sessionKey: m.sessionKey ?? sessionKey,
      timestamp: m.timestamp ?? m.ts ?? Date.now(),
    }));
  }

  /** List available sessions */
  async listSessions(): Promise<GatewaySession[]> {
    const result = await this.request('session.list', {}) as { sessions?: unknown[] };
    return (result?.sessions as GatewaySession[]) ?? [];
  }

  /** Send a raw request and await the response */
  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const id = uuidv4();
      this.pendingRequests.set(id, { resolve, reject });

      const msg = { type: 'req', id, method, params };
      this.ws.send(JSON.stringify(msg));

      // Timeout after 10s
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timed out: ${method}`));
        }
      }, 10000);
    });
  }

  /** Handle incoming WebSocket messages */
  private async handleMessage(data: Record<string, unknown>): Promise<void> {
    if (data.type === 'event') {
      const event = data.event as string;

      if (event === 'connect.challenge') {
        // Respond to challenge with auth
        await this.handleChallenge(data.payload as { nonce: string; ts: number });
      } else if (event === 'chat') {
        const payload = data.payload as { role?: string; content?: string; sessionKey?: string; id?: string; timestamp?: number; ts?: number };
        const msg: ChatMessage = {
          id: payload.id ?? uuidv4(),
          role: (payload.role as ChatMessage['role']) ?? 'assistant',
          content: payload.content ?? '',
          sessionKey: payload.sessionKey ?? 'main',
          timestamp: payload.timestamp ?? payload.ts ?? Date.now(),
        };
        this.messageHandlers.forEach((h) => h(msg));

        // Notify if app is backgrounded
        if (!this.isAppActive && msg.role === 'assistant') {
          await notifyNewMessage(msg.role, msg.content);
        }
      }
    } else if (data.type === 'res') {
      const id = data.id as string;
      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        if (data.ok) {
          pending.resolve(data.payload);
        } else {
          pending.reject(new Error((data.payload as { message?: string })?.message ?? 'Request failed'));
        }
      }

      // Handle hello-ok: save device token
      if (data.ok && (data.payload as { type?: string })?.type === 'hello-ok') {
        const auth = (data.payload as { auth?: { deviceToken?: string } })?.auth;
        if (auth?.deviceToken) {
          await saveDeviceToken(auth.deviceToken);
        }
      }
    }
  }

  /** Handle the connect.challenge and send the auth request */
  private async handleChallenge(challenge: { nonce: string; ts: number }): Promise<void> {
    try {
      const keypair = await getOrCreateKeypair();
      const deviceId = await getDeviceId(keypair);
      const publicKeyB64 = encodeBase64(keypair.publicKey);
      const deviceToken = await getDeviceToken();
      const gatewayAuthToken = await getGatewayAuthToken();
      const signedAt = Date.now();

      const signature = signDevicePayload({
        deviceId,
        publicKey: publicKeyB64,
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        token: deviceToken ?? '',
        nonce: challenge.nonce,
        platform: 'ios',
        deviceFamily: 'mobile',
        signedAt,
      }, keypair.secretKey);

      const connectReq = {
        type: 'req',
        id: uuidv4(),
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'milo-companion',
            version: '1.0.0',
            platform: 'ios',
            mode: 'operator',
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write'],
          caps: [],
          commands: [],
          permissions: {},
          auth: { token: gatewayAuthToken || deviceToken || '' },
          locale: 'en-US',
          userAgent: 'milo-companion/1.0.0',
          device: {
            id: deviceId,
            publicKey: publicKeyB64,
            signature,
            signedAt,
            nonce: challenge.nonce,
          },
        },
      };

      // Register the pending request manually since we construct the ID ourselves
      const reqId = (connectReq as { id: string }).id;
      const pendingPromise = new Promise<void>((resolve, reject) => {
        this.pendingRequests.set(reqId, {
          resolve: resolve as (v: unknown) => void,
          reject,
        });
      });

      this.ws?.send(JSON.stringify(connectReq));
      // pendingPromise is awaited implicitly via onmessage handler
      void pendingPromise;
    } catch (e) {
      console.error('[Gateway] Auth error:', e);
      this.setState('error', `Auth failed: ${String(e)}`);
    }
  }

  /** Schedule auto-reconnect with exponential backoff */
  private scheduleReconnect(): void {
    if (!this.isAppActive || !this.url) return;

    this.reconnectTimer = setTimeout(async () => {
      console.log(`[Gateway] Reconnecting to ${this.url}...`);
      try {
        await this.connect(this.url);
        // Re-subscribe to sessions
        for (const sessionKey of this.subscribedSessions) {
          await this.subscribeSession(sessionKey);
        }
      } catch (e) {
        console.log('[Gateway] Reconnect failed:', e);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);
  }

  private setState(state: ConnectionState, error?: string): void {
    this.currentState = state;
    this.stateHandlers.forEach((h) => h(state, error));
  }

  getState(): ConnectionState {
    return this.currentState;
  }

  setAppActive(active: boolean): void {
    this.isAppActive = active;
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.push(handler);
    return () => {
      this.stateHandlers = this.stateHandlers.filter((h) => h !== handler);
    };
  }

  onSessionList(handler: SessionListHandler): () => void {
    this.sessionListHandlers.push(handler);
    return () => {
      this.sessionListHandlers = this.sessionListHandlers.filter((h) => h !== handler);
    };
  }
}

// Singleton instance
export const gateway = new GatewayClient();
