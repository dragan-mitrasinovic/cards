import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, Observable } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { GameComponent } from './game';
import { WebSocketService } from '../shared/websocket.service';
import { GameStateService } from '../shared/game-state.service';
import { ServerMessage } from '../shared/messages';

describe('GameComponent', () => {
  let mockWs: {
    connect: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    setReconnectCredentials: ReturnType<typeof vi.fn>;
    clearReconnectCredentials: ReturnType<typeof vi.fn>;
    getStoredCredentials: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof signal<string>>;
    messages$: Observable<ServerMessage>;
  };
  let messagesSubject: Subject<ServerMessage>;

  beforeEach(async () => {
    messagesSubject = new Subject<ServerMessage>();
    mockWs = {
      connect: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
      setReconnectCredentials: vi.fn(),
      clearReconnectCredentials: vi.fn(),
      getStoredCredentials: vi.fn().mockReturnValue(null),
      status: signal<string>('disconnected'),
      messages$: messagesSubject.asObservable(),
    };

    await TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(new Map([['id', 'ABC123']])),
          },
        },
        { provide: WebSocketService, useValue: mockWs },
        GameStateService,
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(GameComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show join form when not connected', async () => {
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#join-name')).toBeTruthy();
  });

  it('should show connection status dot', async () => {
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const dot = fixture.nativeElement.querySelector('.capitalize') as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.textContent?.trim()).toBe('disconnected');
  });

  it('should show partner name on player_joined', async () => {
    const fixture = TestBed.createComponent(GameComponent);
    const gameState = TestBed.inject(GameStateService);
    gameState.roomCode.set('ABC123');
    fixture.detectChanges();

    messagesSubject.next({
      type: 'player_joined',
      playerName: 'Alice',
      playerNumber: 1,
      partnerName: 'Bob',
    });

    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Bob');
  });

  it('should auto-reconnect when stored credentials match room code', async () => {
    mockWs.getStoredCredentials.mockReturnValue({ playerName: 'Alice', roomCode: 'ABC123' });
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockWs.connect).toHaveBeenCalledWith('/ws');
    expect(fixture.componentInstance.attemptingReconnect()).toBe(true);
    expect(fixture.componentInstance.needsJoin()).toBe(false);
  });

  it('should show reconnecting UI during auto-reconnect', async () => {
    mockWs.getStoredCredentials.mockReturnValue({ playerName: 'Alice', roomCode: 'ABC123' });
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Reconnecting');
  });

  it('should show join form when stored credentials have wrong room code', async () => {
    mockWs.getStoredCredentials.mockReturnValue({ playerName: 'Alice', roomCode: 'WRONG' });
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockWs.connect).not.toHaveBeenCalled();
    expect(fixture.componentInstance.needsJoin()).toBe(true);
  });

  it('should fall back to join form when reconnect fails', async () => {
    mockWs.getStoredCredentials.mockReturnValue({ playerName: 'Alice', roomCode: 'ABC123' });
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();

    messagesSubject.next({
      type: 'error',
      message: 'reconnection failed — no matching disconnected player',
    });

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.attemptingReconnect()).toBe(false);
    expect(fixture.componentInstance.needsJoin()).toBe(true);
    expect(mockWs.clearReconnectCredentials).toHaveBeenCalled();
  });
});
