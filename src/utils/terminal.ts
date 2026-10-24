import terminalLink from 'terminal-link';
import { exec } from 'node:child_process';

/**
 * Normalizes and ensures a valid web URL with protocol
 */
export function normalizeUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/**
 * Creates a clickable terminal hyperlink that works in both OSC 8 terminals
 * (iTerm2, VS Code, Kitty, Warp) and standard terminals (like default macOS Terminal.app)
 * by falling back to the full URL when OSC 8 is not supported.
 */
export function formatHyperlink(text: string, url?: string | null): string {
  if (!url) return text;
  const cleanUrl = normalizeUrl(url);
  if (!cleanUrl) return text;

  return terminalLink(text, cleanUrl, {
    fallback: (_t, u) => u,
  });
}

/**
 * Returns the platform-appropriate terminal link modifier key (Cmd on macOS, Ctrl on Windows/Linux)
 */
export function getModifierKey(): string {
  return process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
}

/**
 * Opens a URL in the user's default browser (cross-platform: macOS, Windows, Linux)
 */
export function openInBrowser(url: string): void {
  const clean = normalizeUrl(url);
  if (!clean) return;

  if (process.platform === 'darwin') {
    exec(`open "${clean}"`);
  } else if (process.platform === 'win32') {
    // On Windows, 'start "" "url"' is required so cmd doesn't treat the URL as window title
    exec(`start "" "${clean}"`);
  } else {
    exec(`xdg-open "${clean}"`);
  }
}

/**
 * Cleanly truncates text to a specified maximum length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

/**
 * Formats a currency number (e.g. 3.99 -> "$3.99")
 */
export function formatPrice(price?: number | null): string {
  if (price === null || price === undefined) return '';
  return `$${price.toFixed(2)}`;
}

/**
 * Converts media type string to human-friendly clean label
 */
export function formatMediaType(type?: string | null): { label: string } {
  const t = (type || '').toLowerCase();
  if (t.includes('tv') || t.includes('series') || t.includes('show')) {
    return { label: 'TV Series' };
  }
  return { label: 'Movie' };
}
