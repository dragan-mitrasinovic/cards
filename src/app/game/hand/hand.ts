import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDrag, CdkDragPreview, CdkDragPlaceholder, CdkDragStart, CdkDropList } from '@angular/cdk/drag-drop';
import { Card } from '../../shared/messages';
import { CardComponent } from '../card/card';

@Component({
  selector: 'app-hand',
  imports: [CardComponent, CdkDrag, CdkDragPreview, CdkDragPlaceholder, CdkDropList],
  templateUrl: './hand.html',
  styleUrl: './hand.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandComponent {
  readonly hand = input.required<Card[]>();
  readonly handUsed = input.required<boolean[]>();
  readonly isMyTurn = input(false);

  /** Whether drag and drop is enabled (placement phase, not swap mode). */
  readonly dragEnabled = input(false);

  /** Index of the currently selected card, or -1 if none. */
  readonly selectedIndex = input(-1);

  /** Emitted when a card is clicked. */
  readonly cardSelected = output<number>();

  onCardClick(index: number): void {
    if (this.handUsed()[index]) return;
    this.cardSelected.emit(index);
  }

  // CAUTION: Accesses private CDK _dragRef API to center the drag preview on cursor.
  // This may break on Angular CDK upgrades — no public API exists for this.
  onDragStarted(event: CdkDragStart): void {
    const el = event.source.element.nativeElement;
    const dragRef = event.source._dragRef as any;
    dragRef._pickupPositionInElement = {
      x: el.offsetWidth / 2,
      y: el.offsetHeight / 2,
    };
  }
}
