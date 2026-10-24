import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CacheManager } from '../src/cache.js';

describe('Local File Cache Manager', () => {
  const testDir = path.join(os.tmpdir(), `streamhunt-test-cache-${Date.now()}`);
  let cache: CacheManager;

  before(() => {
    cache = new CacheManager(testDir, 1000); // 1 second default TTL
  });

  after(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('stores and retrieves cached items', () => {
    cache.set('test_key', { title: 'Inception', year: 2010 });
    const val = cache.get<{ title: string; year: number }>('test_key');
    assert.deepEqual(val, { title: 'Inception', year: 2010 });
  });

  it('returns null for non-existent keys', () => {
    const val = cache.get('non_existent_key');
    assert.equal(val, null);
  });

  it('respects TTL expiration', async () => {
    cache.set('expiring_key', 'hello', 50); // 50ms TTL
    assert.equal(cache.get('expiring_key'), 'hello');

    // Wait 70ms for expiration
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.equal(cache.get('expiring_key'), null);
  });

  it('reports stats and clears cache', () => {
    cache.set('item1', 'value1');
    cache.set('item2', 'value2');

    const statsBefore = cache.stats();
    assert.ok(statsBefore.count >= 2);
    assert.ok(statsBefore.sizeBytes > 0);

    const cleared = cache.clear();
    assert.ok(cleared.count >= 2);

    const statsAfter = cache.stats();
    assert.equal(statsAfter.count, 0);
  });
});
