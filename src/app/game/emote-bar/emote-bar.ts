import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'app-emote-bar',
  template: `
    <div class="flex items-center gap-2">
      @for (emote of emotes; track emote) {
        <button
          (click)="emoteSent.emit(emote)"
          class="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
        >
          {{ emote }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmoteBarComponent {
  readonly emotes = ['Wow', 'Well Played', 'Interesting'];
  readonly emoteSent = output<string>();
}
