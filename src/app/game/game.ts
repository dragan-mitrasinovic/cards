import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { WebSocketService } from '../shared/websocket.service';
import { GameStateService } from '../shared/game-state.service';
import { PlayerJoinedMessage, PlayerDisconnectedMessage, ErrorMessage, TurnOrderResultMessage, GameStartMessage, CardPlacedMessage, PlayerPassedMessage, PeekResultMessage, SwapPromptMessage, SwapSuggestedMessage, SwapResultMessage, RevealCardMessage } from '../shared/messages';
import { TurnOrderPickComponent } from './turn-order-pick/turn-order-pick';
import { BoardComponent } from './board/board';
import { HandComponent } from './hand/hand';

@Component({
  selector: 'app-game',
  imports: [FormsModule, TurnOrderPickComponent, BoardComponent, HandComponent],
  templateUrl: './game.html',
  styleUrl: './game.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private params = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))));
  readonly roomId = computed(() => this.params() ?? '');

  readonly ws = inject(WebSocketService);
  readonly gameState = inject(GameStateService);

  /** True when the user arrived via shareable link and needs to enter a name. */
  readonly needsJoin = signal(false);
  readonly joinError = signal('');
  readonly partnerDisconnected = signal(false);
  readonly selectedCardIndex = signal(-1);
  readonly selectedSwapSlots = signal<number[]>([]);
  joinName = '';

  private messagesSub?: Subscription;
  private revealTimeouts: ReturnType<typeof setTimeout>[] = [];

  readonly shareableLink = computed(() => {
    const code = this.gameState.roomCode() || this.roomId();
    return code ? `${location.origin}/game/${code}` : '';
  });

  ngOnInit(): void {
    // If arriving via shareable link without an active room, prompt to join
    if (this.ws.status() === 'disconnected' || !this.gameState.roomCode()) {
      this.needsJoin.set(true);
    }

    this.messagesSub = this.ws.messages$.subscribe((msg) => {
      switch (msg.type) {
        case 'player_joined': {
          const joined = msg as PlayerJoinedMessage;
          this.gameState.playerName.set(joined.playerName);
          this.gameState.playerNumber.set(joined.playerNumber);
          this.gameState.partnerName.set(joined.partnerName);
          this.needsJoin.set(false);
          this.partnerDisconnected.set(false);
          break;
        }
        case 'player_disconnected': {
          const disc = msg as PlayerDisconnectedMessage;
          if (disc.playerName === this.gameState.partnerName()) {
            this.partnerDisconnected.set(true);
          }
          break;
        }
        case 'turn_order_prompt': {
          this.gameState.phase.set('turn_order_pick');
          break;
        }
        case 'turn_order_result': {
          const result = msg as TurnOrderResultMessage;
          this.gameState.turnOrderResult.set({
            pick1: result.pick1,
            pick2: result.pick2,
            conflict: result.conflict,
            firstPlayer: result.firstPlayer,
          });
          break;
        }
        case 'game_start': {
          const start = msg as GameStartMessage;
          this.gameState.hand.set(start.hand);
          this.gameState.firstPlayer.set(start.firstPlayer);
          this.gameState.currentTurn.set(start.firstPlayer);
          this.gameState.phase.set('placement');
          break;
        }
        case 'your_turn': {
          this.gameState.isMyTurn.set(true);
          break;
        }
        case 'card_placed': {
          const placed = msg as CardPlacedMessage;
          const board = [...this.gameState.board()];
          board[placed.slotIndex] = { occupied: true, byPlayer: placed.byPlayer };
          this.gameState.board.set(board);
          this.gameState.isMyTurn.set(false);
          break;
        }
        case 'player_passed': {
          const passed = msg as PlayerPassedMessage;
          const passUsed: [boolean, boolean] = [...this.gameState.passUsed()];
          passUsed[passed.byPlayer - 1] = true;
          this.gameState.passUsed.set(passUsed);
          this.gameState.isMyTurn.set(false);
          break;
        }
        case 'peek_result': {
          const peek = msg as PeekResultMessage;
          const peekBoard = [...this.gameState.board()];
          peekBoard[peek.slotIndex] = { ...peekBoard[peek.slotIndex], card: peek.card };
          this.gameState.board.set(peekBoard);
          // Auto-hide after 2 seconds
          setTimeout(() => {
            const b = [...this.gameState.board()];
            b[peek.slotIndex] = { ...b[peek.slotIndex], card: undefined };
            this.gameState.board.set(b);
          }, 2000);
          break;
        }
        case 'swap_prompt': {
          const swap = msg as SwapPromptMessage;
          this.gameState.phase.set('swap');
          this.gameState.currentTurn.set(swap.byPlayer);
          this.gameState.isMyTurn.set(swap.byPlayer === this.gameState.playerNumber());
          this.gameState.swapPending.set(false);
          this.gameState.swapSlots.set(null);
          this.gameState.swapSuggester.set(0);
          this.selectedSwapSlots.set([]);
          break;
        }
        case 'swap_suggested': {
          const suggested = msg as SwapSuggestedMessage;
          this.gameState.swapPending.set(true);
          this.gameState.swapSlots.set([suggested.slotA, suggested.slotB]);
          this.gameState.swapSuggester.set(suggested.byPlayer);
          break;
        }
        case 'swap_result': {
          const swapResult = msg as SwapResultMessage;
          if (swapResult.accepted && swapResult.slotA !== undefined && swapResult.slotB !== undefined) {
            const board = [...this.gameState.board()];
            const temp = board[swapResult.slotA];
            board[swapResult.slotA] = board[swapResult.slotB];
            board[swapResult.slotB] = temp;
            this.gameState.board.set(board);
          }
          this.gameState.swapPending.set(false);
          this.gameState.swapSlots.set(null);
          this.gameState.swapSuggester.set(0);
          this.selectedSwapSlots.set([]);
          break;
        }
        case 'reveal_card': {
          const reveal = msg as RevealCardMessage;
          if (this.gameState.phase() !== 'reveal') {
            this.gameState.phase.set('reveal');
            this.gameState.revealedCount.set(0);
            this.gameState.totalRevealCards.set(0);
          }
          this.gameState.totalRevealCards.update(n => n + 1);
          const timeout = setTimeout(() => {
            const board = [...this.gameState.board()];
            board[reveal.slotIndex] = {
              ...board[reveal.slotIndex],
              card: reveal.card,
            };
            this.gameState.board.set(board);
            this.gameState.revealedCount.update(n => n + 1);
          }, reveal.delay);
          this.revealTimeouts.push(timeout);
          break;
        }
        case 'error': {
          const err = msg as ErrorMessage;
          if (this.needsJoin()) {
            this.joinError.set(err.message);
          }
          break;
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.messagesSub?.unsubscribe();
    this.revealTimeouts.forEach(t => clearTimeout(t));
    this.revealTimeouts = [];
  }

  joinRoom(): void {
    this.joinError.set('');
    const name = this.joinName.trim();
    if (!name) return;

    const code = this.roomId();
    this.ws.connect('/ws');
    this.ws.send({ type: 'join_room', name, roomCode: code });
    this.gameState.roomCode.set(code);
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareableLink());
  }

  placeCard(cardIndex: number, slotIndex: number): void {
    this.ws.send({ type: 'place_card', cardIndex, slotIndex });
    const used = [...this.gameState.handUsed()];
    used[cardIndex] = true;
    this.gameState.handUsed.set(used);
    this.selectedCardIndex.set(-1);
  }

  selectCard(index: number): void {
    this.selectedCardIndex.set(this.selectedCardIndex() === index ? -1 : index);
  }

  onSlotPlace(slotIndex: number): void {
    const cardIndex = this.selectedCardIndex();
    if (cardIndex >= 0) {
      this.placeCard(cardIndex, slotIndex);
    }
  }

  pass(): void {
    this.ws.send({ type: 'pass' });
  }

  peek(slotIndex: number): void {
    this.ws.send({ type: 'peek', slotIndex });
  }

  onSwapSlotClick(slotIndex: number): void {
    const slot = this.gameState.board()[slotIndex];
    if (!slot.occupied) return;

    const current = this.selectedSwapSlots();
    if (current.length === 0) {
      this.selectedSwapSlots.set([slotIndex]);
    } else if (current.length === 1) {
      if (current[0] === slotIndex) {
        this.selectedSwapSlots.set([]);
      } else if (Math.abs(current[0] - slotIndex) === 1) {
        this.suggestSwap(current[0], slotIndex);
      } else {
        this.selectedSwapSlots.set([slotIndex]);
      }
    }
  }

  suggestSwap(slotA: number, slotB: number): void {
    this.ws.send({ type: 'suggest_swap', slotA, slotB });
    this.selectedSwapSlots.set([]);
  }

  skipSwap(): void {
    this.ws.send({ type: 'skip_swap' });
  }

  respondSwap(accept: boolean): void {
    this.ws.send({ type: 'respond_swap', accept });
  }
}
