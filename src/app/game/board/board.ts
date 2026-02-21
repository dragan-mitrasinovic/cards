import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { GameStateService, BoardSlot } from '../../shared/game-state.service';
import { CardComponent } from '../card/card';

@Component({
  selector: 'app-board',
  imports: [CardComponent],
  templateUrl: './board.html',
  styleUrl: './board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardComponent {
  readonly gameState = inject(GameStateService);

  /** Index of the card selected from the player's hand, or -1 if none. */
  readonly selectedCardIndex = input(-1);

  /** Emitted when a player clicks an empty slot to place a card. */
  readonly slotPlace = output<number>();

  /** Emitted when a player clicks their own card to peek. */
  readonly slotPeek = output<number>();

  readonly board = computed(() => this.gameState.board());
  readonly playerNumber = computed(() => this.gameState.playerNumber());
  readonly isMyTurn = computed(() => this.gameState.isMyTurn());

  onSlotClick(index: number): void {
    const slot = this.board()[index];
    if (!slot.occupied && this.selectedCardIndex() >= 0 && this.isMyTurn()) {
      this.slotPlace.emit(index);
    } else if (slot.occupied && slot.byPlayer === this.playerNumber()) {
      this.slotPeek.emit(index);
    }
  }
}
