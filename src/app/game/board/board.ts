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

  /** Whether the board is in swap selection mode. */
  readonly swapMode = input(false);

  /** Whether the board is in reveal mode (cards flip face-up). */
  readonly revealMode = input(false);

  /** Indices of slots selected for swapping. */
  readonly selectedSwapSlots = input<number[]>([]);

  /** Accepted swap history for arrow indicators. */
  readonly swapHistory = input<{slotA: number, slotB: number, byPlayer: number}[]>([]);

  /** Emitted when a player clicks an empty slot to place a card. */
  readonly slotPlace = output<number>();

  /** Emitted when a player clicks their own card to peek. */
  readonly slotPeek = output<number>();

  readonly board = computed(() => this.gameState.board());
  readonly playerNumber = computed(() => this.gameState.playerNumber());
  readonly isMyTurn = computed(() => this.gameState.isMyTurn());

  onSlotClick(index: number): void {
    if (this.swapMode()) {
      const slot = this.board()[index];
      if (slot.occupied) {
        this.slotPlace.emit(index);
      }
      return;
    }
    const slot = this.board()[index];
    if (!slot.occupied && this.selectedCardIndex() >= 0 && this.isMyTurn()) {
      this.slotPlace.emit(index);
    } else if (slot.occupied && slot.byPlayer === this.playerNumber()) {
      this.slotPeek.emit(index);
    }
  }

  isSwapSelected(index: number): boolean {
    return this.selectedSwapSlots().includes(index);
  }

  getSwapArrowPath(slotA: number, slotB: number): string {
    const x1 = 56 + slotA * 88;
    const x2 = 56 + slotB * 88;
    const midX = (x1 + x2) / 2;
    return `M${x1},8 Q${midX},45 ${x2},8`;
  }

  getSwapDotX(slotIndex: number): number {
    return 56 + slotIndex * 88;
  }
}
