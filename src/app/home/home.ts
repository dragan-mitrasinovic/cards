import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WebSocketService } from '../shared/websocket.service';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent {
  playerName = '';
  roomCode = '';

  private router = inject(Router);
  private ws = inject(WebSocketService);

  createGame(): void {
    this.ws.connect('/ws');
    // TODO: send create_room message once room logic is implemented
    this.router.navigate(['/game', 'new']);
  }

  joinGame(): void {
    this.ws.connect('/ws');
    // TODO: send join message with roomCode once room logic is implemented
    this.router.navigate(['/game', this.roomCode.trim()]);
  }
}
