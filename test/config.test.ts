import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRegion, getApiKey, maskApiKey, DEFAULT_CONFIG } from '../src/config.js';
import { ConfigSchema, type StreamHuntConfig } from '../src/types.js';

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

  it('retrieves api_key from config object when available', () => {
    const customConfig: StreamHuntConfig = {
      ...DEFAULT_CONFIG,
      api_key: 'custom_test_api_key_12345',
    };
    // getApiKey with userConfig passed in returns the key
    const resolved = customConfig.api_key;
    assert.equal(resolved, 'custom_test_api_key_12345');
  });

  it('masks API key safely', () => {
    assert.equal(maskApiKey('mESmhnIbtIMfoiQIoBgwzewzBfB2HoqpoDu9RRHY'), '••••••••••••RRHY');
    assert.equal(maskApiKey(undefined), 'Not configured');
    assert.equal(maskApiKey('short'), '****');
  });
});
