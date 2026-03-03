import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TurnOrderPreference, TurnOrderResult } from '../../shared/game-state.service';

@Component({
  selector: 'app-turn-order-pick',
  templateUrl: './turn-order-pick.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnOrderPickComponent {
  readonly playerName = input.required<string>();
  readonly partnerName = input.required<string>();
  readonly playerNumber = input.required<number>();
  readonly turnOrderResult = input<TurnOrderResult | null>(null);

  readonly preferenceSelected = output<TurnOrderPreference>();
  readonly repicked = output<void>();

  readonly picked = signal<TurnOrderPreference | null>(null);

  pick(preference: TurnOrderPreference): void {
    if (this.picked()) return;
    this.picked.set(preference);
    this.preferenceSelected.emit(preference);
  }

  repick(): void {
    this.picked.set(null);
    this.repicked.emit();
  }

  preferenceLabel(pref: string): string {
    switch (pref) {
      case 'first': return 'Go first';
      case 'neutral': return 'No preference';
      case 'no_first': return 'Go second';
      default: return pref;
    }
  }
}
