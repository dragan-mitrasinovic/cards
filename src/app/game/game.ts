import { Component, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { WebSocketService } from '../shared/websocket.service';
import { ServerMessage } from '../shared/messages';

@Component({
  selector: 'app-game',
  imports: [FormsModule, JsonPipe],
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class GameComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private params = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))));
  readonly gameId = computed(() => this.params() ?? '');

  readonly ws = inject(WebSocketService);
  debugMessages: ServerMessage[] = [];
  debugInput = '';

  private messagesSub?: Subscription;

  ngOnInit(): void {
    if (this.ws.status() === 'disconnected') {
      this.ws.connect('/ws');
    }

    this.messagesSub = this.ws.messages$.subscribe((msg) => {
      this.debugMessages = [...this.debugMessages, msg].slice(-10);
    });
  }

  ngOnDestroy(): void {
    this.messagesSub?.unsubscribe();
  }

  sendDebugMessage(): void {
    const text = this.debugInput.trim();
    if (!text) return;
    this.ws.send({ type: 'echo', payload: text });
    this.debugInput = '';
  }
}
