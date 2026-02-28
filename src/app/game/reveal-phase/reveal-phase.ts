import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BoardSlot } from '../../shared/game-state.service';
import { BoardComponent } from '../board/board';

@Component({
  selector: 'app-reveal-phase',
  imports: [BoardComponent],
  templateUrl: './reveal-phase.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevealPhaseComponent {
  readonly playerName = input.required<string>();
  readonly partnerName = input.required<string>();
  readonly playerNumber = input.required<number>();
  readonly board = input.required<BoardSlot[]>();
  readonly revealedCount = input.required<number>();
  readonly totalRevealCards = input.required<number>();
  readonly swapHistory = input.required<{slotA: number, slotB: number, byPlayer: number}[]>();
}
