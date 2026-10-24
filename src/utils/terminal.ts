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
 * and standard terminals (like default macOS Terminal.app).
 */
export function formatHyperlink(text: string, url?: string | null): string {
  if (!url) return text;
  const cleanUrl = normalizeUrl(url);
  if (!cleanUrl) return text;

  // OSC 8 hyperlink sequence: \u001b]8;;URL\u0007TEXT\u001b]8;;\u0007
  return `\u001B]8;;${cleanUrl}\u0007${text}\u001B]8;;\u0007`;
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
