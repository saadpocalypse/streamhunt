import chalk from 'chalk';
import open from 'open';
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
 * Detects whether the current terminal emulator supports OSC 8 hyperlinks.
 * Works seamlessly across Windows (Windows Terminal, VS Code, WezTerm, ConEmu),
 * macOS (VS Code, iTerm2, Kitty, Ghostty, Warp, WezTerm), and Linux.
 */
export function supportsOsc8Hyperlinks(): boolean {
  if (process.env.FORCE_HYPERLINK) {
    return !(
      process.env.FORCE_HYPERLINK.length > 0 &&
      parseInt(process.env.FORCE_HYPERLINK, 10) === 0
    );
  }

  if (
    process.argv.some((arg) =>
      ['--no-hyperlink', '--no-hyperlinks', '--hyperlink=false', '--hyperlink=never'].includes(arg)
    )
  ) {
    return false;
  }

  if (
    process.argv.some((arg) =>
      ['--hyperlink', '--hyperlink=true', '--hyperlink=always'].includes(arg)
    )
  ) {
    return true;
  }

  // Windows Terminal (Windows 10 / 11) - full native OSC 8 support
  if (process.env.WT_SESSION) {
    return true;
  }

  // VS Code, Cursor, Windsurf, Antigravity integrated terminal on Windows, Mac, Linux
  if (process.env.TERM_PROGRAM === 'vscode' || process.env.CURSOR_TRACE_ID) {
    return true;
  }

  // Apple Terminal.app on macOS does NOT support OSC 8 hyperlinks
  if (process.env.TERM_PROGRAM === 'Apple_Terminal') {
    return false;
  }

  const termProg = (process.env.TERM_PROGRAM || '').toLowerCase();
  if (
    [
      'iterm.app',
      'wezterm',
      'ghostty',
      'zed',
      'warpterminal',
      'alacritty',
      'hyper',
    ].includes(termProg)
  ) {
    return true;
  }

  // ConEmu / Cmder on Windows
  if (process.env.ConEmuANSI === 'ON') {
    return true;
  }

  const term = (process.env.TERM || '').toLowerCase();
  if (['xterm-kitty', 'alacritty', 'wezterm'].includes(term)) {
    return true;
  }

  // Modern Windows consoles (Windows 10 19041+ / Windows 11) support OSC 8
  if (process.platform === 'win32') {
    return true;
  }

  return false;
}

/**
 * Creates a clickable terminal hyperlink.
 * When OSC 8 is supported (Windows Terminal, VS Code, iTerm2, Kitty, Ghostty, Warp),
 * it outputs standard OSC 8 escape sequence with styled text inside, triggering
 * the pointer cursor (hand cursor) on hover across Windows, macOS, and Linux.
 * In terminals without OSC 8 support (e.g. macOS Terminal.app), it outputs the
 * clean raw URL so the terminal's built-in URL detector makes it clickable.
 */
export function formatHyperlink(label: string, url?: string | null): string {
  if (!url) return label;
  const cleanUrl = normalizeUrl(url);
  if (!cleanUrl) return label;

  if (supportsOsc8Hyperlinks()) {
    // Standard OSC 8 sequence: \x1b]8;;URL\x07LABEL\x1b]8;;\x07
    // Color/underline styling must be INSIDE the OSC 8 sequence so terminal parsers
    // cleanly trigger the pointer cursor (hand icon) on hover without ANSI corruption.
    return `\u001b]8;;${cleanUrl}\u0007${chalk.cyan.underline(label)}\u001b]8;;\u0007`;
  }

  // Fallback for non-OSC 8 terminals (e.g. macOS Terminal.app)
  return chalk.cyan.underline(cleanUrl);
}

/**
 * Returns the platform-appropriate terminal link modifier key (Cmd on macOS, Ctrl on Windows/Linux)
 */
export function getModifierKey(): string {
  return process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
}

/**
 * Opens a URL in the user's default browser (cross-platform: macOS, Windows, Linux)
 * Uses the battle-tested 'open' package with graceful child_process fallback.
 */
export async function openInBrowser(url: string): Promise<boolean> {
  const clean = normalizeUrl(url);
  if (!clean) return false;

  try {
    await open(clean);
    return true;
  } catch {
    return new Promise<boolean>((resolve) => {
      let cmd: string;
      if (process.platform === 'darwin') {
        cmd = `open "${clean}"`;
      } else if (process.platform === 'win32') {
        cmd = `start "" "${clean}"`;
      } else {
        cmd = `xdg-open "${clean}"`;
      }
      exec(cmd, (err) => resolve(!err));
    });
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

