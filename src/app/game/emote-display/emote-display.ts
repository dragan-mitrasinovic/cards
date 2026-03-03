import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-emote-display',
  template: `
    @if (emote()) {
      <div class="emote-toast" [class.emote-top]="position() === 'top'" [class.emote-bottom]="position() === 'bottom'">
        {{ emote() }}
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      pointer-events: none;
    }

    :host-context([data-position="top"]) {
      top: 5rem;
    }

    :host-context([data-position="bottom"]) {
      bottom: 11rem;
    }

    .emote-toast {
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 0.5rem 1.5rem;
      border-radius: 9999px;
      font-size: 1rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .emote-top {
      animation: emote-fade-down 2.5s ease-in-out forwards;
    }

    .emote-bottom {
      animation: emote-fade-up 2.5s ease-in-out forwards;
    }

    @keyframes emote-fade-down {
      0% { opacity: 0; transform: translateY(-8px); }
      10% { opacity: 1; transform: translateY(0); }
      80% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-8px); }
    }

    @keyframes emote-fade-up {
      0% { opacity: 0; transform: translateY(8px); }
      10% { opacity: 1; transform: translateY(0); }
      80% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(8px); }
    }
  `,
  host: {
    '[attr.data-position]': 'position()',
    '[style.top]': 'position() === "top" ? "5rem" : null',
    '[style.bottom]': 'position() === "bottom" ? "11rem" : null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmoteDisplayComponent {
  readonly emote = input<string | null>(null);
  readonly position = input<'top' | 'bottom'>('bottom');
}
