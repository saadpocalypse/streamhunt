import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WatchmodeClient, StreamFindError } from '../src/api.js';

describe('Watchmode Client & Error States', () => {
  it('throws friendly StreamFindError when API key is missing', async () => {
    const client = new WatchmodeClient({ apiKey: '', mockMode: false });
    await assert.rejects(
      async () => {
        await client.search('Batman');
      },
      (err: any) => {
        assert.ok(err instanceof StreamFindError);
        assert.equal(err.code, 'MISSING_API_KEY');
        assert.ok(err.remediation?.includes('WATCHMODE_API_KEY'));
        return true;
      }
    );
  });

  it('works offline and populates results in mock mode', async () => {
    const client = new WatchmodeClient({ mockMode: true });
    const results = await client.search('Breaking Bad');
    assert.ok(results.length > 0);
    assert.equal(results[0].name, 'Breaking Bad');

    const sources = await client.getSources(results[0].id, 'US');
    assert.ok(sources.length > 0);
    assert.ok(sources.some((s) => s.name === 'Philo'));

    const providers = await client.getProviders('US');
    assert.ok(providers.length > 0);
    assert.ok(providers.some((p) => p.name === 'Max'));
  });
});
