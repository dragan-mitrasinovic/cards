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

  reset(): void {
    this.playerName.set('');
    this.playerNumber.set(0);
    this.partnerName.set('');
    this.roomCode.set('');
    this.phase.set('lobby');
    this.hand.set([]);
    this.turnOrderResult.set(null);
    this.firstPlayer.set(0);
  }
}
