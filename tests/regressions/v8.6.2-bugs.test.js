/**
 * Regression tests for bugs fixed in v8.6.2
 * Tests cache eviction, global dedup map limits, and exception loading.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadScripts } from '../helpers/load-script.js';

let ctx;

beforeAll(() => {
  ctx = loadScripts(['scripts/version.js', 'scripts/shared-helpers.js'], {
    document: {
      querySelectorAll: () => [],
      querySelector: () => null,
      body: {},
      getElementById: () => null,
    },
    getComputedStyle: () => ({
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      position: 'static',
    }),
  });
});

// ============================================================================
// Cache eviction doesn't crash with empty maps
// ============================================================================

describe('cache eviction with empty maps', () => {
  it('clearCaches does not throw on fresh state', () => {
    expect(() => ctx.a11yHelpers.clearCaches()).not.toThrow();
  });

  it('clearVisibilityCaches does not throw on empty caches', () => {
    expect(() => ctx.a11yHelpers.clearVisibilityCaches()).not.toThrow();
  });

  it('getCacheStats returns valid object after clearing', () => {
    ctx.a11yHelpers.clearCaches();
    const stats = ctx.a11yHelpers.getCacheStats();
    expect(stats).toBeDefined();
    expect(stats.queryCacheSize).toBe(0);
    expect(stats.queryHits).toBe(0);
    expect(stats.queryMisses).toBe(0);
  });
});

// ============================================================================
// loadLearnedExceptions returns result object (not boolean)
// Bug: loadLearnedExceptions was returning boolean instead of result object
// ============================================================================

describe('loadLearnedExceptions return type', () => {
  let verifierCtx;

  beforeAll(() => {
    verifierCtx = loadScripts(
      ['scripts/version.js', 'scripts/shared-helpers.js', 'scripts/issue-verifier.js'],
      {
        document: {
          querySelectorAll: () => [],
          querySelector: () => null,
          body: {},
          getElementById: () => null,
        },
        getComputedStyle: () => ({
          display: 'block',
          visibility: 'visible',
          opacity: '1',
          position: 'static',
        }),
      },
    );
  });

  it('returns an object with success property (not a boolean)', () => {
    const result = verifierCtx.loadLearnedExceptions({
      global: [{ id: 'ge-001', wcag: '1.1.1', pattern: { type: 'test' } }],
    });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect(typeof result.success).toBe('boolean');
  });

  it('returns loaded count on success', () => {
    const result = verifierCtx.loadLearnedExceptions({
      global: [
        { id: 'ge-001', wcag: '1.1.1', pattern: { type: 'test' } },
        { id: 'ge-002', wcag: '4.1.2', pattern: { type: 'test' } },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.loaded).toBe(2);
  });

  it('returns error message on failure', () => {
    const result = verifierCtx.loadLearnedExceptions(null);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// Deduplication uses normalized selectors
// Bug: deduplication was using raw selectors, missing duplicates
// ============================================================================

describe('deduplication normalization', () => {
  it('deduplicates issues with nth-child(1) and first-child selectors', () => {
    const issues = [
      { selector: 'li:nth-child(1)', wcag: '1.1.1', message: 'Test', severity: 'serious' },
      { selector: 'li:first-child', wcag: '1.1.1', message: 'Test', severity: 'serious' },
    ];
    const result = ctx.a11yHelpers.deduplicateIssues(issues);
    expect(result).toHaveLength(1);
  });

  it('deduplicates issues with dynamic IDs', () => {
    const issues = [
      { selector: '#section-42', wcag: '4.1.2', message: 'Missing name', severity: 'serious' },
      { selector: '#section-99', wcag: '4.1.2', message: 'Missing name', severity: 'serious' },
    ];
    const result = ctx.a11yHelpers.deduplicateIssues(issues);
    expect(result).toHaveLength(1);
  });
});
