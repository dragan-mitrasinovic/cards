import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { HomeComponent } from './home';
import { WebSocketService } from '../shared/websocket.service';
import { ServerMessage, RoomCreatedMessage, PlayerJoinedMessage } from '../shared/messages';

describe('HomeComponent', () => {
  let mockWs: {
    connect: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    messages$: Subject<ServerMessage>;
  };

  beforeEach(async () => {
    const messagesSubject = new Subject<ServerMessage>();
    mockWs = {
      connect: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
      messages$: messagesSubject,
    };

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: WebSocketService, useValue: mockWs },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Cards');
  });

  it('should disable Create Game when name is empty', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const createBtn = compiled.querySelector('button') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
  });

  it('should connect to WebSocket and send create_room on createGame', () => {
    const fixture = TestBed.createComponent(HomeComponent);

    fixture.componentInstance.playerName = 'Alice';
    fixture.componentInstance.createGame();

    expect(mockWs.connect).toHaveBeenCalledWith('/ws');
    expect(mockWs.send).toHaveBeenCalledWith({ type: 'create_room', name: 'Alice' });
  });

  it('should navigate on room_created response', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.playerName = 'Alice';
    fixture.componentInstance.createGame();

    mockWs.messages$.next({
      type: 'room_created',
      roomCode: 'ABCD',
      playerNumber: 1,
    } as RoomCreatedMessage);

    expect(router.navigate).toHaveBeenCalledWith(['/game', 'ABCD']);
  });

  it('should connect to WebSocket and send join_room on joinGame', () => {
    const fixture = TestBed.createComponent(HomeComponent);

    fixture.componentInstance.playerName = 'Bob';
    fixture.componentInstance.roomCode = 'XYZ';
    fixture.componentInstance.joinGame();

    expect(mockWs.connect).toHaveBeenCalledWith('/ws');
    expect(mockWs.send).toHaveBeenCalledWith({ type: 'join_room', name: 'Bob', roomCode: 'XYZ' });
  });

  it('should navigate on player_joined response', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.playerName = 'Bob';
    fixture.componentInstance.roomCode = 'XYZ';
    fixture.componentInstance.joinGame();

    mockWs.messages$.next({
      type: 'player_joined',
      playerName: 'Bob',
      playerNumber: 2,
      partnerName: 'Alice',
    } as PlayerJoinedMessage);

    expect(router.navigate).toHaveBeenCalledWith(['/game', 'XYZ']);
  });

  it('should show error on error response', () => {
    const fixture = TestBed.createComponent(HomeComponent);

    fixture.componentInstance.playerName = 'Bob';
    fixture.componentInstance.roomCode = 'BAD';
    fixture.componentInstance.joinGame();

    mockWs.messages$.next({ type: 'error', message: 'room not found' });

    expect(fixture.componentInstance.errorMessage()).toBe('room not found');
  });
});
