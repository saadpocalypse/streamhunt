import type {
  SourceItem,
  StreamHuntConfig,
  StreamFindConfig,
  SearchResultItem,
  TitleDetails,
  CategorizedSource,
  MatchedAvailability,
} from './types.js';

/**
 * Common provider name aliases to ensure robust matching even with slight naming variations
 */
const PROVIDER_ALIASES: Record<string, string[]> = {
  max: ['max', 'hbo max', 'hbo'],
  'hbo max': ['max', 'hbo max', 'hbo'],
  'sling tv': ['sling tv', 'sling', 'sling freestream'],
  sling: ['sling tv', 'sling', 'sling freestream'],
  philo: ['philo', 'philo free', 'philo free channels'],
  'prime video': ['prime video', 'amazon prime video', 'amazon prime', 'amazon'],
  'amazon prime video': ['prime video', 'amazon prime video', 'amazon prime', 'amazon'],
  'apple tv+': ['apple tv+', 'apple tv plus', 'apple tv'],
  'disney+': ['disney+', 'disney plus', 'disney'],
  'paramount+': ['paramount+', 'paramount plus', 'paramount'],
  peacock: ['peacock', 'peacock premium'],
  plex: ['plex', 'plex free movies & tv'],
  tubi: ['tubi', 'tubi tv'],
  'pluto tv': ['pluto tv', 'pluto'],
  'the roku channel': ['the roku channel', 'roku channel', 'roku'],
  'roku channel': ['the roku channel', 'roku channel', 'roku'],
  cineverse: ['cineverse', 'cineverse tv'],
  'cineverse tv': ['cineverse', 'cineverse tv'],
  youtube: ['youtube', 'youtube free', 'youtube movies'],
  'google tv freeplay': ['google tv freeplay', 'google play', 'google tv', 'google'],
  hoopla: ['hoopla'],
};

/**
 * Normalizes a provider name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Checks if a given provider name matches any item in the target list
 */
