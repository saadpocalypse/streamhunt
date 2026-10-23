import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import dotenv from 'dotenv';
import { ConfigSchema, type StreamFindConfig } from './types.js';

// Load .env quietly
dotenv.config({ quiet: true });

// Also check project directory .env if executing globally or from another cwd
const projectEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(projectEnvPath)) {
  dotenv.config({ path: projectEnvPath, override: false, quiet: true });
}

// Check user home config dir: ~/.streamfind/
const CONFIG_DIR = path.join(os.homedir(), '.streamfind');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const HOME_ENV_FILE = path.join(CONFIG_DIR, '.env');

if (fs.existsSync(HOME_ENV_FILE)) {
  dotenv.config({ path: HOME_ENV_FILE, override: false, quiet: true });
}

export const DEFAULT_CONFIG: StreamFindConfig = {
  region: 'US',
  subscriptions: {
    paid: ['Max', 'Philo'],
    free_tier_only: ['Sling TV', 'Plex'],
  },
  always_include_public_free: true,
  include_rent_buy: false,
};

/**
 * Returns the path to the user's config directory (~/.streamfind)
 */
export function getConfigDir(): string {
  return CONFIG_DIR;
}

/**
 * Returns the path to the user's config.json file
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * Loads user config from ~/.streamfind/config.json.
 * If file does not exist, automatically creates it with default values.
 */
export function loadUserConfig(): StreamFindConfig {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    if (!fs.existsSync(CONFIG_FILE)) {
      saveUserConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }

    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsedJson = JSON.parse(raw);
    const validated = ConfigSchema.safeParse(parsedJson);

    if (!validated.success) {
      // Merge with default config if some fields are missing
      const merged = {
        ...DEFAULT_CONFIG,
        ...(typeof parsedJson === 'object' && parsedJson !== null ? parsedJson : {}),
        subscriptions: {
          ...DEFAULT_CONFIG.subscriptions,
          ...(parsedJson?.subscriptions || {}),
        },
      };
      const revalidated = ConfigSchema.parse(merged);
      saveUserConfig(revalidated);
      return revalidated;
    }

    return validated.data;
  } catch (error) {
    // If corrupted or unreadable, fallback to default
    return DEFAULT_CONFIG;
  }
}

/**
 * Saves user configuration to ~/.streamfind/config.json
 */
export function saveUserConfig(config: StreamFindConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Retrieves the Watchmode API key from environment variables.
 */
export function getApiKey(): string | undefined {
  return (
    process.env.WATCHMODE_API_KEY?.trim() ||
    process.env.STREAMFIND_API_KEY?.trim() ||
    undefined
  );
}

/**
 * Resolves the target region code (e.g., 'US', 'GB', 'CA').
 * Priority: CLI flag > STREAMFIND_DEFAULT_REGION env > user config.region > 'US'
 */
export function resolveRegion(cliRegion?: string, userConfig?: StreamFindConfig): string {
  if (cliRegion && cliRegion.trim().length > 0) {
    return cliRegion.trim().toUpperCase();
  }
  if (userConfig?.region && userConfig.region.trim().length > 0) {
    return userConfig.region.trim().toUpperCase();
  }
  if (process.env.STREAMFIND_DEFAULT_REGION && process.env.STREAMFIND_DEFAULT_REGION.trim().length > 0) {
    return process.env.STREAMFIND_DEFAULT_REGION.trim().toUpperCase();
  }
  const config = loadUserConfig();
  return (config.region || 'US').toUpperCase();
}
