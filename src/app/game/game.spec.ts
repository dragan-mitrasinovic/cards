import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, Observable } from 'rxjs';
import { signal } from '@angular/core';
import { GameComponent } from './game';
import { WebSocketService } from '../shared/websocket.service';
import { GameStateService } from '../shared/game-state.service';
import { ServerMessage } from '../shared/messages';

describe('GameComponent', () => {
  let mockWs: {
    connect: () => void;
    send: () => void;
    disconnect: () => void;
    status: ReturnType<typeof signal<string>>;
    messages$: Observable<ServerMessage>;
  };
  let messagesSubject: Subject<ServerMessage>;

  beforeEach(async () => {
    messagesSubject = new Subject<ServerMessage>();
    mockWs = {
      connect: () => {},
      send: () => {},
      disconnect: () => {},
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
    const dot = fixture.nativeElement.querySelector('span[title]') as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.title).toBe('disconnected');
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
});
