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
/**
 * Universal entertainment service noise words (carrier types, distribution terms,
 * affixes) that do not distinguish the core brand identity.
 */
const NOISE_WORDS = new Set([
  'the',
  'tv',
  'channel',
  'channels',
  'app',
  'network',
  'networks',
  'video',
  'videos',
  'media',
  'stream',
  'streaming',
  'subscription',
  'subscriptions',
  'on',
  'demand',
  'live',
  'digital',
  'plus',
  'freeplay',
]);

/**
 * Cleans and canonicalizes strings by expanding symbols and separating compound identifiers
 */
export function cleanString(str: string): string {
  return str
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/tv/gi, ' tv ') // splits concatenated names like AppleTV -> Apple TV
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes a string into canonical words
 */
export function normalizeTokens(str: string): string[] {
  return cleanString(str).split(' ').filter(Boolean);
}

/**
 * Extracts core brand tokens by filtering out generic media/carrier noise words
 */
export function getBrandTokens(str: string): string[] {
  const tokens = normalizeTokens(str);
  const filtered = tokens.filter((t) => !NOISE_WORDS.has(t));
  return filtered.length > 0 ? filtered : tokens;
}

export interface ParsedWatchmodeSource {
  baseName: string;
  hostName: string | null;
}

/**
 * Decomposes Watchmode source naming conventions into base service and carrier/host platform:
 * - "Base (Via Host)" -> e.g. "HBO Max (Via Amazon Prime)" => base: "HBO Max", host: "Amazon Prime"
 * - "Base on Host" -> e.g. "Hulu on Disney+" => base: "Hulu", host: "Disney+"
 * - "Base Host Channel" -> e.g. "Max Roku Channel" => base: "Max", host: "Roku"
 */
export function parseWatchmodeSourceName(rawName: string): ParsedWatchmodeSource {
  const name = rawName.trim();

  // Pattern 1: Base (Via Host) or Base (on Host)
  const viaMatch = name.match(/^(.*?)\s*\((?:via|on)\s+(.*?)\)$/i);
  if (viaMatch) {
    return {
      baseName: viaMatch[1].trim(),
      hostName: viaMatch[2].trim(),
    };
  }

  // Pattern 2: Base on Host
  const onMatch = name.match(/^(.*?)\s+on\s+(.*)$/i);
  if (onMatch) {
    return {
      baseName: onMatch[1].trim(),
      hostName: onMatch[2].trim(),
    };
  }

  // Pattern 3: Add-on Channel: Base Host Channel (e.g. "Max Roku Channel", "AMC+ Amazon Channel")
  // Exclude when the platform itself is the brand (e.g. "The Roku Channel", "Apple TV Channel")
  if (
    !name.match(/^(the\s+)?roku\s+channel$/i) &&
    !name.match(/^(the\s+)?apple\s*tv(\s*channel)?$/i)
  ) {
    const chanMatch = name.match(/^(.*?)\s+(amazon|roku|apple\s*tv)\s+channel$/i);
    if (chanMatch) {
      return {
        baseName: chanMatch[1].trim(),
        hostName: chanMatch[2].trim(),
      };
    }
  }

  return {
    baseName: name,
    hostName: null,
  };
}

/**
 * Dynamically compares a Watchmode source name against a user-configured provider item
 * using token brand analysis without any hardcoded dictionary.
 */
export function matchesProvider(sourceName: string, userItem: string, sourceId?: number): boolean {
  const trimmedUser = userItem.trim();
  if (!trimmedUser) return false;

  // Direct source_id match if user configured numeric IDs (e.g. "387" or "26")
  if (sourceId !== undefined && !Number.isNaN(Number(trimmedUser))) {
    if (sourceId === parseInt(trimmedUser, 10)) {
      return true;
    }
  }

  const sParsed = parseWatchmodeSourceName(sourceName);
  const uParsed = parseWatchmodeSourceName(trimmedUser);

  // 1. Exact cleaned string match
  const sClean = cleanString(sParsed.baseName);
  const uClean = cleanString(uParsed.baseName);
  if (sClean === uClean) return true;

  // 2. Compact alphanumeric match
  const sCompact = sClean.replace(/\s+/g, '');
  const uCompact = uClean.replace(/\s+/g, '');
  if (sCompact === uCompact) return true;

  // 3. Core brand tokens exact match
  const sBrand = getBrandTokens(sParsed.baseName);
  const uBrand = getBrandTokens(uParsed.baseName);
  if (sBrand.join(' ') === uBrand.join(' ')) return true;

  // 4. Token set containment (e.g. "Max" in "HBO Max", "Prime" in "Prime Video", "Disney" in "Disney+")
  const sSet = new Set(sBrand);
  const uSet = new Set(uBrand);

  const uInS = uBrand.every((t) => sSet.has(t));
  const sInU = sBrand.every((t) => uSet.has(t));

  // Safeguard: Ensure tokens are substantial (length >= 3) to prevent accidental collisions
  const minLen = Math.min(...uBrand.map((t) => t.length), ...sBrand.map((t) => t.length));
  if (minLen >= 3 && (uInS || sInU)) {
    return true;
  }

  // 5. If user specifically configured a hosted channel, verify both base and host
  if (sParsed.hostName && uParsed.hostName) {
    const sHostBrand = getBrandTokens(sParsed.hostName);
    const uHostBrand = getBrandTokens(uParsed.hostName);
    if (sHostBrand.some((t) => uHostBrand.includes(t)) && (uInS || sInU)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a given provider name matches any item in the target list
 */
export function isProviderInList(
  providerName: string,
  list: string[],
  sourceId?: number
): boolean {
  if (!list || list.length === 0) return false;

  for (const item of list) {
    if (matchesProvider(providerName, item, sourceId)) {
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
 * Normalizes a provider name for deduplication grouping
 */
function normalizeForGrouping(name: string): string {
  const parsed = parseWatchmodeSourceName(name);
  const brand = getBrandTokens(parsed.baseName).join('');
  return brand || cleanString(name).replace(/\s+/g, '');
}

/**
 * Deduplicate sources by provider name and type, picking the highest format and lowest price
 */
function deduplicateSources(sources: SourceItem[]): SourceItem[] {
  const map = new Map<string, SourceItem>();

  for (const src of sources) {
    const key = `${normalizeForGrouping(src.name)}_${src.type}`;
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

/**
 * Derives a dynamic description for free/freemium sources from Watchmode metadata
 */
function getFreeSubDescription(sourceName: string): string {
  const parsed = parseWatchmodeSourceName(sourceName);
  if (parsed.hostName) {
    return `(Via ${parsed.hostName})`;
  }

  // If the source name contains an explicit parenthetical qualifier, preserve it
  const parenMatch = sourceName.match(/\(([^)]+)\)/);
  if (parenMatch) {
    return `(${parenMatch[1].trim()})`;
  }

  return '(Free)';
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
    const isPaidUserSub = isProviderInList(src.name, paidList, src.source_id);
    const isFreeTierUserAcc = isProviderInList(src.name, freeTierList, src.source_id);

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
          subDescription: getFreeSubDescription(src.name),
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
