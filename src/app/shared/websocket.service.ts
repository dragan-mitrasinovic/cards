import { Injectable, signal, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { ClientMessage, ServerMessage } from './messages';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

const INITIAL_RECONNECT_DELAY = 500;
const MAX_RECONNECT_DELAY = 5000;
const HEARTBEAT_INTERVAL = 30_000;

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  readonly status = signal<ConnectionStatus>('disconnected');
  private socket: WebSocket | null = null;
  private messagesSubject = new Subject<ServerMessage>();
  readonly messages$: Observable<ServerMessage> = this.messagesSubject.asObservable();

  private reconnectDelay = INITIAL_RECONNECT_DELAY;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private url: string | null = null;
  private intentionalClose = false;
  private pendingMessages: ClientMessage[] = [];

  /** Stored credentials for reconnection after unexpected disconnect. */
  private reconnectName: string | null = null;
  private reconnectRoomCode: string | null = null;

  connect(path: string): void {
    this.disconnect();
    this.intentionalClose = false;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${location.host}${path}`;
    this.openConnection();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();
    this.pendingMessages = [];
    this.reconnectName = null;
    this.reconnectRoomCode = null;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.status.set('disconnected');
  }

  /** Store credentials so the service can auto-reconnect to the same room. */
  setReconnectCredentials(name: string, roomCode: string): void {
    this.reconnectName = name;
    this.reconnectRoomCode = roomCode;
  }

  send(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      this.pendingMessages.push(message);
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messagesSubject.complete();
  }

  private openConnection(): void {
    if (!this.url) return;

    this.status.set('connecting');
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      this.status.set('connected');
      this.reconnectDelay = INITIAL_RECONNECT_DELAY;
      this.startHeartbeat();

      // If we have stored credentials, send a reconnect message
      if (this.reconnectName && this.reconnectRoomCode) {
        this.send({ type: 'reconnect', name: this.reconnectName, roomCode: this.reconnectRoomCode });
      }

      this.flushPending();
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        this.messagesSubject.next(message);
      } catch {
        console.error('Failed to parse WebSocket message:', event.data);
      }
    };

    this.socket.onclose = () => {
      this.status.set('disconnected');
      this.stopHeartbeat();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.openConnection();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
    }, this.reconnectDelay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'echo', payload: 'ping' });
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private flushPending(): void {
    for (const msg of this.pendingMessages) {
      this.send(msg);
    }
    this.pendingMessages = [];
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectDelay = INITIAL_RECONNECT_DELAY;
  }
}
