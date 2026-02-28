import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BoardSlot } from '../../shared/game-state.service';
import { BoardComponent } from '../board/board';

@Component({
  selector: 'app-game-over',
  imports: [BoardComponent],
  templateUrl: './game-over.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameOverComponent {
  readonly partnerName = input.required<string>();
  readonly playerNumber = input.required<number>();
  readonly board = input.required<BoardSlot[]>();
  readonly gameResult = input.required<{ win: boolean } | null>();
  readonly playAgainSent = input.required<boolean>();
  readonly partnerWantsRematch = input.required<boolean>();
  readonly swapHistory = input.required<{slotA: number, slotB: number, byPlayer: number}[]>();

  readonly playAgain = output<void>();
  readonly leaveGame = output<void>();
}
