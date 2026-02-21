import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-game',
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class GameComponent {
  private route = inject(ActivatedRoute);
  private params = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))));
  readonly gameId = computed(() => this.params() ?? '');
}
