import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { GameStateService } from '../../shared/game-state.service';
import { CardComponent } from '../card/card';

@Component({
  selector: 'app-hand',
  imports: [CardComponent],
  templateUrl: './hand.html',
  styleUrl: './hand.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandComponent {
  readonly gameState = inject(GameStateService);

  /** Index of the currently selected card, or -1 if none. */
  readonly selectedIndex = input(-1);

  /** Emitted when a card is clicked. */
  readonly cardSelected = output<number>();

  readonly hand = computed(() => this.gameState.hand());
  readonly handUsed = computed(() => this.gameState.handUsed());
  readonly isMyTurn = computed(() => this.gameState.isMyTurn());

  onCardClick(index: number): void {
    if (this.handUsed()[index]) return;
    this.cardSelected.emit(index);
  }
}
