import { ChangeDetectionStrategy, Component, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, filter, take } from 'rxjs';
import { WebSocketService } from '../shared/websocket.service';
import { GameStateService } from '../shared/game-state.service';
import {
  RoomCreatedMessage,
  PlayerJoinedMessage,
  ErrorMessage,
  ServerMessage,
} from '../shared/messages';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnDestroy {
  playerName = '';
  roomCode = '';
  readonly errorMessage = signal('');
  readonly loading = signal(false);

  private router = inject(Router);
  private ws = inject(WebSocketService);
  private gameState = inject(GameStateService);
  private sub?: Subscription;

  createGame(): void {
    this.errorMessage.set('');
    this.loading.set(true);

    this.sub?.unsubscribe();
    this.sub = this.ws.messages$
      .pipe(
        filter(
          (msg): msg is RoomCreatedMessage | ErrorMessage =>
            msg.type === 'room_created' || msg.type === 'error',
        ),
        take(1),
      )
      .subscribe((msg) => this.handleCreateResponse(msg));

    this.ws.connect('/ws');
    this.ws.send({ type: 'create_room', name: this.playerName.trim() });
  }

  joinGame(): void {
    this.errorMessage.set('');
    this.loading.set(true);
    const code = this.roomCode.trim().toUpperCase();

    this.sub?.unsubscribe();
    this.sub = this.ws.messages$
      .pipe(
        filter(
          (msg): msg is PlayerJoinedMessage | ErrorMessage =>
            msg.type === 'player_joined' || msg.type === 'error',
        ),
        take(1),
      )
      .subscribe((msg) => this.handleJoinResponse(msg, code));

    this.ws.connect('/ws');
    this.ws.send({ type: 'join_room', name: this.playerName.trim(), roomCode: code });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private handleCreateResponse(msg: ServerMessage): void {
    this.loading.set(false);
    if (msg.type === 'room_created') {
      const created = msg as RoomCreatedMessage;
      this.gameState.playerName.set(this.playerName.trim());
      this.gameState.playerNumber.set(created.playerNumber);
      this.gameState.roomCode.set(created.roomCode);
      this.router.navigate(['/game', created.roomCode]);
    } else if (msg.type === 'error') {
      this.errorMessage.set((msg as ErrorMessage).message);
    }
  }

  private handleJoinResponse(msg: ServerMessage, code: string): void {
    this.loading.set(false);
    if (msg.type === 'player_joined') {
      const joined = msg as PlayerJoinedMessage;
      this.gameState.playerName.set(this.playerName.trim());
      this.gameState.playerNumber.set(joined.playerNumber);
      this.gameState.partnerName.set(joined.partnerName);
      this.gameState.roomCode.set(code);
      this.router.navigate(['/game', code]);
    } else if (msg.type === 'error') {
      this.errorMessage.set((msg as ErrorMessage).message);
    }
  }
}
