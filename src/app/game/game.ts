import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { WebSocketService } from '../shared/websocket.service';
import { GameStateService } from '../shared/game-state.service';
import { PlayerJoinedMessage, PlayerDisconnectedMessage, ErrorMessage } from '../shared/messages';

@Component({
  selector: 'app-game',
  imports: [FormsModule],
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
  joinName = '';

  private messagesSub?: Subscription;

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
}
