import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { WebSocketService } from '../shared/websocket.service';
import { GameStateService, type TurnOrderPreference } from '../shared/game-state.service';
import { CardStyleService } from '../shared/card-style.service';
import { ServerMessage } from '../shared/messages';
import { TurnOrderPickComponent } from './turn-order-pick/turn-order-pick';
import { BoardComponent } from './board/board';
import { HandComponent } from './hand/hand';
import { SwapPhaseComponent } from './swap-phase/swap-phase';
import { RevealPhaseComponent } from './reveal-phase/reveal-phase';
import { GameOverComponent } from './game-over/game-over';
import { EmoteBarComponent } from './emote-bar/emote-bar';
import { EmoteDisplayComponent } from './emote-display/emote-display';
import { PartnerHandComponent } from './partner-hand/partner-hand';

import { ThemeToggleComponent } from '../shared/theme-toggle/theme-toggle';
import { CardStylePickerComponent } from '../shared/card-style-picker/card-style-picker';

@Component({
  selector: 'app-game',
  imports: [FormsModule, CdkDropListGroup, TurnOrderPickComponent, BoardComponent, HandComponent, SwapPhaseComponent, RevealPhaseComponent, GameOverComponent, EmoteBarComponent, EmoteDisplayComponent, PartnerHandComponent, ThemeToggleComponent, CardStylePickerComponent],
  templateUrl: './game.html',
  styleUrl: './game.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private params = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))));
  readonly roomId = computed(() => this.params() ?? '');

  protected readonly ws = inject(WebSocketService);
  protected readonly gameState = inject(GameStateService);

  private readonly cardStyleService = inject(CardStyleService);
  readonly gameThemeClass = computed(() => `game-theme-${this.cardStyleService.style()}`);

  /** True when the user arrived via shareable link and needs to enter a name. */
  readonly needsJoin = signal(false);
  readonly joinError = signal('');
  readonly partnerDisconnected = signal(false);
  readonly attemptingReconnect = signal(false);
  readonly selectedCardIndex = signal(-1);
  readonly selectedSwapSlots = signal<number[]>([]);
  readonly placementSwapMode = signal(false);
  readonly activeEmote = signal<{ text: string; fromSelf: boolean } | null>(null);
  readonly partnerLeftMessage = signal('');
  readonly cardStylePickerOpen = signal(false);
  readonly partnerPlayerNumber = computed(() => this.gameState.playerNumber() === 1 ? 2 : 1);
  readonly partnerRemainingCards = computed(() =>
    7 - this.gameState.board().filter(s => s.byPlayer === this.partnerPlayerNumber()).length
  );
  readonly isDragEnabled = computed(() =>
    this.gameState.phase() === 'placement' && !this.placementSwapMode() && this.gameState.isMyTurn()
  );
  joinName = '';

  private messagesSub?: Subscription;
  private revealTimeouts: ReturnType<typeof setTimeout>[] = [];
  private peekTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
  private emoteTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxRevealDelay = 0;

  readonly shareableLink = computed(() => {
    const code = this.gameState.roomCode() || this.roomId();
    return code ? `${location.origin}/game/${code}` : '';
  });

  readonly showHand = computed(() => {
    const phase = this.gameState.phase();
    return phase === 'turn_order_pick' || phase === 'placement' || phase === 'swap' || phase === 'reveal';
  });

  ngOnInit(): void {
    // Check sessionStorage for stored reconnection credentials (page reload scenario)
    const stored = this.ws.getStoredCredentials();
    if (stored && stored.roomCode === this.roomId()) {
      this.attemptingReconnect.set(true);
      this.gameState.roomCode.set(stored.roomCode);
      this.ws.connect('/ws');
    } else {
      // No stored credentials or room code mismatch — check if we need to join
      const currentRoom = this.gameState.roomCode();
      if (this.ws.status() === 'disconnected' || !currentRoom || currentRoom !== this.roomId()) {
        this.needsJoin.set(true);
      }
    }

    this.messagesSub = this.ws.messages$.subscribe((msg: ServerMessage) => {
      switch (msg.type) {
        case 'player_joined': {
          this.gameState.playerName.set(msg.playerName);
          this.gameState.playerNumber.set(msg.playerNumber);
          this.gameState.partnerName.set(msg.partnerName);
          this.needsJoin.set(false);
          this.attemptingReconnect.set(false);
          this.partnerDisconnected.set(false);
          this.partnerLeftMessage.set('');
          // Store credentials for auto-reconnection
          this.ws.setReconnectCredentials(msg.playerName, this.gameState.roomCode() || this.roomId());
          break;
        }
        case 'player_disconnected': {
          if (msg.playerName === this.gameState.partnerName()) {
            this.partnerDisconnected.set(true);
          }
          break;
        }
        case 'player_reconnected': {
          if (msg.playerName === this.gameState.partnerName()) {
            this.partnerDisconnected.set(false);
          }
          break;
        }
        case 'turn_order_prompt': {
          // If coming from game_over, this is a rematch — reset full game state
          if (this.gameState.phase() === 'game_over') {
            this.revealTimeouts.forEach(t => clearTimeout(t));
            this.revealTimeouts = [];
            this.gameState.resetForRematch();
          } else {
            // Clear any stale result from a previous session (GameStateService is a singleton)
            this.gameState.turnOrderResult.set(null);
          }
          this.gameState.hand.set(msg.hand);
          this.gameState.phase.set('turn_order_pick');
          break;
        }
        case 'turn_order_result': {
          this.gameState.turnOrderResult.set({
            pick1: msg.pick1,
            pick2: msg.pick2,
            conflict: msg.conflict,
            firstPlayer: msg.firstPlayer,
          });
          break;
        }
        case 'game_start': {
          this.gameState.hand.set(msg.hand);
          this.gameState.firstPlayer.set(msg.firstPlayer);
          this.gameState.currentTurn.set(msg.firstPlayer);
          this.gameState.phase.set('placement');
          // Reset board and hand state for fresh game or reconnection
          this.gameState.clearBoard();
          this.gameState.handUsed.set(msg.handUsed ?? new Array(7).fill(false));
          this.gameState.passUsed.set([false, false]);
          this.gameState.swapAccepted.set([false, false]);
          this.gameState.swapHistory.set([]);
          this.gameState.swapPending.set(false);
          this.maxRevealDelay = 0;
          break;
        }
        case 'your_turn': {
          this.gameState.isMyTurn.set(true);
          break;
        }
        case 'card_placed': {
          const board = [...this.gameState.board()];
          board[msg.slotIndex] = { occupied: true, byPlayer: msg.byPlayer };
          this.gameState.board.set(board);
          this.gameState.isMyTurn.set(false);
          break;
        }
        case 'player_passed': {
          const passUsed: [boolean, boolean] = [...this.gameState.passUsed()];
          passUsed[msg.byPlayer - 1] = true;
          this.gameState.passUsed.set(passUsed);
          this.gameState.isMyTurn.set(false);
          break;
        }
        case 'peek_result': {
          const peekBoard = [...this.gameState.board()];
          peekBoard[msg.slotIndex] = { ...peekBoard[msg.slotIndex], card: msg.card };
          this.gameState.board.set(peekBoard);

          // Cancel any existing peek timeout for this slot
          const existingTimeout = this.peekTimeouts.get(msg.slotIndex);
          if (existingTimeout) clearTimeout(existingTimeout);

          // Auto-hide after 2 seconds
          const peekTimeout = setTimeout(() => {
            const b = [...this.gameState.board()];
            b[msg.slotIndex] = { ...b[msg.slotIndex], card: undefined };
            this.gameState.board.set(b);
            this.peekTimeouts.delete(msg.slotIndex);
          }, 2000);
          this.peekTimeouts.set(msg.slotIndex, peekTimeout);
          break;
        }
        case 'swap_prompt': {
          this.gameState.phase.set('swap');
          this.gameState.currentTurn.set(msg.byPlayer);
          this.gameState.isMyTurn.set(msg.byPlayer === this.gameState.playerNumber());
          this.gameState.swapPending.set(false);
          this.gameState.swapSlots.set(null);
          this.gameState.swapSuggester.set(0);
          this.selectedSwapSlots.set([]);
          break;
        }
        case 'swap_suggested': {
          this.gameState.swapPending.set(true);
          this.gameState.swapSlots.set([msg.slotA, msg.slotB]);
          this.gameState.swapSuggester.set(msg.byPlayer);
          this.placementSwapMode.set(false);
          this.selectedSwapSlots.set([]);
          break;
        }
        case 'swap_result': {
          if (msg.accepted && msg.slotA !== undefined && msg.slotB !== undefined) {
            const board = [...this.gameState.board()];
            const temp = board[msg.slotA];
            board[msg.slotA] = board[msg.slotB];
            board[msg.slotB] = temp;
            this.gameState.board.set(board);

            if (msg.byPlayer !== undefined) {
              const accepted: [boolean, boolean] = [...this.gameState.swapAccepted()];
              accepted[msg.byPlayer - 1] = true;
              this.gameState.swapAccepted.set(accepted);

              const history = [...this.gameState.swapHistory()];
              history.push({ slotA: msg.slotA, slotB: msg.slotB, byPlayer: msg.byPlayer });
              this.gameState.swapHistory.set(history);
            }
          }
          this.gameState.swapPending.set(false);
          this.gameState.swapSlots.set(null);
          this.gameState.swapSuggester.set(0);
          this.selectedSwapSlots.set([]);
          this.placementSwapMode.set(false);
          break;
        }
        case 'reveal_card': {
          if (this.gameState.phase() !== 'reveal') {
            this.gameState.phase.set('reveal');
            this.gameState.revealedCount.set(0);
            this.gameState.totalRevealCards.set(0);
            this.maxRevealDelay = 0;
          }
          this.gameState.totalRevealCards.update(n => n + 1);
          this.maxRevealDelay = Math.max(this.maxRevealDelay, msg.delay);
          const timeout = setTimeout(() => {
            const board = [...this.gameState.board()];
            board[msg.slotIndex] = {
              ...board[msg.slotIndex],
              card: msg.card,
            };
            this.gameState.board.set(board);
            this.gameState.revealedCount.update(n => n + 1);
          }, msg.delay);
          this.revealTimeouts.push(timeout);
          break;
        }
        case 'game_result': {
          this.gameState.gameResult.set({ win: msg.win });
          // Transition to game_over after all reveals complete
          const totalDelay = this.maxRevealDelay + 800;
          const resultTimeout = setTimeout(() => {
            this.gameState.phase.set('game_over');
          }, totalDelay);
          this.revealTimeouts.push(resultTimeout);
          break;
        }
        case 'play_again_waiting': {
          if (msg.playerName !== this.gameState.playerName()) {
            this.gameState.partnerWantsRematch.set(true);
          }
          break;
        }
        case 'emote_received': {
          this.showEmote(msg.emote, false);
          break;
        }
        case 'partner_exited': {
          this.partnerLeftMessage.set(`${msg.playerName} left the game`);
          this.gameState.resetForPartnerExit();
          this.partnerDisconnected.set(false);
          this.selectedCardIndex.set(-1);
          this.selectedSwapSlots.set([]);
          this.placementSwapMode.set(false);
          this.revealTimeouts.forEach(t => clearTimeout(t));
          this.revealTimeouts = [];
          break;
        }
        case 'error': {
          if (this.attemptingReconnect()) {
            // Auto-reconnect failed — fall back to join form
            this.attemptingReconnect.set(false);
            this.ws.clearReconnectCredentials();
            this.needsJoin.set(true);
            this.joinError.set(msg.message);
          } else if (this.needsJoin()) {
            this.joinError.set(msg.message);
          }
          if (this.placementSwapMode()) {
            this.placementSwapMode.set(false);
            this.selectedSwapSlots.set([]);
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
    this.peekTimeouts.forEach(t => clearTimeout(t));
    this.peekTimeouts.clear();
    if (this.emoteTimeout) {
      clearTimeout(this.emoteTimeout);
    }
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

  onTurnOrderPick(preference: TurnOrderPreference): void {
    this.ws.send({ type: 'turn_order_pick', preference });
  }

  onTurnOrderRepick(): void {
    this.gameState.turnOrderResult.set(null);
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

  onCardDropped(event: { cardIndex: number, slotIndex: number }): void {
    this.placeCard(event.cardIndex, event.slotIndex);
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
      } else {
        this.suggestSwap(current[0], slotIndex);
      }
    }
  }

  suggestSwap(slotA: number, slotB: number): void {
    this.ws.send({ type: 'suggest_swap', slotA, slotB });
    this.selectedSwapSlots.set([]);
    this.placementSwapMode.set(false);
  }

  skipSwap(): void {
    this.ws.send({ type: 'skip_swap' });
  }

  respondSwap(accept: boolean): void {
    this.ws.send({ type: 'respond_swap', accept });
  }

  enterPlacementSwapMode(): void {
    this.placementSwapMode.set(true);
    this.selectedCardIndex.set(-1);
    this.selectedSwapSlots.set([]);
  }

  cancelPlacementSwap(): void {
    this.placementSwapMode.set(false);
    this.selectedSwapSlots.set([]);
  }

  onPlacementSlotAction(slotIndex: number): void {
    if (this.placementSwapMode()) {
      this.onSwapSlotClick(slotIndex);
    } else {
      this.onSlotPlace(slotIndex);
    }
  }

  onPlacementPeekAction(slotIndex: number): void {
    if (this.placementSwapMode()) {
      this.onSwapSlotClick(slotIndex);
    } else {
      const slot = this.gameState.board()[slotIndex];
      if (slot.card) {
        const b = [...this.gameState.board()];
        b[slotIndex] = { ...b[slotIndex], card: undefined };
        this.gameState.board.set(b);
      } else {
        this.peek(slotIndex);
      }
    }
  }

  playAgain(): void {
    this.ws.send({ type: 'play_again' });
    this.gameState.playAgainSent.set(true);
  }

  sendEmote(emote: string): void {
    this.ws.send({ type: 'send_emote', emote });
    this.showEmote(emote, true);
  }

  private showEmote(text: string, fromSelf: boolean): void {
    if (this.emoteTimeout) {
      clearTimeout(this.emoteTimeout);
    }

    this.activeEmote.set({ text, fromSelf });
    this.emoteTimeout = setTimeout(() => {
      this.activeEmote.set(null);
      this.emoteTimeout = null;
    }, 2500);
  }

  leaveGame(): void {
    this.ws.clearReconnectCredentials();
    this.ws.disconnect();
    this.gameState.reset();
    this.router.navigate(['/']);
  }

  exitGame(): void {
    if (this.gameState.roomCode()) {
      this.ws.send({ type: 'exit_game' });
    }
    this.ws.clearReconnectCredentials();
    this.ws.disconnect();
    this.gameState.reset();
    this.router.navigate(['/']);
  }
}
