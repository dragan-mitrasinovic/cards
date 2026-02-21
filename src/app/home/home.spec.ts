import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HomeComponent } from './home';
import { WebSocketService } from '../shared/websocket.service';

describe('HomeComponent', () => {
  let mockWs: { connect: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockWs = { connect: vi.fn(), send: vi.fn(), disconnect: vi.fn() };

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

  it('should connect to WebSocket and navigate on createGame', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.playerName = 'Alice';
    fixture.componentInstance.createGame();

    expect(mockWs.connect).toHaveBeenCalledWith('/ws');
    expect(router.navigate).toHaveBeenCalledWith(['/game', 'new']);
  });

  it('should connect to WebSocket and navigate on joinGame', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.playerName = 'Bob';
    fixture.componentInstance.roomCode = 'XYZ';
    fixture.componentInstance.joinGame();

    expect(mockWs.connect).toHaveBeenCalledWith('/ws');
    expect(router.navigate).toHaveBeenCalledWith(['/game', 'XYZ']);
  });
});
