import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Card, Suit } from '../../shared/messages';
import { CardStyleService } from '../../shared/card-style.service';

@Component({
  selector: 'app-card',
  templateUrl: './card.html',
  styleUrl: './card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  private readonly cardStyleService = inject(CardStyleService);

  readonly card = input<Card>();
  readonly faceUp = input(false);
  readonly selected = input(false);
  readonly ownCard = input(false);
  readonly disabled = input(false);
  readonly revealed = input(false);

  readonly themeClass = computed(() => `card-theme-${this.cardStyleService.style()}`);

  /** Used by HandComponent for card selection. Unused on board (pointer-events-none). */
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
    return suit === 'H' || suit === 'D' ? 'suit-red' : 'suit-black';
  }
}
