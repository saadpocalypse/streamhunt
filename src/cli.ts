#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { select, input } from '@inquirer/prompts';
import { WatchmodeClient, StreamHuntError } from './api.js';
import {
  loadUserConfig,
  resolveRegion,
  getApiKey,
  saveApiKey,
  maskApiKey,
} from './config.js';
import { matchSources } from './matcher.js';
import { Formatter } from './formatter.js';
import { defaultCache } from './cache.js';
import { runConfigWizard } from './wizard.js';
import { formatMediaType } from './utils/terminal.js';
import type { SearchResultItem } from './types.js';

const program = new Command();

program
  .name('streamhunt')
  .description('Production-grade streaming availability CLI tool powered by Watchmode API')
  .version('1.0.0');

/**
 * Main lookup action: streamhunt [title...]
 */
program
  .argument('[title...]', 'Title of the movie or TV show to search for')
  .option('-a, --all', 'Display all platforms including rent, buy, and non-subscribed SVODs', false)
  .option('-r, --region <region>', 'Override target region code (e.g. US, GB, CA)')
  .option('--json', 'Output raw JSON result to stdout for scripting', false)
  .option('--mock', 'Force offline mock mode for testing without using API quota', false)
  .action(async (titleParts: string[], options) => {
    let query = titleParts.join(' ').trim();

    // If no title provided and in interactive terminal, prompt user
    if (!query) {
      if (process.stdin.isTTY && !options.json) {
        try {
          const entered = await input({
            message: 'Search movie or TV show title:',
            validate: (val) => (val.trim().length > 0 ? true : 'Please enter a title.'),
          });
          query = entered.trim();
        } catch {
          return;
        }
      } else {
        program.help();
        return;
      }
    }

    const config = loadUserConfig();
    const region = resolveRegion(options.region, config);

    // Ensure API key is configured; prompt user interactively on first run if missing
    let apiKey = getApiKey(config);
    if (!apiKey && !options.mock && !options.json && process.stdin.isTTY) {
      console.log(
        boxen(
          `${chalk.bold.yellow('Watchmode API Key Required')}\n\n` +
            `${chalk.white('streamhunt queries streaming data through the Watchmode API.')}\n` +
            `${chalk.dim('Sign up for a free key at:')} ${chalk.cyan('https://api.watchmode.com/')}`,
          {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'yellow',
          }
        )
      );

      try {
        const entered = await input({
          message: 'Enter your Watchmode API key:',
          validate: (val) =>
            val.trim().length > 5 ? true : 'Please enter a valid API key.',
        });
        apiKey = entered.trim();
        saveApiKey(apiKey);
        config.api_key = apiKey;
        console.log(
          chalk.green(`[OK] API key saved to ~/.streamhunt/config.json\n`)
        );
      } catch {
        console.log(chalk.dim('\nSearch cancelled.'));
        process.exitCode = 1;
        return;
      }
    }

    const client = new WatchmodeClient({
      apiKey,
      mockMode:
        options.mock ||
        process.env.STREAMHUNT_MOCK === 'true' ||
        process.env.STREAMFIND_MOCK === 'true',
    });

    const spinner = ora();

    try {
      if (!options.json) {
        spinner.start(`Searching Watchmode for "${chalk.bold(query)}"...`);
      }

      // Step 1: Search for matching titles
      const searchResults = await client.search(query);

      if (searchResults.length === 0) {
        if (!options.json) {
          spinner.fail(`No movies or TV shows found matching "${chalk.bold(query)}".`);
          console.log(chalk.dim('\nTip: Check spelling or try a broader search term.'));
        } else {
          console.log(JSON.stringify({ error: 'NOT_FOUND', query }, null, 2));
        }
        process.exitCode = 0;
        return;
      }

      let selectedTitle: SearchResultItem;

      if (searchResults.length === 1) {
        selectedTitle = searchResults[0];
        if (!options.json) {
          spinner.succeed(`Found: ${chalk.bold.cyan(selectedTitle.name)} (${selectedTitle.year || 'N/A'})`);
        }
      } else {
        if (!options.json) {
          spinner.stop();

          // Interactive prompt for multiple results
          const choices = searchResults.slice(0, 10).map((item) => {
            const media = formatMediaType(item.type);
            const yearStr = item.year ? `(${item.year})` : '(Year N/A)';
            return {
              name: `${item.name} ${yearStr} | [${media.label}]`,
              value: item,
            };
          });

          selectedTitle = await select({
            message: `Multiple matches found for "${query}". Select title:`,
            choices,
          });
        } else {
          selectedTitle = searchResults[0];
        }
      }

      // Step 2: Fetch sources and details
      if (!options.json) {
        spinner.start(`Checking streaming availability in ${chalk.bold(region)}...`);
      }

      const [sources, details] = await Promise.all([
        client.getSources(selectedTitle.id, region),
        client.getTitleDetails(selectedTitle.id).catch(() => null),
      ]);

      if (!options.json) {
        spinner.stop();
      }

      // Step 3: Match against user config
      const matched = matchSources(selectedTitle, sources, config, details, {
        includeAll: options.all,
      });

      // Step 4: Render cleanly and exit
      if (options.json) {
        console.log(JSON.stringify(matched, null, 2));
      } else {
        console.log(
          Formatter.renderAvailability(matched, {
            includeAll: options.all,
            region,
          })
        );
      }
    } catch (err: any) {
      if (spinner.isSpinning) {
        spinner.stop();
      }

      if (options.json) {
        console.error(
          JSON.stringify(
            {
              error: err.code || 'UNKNOWN_ERROR',
              message: err.message,
              remediation: err.remediation,
            },
            null,
            2
          )
        );
        process.exitCode = 1;
        return;
      }

      if (err instanceof StreamHuntError) {
        console.log(Formatter.renderError(err.code, err.message, err.remediation));
      } else {
        console.log(
          Formatter.renderError(
            'UNEXPECTED_ERROR',
            err.message || 'An unexpected error occurred.',
            'Please report this issue or check your connection.'
          )
        );
      }
      process.exitCode = 1;
    }
  });

