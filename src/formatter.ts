import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import type {
  MatchedAvailability,
  CategorizedSource,
  Provider,
  TitleDetails,
} from './types.js';
import { formatHyperlink, formatPrice, formatMediaType, truncate } from './utils/terminal.js';

export interface RenderOptions {
  includeAll?: boolean;
  region?: string;
  selectedIndex?: number;
  interactive?: boolean;
}

export class Formatter {
  /**
   * Renders a clean Textual-style header panel for the movie or TV show
   */
  static renderTitleCard(matched: MatchedAvailability, region: string = 'US'): string {
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

    let body = `  ${titleLine}\n`;
    if (metaLine) {
      body += `  ${metaLine}\n`;
    }
    if (plotLine) {
      body += `\n  ${plotLine}\n`;
    }

    return boxen(body.trimEnd(), {
      title: chalk.bold.cyan(' STREAMHUNT ') + chalk.dim(`[Region: ${region.toUpperCase()}]`),
      titleAlignment: 'left',
      padding: { top: 0, bottom: 0, left: 0, right: 1 },
      margin: { top: 0, bottom: 0 },
      borderStyle: 'round',
      borderColor: 'cyan',
    });
  }

  /**
   * Creates a stylized cli-table3 table formatted like a Textual panel
   */
  private static createSectionTable(
    headers: string[] = ['STATUS', 'PROVIDER', 'DETAILS', 'QUALITY', 'PRICE', 'ACTION']
  ): Table.Table {
    return new Table({
      head: headers.map((h) => chalk.cyan.bold(h)),
      chars: {
        top: '─',
        'top-mid': '┬',
        'top-left': '┌',
        'top-right': '┐',
        bottom: '─',
        'bottom-mid': '┴',
        'bottom-left': '└',
        'bottom-right': '┘',
        left: '│',
        'left-mid': '├',
        mid: '─',
        'mid-mid': '┼',
        right: '│',
        'right-mid': '┤',
        middle: '│',
      },
      style: {
        'padding-left': 1,
        'padding-right': 1,
        head: [],
        border: ['dim'],
      },
    });
  }

  /**
   * Formats a row in the table, with optional interactive highlight
   */
  private static formatTableRow(
    source: CategorizedSource,
    isHighlighted: boolean = false
  ): string[] {
    let statusBadge: string;
    let priceText: string;
    let detailsText: string = source.subDescription || '-';

    switch (source.category) {
      case 'paid_sub':
        statusBadge = chalk.green.bold('[Paid Sub]');
        priceText = chalk.green('Included');
        if (!source.subDescription) detailsText = 'Subscription included';
        break;
      case 'free_tier':
        statusBadge = chalk.yellow.bold('[Free Tier]');
        priceText = chalk.yellow('Free');
        if (!source.subDescription) detailsText = 'Freestream / Free channels';
        break;
      case 'included_free':
        statusBadge = chalk.green.bold('[Included Free]');
        priceText = chalk.green('Free');
        if (!source.subDescription) detailsText = 'Free on paid service';
        break;
      case 'public_free':
        statusBadge = chalk.blue.bold('[Public Free]');
        priceText = chalk.blue('Free');
        if (!source.subDescription) detailsText = 'Ad-supported';
        break;
      case 'rent':
        statusBadge = chalk.magenta.bold('[Rent]');
        priceText = chalk.yellow(formatPrice(source.price));
        detailsText = 'Digital rental';
        break;
      case 'buy':
        statusBadge = chalk.cyan.bold('[Buy]');
        priceText = chalk.yellow(formatPrice(source.price));
        detailsText = 'Digital purchase';
        break;
      case 'other_sub':
      default:
        statusBadge = chalk.gray.bold('[Other Sub]');
        priceText = chalk.dim('Sub Req');
        detailsText = 'Separate subscription';
        break;
    }

    let providerText = source.providerName;
    if (isHighlighted) {
      providerText = chalk.bold.underline(providerText);
    } else {
      providerText = chalk.bold.white(providerText);
    }

    let qualityText = chalk.dim('SD');
    if (source.format) {
      const fmt = source.format.toUpperCase();
      if (fmt.includes('4K') || fmt.includes('UHD')) {
        qualityText = chalk.hex('#FF9900').bold('4K');
      } else if (fmt.includes('HD') || fmt.includes('1080') || fmt.includes('720')) {
        qualityText = chalk.cyan('HD');
      } else {
        qualityText = chalk.dim(fmt);
      }
    }

    let actionText = chalk.dim('-');
    if (source.webUrl) {
      const linkLabel = isHighlighted ? '-> [Open Stream]' : '-> Open Stream';
      actionText = formatHyperlink(chalk.dim.underline(linkLabel), source.webUrl);
    }

    const pointer = isHighlighted ? chalk.cyan.bold('>') : ' ';
    const formattedStatus = `${pointer} ${statusBadge}`;

    return [
      formattedStatus,
      providerText,
      chalk.dim(detailsText),
      qualityText,
      priceText,
      actionText,
    ];
  }

