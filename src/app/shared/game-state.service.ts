import { Injectable, signal } from '@angular/core';
import { Card } from './messages';

export type TurnOrderPreference = 'first' | 'neutral' | 'no_first';

/** TurnOrderResult holds the outcome of a turn order pick round. */
export interface TurnOrderResult {
  pick1: string;
  pick2: string;
  conflict: boolean;
  firstPlayer?: number;
}

/** BoardSlot represents a single slot on the board. */
export interface BoardSlot {
  occupied: boolean;
  byPlayer: number; // 0 = empty, 1 or 2
  card?: Card;      // only set after peek or reveal
}

/** GameStateService holds shared game session state across components. */
@Injectable({ providedIn: 'root' })
export class GameStateService {
  readonly playerName = signal('');
  readonly playerNumber = signal(0);
  readonly partnerName = signal('');
  readonly roomCode = signal('');
  readonly phase = signal<string>('lobby');
  readonly hand = signal<Card[]>([]);
  readonly turnOrderResult = signal<TurnOrderResult | null>(null);
  readonly firstPlayer = signal(0);
  readonly currentTurn = signal(0);
  readonly isMyTurn = signal(false);
  readonly board = signal<BoardSlot[]>(this.emptyBoard());
  readonly passUsed = signal<[boolean, boolean]>([false, false]);
  readonly handUsed = signal<boolean[]>(new Array(7).fill(false));

  reset(): void {
    this.playerName.set('');
    this.playerNumber.set(0);
    this.partnerName.set('');
    this.roomCode.set('');
    this.phase.set('lobby');
    this.hand.set([]);
    this.turnOrderResult.set(null);
    this.firstPlayer.set(0);
    this.currentTurn.set(0);
    this.isMyTurn.set(false);
    this.board.set(this.emptyBoard());
    this.passUsed.set([false, false]);
    this.handUsed.set(new Array(7).fill(false));
  }

  private emptyBoard(): BoardSlot[] {
    return Array.from({ length: 15 }, () => ({ occupied: false, byPlayer: 0 }));
  }
}
