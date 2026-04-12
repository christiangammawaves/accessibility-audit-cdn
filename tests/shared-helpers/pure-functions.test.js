/**
 * Tests for pure functions in scripts/shared-helpers.js
 * These functions have no DOM dependency and can run in pure Node.js.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadScripts } from '../helpers/load-script.js';
import { createDOMOverrides } from '../helpers/mock-dom.js';

let ctx;
let domCtx;

beforeAll(() => {
  ctx = loadScripts(['scripts/version.js', 'scripts/shared-helpers.js']);
  const domOverrides = createDOMOverrides('<!DOCTYPE html><html><body></body></html>');
  domCtx = loadScripts(['scripts/version.js', 'scripts/shared-helpers.js'], domOverrides);
});

// ============================================================================
// normalizeSelector()
// ============================================================================

describe('normalizeSelector', () => {
  it('returns "unknown" for null/undefined/empty input', () => {
    expect(ctx.a11yHelpers.normalizeSelector(null)).toBe('unknown');
    expect(ctx.a11yHelpers.normalizeSelector(undefined)).toBe('unknown');
    expect(ctx.a11yHelpers.normalizeSelector('')).toBe('unknown');
  });

  it('normalizes :nth-child(1) to :first-child', () => {
    expect(ctx.a11yHelpers.normalizeSelector('div:nth-child(1)')).toBe('div:first-child');
  });

  it('normalizes :nth-last-child(1) to :last-child', () => {
    expect(ctx.a11yHelpers.normalizeSelector('li:nth-last-child(1)')).toBe('li:last-child');
  });

  it('replaces Shopify section IDs with [data-shopify-section]', () => {
    const result = ctx.a11yHelpers.normalizeSelector('#shopify-section-header');
    expect(result).toBe('[data-shopify-section]');
  });

  it('replaces dynamic IDs like #abc-123 with [id]', () => {
    const result = ctx.a11yHelpers.normalizeSelector('#section-42');
    expect(result).toBe('[id]');
  });

  it('normalizes React/Vue dynamic classes', () => {
    const result = ctx.a11yHelpers.normalizeSelector('div.component_a1b2c3d4e5');
    expect(result).toBe('div[class]');
  });

  it('normalizes whitespace', () => {
    expect(ctx.a11yHelpers.normalizeSelector('div   >   span')).toBe('div > span');
  });

  it('passes through selectors that need no normalization', () => {
    expect(ctx.a11yHelpers.normalizeSelector('div.my-class')).toBe('div.my-class');
    expect(ctx.a11yHelpers.normalizeSelector('button[role="tab"]')).toBe('button[role="tab"]');
  });

  it(':nth-child(2) is normalized to :nth-child(*) for dedup grouping', () => {
    expect(ctx.a11yHelpers.normalizeSelector('li:nth-child(2)')).toBe('li:nth-child(*)');
    expect(ctx.a11yHelpers.normalizeSelector('li:nth-child(3)')).toBe('li:nth-child(*)');
    expect(ctx.a11yHelpers.normalizeSelector('div:nth-of-type(5)')).toBe('div:nth-of-type(*)');
    expect(ctx.a11yHelpers.normalizeSelector('span:nth-last-child(2)')).toBe('span:nth-last-child(*)');
    expect(ctx.a11yHelpers.normalizeSelector('p:nth-last-of-type(3)')).toBe('p:nth-last-of-type(*)');
  });
});

// ============================================================================
// createDedupeKey()
// ============================================================================

describe('createDedupeKey', () => {
  it('creates key from selector|wcag|message', () => {
    const key = ctx.a11yHelpers.createDedupeKey({
      selector: 'img.hero',
      wcag: '1.1.1',
      message: 'Image missing alt text',
    });
    expect(key).toBe('img.hero|1.1.1|image missing alt text');
  });

  it('normalizes the selector in the key', () => {
    const key = ctx.a11yHelpers.createDedupeKey({
      selector: 'div:nth-child(1)',
      wcag: '1.3.1',
      message: 'Test',
    });
    expect(key).toContain(':first-child');
  });

  it('truncates message to 50 chars', () => {
    const longMessage = 'A'.repeat(100);
    const key = ctx.a11yHelpers.createDedupeKey({
      selector: 'div',
      wcag: '1.1.1',
      message: longMessage,
    });
    const messagePart = key.split('|')[2];
    expect(messagePart.length).toBe(50);
  });

  it('falls back to "unknown" for missing fields', () => {
    const key = ctx.a11yHelpers.createDedupeKey({});
    expect(key).toBe('unknown|unknown|');
  });

  it('uses issue property as fallback for message', () => {
    const key = ctx.a11yHelpers.createDedupeKey({
      selector: 'a',
      wcag: '2.4.4',
      issue: 'Link has no purpose',
    });
    expect(key).toContain('link has no purpose');
  });

  it('message exactly 50 chars stays exactly 50 chars (boundary)', () => {
    const exactMessage = 'B'.repeat(50);
    const key = ctx.a11yHelpers.createDedupeKey({
      selector: 'div',
      wcag: '2.1.1',
      message: exactMessage,
    });
    const messagePart = key.split('|')[2];
    expect(messagePart.length).toBe(50);
  });

  it('empty message produces empty message part in key', () => {
    const key = ctx.a11yHelpers.createDedupeKey({
      selector: 'div',
      wcag: '1.3.1',
      message: '',
    });
    const messagePart = key.split('|')[2];
    expect(messagePart).toBe('');
  });
});

// ============================================================================
// deduplicateIssues()
// ============================================================================

describe('deduplicateIssues', () => {
  it('removes exact duplicates', () => {
    const issues = [
      { selector: 'img', wcag: '1.1.1', message: 'Missing alt', severity: 'serious' },
      { selector: 'img', wcag: '1.1.1', message: 'Missing alt', severity: 'serious' },
    ];
    const result = ctx.a11yHelpers.deduplicateIssues(issues);
    expect(result).toHaveLength(1);
  });

  it('keeps issues with different WCAG criteria', () => {
    const issues = [
      { selector: 'img', wcag: '1.1.1', message: 'Missing alt', severity: 'serious' },
      { selector: 'img', wcag: '2.4.4', message: 'Missing alt', severity: 'serious' },
    ];
    const result = ctx.a11yHelpers.deduplicateIssues(issues, { checkRelatedCriteria: false });
    expect(result).toHaveLength(2);
  });

  it('removes related WCAG criteria duplicates by default', () => {
    const issues = [
      { selector: 'img', wcag: '1.1.1', message: 'Missing name', severity: 'serious' },
      { selector: 'img', wcag: '4.1.2', message: 'Missing name', severity: 'serious' },
    ];
    const result = ctx.a11yHelpers.deduplicateIssues(issues);
    expect(result).toHaveLength(1);
  });

  it('respects checkRelatedCriteria: false option', () => {
    const issues = [
      { selector: 'img', wcag: '1.1.1', message: 'Missing name', severity: 'serious' },
      { selector: 'img', wcag: '4.1.2', message: 'Missing name', severity: 'serious' },
    ];
    const result = ctx.a11yHelpers.deduplicateIssues(issues, { checkRelatedCriteria: false });
    expect(result).toHaveLength(2);
  });

  it('handles empty input array', () => {
    expect(ctx.a11yHelpers.deduplicateIssues([])).toEqual([]);
  });

  it('preserves order (first occurrence wins)', () => {
    const issues = [
      { selector: 'img', wcag: '1.1.1', message: 'First', severity: 'serious' },
      { selector: 'img', wcag: '1.1.1', message: 'First', severity: 'serious' },
      { selector: 'button', wcag: '4.1.2', message: 'Second', severity: 'moderate' },
    ];
    const result = ctx.a11yHelpers.deduplicateIssues(issues);
    expect(result[0].message).toBe('First');
    expect(result[1].message).toBe('Second');
  });
});

// ============================================================================
// parseColor()
// ============================================================================

describe('parseColor', () => {
  it('parses rgb(r, g, b) format', () => {
    const c = ctx.a11yHelpers.parseColor('rgb(255, 128, 0)');
    expect(c).toEqual({ r: 255, g: 128, b: 0, a: 1 });
  });

  it('parses rgba(r, g, b, a) format', () => {
    const c = ctx.a11yHelpers.parseColor('rgba(255, 128, 0, 0.5)');
    expect(c).toEqual({ r: 255, g: 128, b: 0, a: 0.5 });
  });

  it('parses 3-digit hex', () => {
    const c = ctx.a11yHelpers.parseColor('#fff');
    expect(c).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('parses 6-digit hex', () => {
    const c = ctx.a11yHelpers.parseColor('#ff8000');
    expect(c).toEqual({ r: 255, g: 128, b: 0, a: 1 });
  });

  it('returns null for "transparent"', () => {
    expect(ctx.a11yHelpers.parseColor('transparent')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(ctx.a11yHelpers.parseColor(null)).toBeNull();
    expect(ctx.a11yHelpers.parseColor(undefined)).toBeNull();
  });

  it('returns null for unrecognized formats', () => {
    expect(ctx.a11yHelpers.parseColor('not-a-color')).toBeNull();
  });

  it('alpha defaults to 1 for rgb', () => {
    const c = ctx.a11yHelpers.parseColor('rgb(0, 0, 0)');
    expect(c.a).toBe(1);
  });
});

// ============================================================================
// getLuminance()
// ============================================================================

describe('getLuminance', () => {
  it('returns 0 for black', () => {
    expect(ctx.a11yHelpers.getLuminance(0, 0, 0)).toBe(0);
  });

  it('returns 1 for white', () => {
    expect(ctx.a11yHelpers.getLuminance(255, 255, 255)).toBe(1);
  });

  it('returns expected value for a known color', () => {
    // Red: ~0.2126
    const luminance = ctx.a11yHelpers.getLuminance(255, 0, 0);
    expect(luminance).toBeCloseTo(0.2126, 3);
  });

  it('returns approximately 0.2159 for mid-gray (128,128,128)', () => {
    const luminance = ctx.a11yHelpers.getLuminance(128, 128, 128);
    expect(luminance).toBeCloseTo(0.2159, 2);
  });
});

// ============================================================================
// getContrastRatio()
// ============================================================================

describe('getContrastRatio', () => {
  it('returns 21:1 for black on white', () => {
    const ratio = ctx.a11yHelpers.getContrastRatio(
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    expect(ratio).toBe(21);
  });

  it('returns 1:1 for same color', () => {
    const ratio = ctx.a11yHelpers.getContrastRatio(
      { r: 100, g: 100, b: 100 },
      { r: 100, g: 100, b: 100 },
    );
    expect(ratio).toBe(1);
  });

  it('is order-independent', () => {
    const ratio1 = ctx.a11yHelpers.getContrastRatio(
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    const ratio2 = ctx.a11yHelpers.getContrastRatio(
      { r: 255, g: 255, b: 255 },
      { r: 0, g: 0, b: 0 },
    );
    expect(ratio1).toBe(ratio2);
  });

  it('returns expected ratio for known pair', () => {
    // AA large text requires 3:1
    const ratio = ctx.a11yHelpers.getContrastRatio(
      { r: 0, g: 0, b: 0 },
      { r: 128, g: 128, b: 128 },
    );
    expect(ratio).toBeGreaterThan(3);
  });
});

// ============================================================================
// getDefaultImpact()
// ============================================================================

describe('getDefaultImpact', () => {
  it('returns correct impact for critical', () => {
    expect(ctx.a11yHelpers.getDefaultImpact('critical')).toBe('Users cannot complete essential tasks');
  });

  it('returns correct impact for serious', () => {
    expect(ctx.a11yHelpers.getDefaultImpact('serious')).toBe('Users face significant barriers');
  });

  it('returns correct impact for moderate', () => {
    expect(ctx.a11yHelpers.getDefaultImpact('moderate')).toBe('Users experience frustration');
  });

  it('returns correct impact for minor', () => {
    expect(ctx.a11yHelpers.getDefaultImpact('minor')).toBe('Minor inconvenience');
  });

  it('returns fallback for unknown severity', () => {
    expect(ctx.a11yHelpers.getDefaultImpact('unknown')).toBe('Impact varies');
  });
});

// ============================================================================
// createResults()
// ============================================================================

describe('createResults', () => {
  it('returns standard structure with all required fields', () => {
    const results = ctx.a11yHelpers.createResults('header', '2.2');
    expect(results).toHaveProperty('component', 'header');
    expect(results).toHaveProperty('wcagVersion', '2.2');
    expect(results).toHaveProperty('timestamp');
    expect(results).toHaveProperty('issues');
    expect(results).toHaveProperty('passed');
    expect(results).toHaveProperty('manualChecks');
    expect(results).toHaveProperty('stats');
    expect(Array.isArray(results.issues)).toBe(true);
    expect(Array.isArray(results.passed)).toBe(true);
    expect(Array.isArray(results.manualChecks)).toBe(true);
  });

  it('initializes stats to zero', () => {
    const results = ctx.a11yHelpers.createResults('test');
    expect(results.stats).toEqual({
      elementsScanned: 0,
      issuesFound: 0,
      passedChecks: 0,
      manualChecksNeeded: 0,
      executionTimeMs: 0,
    });
  });

  it('uses defaults for missing params', () => {
    const results = ctx.a11yHelpers.createResults();
    expect(results.component).toBe('unknown');
  });
});
