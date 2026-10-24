import { exec } from 'node:child_process';
import os from 'node:os';

/**
 * Opens a URL in the system's default web browser across macOS, Linux, and Windows
 */
export function openUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) {
      resolve(false);
      return;
    }

    const platform = os.platform();
    let command: string;

    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    exec(command, (error) => {
      resolve(!error);
    });
  });
}
