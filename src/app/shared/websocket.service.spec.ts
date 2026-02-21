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
});
