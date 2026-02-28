import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Card, Suit } from '../../shared/messages';

@Component({
  selector: 'app-card',
  templateUrl: './card.html',
  styleUrl: './card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly card = input<Card>();
  readonly faceUp = input(false);
  readonly selected = input(false);
  readonly ownCard = input(false);
  readonly disabled = input(false);
  readonly revealed = input(false);

  readonly clicked = output<void>();

  suitSymbol(suit: Suit): string {
    switch (suit) {
      case 'H': return '♥';
      case 'S': return '♠';
      case 'D': return '♦';
      case 'C': return '♣';
    }
  }

  suitColor(suit: Suit): string {
    return suit === 'H' || suit === 'D' ? 'red' : 'black';
  }
}
