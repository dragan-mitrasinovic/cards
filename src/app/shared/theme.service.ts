import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'theme-preference';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly darkMode = signal(false);

  private hasStoredPreference = false;
  private mediaQuery?: MediaQueryList;

  constructor() {
    this.init();
  }

  private init(): void {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === 'dark' || stored === 'light') {
      this.hasStoredPreference = true;
      this.applyTheme(stored === 'dark');
    } else {
      this.mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
      this.applyTheme(this.mediaQuery?.matches ?? false);
      this.mediaQuery?.addEventListener('change', this.onSystemChange);
    }
  }

  toggle(): void {
    const newValue = !this.darkMode();
    localStorage.setItem(STORAGE_KEY, newValue ? 'dark' : 'light');

    if (!this.hasStoredPreference) {
      this.hasStoredPreference = true;
      this.mediaQuery?.removeEventListener('change', this.onSystemChange);
    }

    this.applyTheme(newValue);
  }

  private applyTheme(dark: boolean): void {
    this.darkMode.set(dark);
    document.documentElement.classList.toggle('dark', dark);
  }

  private onSystemChange = (e: MediaQueryListEvent): void => {
    this.applyTheme(e.matches);
  };
}
