import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchSources, isProviderInList } from '../src/matcher.js';
import type { StreamHuntConfig, SourceItem, SearchResultItem } from '../src/types.js';

describe('Matcher and Categorization Engine', () => {
  const sampleConfig: StreamHuntConfig = {
    region: 'US',
    subscriptions: {
      paid: ['Max', 'Philo'],
      free_tier_only: ['Sling TV', 'Plex'],
    },
    always_include_public_free: true,
    include_rent_buy: false,
  };

  const sampleTitle: SearchResultItem = {
    id: 100,
    name: 'Sample Movie',
    type: 'movie',
    year: 2024,
  };

  it('correctly matches provider names dynamically without hardcoded dictionaries', () => {
    // Basic casing and brand token matching
    assert.equal(isProviderInList('Max', ['Max']), true);
    assert.equal(isProviderInList('HBO Max', ['Max']), true);
    assert.equal(isProviderInList('max', ['Max']), true);
    assert.equal(isProviderInList('Sling TV', ['Sling']), true);
    assert.equal(isProviderInList('Sling Freestream', ['Sling TV']), true);
    assert.equal(isProviderInList('Philo', ['philo']), true);
    assert.equal(isProviderInList('Netflix', ['Max', 'Philo']), false);

    // Symbols and affixes
    assert.equal(isProviderInList('Disney+', ['Disney +']), true);
    assert.equal(isProviderInList('Disney Plus', ['Disney+']), true);
    assert.equal(isProviderInList('AppleTV+', ['Apple TV Plus']), true);
    assert.equal(isProviderInList('Paramount+ with Showtime', ['Paramount+']), true);
    assert.equal(isProviderInList('Prime Video', ['Amazon Prime']), true);
    assert.equal(isProviderInList('Tubi TV', ['Tubi']), true);
    assert.equal(isProviderInList('The Roku Channel', ['Roku']), true);

    // Hosted channel parsing: base matches, but host does not grant unrelated add-ons
    assert.equal(isProviderInList('MAX (Via Amazon Prime)', ['Max']), true);
    assert.equal(isProviderInList('Max Roku Channel', ['Max']), true);
    assert.equal(isProviderInList('AMC+ Roku Channel', ['The Roku Channel']), false);
    assert.equal(isProviderInList('Cinemax', ['Max']), false);

    // Global / International services
    assert.equal(isProviderInList('Binge', ['Binge']), true);
    assert.equal(isProviderInList('BBC iPlayer', ['BBC iPlayer']), true);
    assert.equal(isProviderInList('Crave', ['Crave']), true);

    // Numeric source ID matching
    assert.equal(isProviderInList('Any Name', ['387'], 387), true);
  });

  it('categorizes paid subscriptions as [Paid Sub]', () => {
    const sources: SourceItem[] = [
      {
        source_id: 1,
        name: 'Max',
        type: 'sub',
        format: '4K',
        web_url: 'https://max.com',
      },
    ];

    const result = matchSources(sampleTitle, sources, sampleConfig);
    assert.equal(result.paidSubscriptions.length, 1);
    assert.equal(result.paidSubscriptions[0].providerName, 'Max');
    assert.equal(result.paidSubscriptions[0].category, 'paid_sub');
    assert.equal(result.paidSubscriptions[0].badgeLabel, '[Paid Sub]');
  });

  it('categorizes account free tiers as [Free Tier] with dynamic description', () => {
    const sources: SourceItem[] = [
      {
        source_id: 2,
        name: 'Sling TV',
        type: 'free',
        format: 'HD',
        web_url: 'https://sling.com',
      },
      {
        source_id: 99,
        name: 'Plex (Free Movies & TV)',
        type: 'free',
        format: 'HD',
        web_url: 'https://plex.tv',
      },
    ];

    const result = matchSources(sampleTitle, sources, sampleConfig);
    assert.equal(result.freeTiers.length, 2);
    assert.equal(result.freeTiers[0].providerName, 'Sling TV');
    assert.equal(result.freeTiers[0].category, 'free_tier');
    assert.equal(result.freeTiers[0].badgeLabel, '[Free Tier]');
    assert.equal(result.freeTiers[0].subDescription, '(Free)');

    // Parenthetical qualifier extracted dynamically
    assert.equal(result.freeTiers[1].subDescription, '(Free Movies & TV)');
  });

  it('categorizes free stream from paid subscription as [Included Free]', () => {
    // Max is in config.subscriptions.paid, but returned as free
    const sources: SourceItem[] = [
      {
        source_id: 1,
        name: 'Max',
        type: 'free',
        format: 'HD',
        web_url: 'https://max.com',
      },
    ];

    const result = matchSources(sampleTitle, sources, sampleConfig);
    assert.equal(result.includedFree.length, 1);
    assert.equal(result.includedFree[0].providerName, 'Max');
    assert.equal(result.includedFree[0].category, 'included_free');
    assert.equal(result.includedFree[0].badgeLabel, '[Included Free]');
  });

  it('categorizes open public free platforms as [Public Free]', () => {
    const sources: SourceItem[] = [
      {
        source_id: 3,
        name: 'Tubi',
        type: 'free',
        format: 'HD',
        web_url: 'https://tubitv.com',
      },
      {
        source_id: 4,
        name: 'Pluto TV',
        type: 'free',
        format: 'SD',
        web_url: 'https://pluto.tv',
      },
    ];

    const result = matchSources(sampleTitle, sources, sampleConfig);
    assert.equal(result.publicFree.length, 2);
    assert.equal(result.publicFree[0].providerName, 'Tubi');
    assert.equal(result.publicFree[0].category, 'public_free');
    assert.equal(result.publicFree[0].badgeLabel, '[Public Free]');
  });

  it('hides rent/buy unless --all is passed or config.include_rent_buy is true', () => {
    const sources: SourceItem[] = [
      {
        source_id: 5,
        name: 'Amazon Video',
        type: 'rent',
        price: 3.99,
        format: '4K',
      },
      {
        source_id: 6,
        name: 'Apple TV',
        type: 'buy',
        price: 9.99,
        format: '4K',
      },
    ];

    // Default config: include_rent_buy = false
    const withoutAll = matchSources(sampleTitle, sources, sampleConfig, null, {
      includeAll: false,
    });
    assert.equal(withoutAll.rent.length, 0);
    assert.equal(withoutAll.buy.length, 0);

    // With includeAll: true
    const withAll = matchSources(sampleTitle, sources, sampleConfig, null, {
      includeAll: true,
    });
    assert.equal(withAll.rent.length, 1);
    assert.equal(withAll.buy.length, 1);
    assert.equal(withAll.rent[0].price, 3.99);
    assert.equal(withAll.buy[0].price, 9.99);
  });

  it('shows other subscriptions when --all is enabled', () => {
    const sources: SourceItem[] = [
      {
        source_id: 7,
        name: 'Netflix',
        type: 'sub',
        format: '4K',
      },
    ];

    const result = matchSources(sampleTitle, sources, sampleConfig, null, {
      includeAll: true,
    });
    assert.equal(result.paidSubscriptions.length, 0);
    assert.equal(result.otherSubscriptions.length, 1);
    assert.equal(result.otherSubscriptions[0].providerName, 'Netflix');
    assert.equal(result.otherSubscriptions[0].category, 'other_sub');
  });

  it('deduplicates multiple source resolutions choosing highest quality and lowest price', () => {
    const sources: SourceItem[] = [
      {
        source_id: 8,
        name: 'Amazon Video',
        type: 'rent',
        price: 4.99,
        format: 'HD',
        web_url: 'https://amazon.com/hd',
      },
      {
        source_id: 8,
        name: 'Amazon Video',
        type: 'rent',
        price: 3.99,
        format: '4K',
        web_url: 'https://amazon.com/4k',
      },
    ];

    const result = matchSources(sampleTitle, sources, sampleConfig, null, {
      includeAll: true,
    });
    assert.equal(result.rent.length, 1);
    assert.equal(result.rent[0].format, '4K');
    assert.equal(result.rent[0].price, 3.99);
  });
});
