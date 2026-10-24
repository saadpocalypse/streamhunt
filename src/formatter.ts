import chalk from 'chalk';
import boxen from 'boxen';
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

    const titleLine = `${chalk.bold.white(title.name)}${chalk.dim(yearStr)}  |  ${chalk.cyan.bold(
      media.label
    )}`;

    const metaParts: string[] = [];

    if (details?.user_rating) {
      metaParts.push(chalk.yellow(`Rating: ${details.user_rating.toFixed(1)}/10`));
    }
    if (details?.critic_score) {
      metaParts.push(chalk.green(`Critic: ${details.critic_score}%`));
    }
    if (details?.runtime_minutes) {
      metaParts.push(chalk.dim(`${details.runtime_minutes} min`));
    }
    if (details?.genre_names && details.genre_names.length > 0) {
      metaParts.push(chalk.dim(details.genre_names.slice(0, 3).join(', ')));
    }

    let metaLine = '';
    if (metaParts.length > 0) {
      metaLine = metaParts.join(chalk.dim('  |  '));
    }

    let plotLine = '';
    if (details?.plot_overview) {
      const truncatedPlot = truncate(details.plot_overview, 175);
      plotLine = chalk.dim.italic(truncatedPlot);
    }

    let body = `${titleLine}\n`;
    if (metaLine) {
      body += `${metaLine}\n`;
    }
    if (plotLine) {
      body += `\n${plotLine}\n`;
    }

    return boxen(body.trimEnd(), {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 0 },
      borderStyle: 'round',
      borderColor: 'cyan',
    });
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
      lines.push(
        `  ${chalk.yellow.bold('[Notice]')} ${chalk.white(
          'Not currently streaming on your active subscriptions or free tiers.'
        )}`
      );
      lines.push(
        `  ${chalk.dim('Tip: Use')} ${chalk.cyan('streamhunt "<title>" --all')} ${chalk.dim(
          'to view digital purchase/rental options and other streaming providers.'
        )}`
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
      boxen(
        `${chalk.bold.white('Supported Streaming Providers for Region:')} ${chalk.cyan.bold(
          region
        )}\n` +
          `${chalk.dim('Total providers found:')} ${chalk.green(providers.length)}\n` +
          `${chalk.dim('Configure exact names in ~/.streamhunt/config.json')}`,
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'green',
        }
      )
    );
    lines.push('');

    for (const p of providers) {
      const typeLabel = p.type ? chalk.dim(`[${p.type}]`) : '';
      lines.push(`  - ${chalk.white.bold(p.name)} ${typeLabel}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Formats user-friendly error banners
   */
  static renderError(title: string, message: string, remediation?: string): string {
    let body = `${chalk.red.bold('[Error] ' + title)}\n\n${chalk.white(message)}`;
    if (remediation) {
      body += `\n\n${chalk.cyan.bold('How to fix:')}\n${chalk.dim(remediation)}`;
    }
    return boxen(body, {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'red',
    });
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

    const body =
      `${chalk.bold.cyan('Active Streamhunt Configuration')}\n\n` +
      `${chalk.bold('Watchmode API Key:')} ${chalk.white(masked)}\n` +
      `${chalk.bold('Region:')} ${chalk.cyan(config.region || 'US')}\n` +
      `${chalk.bold('Public Free Platforms:')} ${
        config.always_include_public_free
          ? chalk.green('Always Included')
          : chalk.dim('Excluded')
      }\n` +
      `${chalk.bold('Include Rent/Buy by Default:')} ${
        config.include_rent_buy ? chalk.green('Yes') : chalk.dim('No')
      }\n\n` +
      `${chalk.bold('Paid Subscriptions:')} (${chalk.green(
        config.subscriptions.paid.length
      )})\n${paidList}\n\n` +
      `${chalk.bold('Free Tier Accounts:')} (${chalk.yellow(
        config.subscriptions.free_tier_only.length
      )})\n${freeList}`;

    return boxen(body, {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    });
  }
}

