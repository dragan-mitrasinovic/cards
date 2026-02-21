import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent {
  playerName = '';
  roomCode = '';

  createGame(): void {
    // TODO: wire up WebSocket — create room and navigate to /game/:id
  }

  joinGame(): void {
    // TODO: wire up WebSocket — join room by code and navigate to /game/:id
  }
}
