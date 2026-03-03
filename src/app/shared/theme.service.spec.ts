import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeService } from './theme.service';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList);
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mockMatchMedia(false);
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should default to light mode when system prefers light', () => {
    const service = new ThemeService();

    expect(service.darkMode()).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should default to dark mode when system prefers dark', () => {
    mockMatchMedia(true);
    const service = new ThemeService();

    expect(service.darkMode()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should respect stored dark preference', () => {
    localStorage.setItem('theme-preference', 'dark');
    const service = new ThemeService();

    expect(service.darkMode()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should respect stored light preference over system dark', () => {
    localStorage.setItem('theme-preference', 'light');
    mockMatchMedia(true);
    const service = new ThemeService();

    expect(service.darkMode()).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should toggle from light to dark', () => {
    const service = new ThemeService();

    service.toggle();

    expect(service.darkMode()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme-preference')).toBe('dark');
  });

  it('should toggle from dark to light', () => {
    localStorage.setItem('theme-preference', 'dark');
    const service = new ThemeService();

    service.toggle();

    expect(service.darkMode()).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme-preference')).toBe('light');
  });
});
