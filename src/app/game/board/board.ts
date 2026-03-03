import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { BoardSlot } from '../../shared/game-state.service';
import { CardComponent } from '../card/card';

@Component({
  selector: 'app-board',
  imports: [CardComponent, CdkDropList],
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

  /** Whether drag-and-drop is enabled. */
  readonly dragEnabled = input(false);

  /** Indices of slots selected for swapping. */
  readonly selectedSwapSlots = input<number[]>([]);

  /** Accepted swap history for arrow indicators. */
  readonly swapHistory = input<{slotA: number, slotB: number, byPlayer: number}[]>([]);

  /** Emitted when a player clicks an empty slot to place a card. */
  readonly slotPlace = output<number>();

  /** Emitted when a player clicks their own card to peek. */
  readonly slotPeek = output<number>();

  /** Emitted when a card is dropped on a slot via drag and drop. */
  readonly cardDropped = output<{ cardIndex: number, slotIndex: number }>();

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

  onDrop(event: CdkDragDrop<number>, slotIndex: number): void {
    const cardIndex = event.item.data as number;
    const slot = this.board()[slotIndex];

    if (!slot.occupied && this.isMyTurn() && !this.swapMode()) {
      this.cardDropped.emit({ cardIndex, slotIndex });
    }
  }

  canDrop = (slotIndex: number) => {
    return (): boolean => {
      const slot = this.board()[slotIndex];
      return !slot.occupied && this.isMyTurn() && !this.swapMode();
    };
  };

  isSwapSelected(index: number): boolean {
    return this.selectedSwapSlots().includes(index);
  }

  /** Returns swap info for a given slot, or null if the slot is not part of any accepted swap. */
  getSlotSwapInfo(index: number): { byPlayer: number } | null {
    for (const swap of this.swapHistory()) {
      if (swap.slotA === index || swap.slotB === index) {
        return { byPlayer: swap.byPlayer };
      }
    }

    return null;
  }

  isSlotSwappedByMe(index: number): boolean {
    const info = this.getSlotSwapInfo(index);
    return info !== null && info.byPlayer === this.playerNumber();
  }

  isSlotSwappedByPartner(index: number): boolean {
    const info = this.getSlotSwapInfo(index);
    return info !== null && info.byPlayer !== this.playerNumber();
  }
}