export function isProviderInList(providerName: string, list: string[]): boolean {
  if (!list || list.length === 0) return false;

  const normalizedProvider = normalizeName(providerName);
  const lowerProvider = providerName.toLowerCase().trim();

  for (const item of list) {
    const normalizedItem = normalizeName(item);
    const lowerItem = item.toLowerCase().trim();

    // Exact match or normalized match
    if (lowerProvider === lowerItem || normalizedProvider === normalizedItem) {
      return true;
    }

    // Check alias dictionary
    const aliases = PROVIDER_ALIASES[lowerItem] || PROVIDER_ALIASES[normalizedItem] || [];
    if (
      aliases.some(
        (alias) =>
          normalizeName(alias) === normalizedProvider ||
          lowerProvider.includes(alias) ||
          alias.includes(lowerProvider)
      )
    ) {
      return true;
    }

    // Check if one contains the other (e.g. "Sling TV" contains "Sling")
    if (
      (normalizedProvider.length > 3 && normalizedItem.includes(normalizedProvider)) ||
      (normalizedItem.length > 3 && normalizedProvider.includes(normalizedItem))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Format comparison score to choose best quality stream (4K > HD > SD)
 */
function getFormatScore(format?: string | null): number {
  if (!format) return 0;
  const f = format.toUpperCase();
  if (f.includes('4K') || f.includes('UHD')) return 3;
  if (f.includes('HD') || f.includes('1080') || f.includes('720')) return 2;
  if (f.includes('SD') || f.includes('480')) return 1;
  return 0;
}

/**
 * Deduplicate sources by provider name and type, picking the highest format and lowest price
 */
function deduplicateSources(sources: SourceItem[]): SourceItem[] {
  const map = new Map<string, SourceItem>();

  for (const src of sources) {
    const key = `${normalizeName(src.name)}_${src.type}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, src);
      continue;
    }

    // Merge: pick the best format and lowest price
    const existingScore = getFormatScore(existing.format);
    const currentScore = getFormatScore(src.format);

    let preferred = existing;

    // Quality check
    if (currentScore > existingScore) {
      preferred = src;
    }

    // Price check for rent/buy: pick the lower price
    if (src.type === 'rent' || src.type === 'buy') {
      if (
        src.price !== null &&
        src.price !== undefined &&
        (existing.price === null || existing.price === undefined || src.price < existing.price)
      ) {
        preferred = src;
      }
    }

    // Keep web_url if the preferred one is missing but other has it
    if (!preferred.web_url && (existing.web_url || src.web_url)) {
      preferred = {
        ...preferred,
        web_url: existing.web_url || src.web_url,
      };
    }

    map.set(key, preferred);
  }

  return Array.from(map.values());
}

export interface MatchOptions {
  includeAll?: boolean;
}

/**
 * Categorize raw Watchmode sources against user configuration
 */
export function matchSources(
  title: SearchResultItem,
  rawSources: SourceItem[],
  config: StreamFindConfig,
  details?: TitleDetails | null,
  options: MatchOptions = {}
): MatchedAvailability {
  const deduped = deduplicateSources(rawSources);

  const paidSubscriptions: CategorizedSource[] = [];
  const freeTiers: CategorizedSource[] = [];
  const includedFree: CategorizedSource[] = [];
  const publicFree: CategorizedSource[] = [];
  const otherSubscriptions: CategorizedSource[] = [];
  const rent: CategorizedSource[] = [];
  const buy: CategorizedSource[] = [];

  const paidList = config.subscriptions.paid || [];
  const freeTierList = config.subscriptions.free_tier_only || [];
  const includeRentBuy = options.includeAll || config.include_rent_buy;

  for (const src of deduped) {
    const isPaidUserSub = isProviderInList(src.name, paidList);
    const isFreeTierUserAcc = isProviderInList(src.name, freeTierList);

    if (src.type === 'sub') {
      if (isPaidUserSub) {
        paidSubscriptions.push({
          sourceId: src.source_id,
          providerName: src.name,
          category: 'paid_sub',
          type: src.type,
          format: src.format,
          price: src.price,
          webUrl: src.web_url,
          badgeLabel: '[Paid Sub]',
          tagColor: 'green',
        });
      } else {
        // Other subscription service not in user's paid list
        otherSubscriptions.push({
          sourceId: src.source_id,
          providerName: src.name,
          category: 'other_sub',
          type: src.type,
          format: src.format,
          price: src.price,
          webUrl: src.web_url,
          badgeLabel: '[Other Sub]',
          tagColor: 'gray',
          subDescription: 'Subscription required',
        });
      }
    } else if (src.type === 'free') {
      if (isFreeTierUserAcc) {
        // Free tier account like Sling Freestream, Plex free channels
        freeTiers.push({
          sourceId: src.source_id,
          providerName: src.name,
          category: 'free_tier',
          type: src.type,
          format: src.format,
          price: src.price,
          webUrl: src.web_url,
          badgeLabel: '[Free Tier]',
          tagColor: 'yellow',
          subDescription: '(Freestream / Free channels)',
        });
      } else if (isPaidUserSub) {
        // Provider is in user's paid subscriptions, but content is streamed free
        includedFree.push({
          sourceId: src.source_id,
          providerName: src.name,
          category: 'included_free',
          type: src.type,
          format: src.format,
          price: src.price,
          webUrl: src.web_url,
          badgeLabel: '[Included Free]',
          tagColor: 'green',
        });
      } else if (config.always_include_public_free) {
        // Open public free platform (Tubi, Pluto TV, etc.)
        publicFree.push({
          sourceId: src.source_id,
          providerName: src.name,
          category: 'public_free',
          type: src.type,
          format: src.format,
          price: src.price,
          webUrl: src.web_url,
          badgeLabel: '[Public Free]',
          tagColor: 'blue',
          subDescription: '(Ad-supported)',
        });
      }
    } else if (src.type === 'rent') {
      if (includeRentBuy) {
        rent.push({
          sourceId: src.source_id,
          providerName: src.name,
          category: 'rent',
          type: src.type,
          format: src.format,
          price: src.price,
          webUrl: src.web_url,
          badgeLabel: '[Rent]',
          tagColor: 'magenta',
        });
      }
    } else if (src.type === 'buy') {
      if (includeRentBuy) {
        buy.push({
          sourceId: src.source_id,
          providerName: src.name,
          category: 'buy',
          type: src.type,
          format: src.format,
          price: src.price,
          webUrl: src.web_url,
          badgeLabel: '[Buy]',
          tagColor: 'cyan',
        });
      }
    }
  }

  // Sort rent and buy by price ascending
  rent.sort((a, b) => (a.price ?? 999) - (b.price ?? 999));
  buy.sort((a, b) => (a.price ?? 999) - (b.price ?? 999));

  // Count how many streams are readily accessible without extra purchase
  const userAvailableCount =
    paidSubscriptions.length +
    freeTiers.length +
    includedFree.length +
    publicFree.length;

  return {
    title,
    details,
    paidSubscriptions,
    freeTiers,
    includedFree,
    publicFree,
    otherSubscriptions,
    rent,
    buy,
    totalAvailableSources: deduped.length,
    userAvailableCount,
  };
}