  /**
   * Renders the complete Textual-inspired availability interface
   */
  static renderAvailability(
    matched: MatchedAvailability,
    options: RenderOptions = {}
  ): string {
    const lines: string[] = [];
    const region = options.region || 'US';

    // 1. Header Card
    lines.push(this.renderTitleCard(matched, region));
    lines.push('');

    // Combine user available streams
    const userStreams = [
      ...matched.paidSubscriptions,
      ...matched.includedFree,
      ...matched.freeTiers,
      ...matched.publicFree,
    ];

    let currentIndex = 0;
    const selectedIdx = options.selectedIndex ?? -1;

    // 2. Included Streams Section
    if (userStreams.length > 0) {
      lines.push(
        chalk.bold.green('  INCLUDED IN YOUR SERVICES & FREE PLATFORMS')
      );

      const table = this.createSectionTable();
      for (const src of userStreams) {
        const isHighlighted = options.interactive && currentIndex === selectedIdx;
        table.push(this.formatTableRow(src, isHighlighted));
        currentIndex++;
      }
      lines.push(table.toString());
      lines.push('');
    } else {
      lines.push(
        boxen(
          `${chalk.yellow.bold('[Notice] Not currently streaming on your active subscriptions or free tiers.')}\n\n` +
            `${chalk.dim('Tip: Use ')}${chalk.cyan('streamhunt "<title>" --all')}${chalk.dim(
              ' to view digital purchase/rental options and other streaming providers.'
            )}`,
          {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'yellow',
          }
        )
      );
      lines.push('');
    }

    // 3. Other Subscription Platforms (when --all is enabled)
    if (options.includeAll && matched.otherSubscriptions.length > 0) {
      lines.push(
        chalk.bold.gray('  OTHER SUBSCRIPTION PLATFORMS (Requires separate signup)')
      );

      const table = this.createSectionTable();
      for (const src of matched.otherSubscriptions) {
        const isHighlighted = options.interactive && currentIndex === selectedIdx;
        table.push(this.formatTableRow(src, isHighlighted));
        currentIndex++;
      }
      lines.push(table.toString());
      lines.push('');
    }

    // 4. Digital Purchase & Rental (VOD)
    const showVod = options.includeAll || matched.rent.length > 0 || matched.buy.length > 0;
    const vodSources = [...matched.rent, ...matched.buy];

    if (showVod && vodSources.length > 0) {
      lines.push(
        chalk.bold.magenta('  DIGITAL PURCHASE & RENTAL (VOD)')
      );

      const table = this.createSectionTable();
      for (const src of vodSources.slice(0, 8)) {
        const isHighlighted = options.interactive && currentIndex === selectedIdx;
        table.push(this.formatTableRow(src, isHighlighted));
        currentIndex++;
      }
      lines.push(table.toString());
      lines.push('');
    }

    // 5. Interactive Footer Bar
    if (options.interactive) {
      lines.push(
        chalk.dim(
          '  [Up/Down] Navigate  [Enter] Open Stream  [a] Toggle All/Rent  [/] New Search  [q] Quit'
        )
      );
    }

    return lines.join('\n');
  }

  /**
   * Renders the list of supported providers in the region with fixed-width tabular formatting
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

    const table = new Table({
      head: ['PROVIDER NAME', 'DEFAULT TYPE', 'SUPPORTED REGIONS'].map((h) =>
        chalk.cyan.bold(h)
      ),
      chars: {
        top: '─',
        'top-mid': '┬',
        'top-left': '┌',
        'top-right': '┐',
        bottom: '─',
        'bottom-mid': '┴',
        'bottom-left': '└',
        'bottom-right': '┘',
        left: '│',
        'left-mid': '├',
        mid: '─',
        'mid-mid': '┼',
        right: '│',
        'right-mid': '┤',
        middle: '│',
      },
      style: {
        'padding-left': 1,
        'padding-right': 1,
        head: [],
        border: ['dim'],
      },
    });

    for (const p of providers) {
      const typeLabel = p.type ? chalk.bold(p.type.toUpperCase()) : chalk.dim('-');
      const regionsList = p.regions ? p.regions.slice(0, 5).join(', ') : region;
      table.push([chalk.white.bold(p.name), typeLabel, chalk.dim(regionsList)]);
    }

    lines.push(table.toString());
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
