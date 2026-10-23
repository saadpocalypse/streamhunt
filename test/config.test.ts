import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRegion, DEFAULT_CONFIG } from '../src/config.js';
import { ConfigSchema } from '../src/types.js';

describe('Config Management', () => {
  it('validates default config against schema', () => {
    const parsed = ConfigSchema.safeParse(DEFAULT_CONFIG);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.data.subscriptions.paid, ['Max', 'Philo']);
      assert.deepEqual(parsed.data.subscriptions.free_tier_only, ['Sling TV', 'Plex']);
      assert.equal(parsed.data.always_include_public_free, true);
      assert.equal(parsed.data.include_rent_buy, false);
      assert.equal(parsed.data.region, 'US');
    }
  });

  it('correctly resolves region priority', () => {
    // 1. CLI flag takes precedence
    assert.equal(resolveRegion('GB'), 'GB');
    assert.equal(resolveRegion('ca'), 'CA');

    // 2. User config fallback when CLI is omitted
    const customConfig = { ...DEFAULT_CONFIG, region: 'AU' };
    assert.equal(resolveRegion(undefined, customConfig), 'AU');
  });

  it('handles partial config gracefully with defaults', () => {
    const partial = {
      subscriptions: {
        paid: ['Netflix'],
      },
    };
    const parsed = ConfigSchema.parse(partial);
    assert.equal(parsed.region, 'US');
    assert.deepEqual(parsed.subscriptions.paid, ['Netflix']);
    assert.deepEqual(parsed.subscriptions.free_tier_only, ['Sling TV', 'Plex']);
    assert.equal(parsed.always_include_public_free, true);
  });
});
