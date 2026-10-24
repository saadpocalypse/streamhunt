import {
  SearchResponseSchema,
  SearchResultItemSchema,
  SourceItemSchema,
  TitleDetailsSchema,
  ProviderSchema,
  type SearchResultItem,
  type SourceItem,
  type TitleDetails,
  type Provider,
} from './types.js';
import { defaultCache, type CacheManager } from './cache.js';
import { getApiKey } from './config.js';
import {
  MOCK_SEARCH_RESULTS,
  MOCK_SOURCES,
  MOCK_TITLE_DETAILS,
  MOCK_PROVIDERS,
} from './utils/mockData.js';

export class StreamHuntError extends Error {
  public code: string;
  public remediation?: string;

  constructor(message: string, code: string = 'API_ERROR', remediation?: string) {
    super(message);
    this.name = 'StreamHuntError';
    this.code = code;
    this.remediation = remediation;
  }
}
export const StreamFindError = StreamHuntError;

export interface WatchmodeClientOptions {
  apiKey?: string;
  cache?: CacheManager;
  timeoutMs?: number;
  mockMode?: boolean;
}

export class WatchmodeClient {
  private apiKey?: string;
  private cache: CacheManager;
  private timeoutMs: number;
  private baseUrl = 'https://api.watchmode.com/v1';
  private mockMode: boolean;

  constructor(options: WatchmodeClientOptions = {}) {
    this.apiKey = options.apiKey ?? getApiKey();
    this.cache = options.cache ?? defaultCache;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.mockMode =
      options.mockMode ??
      (process.env.STREAMHUNT_MOCK === 'true' ||
        process.env.STREAMFIND_MOCK === 'true' ||
        false);
  }

