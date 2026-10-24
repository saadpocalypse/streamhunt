import { z } from 'zod';

/**
 * User configuration stored in ~/.streamhunt/config.json
 */
export const ConfigSchema = z.object({
  api_key: z.string().optional(),
  region: z.string().default('US'),
  subscriptions: z.object({
    paid: z.array(z.string()).default(['Max', 'Philo']),
    free_tier_only: z.array(z.string()).default(['Sling TV', 'Plex']),
  }),
  always_include_public_free: z.boolean().default(true),
  include_rent_buy: z.boolean().default(false),
});

export type StreamHuntConfig = z.infer<typeof ConfigSchema>;
export type StreamFindConfig = StreamHuntConfig; // Backward compatibility alias

/**
 * Watchmode Search Result Item
 */
export const SearchResultItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string().optional().default('movie'),
  year: z.number().nullable().optional(),
  imdb_id: z.string().nullable().optional(),
  tmdb_id: z.number().nullable().optional(),
  tmdb_type: z.string().nullable().optional(),
  result_type: z.string().optional(),
});

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;

/**
 * Watchmode Search Response Schema
 */
export const SearchResponseSchema = z.object({
  title_results: z.array(SearchResultItemSchema).default([]),
  results: z.array(SearchResultItemSchema).optional(),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/**
 * Watchmode Source / Platform Item
 */
export const SourceItemSchema = z.object({
  source_id: z.number(),
  name: z.string(),
  type: z.enum(['sub', 'free', 'rent', 'buy', 'tv_everywhere']).or(z.string()),
  region: z.string().optional(),
  ios_url: z.string().nullable().optional(),
  android_url: z.string().nullable().optional(),
  web_url: z.string().nullable().optional(),
  format: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  seasons: z.number().nullable().optional(),
  episodes: z.number().nullable().optional(),
});

export type SourceItem = z.infer<typeof SourceItemSchema>;

/**
 * Watchmode Title Details Schema (optional enrichment)
 */
export const TitleDetailsSchema = z.object({
  id: z.number(),
  title: z.string(),
  plot_overview: z.string().nullable().optional(),
  type: z.string().optional(),
  year: z.number().nullable().optional(),
  genre_names: z.array(z.string()).optional(),
  user_rating: z.number().nullable().optional(),
  critic_score: z.number().nullable().optional(),
  runtime_minutes: z.number().nullable().optional(),
  poster: z.string().nullable().optional(),
  network_names: z.array(z.string()).optional(),
  end_year: z.number().nullable().optional(),
});

export type TitleDetails = z.infer<typeof TitleDetailsSchema>;

/**
 * Provider / Source metadata from /v1/sources/
 */
export const ProviderSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string().optional(),
  regions: z.array(z.string()).optional(),
});

export type Provider = z.infer<typeof ProviderSchema>;

/**
 * Categorized source for presentation
 */
export type MatchCategory =
  | 'paid_sub'
  | 'free_tier'
  | 'included_free'
  | 'public_free'
  | 'other_sub'
  | 'rent'
  | 'buy';

export interface CategorizedSource {
  sourceId: number;
  providerName: string;
  category: MatchCategory;
  type: string;
  format?: string | null;
  price?: number | null;
  webUrl?: string | null;
  badgeLabel: string;
  tagColor: 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'gray';
  subDescription?: string;
}

export interface MatchedAvailability {
  title: SearchResultItem;
  details?: TitleDetails | null;
  paidSubscriptions: CategorizedSource[];
  freeTiers: CategorizedSource[];
  includedFree: CategorizedSource[];
  publicFree: CategorizedSource[];
  otherSubscriptions: CategorizedSource[];
  rent: CategorizedSource[];
  buy: CategorizedSource[];
  totalAvailableSources: number;
  userAvailableCount: number;
}
