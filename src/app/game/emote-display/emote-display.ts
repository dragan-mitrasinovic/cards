import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-emote-display',
  template: `
    @if (emote()) {
      <div class="emote-toast">
        {{ emote() }}
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: fixed;
      top: 5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      pointer-events: none;
    }

    .emote-toast {
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 0.5rem 1.5rem;
      border-radius: 9999px;
      font-size: 1rem;
      font-weight: 600;
      white-space: nowrap;
      animation: emote-fade 2.5s ease-in-out forwards;
    }

    @keyframes emote-fade {
      0% { opacity: 0; transform: translateY(-8px); }
      10% { opacity: 1; transform: translateY(0); }
      80% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-8px); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmoteDisplayComponent {
  readonly emote = input<string | null>(null);
}