  /**
   * Validates API key existence before network operations
   */
  private requireApiKey(): string {
    if (this.mockMode) return 'MOCK_KEY';
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new StreamHuntError(
        'Watchmode API key is missing.',
        'MISSING_API_KEY',
        'Add your key to .env (WATCHMODE_API_KEY=your_key) or visit https://api.watchmode.com/ to sign up for a free key.'
      );
    }
    return this.apiKey;
  }

  /**
   * Internal generic fetch with timeout, HTTP error checking, and rate limit detection
   */
  private async request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const key = this.requireApiKey();
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set('apiKey', key);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'streamhunt-cli/1.0.0',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new StreamHuntError(
            'Unauthorized: Invalid Watchmode API key provided.',
            'INVALID_API_KEY',
            'Verify your WATCHMODE_API_KEY in .env or at https://api.watchmode.com/'
          );
        }
        if (response.status === 429) {
          throw new StreamHuntError(
            'Watchmode API rate limit reached or quota exhausted.',
            'RATE_LIMIT_EXCEEDED',
            'Watchmode free tier allows limited requests per month. Check your quota at https://api.watchmode.com/'
          );
        }
        if (response.status === 404) {
          throw new StreamHuntError(
            'The requested resource was not found on Watchmode.',
            'NOT_FOUND'
          );
        }
        throw new StreamHuntError(
          `Watchmode API returned error status ${response.status}: ${response.statusText}`,
          'HTTP_ERROR'
        );
      }

      const json = await response.json();
      return json as T;
    } catch (err: any) {
      if (err instanceof StreamHuntError) {
        throw err;
      }
      if (err.name === 'AbortError') {
        throw new StreamHuntError(
          `Request to Watchmode timed out after ${this.timeoutMs}ms.`,
          'TIMEOUT',
          'Check your internet connection or try again later.'
        );
      }
      throw new StreamHuntError(
        `Network error while contacting Watchmode: ${err.message}`,
        'NETWORK_ERROR',
        'Verify your network connection.'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Search for a movie or TV show title
   */
  async search(query: string): Promise<SearchResultItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `search_${trimmed.toLowerCase()}`;
    const cached = this.cache.get<SearchResultItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.mockMode) {
      const normalized = trimmed.toLowerCase();
      const mockResult =
        MOCK_SEARCH_RESULTS[normalized] ||
        Object.entries(MOCK_SEARCH_RESULTS).find(([k]) =>
          normalized.includes(k) || k.includes(normalized)
        )?.[1] ||
        [
          {
            id: 9999999,
            name: trimmed,
            type: 'movie',
            year: new Date().getFullYear(),
            result_type: 'title',
          },
        ];
      this.cache.set(cacheKey, mockResult);
      return mockResult;
    }

    const raw = await this.request<any>('/search/', {
      search_field: 'name',
      search_value: trimmed,
      types: 'movie,tv',
    });

    // Watchmode search payload can return { title_results: [...] } or an array directly
    let items: any[] = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw && Array.isArray(raw.title_results)) {
      items = raw.title_results;
    } else if (raw && Array.isArray(raw.results)) {
      items = raw.results;
    }

    const validated: SearchResultItem[] = [];
    for (const item of items) {
      const parsed = SearchResultItemSchema.safeParse(item);
      if (parsed.success) {
        validated.push(parsed.data);
      }
    }

    this.cache.set(cacheKey, validated);
    return validated;
  }

  /**
   * Get streaming sources for a title in a given region
   */
  async getSources(titleId: number, region: string = 'US'): Promise<SourceItem[]> {
    const cacheKey = `sources_${titleId}_${region.toUpperCase()}`;
    const cached = this.cache.get<SourceItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.mockMode) {
      const mockSources = MOCK_SOURCES[titleId] || MOCK_SOURCES[3173903];
      this.cache.set(cacheKey, mockSources);
      return mockSources;
    }

    const raw = await this.request<any>(`/title/${titleId}/sources/`, {
      regions: region.toUpperCase(),
    });

    const items = Array.isArray(raw) ? raw : [];
    const validated: SourceItem[] = [];

    for (const item of items) {
      const parsed = SourceItemSchema.safeParse(item);
      if (parsed.success) {
        validated.push(parsed.data);
      }
    }

    this.cache.set(cacheKey, validated);
    return validated;
  }

  /**
   * Get metadata details for a title (plot, rating, genres)
   */
  async getTitleDetails(titleId: number): Promise<TitleDetails | null> {
    const cacheKey = `details_${titleId}`;
    const cached = this.cache.get<TitleDetails>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.mockMode) {
      const mockDetails = MOCK_TITLE_DETAILS[titleId] || null;
      if (mockDetails) {
        this.cache.set(cacheKey, mockDetails);
      }
      return mockDetails;
    }

    try {
      const raw = await this.request<any>(`/title/${titleId}/details/`, {});
      const parsed = TitleDetailsSchema.safeParse(raw);
      if (parsed.success) {
        this.cache.set(cacheKey, parsed.data);
        return parsed.data;
      }
      return null;
    } catch {
      // Non-critical: Title details enrichment can fail gracefully without breaking sources
      return null;
    }
  }

  /**
   * List all providers supported by Watchmode in a region
   */
  async getProviders(region: string = 'US'): Promise<Provider[]> {
    const cacheKey = `providers_${region.toUpperCase()}`;
    const cached = this.cache.get<Provider[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.mockMode) {
      this.cache.set(cacheKey, MOCK_PROVIDERS);
      return MOCK_PROVIDERS;
    }

    const raw = await this.request<any>('/sources/', {
      regions: region.toUpperCase(),
    });

    const items = Array.isArray(raw) ? raw : [];
    const validated: Provider[] = [];

    for (const item of items) {
      const parsed = ProviderSchema.safeParse(item);
      if (parsed.success) {
        validated.push(parsed.data);
      }
    }

    // Sort alphabetically by name
    validated.sort((a, b) => a.name.localeCompare(b.name));
    this.cache.set(cacheKey, validated);
    return validated;
  }
}
