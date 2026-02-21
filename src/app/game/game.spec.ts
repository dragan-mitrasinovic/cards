import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, Observable } from 'rxjs';
import { signal } from '@angular/core';
import { GameComponent } from './game';
import { WebSocketService } from '../shared/websocket.service';

describe('GameComponent', () => {
  let mockWs: { connect: () => void; send: () => void; disconnect: () => void; status: ReturnType<typeof signal<string>>; messages$: Observable<unknown> };

  beforeEach(async () => {
    mockWs = {
      connect: () => {},
      send: () => {},
      disconnect: () => {},
      status: signal<string>('disconnected'),
      messages$: new Subject().asObservable(),
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
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(GameComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display game id', async () => {
    const fixture = TestBed.createComponent(GameComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.font-mono')?.textContent).toContain('ABC123');
  });

  it('should show connection status dot', async () => {
    const fixture = TestBed.createComponent(GameComponent);
    await fixture.whenStable();
    const dot = fixture.nativeElement.querySelector('span[title]') as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.title).toBe('disconnected');
  });
});
