import { input, select, checkbox, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import boxen from 'boxen';
import {
  loadUserConfig,
  saveUserConfig,
  getConfigPath,
  DEFAULT_CONFIG,
} from './config.js';
import type { StreamFindConfig } from './types.js';

const POPULAR_PAID_PROVIDERS = [
  'Max',
  'Philo',
  'Netflix',
  'Hulu',
  'Disney+',
  'Prime Video',
  'Paramount+',
  'Peacock',
  'Apple TV+',
  'Starz',
  'MGM+',
  'Crunchyroll',
];

const POPULAR_FREE_TIERS = [
  'Sling TV',
  'Plex',
  'Freevee',
  'The Roku Channel',
  'Vudu (Free with Ads)',
];

export async function runConfigWizard(): Promise<void> {
  console.log(
    boxen(
      `${chalk.bold.cyan('⚙️  Streamfind Configuration Wizard')}\n` +
        `${chalk.dim('Configure your streaming subscriptions, free accounts, and region.')}\n` +
        `${chalk.dim('Saved to:')} ${chalk.white(getConfigPath())}`,
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      }
    )
  );

  const current = loadUserConfig();

  // 1. Region
  const region = await input({
    message: 'Default Target Market / Region Code (e.g., US, GB, CA):',
    default: current.region || 'US',
    validate: (val) =>
      val.trim().length >= 2 ? true : 'Please enter a valid 2-letter country code.',
  });

  // 2. Paid Subscriptions
  // Merge current paid with popular list for choice presentation
  const paidChoices = Array.from(
    new Set([...current.subscriptions.paid, ...POPULAR_PAID_PROVIDERS])
  ).map((name) => ({
    name,
    value: name,
    checked: current.subscriptions.paid.includes(name),
  }));

  const selectedPaid = await checkbox({
    message: 'Select your Paid Streaming Subscriptions (Space to toggle, Enter to confirm):',
    choices: paidChoices,
    pageSize: 14,
  });

  const additionalPaid = await input({
    message: 'Any other paid subscriptions not listed above? (comma-separated, or press Enter to skip):',
  });

  if (additionalPaid.trim()) {
    const extra = additionalPaid
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !selectedPaid.includes(s));
    selectedPaid.push(...extra);
  }

  // 3. Free Tier Accounts
  const freeTierChoices = Array.from(
    new Set([...current.subscriptions.free_tier_only, ...POPULAR_FREE_TIERS])
  ).map((name) => ({
    name,
    value: name,
    checked: current.subscriptions.free_tier_only.includes(name),
  }));

  const selectedFreeTiers = await checkbox({
    message: 'Select your Free/Freemium Tier Accounts (e.g., Sling Freestream, Plex):',
    choices: freeTierChoices,
    pageSize: 10,
  });

  const additionalFreeTiers = await input({
    message: 'Any other free tier accounts? (comma-separated, or press Enter to skip):',
  });

  if (additionalFreeTiers.trim()) {
    const extra = additionalFreeTiers
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !selectedFreeTiers.includes(s));
    selectedFreeTiers.push(...extra);
  }

  // 4. Always include public free
  const publicFree = await confirm({
    message: 'Always include public free ad-supported platforms (e.g., Tubi, Pluto TV)?',
    default: current.always_include_public_free,
  });

  // 5. Default rent/buy inclusion
  const includeRentBuy = await confirm({
    message: 'Include Rent & Buy platforms by default on every search?',
    default: current.include_rent_buy,
  });

  const updatedConfig: StreamFindConfig = {
    region: region.trim().toUpperCase(),
    subscriptions: {
      paid: selectedPaid,
      free_tier_only: selectedFreeTiers,
    },
    always_include_public_free: publicFree,
    include_rent_buy: includeRentBuy,
  };

  saveUserConfig(updatedConfig);

  console.log(
    boxen(
      `${chalk.bold.green('✔ Configuration Saved Successfully!')}\n\n` +
        `${chalk.bold('Region:')} ${chalk.cyan(updatedConfig.region)}\n` +
        `${chalk.bold('Paid Subscriptions:')} ${chalk.green(
          updatedConfig.subscriptions.paid.join(', ') || 'None'
        )}\n` +
        `${chalk.bold('Free Tier Accounts:')} ${chalk.yellow(
          updatedConfig.subscriptions.free_tier_only.join(', ') || 'None'
        )}\n` +
        `${chalk.bold('Public Free Platforms:')} ${
          updatedConfig.always_include_public_free ? chalk.green('Enabled') : chalk.gray('Disabled')
        }\n` +
        `${chalk.bold('Default Rent/Buy:')} ${
          updatedConfig.include_rent_buy ? chalk.green('Enabled') : chalk.gray('Disabled')
        }`,
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green',
      }
    )
  );
}
