import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, formatHyperlink, shouldEmitHyperlinks } from '../src/utils/terminal.js';

function withForceHyperlink(value: string, fn: () => void): void {
  const original = process.env.FORCE_HYPERLINK;
  try {
    process.env.FORCE_HYPERLINK = value;
    fn();
  } finally {
    if (original !== undefined) {
      process.env.FORCE_HYPERLINK = original;
    } else {
      delete process.env.FORCE_HYPERLINK;
    }
  }
}

describe('Terminal Utilities & Hyperlinks', () => {
  it('normalizes URLs ensuring valid protocol', () => {
    assert.equal(normalizeUrl('https://disneyplus.com'), 'https://disneyplus.com');
    assert.equal(normalizeUrl('http://example.com'), 'http://example.com');
    assert.equal(normalizeUrl('//example.com/test'), 'https://example.com/test');
    assert.equal(normalizeUrl('netflix.com/title/123'), 'https://netflix.com/title/123');
    assert.equal(normalizeUrl(null), null);
    assert.equal(normalizeUrl(''), null);
  });

  it('respects FORCE_HYPERLINK override', () => {
    withForceHyperlink('1', () => assert.equal(shouldEmitHyperlinks(), true));
    withForceHyperlink('0', () => assert.equal(shouldEmitHyperlinks(), false));
  });

  it('renders an OSC 8 "Open Link" hyperlink when enabled', () => {
    withForceHyperlink('1', () => {
      const link = formatHyperlink('Open Link', 'https://disneyplus.com');
      assert.ok(link.startsWith('\u001b]8;;https://disneyplus.com\u0007'));
      assert.ok(link.endsWith('\u001b]8;;\u0007'));
      assert.ok(link.includes('Open Link'));
      assert.ok(!link.includes('Cmd') && !link.includes('Ctrl'));
    });
  });

  it('prints the raw URL when hyperlinks are disabled (piped output)', () => {
    withForceHyperlink('0', () => {
      const link = formatHyperlink('Open Link', 'https://disneyplus.com');
      assert.equal(link, 'https://disneyplus.com');
    });
  });
});
