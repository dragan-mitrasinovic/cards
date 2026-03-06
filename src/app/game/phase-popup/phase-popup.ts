import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-phase-popup',
  templateUrl: './phase-popup.html',
  styleUrl: './phase-popup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhasePopupComponent implements OnInit, OnDestroy {
  /** Duration in ms before auto-hiding. */
  readonly duration = input(2500);

  /** Emitted when the popup closes (auto-hide, backdrop click, X, or Escape). */
  readonly closed = output<void>();

  private autoHideTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.autoHideTimer = setTimeout(() => this.close(), this.duration());
  }

  ngOnDestroy(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }
  }

  close(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }

    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('popup-backdrop')) {
      this.close();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    }
  }
}
