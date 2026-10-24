import chalk from 'chalk';
import boxen from 'boxen';
import type {
  MatchedAvailability,
  CategorizedSource,
  Provider,
  TitleDetails,
} from './types.js';
import { formatHyperlink, formatPrice, formatMediaType, truncate } from './utils/terminal.js';

export class Formatter {
  /**
   * Renders a styled title card box for a movie or TV show
   */
  static renderTitleCard(matched: MatchedAvailability): string {
    const { title, details } = matched;
    const media = formatMediaType(title.type || details?.type);
    const yearStr = title.year ? ` (${title.year})` : '';

    let content = `${chalk.bold.white(title.name)}${chalk.dim(yearStr)}  |  ${chalk.cyan(media.label)}`;

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

    if (metaParts.length > 0) {
      content += `\n${metaParts.join(chalk.dim('  |  '))}`;
    }

    if (details?.plot_overview) {
      const truncatedPlot = truncate(details.plot_overview, 180);
      content += `\n\n${chalk.italic.gray(truncatedPlot)}`;
    }

    return boxen(content, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 1, bottom: 0 },
      borderStyle: 'round',
      borderColor: 'cyan',
    });
  }

  /**
   * Formats a single streaming source line with badges, resolution, price, and clickable link
   */
  private static formatSourceLine(source: CategorizedSource): string {
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

    let line = `  ${badge}  ${chalk.bold.white(source.providerName)}`;

    if (source.subDescription) {
      line += ` ${chalk.dim(source.subDescription)}`;
    }

    if (source.price !== null && source.price !== undefined) {
      line += ` ${chalk.yellow(formatPrice(source.price))}`;
    }

    if (source.format) {
      const fmt = source.format.toUpperCase();
      const fmtColor = fmt.includes('4K') ? chalk.hex('#FF9900') : chalk.gray;
      line += ` ${fmtColor(`(${fmt})`)}`;
    }

    if (source.webUrl) {
      const linkText = chalk.dim.underline('-> Open Stream');
      const clickable = formatHyperlink(linkText, source.webUrl);
      line += `  ${clickable}`;
    }

    return line;
  }

  /**
   * Renders the complete availability report
   */
  static renderAvailability(matched: MatchedAvailability, options: { includeAll?: boolean } = {}): string {
    const lines: string[] = [];

    // Header Card
    lines.push(this.renderTitleCard(matched));
    lines.push('');

    const hasUserMatches = matched.userAvailableCount > 0;

    if (hasUserMatches) {
      lines.push(chalk.bold.underline('Where to Watch (Included in your services / free):'));
      lines.push('');

      if (matched.paidSubscriptions.length > 0) {
        for (const src of matched.paidSubscriptions) {
          lines.push(this.formatSourceLine(src));
        }
      }

      if (matched.includedFree.length > 0) {
        for (const src of matched.includedFree) {
          lines.push(this.formatSourceLine(src));
        }
      }

      if (matched.freeTiers.length > 0) {
        for (const src of matched.freeTiers) {
          lines.push(this.formatSourceLine(src));
        }
      }

      if (matched.publicFree.length > 0) {
        for (const src of matched.publicFree) {
          lines.push(this.formatSourceLine(src));
        }
      }

      lines.push('');
    } else {
      lines.push(
        boxen(
          `${chalk.yellow.bold('[Notice] Not currently streaming on your active subscriptions or free tiers.')}\n\n` +
            `${chalk.dim('Tip: Use ')}${chalk.cyan('streamhunt "<title>" --all')}${chalk.dim(
              ' to see Rent/Buy prices and other streaming services.'
            )}`,
          {
            padding: 1,
            borderStyle: 'single',
            borderColor: 'yellow',
          }
        )
      );
      lines.push('');
    }

    // Additional sections if --all is specified or rent/buy configured
    const showRentBuy = options.includeAll || matched.rent.length > 0 || matched.buy.length > 0;

    if (options.includeAll && matched.otherSubscriptions.length > 0) {
      lines.push(chalk.bold.underline('Other Subscription Platforms (Not in your subscriptions):'));
      lines.push('');
      for (const src of matched.otherSubscriptions) {
        lines.push(this.formatSourceLine(src));
      }
      lines.push('');
    }

    if (showRentBuy && (matched.rent.length > 0 || matched.buy.length > 0)) {
      lines.push(chalk.bold.underline('Digital Purchase / Rental (VOD):'));
      lines.push('');

      if (matched.rent.length > 0) {
        lines.push(`  ${chalk.dim('Available for Rent:')}`);
        for (const src of matched.rent.slice(0, 4)) {
          lines.push(this.formatSourceLine(src));
        }
      }

      if (matched.buy.length > 0) {
        lines.push(`  ${chalk.dim('Available to Buy:')}`);
        for (const src of matched.buy.slice(0, 4)) {
          lines.push(this.formatSourceLine(src));
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Renders the list of supported providers in the region
   */
  static renderProvidersList(providers: Provider[], region: string): string {
    const lines: string[] = [];

    lines.push(
      boxen(
        `${chalk.bold.white(`Supported Streaming Providers for Region:`)} ${chalk.cyan.bold(region)}\n` +
          `${chalk.dim('Total providers found:')} ${chalk.green(providers.length)}\n` +
          `${chalk.dim('Use these exact names in your ~/.streamhunt/config.json')}`,
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'green',
        }
      )
    );
    lines.push('');

    // Group into columns or clean list
    for (const p of providers) {
      const typeBadge = p.type ? chalk.dim(`[${p.type}]`) : '';
      lines.push(`  - ${chalk.white.bold(p.name)} ${typeBadge}`);
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
}
