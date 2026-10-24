import readline from 'node:readline';
import chalk from 'chalk';
import type { MatchedAvailability, CategorizedSource } from './types.js';
import { Formatter } from './formatter.js';
import { openUrl } from './utils/browser.js';

export interface TuiOptions {
  includeAll?: boolean;
  region?: string;
  onSearchAgain?: () => Promise<void>;
}

export class StreamHuntTui {
  private matched: MatchedAvailability;
  private options: TuiOptions;
  private includeAll: boolean;
  private selectedIndex: number = 0;
  private isRunning: boolean = false;
  private statusMessage?: string;
  private onSearchAgain?: () => Promise<void>;

  constructor(matched: MatchedAvailability, options: TuiOptions = {}) {
    this.matched = matched;
    this.options = options;
    this.includeAll = options.includeAll ?? false;
    this.onSearchAgain = options.onSearchAgain;
  }

  /**
   * Retrieves all currently visible streaming sources based on includeAll toggle
   */
  private getVisibleSources(): CategorizedSource[] {
    const list: CategorizedSource[] = [
      ...this.matched.paidSubscriptions,
      ...this.matched.includedFree,
      ...this.matched.freeTiers,
      ...this.matched.publicFree,
    ];

    if (this.includeAll) {
      list.push(...this.matched.otherSubscriptions);
      list.push(...this.matched.rent);
      list.push(...this.matched.buy);
    }

    return list;
  }

  /**
   * Renders the current frame to terminal
   */
  private render(): void {
    const visible = this.getVisibleSources();
    if (this.selectedIndex >= visible.length) {
      this.selectedIndex = Math.max(0, visible.length - 1);
    }

    // Clear screen smoothly
    console.clear();

    const output = Formatter.renderAvailability(this.matched, {
      includeAll: this.includeAll,
      region: this.options.region,
      selectedIndex: this.selectedIndex,
      interactive: true,
    });

    console.log(output);

    if (this.statusMessage) {
      console.log(chalk.cyan(`  ${this.statusMessage}`));
    }
  }

  /**
   * Runs the interactive TUI event loop
   */
  async start(): Promise<void> {
    const visible = this.getVisibleSources();

    // If no interactive streams or no stdin TTY, fall back to static render
    if (!process.stdin.isTTY || visible.length === 0) {
      console.log(
        Formatter.renderAvailability(this.matched, {
          includeAll: this.includeAll,
          region: this.options.region,
          interactive: false,
        })
      );
      return;
    }

    this.isRunning = true;
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    this.render();

    return new Promise<void>((resolve) => {
      const handleKeypress = async (_str: string, key: readline.Key) => {
        if (!this.isRunning) return;

        // Exit on 'q', Esc, or Ctrl+C
        if (
          key.name === 'q' ||
          key.name === 'escape' ||
          (key.ctrl && key.name === 'c')
        ) {
          this.cleanup(handleKeypress);
          console.clear();
          // Print final static view
          console.log(
            Formatter.renderAvailability(this.matched, {
              includeAll: this.includeAll,
              region: this.options.region,
              interactive: false,
            })
          );
          resolve();
          return;
        }

        const currentVisible = this.getVisibleSources();

        // Navigate Down
        if (key.name === 'down' || key.name === 'j') {
          if (this.selectedIndex < currentVisible.length - 1) {
            this.selectedIndex++;
            this.statusMessage = undefined;
            this.render();
          }
          return;
        }

        // Navigate Up
        if (key.name === 'up' || key.name === 'k') {
          if (this.selectedIndex > 0) {
            this.selectedIndex--;
            this.statusMessage = undefined;
            this.render();
          }
          return;
        }

        // Toggle All / Rent & Buy with 'a'
        if (key.name === 'a') {
          this.includeAll = !this.includeAll;
          this.statusMessage = this.includeAll
            ? '[All Platforms (Including Rent / Buy) Enabled]'
            : '[My Subscriptions & Free Platforms Only]';
          this.render();
          return;
        }

        // Open stream link with 'return' / Enter or 'o'
        if (key.name === 'return' || key.name === 'o') {
          const selected = currentVisible[this.selectedIndex];
          if (selected?.webUrl) {
            this.statusMessage = `Opening ${selected.providerName} stream in browser...`;
            this.render();
            await openUrl(selected.webUrl);
          } else {
            this.statusMessage = `No direct web link available for ${selected?.providerName || 'stream'}.`;
            this.render();
          }
          return;
        }

        // New Search with '/'
        if (key.sequence === '/' && this.onSearchAgain) {
          this.cleanup(handleKeypress);
          resolve();
          await this.onSearchAgain();
          return;
        }
      };

      process.stdin.on('keypress', handleKeypress);
    });
  }

  /**
   * Restores normal terminal mode
   */
  private cleanup(listener: any): void {
    this.isRunning = false;
    process.stdin.removeListener('keypress', listener);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }
}
