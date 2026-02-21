import { Injectable, signal } from '@angular/core';

/** GameStateService holds shared game session state across components. */
@Injectable({ providedIn: 'root' })
export class GameStateService {
  readonly playerName = signal('');
  readonly playerNumber = signal(0);
  readonly partnerName = signal('');
  readonly roomCode = signal('');

  reset(): void {
    this.playerName.set('');
    this.playerNumber.set(0);
    this.partnerName.set('');
    this.roomCode.set('');
  }
}
