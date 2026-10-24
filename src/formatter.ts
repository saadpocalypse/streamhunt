import chalk from 'chalk';
import type {
  MatchedAvailability,
  CategorizedSource,
  Provider,
  TitleDetails,
  StreamHuntConfig,
} from './types.js';
import {
  formatPrice,
  formatMediaType,
  truncate,
} from './utils/terminal.js';

export interface RenderOptions {
  includeAll?: boolean;
  region?: string;
}

export class Formatter {
  /**
   * Renders a clean title card for the movie or TV show
   */
  static renderTitleCard(matched: MatchedAvailability): string {
    const { title, details } = matched;
    const media = formatMediaType(title.type || details?.type);
    const yearStr = title.year ? ` (${title.year})` : '';

    return `${chalk.bold.white(title.name)}${chalk.dim(yearStr)}  |  ${chalk.cyan(media.label)}`;
  }

  /**
   * Formats a single stream item as a clean, easily scannable bullet point
   */
  static formatSourceBullet(source: CategorizedSource): string {
    let badge: string;

    switch (source.category) {
      case 'paid_sub':
        badge = chalk.green.bold('[Paid Sub]');
        break;
      case 'free_tier':
        badge = chalk.yellow.bold('[Free Tier]');
        break;
      case 'included_free':
        badge = chalk.green.bold('[Included Free]');
        break;
      case 'public_free':
        badge = chalk.blue.bold('[Public Free]');
        break;
      case 'rent':
        badge = chalk.magenta.bold('[Rent]');
        break;
      case 'buy':
        badge = chalk.cyan.bold('[Buy]');
        break;
      case 'other_sub':
      default:
        badge = chalk.gray.bold('[Other Sub]');
        break;
    }

    let line = `  - ${badge} ${chalk.bold.white(source.providerName)}`;

    if (source.subDescription) {
      line += ` ${chalk.dim(source.subDescription)}`;
    }

    if (source.price !== null && source.price !== undefined) {
      line += ` ${chalk.yellow(formatPrice(source.price))}`;
    }

    if (source.format) {
      const fmt = source.format.toUpperCase();
      const fmtColor = fmt.includes('4K') ? chalk.hex('#FF9900').bold : chalk.dim;
      line += ` ${fmtColor(`(${fmt})`)}`;
    }

    return line;
  }

  /**
   * Renders streaming availability as an easily scannable bullet-point list
   */
  static renderAvailability(
    matched: MatchedAvailability,
    options: RenderOptions = {}
  ): string {
    const lines: string[] = [];

    // 1. Title Card
    lines.push(this.renderTitleCard(matched));
    lines.push('');

    const userStreams = [
      ...matched.paidSubscriptions,
      ...matched.includedFree,
      ...matched.freeTiers,
      ...matched.publicFree,
    ];

    // 2. Included in Your Services & Free Platforms
    if (userStreams.length > 0) {
      lines.push(chalk.bold.underline('Included in Your Services & Free Platforms:'));
      lines.push('');
      for (const src of userStreams) {
        lines.push(this.formatSourceBullet(src));
      }
      lines.push('');
    } else {
      lines.push(chalk.dim('Not available anywhere'));
      lines.push(
        chalk.dim(
          `Tip: Use streamhunt "${matched.title.name}" --all to view digital purchase/rental options.`
        )
      );
      lines.push('');
    }

    // 3. Other Subscription Platforms (when --all is passed)
    if (options.includeAll && matched.otherSubscriptions.length > 0) {
      lines.push(chalk.bold.underline('Other Subscription Platforms:'));
      lines.push('');
      for (const src of matched.otherSubscriptions) {
        lines.push(this.formatSourceBullet(src));
      }
      lines.push('');
    }

    // 4. Digital Purchase & Rental (VOD)
    const showVod = options.includeAll || matched.rent.length > 0 || matched.buy.length > 0;
    if (showVod && (matched.rent.length > 0 || matched.buy.length > 0)) {
      lines.push(chalk.bold.underline('Digital Purchase & Rental (VOD):'));
      lines.push('');

      if (matched.rent.length > 0) {
        lines.push(`  ${chalk.dim('Available for Rent:')}`);
        for (const src of matched.rent.slice(0, 5)) {
          lines.push(this.formatSourceBullet(src));
        }
      }

      if (matched.buy.length > 0) {
        if (matched.rent.length > 0) lines.push('');
        lines.push(`  ${chalk.dim('Available to Buy:')}`);
        for (const src of matched.buy.slice(0, 5)) {
          lines.push(this.formatSourceBullet(src));
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Renders the list of supported providers as clean bullet points
   */
  static renderProvidersList(providers: Provider[], region: string): string {
    const lines: string[] = [];

    lines.push(
      `${chalk.bold.white('Supported Streaming Providers')} ${chalk.cyan(`(${region})`)} - ${chalk.dim(`${providers.length} found`)}`
    );
    lines.push(chalk.dim('Configure exact names in ~/.streamhunt/config.json\n'));

    for (const p of providers) {
      const typeLabel = p.type ? chalk.dim(`[${p.type}]`) : '';
      lines.push(`  - ${chalk.white.bold(p.name)} ${typeLabel}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Formats user-friendly error banners without boxes
   */
  static renderError(_title: string, message?: string, remediation?: string): string {
    const lines: string[] = [];
    const text = message || _title;
    lines.push(chalk.red(text));
    if (remediation) {
      lines.push(chalk.dim(remediation));
    }
    return lines.join('\n');
  }

  /**
   * Renders a clean summary of current configuration
   */
  static renderConfigSummary(config: StreamHuntConfig): string {
    const key = config.api_key;
    const masked =
      key && key.length >= 8
        ? `••••••••••••${key.slice(-4)}`
        : key
        ? '••••'
        : 'Not configured';

    const paidList =
      config.subscriptions.paid.length > 0
        ? config.subscriptions.paid.map((s) => chalk.green(`  - ${s}`)).join('\n')
        : chalk.dim('  None');

    const freeList =
      config.subscriptions.free_tier_only.length > 0
        ? config.subscriptions.free_tier_only.map((s) => chalk.yellow(`  - ${s}`)).join('\n')
        : chalk.dim('  None');

    const lines = [
      chalk.bold.white('Active Streamhunt Configuration'),
      '',
      `${chalk.bold('Watchmode API Key:')} ${chalk.dim(masked)}`,
      `${chalk.bold('Region:')} ${chalk.cyan(config.region || 'US')}`,
      `${chalk.bold('Public Free Platforms:')} ${
        config.always_include_public_free
          ? chalk.green('Always Included')
          : chalk.dim('Excluded')
      }`,
      `${chalk.bold('Include Rent/Buy by Default:')} ${
        config.include_rent_buy ? chalk.green('Yes') : chalk.dim('No')
      }`,
      '',
      `${chalk.bold('Paid Subscriptions:')} (${chalk.green(
        config.subscriptions.paid.length
      )})`,
      paidList,
      '',
      `${chalk.bold('Free Tier Accounts:')} (${chalk.yellow(
        config.subscriptions.free_tier_only.length
      )})`,
      freeList,
    ];

    return lines.join('\n');
  }
}

