import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { CardStyleService, CARD_STYLES, CardStyle } from '../card-style.service';

@Component({
  selector: 'app-card-style-picker',
  templateUrl: './card-style-picker.html',
  styleUrl: './card-style-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardStylePickerComponent {
  readonly cardStyleService = inject(CardStyleService);
  readonly closed = output<void>();
  readonly styles = CARD_STYLES;

  select(style: CardStyle): void {
    this.cardStyleService.select(style);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('picker-backdrop')) {
      this.closed.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closed.emit();
    }
  }
}
