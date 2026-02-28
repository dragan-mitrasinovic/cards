import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BoardSlot } from '../../shared/game-state.service';
import { CardComponent } from '../card/card';

@Component({
  selector: 'app-board',
  imports: [CardComponent],
  templateUrl: './board.html',
  styleUrl: './board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardComponent {
  readonly board = input.required<BoardSlot[]>();
  readonly playerNumber = input.required<number>();
  readonly isMyTurn = input(false);

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

  /** Card width used for SVG arrow calculations. */
  private readonly cardWidth = 80;
  private readonly boardGap = 8;

  getSwapArrowPath(slotA: number, slotB: number): string {
    const halfCard = this.cardWidth / 2;
    const step = this.cardWidth + this.boardGap;
    const x1 = 16 + halfCard + slotA * step;
    const x2 = 16 + halfCard + slotB * step;
    const midX = (x1 + x2) / 2;
    return `M${x1},8 Q${midX},45 ${x2},8`;
  }

  getSwapDotX(slotIndex: number): number {
    const halfCard = this.cardWidth / 2;
    const step = this.cardWidth + this.boardGap;
    return 16 + halfCard + slotIndex * step;
  }

  readonly svgViewBox = `0 0 ${15 * 80 + 14 * 8 + 2 * 16} 50`;
}
