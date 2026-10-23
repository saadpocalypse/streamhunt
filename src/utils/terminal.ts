import chalk from 'chalk';

/**
 * Creates an OSC 8 clickable terminal hyperlink with graceful fallback
 */
export function formatHyperlink(text: string, url?: string | null): string {
  if (!url) return text;

  // OSC 8 hyperlink sequence: \u001b]8;;URL\u0007TEXT\u001b]8;;\u0007
  const osc8 = `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
  return osc8;
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
 * Converts media type string to human-friendly icon & label
 */
export function formatMediaType(type?: string | null): { icon: string; label: string } {
  const t = (type || '').toLowerCase();
  if (t.includes('tv') || t.includes('series') || t.includes('show')) {
    return { icon: '📺', label: 'TV Series' };
  }
  return { icon: '🎬', label: 'Movie' };
}