/**
 * Config command: streamhunt config [--set-key <key>] [--show-key] [--list-providers]
 */
const configCmd = program
  .command('config')
  .description('Manage Watchmode API key, streaming subscriptions, and default region')
  .option('--set-key <key>', 'Save Watchmode API key directly to ~/.streamhunt/config.json')
  .option('--show-key', 'Display currently configured API key (masked)')
  .option('-l, --list-providers', 'List all supported provider names for region in Watchmode')
  .option('-r, --region <region>', 'Region code for listing providers (default: US)')
  .option('--mock', 'Run in mock mode', false)
  .action(async (options) => {
    // 1. Direct API key setter: streamhunt config --set-key <key>
    if (options.setKey) {
      const keyToSet = options.setKey.trim();
      if (keyToSet.length < 5) {
        console.log(chalk.red('[Error] Invalid API key provided.'));
        process.exitCode = 1;
        return;
      }
      saveApiKey(keyToSet);
      console.log(
        chalk.green(
          `[OK] API key successfully saved to ~/.streamhunt/config.json: ${chalk.cyan(
            maskApiKey(keyToSet)
          )}`
        )
      );
      return;
    }

    // 2. Display configured key: streamhunt config --show-key
    if (options.showKey) {
      const config = loadUserConfig();
      const key = getApiKey(config);
      console.log(
        `${chalk.bold('Configured API Key:')} ${
          key ? chalk.cyan(maskApiKey(key)) : chalk.yellow('Not configured')
        }`
      );
      return;
    }

    const config = loadUserConfig();
    const region = resolveRegion(options.region, config);

    // 3. List providers: streamhunt config --list-providers
    if (options.listProviders) {
      const spinner = ora(`Fetching supported streaming providers for ${chalk.bold(region)}...`).start();
      try {
        const client = new WatchmodeClient({
          mockMode:
            options.mock ||
            process.env.STREAMHUNT_MOCK === 'true' ||
            process.env.STREAMFIND_MOCK === 'true',
        });
        const providers = await client.getProviders(region);
        spinner.succeed(`Found ${providers.length} supported providers.`);
        console.log(Formatter.renderProvidersList(providers, region));
      } catch (err: any) {
        spinner.fail('Failed to fetch providers list.');
        if (err instanceof StreamHuntError) {
          console.log(Formatter.renderError(err.code, err.message, err.remediation));
        } else {
          console.log(Formatter.renderError('API_ERROR', err.message));
        }
        process.exitCode = 1;
      }
      return;
    }

    // 4. Run interactive config wizard
    try {
      await runConfigWizard();
    } catch (err: any) {
      // User cancelled prompt (Ctrl+C)
      console.log(chalk.dim('\nConfiguration wizard cancelled.'));
    }
  });

/**
 * Cache commands: streamhunt cache clear / streamhunt cache status
 */
const cacheCmd = program
  .command('cache')
  .description('Manage local search and source cache');

cacheCmd
  .command('clear')
  .description('Purges all cached search and provider responses')
  .action(() => {
    const result = defaultCache.clear();
    const kb = (result.sizeBytes / 1024).toFixed(1);
    console.log(
      chalk.green(
        `[OK] Cache cleared successfully. Removed ${result.count} entries (${kb} KB freed).`
      )
    );
  });

cacheCmd
  .command('status')
  .description('Display cache metrics and storage path')
  .action(() => {
    const stats = defaultCache.stats();
    const kb = (stats.sizeBytes / 1024).toFixed(1);
    console.log(chalk.bold.cyan('Cache Statistics:'));
    console.log(`  - Location: ${chalk.white(stats.location)}`);
    console.log(`  - Cached entries: ${chalk.green(stats.count)}`);
    console.log(`  - Total size: ${chalk.yellow(kb + ' KB')}`);
    console.log(`  - Cache TTL: ${chalk.dim('24 hours')}`);
  });

program.parse(process.argv);
