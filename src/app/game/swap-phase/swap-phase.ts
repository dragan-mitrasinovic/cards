import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { BoardSlot } from '../../shared/game-state.service';
import { BoardComponent } from '../board/board';

@Component({
  selector: 'app-swap-phase',
  imports: [BoardComponent],
  templateUrl: './swap-phase.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwapPhaseComponent {
  readonly playerName = input.required<string>();
  readonly partnerName = input.required<string>();
  readonly playerNumber = input.required<number>();
  readonly isMyTurn = input.required<boolean>();
  readonly swapPending = input.required<boolean>();
  readonly swapSuggester = input.required<number>();
  readonly swapSlots = input<[number, number] | null>(null);
  readonly swapAccepted = input.required<[boolean, boolean]>();
  readonly board = input.required<BoardSlot[]>();
  readonly swapHistory = input.required<{slotA: number, slotB: number, byPlayer: number}[]>();

  readonly respondSwap = output<boolean>();
  readonly skipSwap = output<void>();
  readonly suggestSwap = output<{ slotA: number, slotB: number }>();

  readonly selectedSwapSlots = signal<number[]>([]);

  readonly displaySwapSlots = computed(() =>
    this.swapPending() ? (this.swapSlots() ?? []) : this.selectedSwapSlots()
  );

  readonly boardSwapMode = computed(() =>
    this.isMyTurn() && !this.swapPending() && !this.swapAccepted()[this.playerNumber() - 1]
  );

  onSlotClick(slotIndex: number): void {
    const current = this.selectedSwapSlots();
    if (current.length === 0) {
      this.selectedSwapSlots.set([slotIndex]);
    } else if (current.length === 1) {
      if (current[0] === slotIndex) {
        this.selectedSwapSlots.set([]);
      } else {
        this.suggestSwap.emit({ slotA: current[0], slotB: slotIndex });
        this.selectedSwapSlots.set([]);
      }
    }
  }
}
