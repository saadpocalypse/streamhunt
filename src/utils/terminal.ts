import chalk from 'chalk';

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
 * Decides whether to emit OSC 8 hyperlinks.
 * Always on for interactive terminals; off when output is piped/redirected.
 * Override with FORCE_HYPERLINK=1 (force on) or FORCE_HYPERLINK=0 (force off).
 */
export function shouldEmitHyperlinks(): boolean {
  const force = process.env.FORCE_HYPERLINK;
  if (force !== undefined && force !== '') {
    return parseInt(force, 10) !== 0;
  }
  return Boolean(process.stdout.isTTY);
}

/**
 * Renders a clickable "Open Link"-style hyperlink using the OSC 8 standard.
 * Styling is placed inside the OSC 8 bounds so the whole label is the link target.
 * When output is not a terminal (piped to a file or another program), the raw URL
 * is printed instead so it stays usable.
 */
export function formatHyperlink(label: string, url?: string | null): string {
  if (!url) return label;
  const cleanUrl = normalizeUrl(url);
  if (!cleanUrl) return label;

  if (shouldEmitHyperlinks()) {
    return `\u001b]8;;${cleanUrl}\u0007${chalk.cyan.underline(label)}\u001b]8;;\u0007`;
  }

  return cleanUrl;
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

