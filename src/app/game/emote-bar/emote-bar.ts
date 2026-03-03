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
              class="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg shadow-md hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap border border-gray-200 dark:border-gray-600"
            >
              {{ emote }}
            </button>
          }
          <button
            (click)="open.set(false)"
            class="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      }

      <button
        (click)="open.set(!open())"
        class="w-12 h-12 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors text-xl border border-gray-200 dark:border-gray-600"
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
