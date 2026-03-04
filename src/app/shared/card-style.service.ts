import { Injectable, signal } from '@angular/core';

export type CardStyle = 'basic' | 'royal' | 'ocean' | 'ember' | 'nightfall' | 'cyber';

export const CARD_STYLES: { id: CardStyle; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'royal', label: 'Royal' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'ember', label: 'Ember' },
  { id: 'nightfall', label: 'Nightfall' },
  { id: 'cyber', label: 'Cyber' },
];

const STORAGE_KEY = 'card-style-preference';

@Injectable({ providedIn: 'root' })
export class CardStyleService {
  readonly style = signal<CardStyle>('basic');

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored && CARD_STYLES.some(s => s.id === stored)) {
      this.style.set(stored as CardStyle);
    }
  }

  select(style: CardStyle): void {
    this.style.set(style);
    localStorage.setItem(STORAGE_KEY, style);
  }
}
