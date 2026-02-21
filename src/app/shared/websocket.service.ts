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
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.status.set('disconnected');
  }

  send(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
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

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectDelay = INITIAL_RECONNECT_DELAY;
  }
}
