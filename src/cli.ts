#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { WatchmodeClient, StreamFindError } from './api.js';
import { loadUserConfig, resolveRegion } from './config.js';
import { matchSources } from './matcher.js';
import { Formatter } from './formatter.js';
import { defaultCache } from './cache.js';
import { runConfigWizard } from './wizard.js';
import { formatMediaType } from './utils/terminal.js';
import type { SearchResultItem } from './types.js';

const program = new Command();

program
  .name('streamfind')
  .description('Production-grade streaming availability CLI tool powered by Watchmode API')
  .version('1.0.0');

/**
 * Main lookup action: streamfind <title>
 */
program
  .argument('[title...]', 'Title of the movie or TV show to search for')
  .option('-a, --all', 'Display all platforms including rent, buy, and non-subscribed SVODs', false)
  .option('-r, --region <region>', 'Override target region code (e.g. US, GB, CA)')
  .option('--json', 'Output raw JSON result to stdout for scripting', false)
  .option('--mock', 'Force offline mock mode for testing without using API quota', false)
  .action(async (titleParts: string[], options) => {
    const query = titleParts.join(' ').trim();

    if (!query) {
      program.help();
      return;
    }

    const config = loadUserConfig();
    const region = resolveRegion(options.region, config);
    const client = new WatchmodeClient({
      mockMode: options.mock || process.env.STREAMFIND_MOCK === 'true',
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
              name: `${item.name} ${yearStr} • [${media.label}]`,
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

      // Step 4: Render
      if (options.json) {
        console.log(JSON.stringify(matched, null, 2));
      } else {
        console.log(Formatter.renderAvailability(matched, { includeAll: options.all }));
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

      if (err instanceof StreamFindError) {
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
 * Config command: streamfind config [--list-providers]
 */
const configCmd = program
  .command('config')
  .description('Interactive wizard to configure subscribed streaming services and region')
  .option('-l, --list-providers', 'List all supported provider names for region in Watchmode')
  .option('-r, --region <region>', 'Region code for listing providers (default: US)')
  .option('--mock', 'Run in mock mode', false)
  .action(async (options) => {
    const config = loadUserConfig();
    const region = resolveRegion(options.region, config);

    if (options.listProviders) {
      const spinner = ora(`Fetching supported streaming providers for ${chalk.bold(region)}...`).start();
      try {
        const client = new WatchmodeClient({
          mockMode: options.mock || process.env.STREAMFIND_MOCK === 'true',
        });
        const providers = await client.getProviders(region);
        spinner.succeed(`Found ${providers.length} supported providers.`);
        console.log(Formatter.renderProvidersList(providers, region));
      } catch (err: any) {
        spinner.fail('Failed to fetch providers list.');
        if (err instanceof StreamFindError) {
          console.log(Formatter.renderError(err.code, err.message, err.remediation));
        } else {
          console.log(Formatter.renderError('API_ERROR', err.message));
        }
        process.exitCode = 1;
      }
      return;
    }

    // Run interactive config wizard
    try {
      await runConfigWizard();
    } catch (err: any) {
      // User cancelled prompt (Ctrl+C)
      console.log(chalk.dim('\nConfiguration wizard cancelled.'));
    }
  });

/**
 * Cache commands: streamfind cache clear / streamfind cache status
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
        `✔ Cache cleared successfully. Removed ${result.count} entries (${kb} KB freed).`
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
    console.log(`  • Location: ${chalk.white(stats.location)}`);
    console.log(`  • Cached entries: ${chalk.green(stats.count)}`);
    console.log(`  • Total size: ${chalk.yellow(kb + ' KB')}`);
    console.log(`  • Cache TTL: ${chalk.dim('24 hours')}`);
  });

program.parse(process.argv);
