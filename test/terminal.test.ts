import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl,
  getModifierKey,
  formatHyperlink,
  supportsOsc8Hyperlinks,
} from '../src/utils/terminal.js';

describe('Terminal Utilities & Cross-Platform Link Handling', () => {
  it('normalizes URLs ensuring valid protocol', () => {
    assert.equal(normalizeUrl('https://disneyplus.com'), 'https://disneyplus.com');
    assert.equal(normalizeUrl('http://example.com'), 'http://example.com');
    assert.equal(normalizeUrl('//example.com/test'), 'https://example.com/test');
    assert.equal(normalizeUrl('netflix.com/title/123'), 'https://netflix.com/title/123');
    assert.equal(normalizeUrl(null), null);
    assert.equal(normalizeUrl(''), null);
  });

  it('resolves correct platform modifier key', () => {
    const mod = getModifierKey();
    if (process.platform === 'darwin') {
      assert.equal(mod, 'Cmd');
    } else {
      assert.equal(mod, 'Ctrl');
    }
  });

  it('respects FORCE_HYPERLINK environment override', () => {
    const original = process.env.FORCE_HYPERLINK;
    try {
      process.env.FORCE_HYPERLINK = '1';
      assert.equal(supportsOsc8Hyperlinks(), true);

      process.env.FORCE_HYPERLINK = '0';
      assert.equal(supportsOsc8Hyperlinks(), false);
    } finally {
      if (original !== undefined) {
        process.env.FORCE_HYPERLINK = original;
      } else {
        delete process.env.FORCE_HYPERLINK;
      }
    }
  });

  it('formats OSC 8 hyperlinks with styling inside escape bounds when supported', () => {
    const original = process.env.FORCE_HYPERLINK;
    try {
      process.env.FORCE_HYPERLINK = '1';
      const link = formatHyperlink('Open Link', 'https://disneyplus.com');
      // Must contain standard OSC 8 escape prefix and suffix
      assert.ok(link.includes('\u001b]8;;https://disneyplus.com\u0007'));
      assert.ok(link.includes('\u001b]8;;\u0007'));
      assert.ok(link.includes('Open Link'));
    } finally {
      if (original !== undefined) {
        process.env.FORCE_HYPERLINK = original;
      } else {
        delete process.env.FORCE_HYPERLINK;
      }
    }
  });

  it('falls back to styled raw URL when hyperlinks are disabled', () => {
    const original = process.env.FORCE_HYPERLINK;
    try {
      process.env.FORCE_HYPERLINK = '0';
      const link = formatHyperlink('Open Link', 'https://disneyplus.com');
      assert.ok(!link.includes('\u001b]8;;'));
      assert.ok(link.includes('https://disneyplus.com'));
    } finally {
      if (original !== undefined) {
        process.env.FORCE_HYPERLINK = original;
      } else {
        delete process.env.FORCE_HYPERLINK;
      }
    }
  });
});

