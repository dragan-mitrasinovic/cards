import { WebSocketService } from './websocket.service';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState: number = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }

  simulateOpen(): void {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateClose(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }
}

describe('WebSocketService', () => {
  let service: WebSocketService;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
    service = new WebSocketService();
  });

  afterEach(() => {
    service.ngOnDestroy();
    globalThis.WebSocket = originalWebSocket;
    sessionStorage.clear();
  });

  it('should start disconnected', () => {
    expect(service.status()).toBe('disconnected');
  });

  it('should set status to connecting on connect', () => {
    service.connect('/ws');
    expect(service.status()).toBe('connecting');
  });

  it('should set status to connected on open', () => {
    service.connect('/ws');
    MockWebSocket.instances[0].simulateOpen();
    expect(service.status()).toBe('connected');
  });

  it('should set status to disconnected on close', () => {
    service.connect('/ws');
    MockWebSocket.instances[0].simulateOpen();
    MockWebSocket.instances[0].simulateClose();
    expect(service.status()).toBe('disconnected');
  });

  it('should send JSON messages', () => {
    service.connect('/ws');
    MockWebSocket.instances[0].simulateOpen();
    service.send({ type: 'echo', payload: 'hello' });
    expect(MockWebSocket.instances[0].sent.length).toBe(1);
    expect(JSON.parse(MockWebSocket.instances[0].sent[0])).toEqual({
      type: 'echo',
      payload: 'hello',
    });
  });

  it('should emit parsed messages on messages$', () => {
    const received: unknown[] = [];
    service.messages$.subscribe((msg) => received.push(msg));

    service.connect('/ws');
    MockWebSocket.instances[0].simulateOpen();
    MockWebSocket.instances[0].simulateMessage({ type: 'echo', payload: 'hi' });

    expect(received.length).toBe(1);
    expect(received[0]).toEqual({ type: 'echo', payload: 'hi' });
  });

  it('should not send when disconnected', () => {
    service.send({ type: 'echo', payload: 'nope' });
    expect(MockWebSocket.instances.length).toBe(0);
  });

  it('should disconnect cleanly', () => {
    service.connect('/ws');
    MockWebSocket.instances[0].simulateOpen();
    service.disconnect();
    expect(service.status()).toBe('disconnected');
  });

  it('should attempt reconnect on unexpected close', async () => {
    service.connect('/ws');
    const first = MockWebSocket.instances[0];
    first.simulateOpen();
    first.simulateClose();

    // Reconnect after delay (500ms initial)
    await new Promise((r) => setTimeout(r, 600));
    expect(MockWebSocket.instances.length).toBe(2);
  });

  it('should not reconnect after intentional disconnect', async () => {
    service.connect('/ws');
    MockWebSocket.instances[0].simulateOpen();
    service.disconnect();

    await new Promise((r) => setTimeout(r, 600));
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it('should save credentials to sessionStorage on setReconnectCredentials', () => {
    service.setReconnectCredentials('Alice', 'ABCD');
    const stored = sessionStorage.getItem('reconnect-credentials');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual({ playerName: 'Alice', roomCode: 'ABCD' });
  });

  it('should return stored credentials from getStoredCredentials', () => {
    sessionStorage.setItem('reconnect-credentials', JSON.stringify({ playerName: 'Bob', roomCode: 'XY12' }));
    const result = service.getStoredCredentials();
    expect(result).toEqual({ playerName: 'Bob', roomCode: 'XY12' });
  });

  it('should return null from getStoredCredentials when nothing stored', () => {
    expect(service.getStoredCredentials()).toBeNull();
  });

  it('should clear sessionStorage on clearReconnectCredentials', () => {
    service.setReconnectCredentials('Alice', 'ABCD');
    service.clearReconnectCredentials();
    expect(sessionStorage.getItem('reconnect-credentials')).toBeNull();
    expect(service.getStoredCredentials()).toBeNull();
  });

  it('should NOT clear sessionStorage on disconnect', () => {
    service.setReconnectCredentials('Alice', 'ABCD');
    service.connect('/ws');
    MockWebSocket.instances[0].simulateOpen();
    service.disconnect();
    expect(sessionStorage.getItem('reconnect-credentials')).toBeTruthy();
  });

  it('should load credentials from sessionStorage on open when not in memory', () => {
    sessionStorage.setItem('reconnect-credentials', JSON.stringify({ playerName: 'Alice', roomCode: 'ABCD' }));
    service.connect('/ws');
    MockWebSocket.instances[0].simulateOpen();
    const sent = MockWebSocket.instances[0].sent;
    expect(sent.length).toBe(1);
    expect(JSON.parse(sent[0])).toEqual({ type: 'reconnect', name: 'Alice', roomCode: 'ABCD' });
  });

  it('should send reconnect with in-memory credentials when available', () => {
    service.setReconnectCredentials('Alice', 'ABCD');
    service.connect('/ws');
    MockWebSocket.instances[0].simulateOpen();
    const sent = MockWebSocket.instances[0].sent;
    expect(sent.length).toBe(1);
    expect(JSON.parse(sent[0])).toEqual({ type: 'reconnect', name: 'Alice', roomCode: 'ABCD' });
  });
});
