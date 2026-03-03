import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CardComponent } from '../card/card';

@Component({
  selector: 'app-partner-hand',
  imports: [CardComponent],
  templateUrl: './partner-hand.html',
  styleUrl: './partner-hand.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerHandComponent {
  readonly partnerName = input.required<string>();
  readonly remainingCards = input.required<number>();

  readonly cardSlots = computed(() =>
    Array.from({ length: this.remainingCards() }, (_, i) => i)
  );
}
