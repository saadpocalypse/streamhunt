import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export interface CacheEntry<T> {
  key: string;
  timestamp: number;
  ttlMs: number;
  data: T;
}

export interface CacheStats {
  count: number;
  sizeBytes: number;
  location: string;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class CacheManager {
  private cacheDir: string;
  private defaultTtlMs: number;

  constructor(customDir?: string, defaultTtlMs: number = DEFAULT_TTL_MS) {
    this.cacheDir = customDir || path.join(os.homedir(), '.cache', 'streamhunt');
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Ensure cache directory exists
   */
  private ensureDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Generates a safe file name for a cache key
   */
  private getFilePath(key: string): string {
    const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
    // Sanitize key prefix for human-inspectable debug filenames
    const sanitizedPrefix = key
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 32);
    return path.join(this.cacheDir, `${sanitizedPrefix}_${hash}.json`);
  }

  /**
   * Retrieve cached value if not expired
   */
  get<T>(key: string): T | null {
    try {
      const filePath = this.getFilePath(key);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry<T>;

      const isExpired = Date.now() - entry.timestamp > entry.ttlMs;
      if (isExpired) {
        // Evict expired entry asynchronously
        fs.unlink(filePath, () => {});
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * Save a value into cache with TTL
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    try {
      this.ensureDir();
      const filePath = this.getFilePath(key);
      const entry: CacheEntry<T> = {
        key,
        timestamp: Date.now(),
        ttlMs: ttlMs ?? this.defaultTtlMs,
        data,
      };
      fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
    } catch (err) {
      // Non-blocking: fail quietly on cache write issues
    }
  }

  /**
   * Clear all cache files
   */
  clear(): { count: number; sizeBytes: number } {
    let count = 0;
    let sizeBytes = 0;

    try {
      if (!fs.existsSync(this.cacheDir)) {
        return { count: 0, sizeBytes: 0 };
      }

      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const fullPath = path.join(this.cacheDir, file);
          try {
            const stats = fs.statSync(fullPath);
            sizeBytes += stats.size;
            fs.unlinkSync(fullPath);
            count++;
          } catch {
            // Ignore unremovable files
          }
        }
      }
    } catch {
      // Ignore
    }

    return { count, sizeBytes };
  }

  /**
   * Get cache directory statistics
   */
  stats(): CacheStats {
    let count = 0;
    let sizeBytes = 0;

    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const fullPath = path.join(this.cacheDir, file);
              const stats = fs.statSync(fullPath);
              sizeBytes += stats.size;
              count++;
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    return {
      count,
      sizeBytes,
      location: this.cacheDir,
    };
  }
}

export const defaultCache = new CacheManager();
