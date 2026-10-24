import { openInBrowser } from './terminal.js';

/**
 * Opens a URL in the system's default web browser across macOS, Linux, and Windows
 */
export function openUrl(url: string): Promise<boolean> {
  return openInBrowser(url);
}

