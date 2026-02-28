import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Card } from '../../shared/messages';
import { CardComponent } from '../card/card';

@Component({
  selector: 'app-hand',
  imports: [CardComponent],
  templateUrl: './hand.html',
  styleUrl: './hand.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandComponent {
  readonly hand = input.required<Card[]>();
  readonly handUsed = input.required<boolean[]>();
  readonly isMyTurn = input(false);

  /** Index of the currently selected card, or -1 if none. */
  readonly selectedIndex = input(-1);

  /** Emitted when a card is clicked. */
  readonly cardSelected = output<number>();

  onCardClick(index: number): void {
    if (this.handUsed()[index]) return;
    this.cardSelected.emit(index);
  }
}
