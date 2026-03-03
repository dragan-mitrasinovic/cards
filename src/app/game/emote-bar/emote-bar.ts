import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

@Component({
  selector: 'app-emote-bar',
  template: `
    <div class="relative">
      @if (open()) {
        <div class="absolute bottom-full right-0 mb-2 flex flex-col items-end gap-1.5">
          @for (emote of emotes; track emote) {
            <button
              (click)="sendEmote(emote)"
              class="px-3 py-1.5 text-sm bg-white text-gray-700 rounded-lg shadow-md hover:bg-blue-50 hover:text-blue-600 transition-colors whitespace-nowrap border border-gray-200"
            >
              {{ emote }}
            </button>
          }
          <button
            (click)="open.set(false)"
            class="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      }

      <button
        (click)="open.set(!open())"
        class="w-12 h-12 flex items-center justify-center rounded-full bg-white/80 shadow-md hover:bg-white transition-colors text-xl border border-gray-200"
        title="Send emote"
      >
        💬
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmoteBarComponent {
  readonly emotes = ['Wow', 'Well Played', 'Interesting'];
  readonly emoteSent = output<string>();
  readonly open = signal(false);

  sendEmote(emote: string): void {
    this.emoteSent.emit(emote);
    this.open.set(false);
  }
}
