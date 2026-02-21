import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { WebSocketService } from '../../shared/websocket.service';
import { GameStateService, TurnOrderPreference } from '../../shared/game-state.service';

@Component({
  selector: 'app-turn-order-pick',
  templateUrl: './turn-order-pick.html',
  styleUrl: './turn-order-pick.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnOrderPickComponent {
  private ws = inject(WebSocketService);
  readonly gameState = inject(GameStateService);

  readonly picked = signal<TurnOrderPreference | null>(null);
  readonly result = computed(() => this.gameState.turnOrderResult());

  pick(preference: TurnOrderPreference): void {
    if (this.picked()) return;
    this.picked.set(preference);
    this.ws.send({ type: 'turn_order_pick', preference });
  }

  repick(): void {
    this.picked.set(null);
    this.gameState.turnOrderResult.set(null);
  }

  preferenceLabel(pref: string): string {
    switch (pref) {
      case 'first': return 'Go first';
      case 'neutral': return 'No preference';
      case 'no_first': return 'Go second';
      default: return pref;
    }
  }
}
