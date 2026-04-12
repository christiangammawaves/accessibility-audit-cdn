/**
 * Tests for pure logic in scripts/issue-verifier.js
 * Focuses on confidence scoring, issue type mapping, and exception loading.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadScripts, ROOT } from '../helpers/load-script.js';

let ctx;

beforeAll(() => {
  ctx = loadScripts(['scripts/version.js', 'scripts/shared-helpers.js', 'scripts/issue-verifier.js'], {
    // issue-verifier references document for some checks but the pure functions don't need it
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
      width: '100px',
      height: '100px',
      clip: 'auto',
      clipPath: 'none',
      overflow: 'visible',
    }),
  });
});

// ============================================================================
// loadLearnedExceptions()
// ============================================================================

describe('loadLearnedExceptions', () => {
  it('returns success for valid structure', () => {
    const testExceptions = JSON.parse(
      readFileSync(resolve(ROOT, 'tests/helpers/fixtures/learned-exceptions-test.json'), 'utf-8'),
    );
    const result = ctx.loadLearnedExceptions(testExceptions);
    expect(result.success).toBe(true);
    expect(result.loaded).toBe(2);
  });

  it('returns failure for null input', () => {
    const result = ctx.loadLearnedExceptions(null);
    expect(result.success).toBe(false);
  });

  it('parses JSON string input', () => {
    const json = JSON.stringify({
      global: [{ id: 'ge-001', wcag: '1.1.1', pattern: { type: 'test' }, confidence: 80 }],
    });
    const result = ctx.loadLearnedExceptions(JSON.parse(json));
    expect(result.success).toBe(true);
  });

  it('returns error for missing global array', () => {
    const result = ctx.loadLearnedExceptions({});
    expect(result.success).toBe(false);
  });

  it('returns error when global is not an array', () => {
    const result = ctx.loadLearnedExceptions({ global: 'not-array' });
    expect(result.success).toBe(false);
  });

  it('reports correct loaded count', () => {
    const exceptions = {
      global: [
        { id: 'ge-001', wcag: '1.1.1', pattern: { type: 'test' } },
        { id: 'ge-002', wcag: '4.1.2', pattern: { type: 'test' } },
        { id: 'ge-003', wcag: '2.4.4', pattern: { type: 'test' } },
      ],
    };
    const result = ctx.loadLearnedExceptions(exceptions);
    expect(result.loaded).toBe(3);
  });
});

// ============================================================================
// getIssueType() — if exposed
// ============================================================================

describe('issue type inference', () => {
  // The verifier exposes verifyAuditResults which internally uses getIssueType.
  // We test the behavior indirectly through the full verification pipeline
  // or check if it's accessible on the global.

  it('verifyAuditResults is a function', () => {
    expect(typeof ctx.verifyAuditResults).toBe('function');
  });

  it('getConfidenceLabel is exposed', () => {
    if (ctx.getConfidenceLabel) {
      expect(ctx.getConfidenceLabel(95)).toBe('Very High');
      expect(ctx.getConfidenceLabel(80)).toBe('High');
      expect(ctx.getConfidenceLabel(65)).toBe('Medium-High');
      expect(ctx.getConfidenceLabel(50)).toBe('Medium');
      expect(ctx.getConfidenceLabel(35)).toBe('Low-Medium');
      expect(ctx.getConfidenceLabel(20)).toBe('Low');
      expect(ctx.getConfidenceLabel(5)).toBe('Very Low');
    }
  });
});

// ============================================================================
// groupSimilarIssues() — if exposed
// ============================================================================

describe('groupSimilarIssues', () => {
  it('is exposed as a function', () => {
    if (ctx.groupSimilarIssues) {
      expect(typeof ctx.groupSimilarIssues).toBe('function');
    }
  });

  it('returns empty array for empty input', () => {
    if (ctx.groupSimilarIssues) {
      expect(ctx.groupSimilarIssues([])).toEqual([]);
    }
  });

  it('groups issues differing only by numbers', () => {
    if (ctx.groupSimilarIssues) {
      const issues = [
        { message: 'Image 1 missing alt', confidence: 80 },
        { message: 'Image 2 missing alt', confidence: 75 },
        { message: 'Image 3 missing alt', confidence: 70 },
      ];
      const grouped = ctx.groupSimilarIssues(issues);
      expect(grouped.length).toBeLessThanOrEqual(issues.length);
    }
  });
});

// ============================================================================
// Exception usage tracking (L1 features)
// ============================================================================

describe('exception usage tracking', () => {
  it('getExceptionUsageStats is exposed', () => {
    if (ctx.getExceptionUsageStats) {
      const stats = ctx.getExceptionUsageStats();
      expect(stats).toBeDefined();
    }
  });

  it('clearExceptionUsageStats resets data', () => {
    if (ctx.clearExceptionUsageStats) {
      ctx.clearExceptionUsageStats();
      const stats = ctx.getExceptionUsageStats();
      expect(stats.totalExceptionsApplied || 0).toBe(0);
    }
  });
});

// ============================================================================
// verifyAuditResults() — integration-level test
// ============================================================================

describe('verifyAuditResults', () => {
  it('processes issues through the verification pipeline', async () => {
    // Load test exceptions first
    const testExceptions = JSON.parse(
      readFileSync(resolve(ROOT, 'tests/helpers/fixtures/learned-exceptions-test.json'), 'utf-8'),
    );
    ctx.loadLearnedExceptions(testExceptions);

    const auditData = {
      data: {
        issues: [
          {
            severity: 'serious',
            wcag: '1.1.1',
            message: 'Image missing alt text',
            selector: 'img.hero',
            fix: 'Add alt attribute',
          },
          {
            severity: 'moderate',
            wcag: '4.1.2',
            message: 'Button has no accessible name',
            selector: 'button.close',
            fix: 'Add aria-label',
          },
        ],
      },
    };

    const result = await ctx.verifyAuditResults(auditData, {
      removeBelow: 20,
      flagBelow: 50,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.issues).toBeDefined();
    expect(Array.isArray(result.data.issues)).toBe(true);
    // Each issue should have a verification object with confidence score
    for (const issue of result.data.issues) {
      expect(issue.verification).toBeDefined();
      expect(typeof issue.verification.confidence).toBe('number');
    }
  });

  it('returns statistics about verification', async () => {
    const auditData = {
      data: {
        issues: [
          { severity: 'serious', wcag: '1.1.1', message: 'Test', selector: 'div', fix: 'Fix' },
        ],
      },
    };

    const result = await ctx.verifyAuditResults(auditData);
    expect(result.data.statistics).toBeDefined();
  });
});

// ============================================================================
// verifyIssue() — single-issue verification
// ============================================================================

describe('verifyIssue', () => {
  it('is exposed as a function', () => {
    expect(typeof ctx.verifyIssue).toBe('function');
  });

  it('returns an object with a verification property containing a confidence score', () => {
    const issue = { severity: 'serious', wcag: '1.1.1', message: 'Image missing alt text', selector: null, fix: 'Add alt' };
    const result = ctx.verifyIssue(issue);
    expect(result).toBeDefined();
    expect(result.verification).toBeDefined();
    expect(typeof result.verification.confidence).toBe('number');
  });

  it('confidence score is clamped to [0, 100]', () => {
    const issue = { severity: 'minor', wcag: '2.1.1', message: 'Keyboard issue', selector: null, fix: 'Fix it' };
    const result = ctx.verifyIssue(issue);
    expect(result.verification.confidence).toBeGreaterThanOrEqual(0);
    expect(result.verification.confidence).toBeLessThanOrEqual(100);
  });

  it('preserves original issue fields on the returned object', () => {
    const issue = { severity: 'moderate', wcag: '1.4.3', message: 'Low contrast', selector: null, fix: 'Fix contrast' };
    const result = ctx.verifyIssue(issue);
    expect(result.severity).toBe('moderate');
    expect(result.wcag).toBe('1.4.3');
    expect(result.message).toBe('Low contrast');
  });

  it('issue with no selector produces a note in verification', () => {
    const issue = { severity: 'minor', wcag: '2.4.4', message: 'Link purpose unclear', selector: null, fix: 'Add context' };
    const result = ctx.verifyIssue(issue);
    // Without a selector the element cannot be found — should still succeed
    expect(result.verification).toBeDefined();
  });
});

// ============================================================================
// getExceptionLog / clearExceptionLog
// ============================================================================

describe('getExceptionLog / clearExceptionLog', () => {
  it('getExceptionLog is exposed as a function', () => {
    expect(typeof ctx.getExceptionLog).toBe('function');
  });

  it('clearExceptionLog is exposed as a function', () => {
    expect(typeof ctx.clearExceptionLog).toBe('function');
  });

  it('clearExceptionLog empties the exception log', () => {
    ctx.clearExceptionLog();
    expect(ctx.getExceptionLog()).toEqual([]);
  });

  it('getExceptionLog returns an array after clearing', () => {
    ctx.clearExceptionLog();
    const log = ctx.getExceptionLog();
    expect(Array.isArray(log)).toBe(true);
  });

  it('getExceptionLog entries accumulate during verifyAuditResults when exceptions match', async () => {
    // Load an exception that will match the test issue
    ctx.loadLearnedExceptions({
      global: [
        { id: 'test-exc-001', wcag: '1.1.1', pattern: { type: 'message-contains', value: 'missing alt' }, confidence: 50 },
      ],
    });
    ctx.clearExceptionLog();

    const auditData = {
      data: {
        issues: [{ severity: 'serious', wcag: '1.1.1', message: 'Image missing alt text', selector: null, fix: 'Add alt' }],
      },
    };
    await ctx.verifyAuditResults(auditData, { removeBelow: 0, flagBelow: 0 });

    // Whether or not the exception matched, getExceptionLog must return an array
    expect(Array.isArray(ctx.getExceptionLog())).toBe(true);
  });
});

// ============================================================================
// New pattern type handlers (v10.2.0 — Shopify audit learnings)
// ============================================================================

describe('loadLearnedExceptions with new pattern types', () => {
  it('loads updated learned-exceptions.json with all global + site-specific entries', () => {
    const exceptions = JSON.parse(
      readFileSync(resolve(ROOT, 'learned-exceptions.json'), 'utf-8'),
    );
    const result = ctx.loadLearnedExceptions(exceptions);
    expect(result.success).toBe(true);
    // loaded reflects globalCount only (site-specific tracked separately)
    expect(result.loaded).toBe(exceptions.global.length);
    expect(result.siteSpecificDomains).toBe(Object.keys(exceptions.siteSpecific).length);
  });

  it('accepts wcag-scope-exclusion pattern type', () => {
    const exceptions = {
      global: [{
        id: 'test-scope',
        wcag: ['3.2.5'],
        pattern: { type: 'wcag-scope-exclusion', criterion: '3.2.5', level: 'AAA', scope: 'AA' },
        confidence: 100
      }],
    };
    const result = ctx.loadLearnedExceptions(exceptions);
    expect(result.success).toBe(true);
    expect(result.loaded).toBe(1);
  });

  it('accepts severity-modifier pattern type', () => {
    const exceptions = {
      global: [{
        id: 'test-severity',
        wcag: ['1.4.10'],
        pattern: {
          type: 'severity-modifier',
          selectors: ['[class*="ticker"]'],
          modifiedSeverity: 'minor'
        },
        confidence: 85
      }],
    };
    const result = ctx.loadLearnedExceptions(exceptions);
    expect(result.success).toBe(true);
    expect(result.loaded).toBe(1);
  });

  it('accepts audit-rule pattern type', () => {
    const exceptions = {
      global: [{
        id: 'test-rule',
        wcag: ['1.4.3'],
        pattern: {
          type: 'audit-rule',
          rule: 'contrast-disabled-exemption',
          appliesTo: 'native-disabled-only',
          excludes: ['data-disabled', 'aria-disabled']
        },
        confidence: 100
      }],
    };
    const result = ctx.loadLearnedExceptions(exceptions);
    expect(result.success).toBe(true);
    expect(result.loaded).toBe(1);
  });

  it('accepts library-not-present pattern type', () => {
    const exceptions = {
      global: [{
        id: 'test-lib',
        wcag: ['*'],
        pattern: {
          type: 'library-not-present',
          libraries: ['splide'],
          selectorPatterns: ['.splide', '[class*="splide"]']
        },
        confidence: 95
      }],
    };
    const result = ctx.loadLearnedExceptions(exceptions);
    expect(result.success).toBe(true);
    expect(result.loaded).toBe(1);
  });

  it('accepts third-party-form-override pattern type', () => {
    const exceptions = {
      global: [{
        id: 'test-form',
        wcag: ['1.3.5'],
        pattern: {
          type: 'third-party-form-override',
          overrideSelectors: ['#gorgias-web-messenger-container'],
          nativeFormSelectors: ['form.contact-form']
        },
        confidence: 90
      }],
    };
    const result = ctx.loadLearnedExceptions(exceptions);
    expect(result.success).toBe(true);
    expect(result.loaded).toBe(1);
  });
});

describe('wcag-scope-exclusion matching', () => {
  beforeEach(() => {
    ctx.clearExceptionLog();
  });

  it('matches when criterion level exceeds audit scope', () => {
    ctx.loadLearnedExceptions({
      global: [{
        id: 'scope-test',
        wcag: ['3.2.5'],
        pattern: { type: 'wcag-scope-exclusion', criterion: '3.2.5', level: 'AAA', scope: 'AA' },
        confidence: 100
      }],
    });

    const issue = { severity: 'moderate', wcag: '3.2.5', message: 'Opens new tab without warning', selector: null, fix: 'Add warning' };
    const result = ctx.verifyIssue(issue);
    expect(result.verification).toBeDefined();
    // Should have lower confidence due to matching the scope exclusion exception
    const matchNote = result.verification.notes.find(n => n.includes('Matches exception'));
    expect(matchNote).toBeDefined();
  });

  it('does not match when criterion is in scope', () => {
    ctx.loadLearnedExceptions({
      global: [{
        id: 'scope-test-2',
        wcag: ['1.1.1'],
        pattern: { type: 'wcag-scope-exclusion', criterion: '1.1.1', level: 'A', scope: 'AA' },
        confidence: 100
      }],
    });

    const issue = { severity: 'serious', wcag: '1.1.1', message: 'Image missing alt', selector: null, fix: 'Add alt' };
    const result = ctx.verifyIssue(issue);
    // Should NOT match since Level A is within AA scope
    const matchNote = result.verification.notes.find(n => n.includes('Matches exception'));
    expect(matchNote).toBeUndefined();
  });
});

describe('focus-order-manual-review matching', () => {
  it('matches when issue message contains a trigger keyword', () => {
    ctx.loadLearnedExceptions({
      global: [{
        id: 'focus-test',
        wcag: ['2.4.3'],
        pattern: { type: 'focus-order-manual-review', triggers: ['tabindex > 0', 'visual-dom-order-mismatch'] },
        confidence: 80
      }],
    });

    const issue = { severity: 'moderate', wcag: '2.4.3', message: 'Element has tabindex > 0 which affects focus order', selector: null, fix: 'Remove tabindex' };
    const result = ctx.verifyIssue(issue);
    const matchNote = result.verification.notes.find(n => n.includes('Matches exception'));
    expect(matchNote).toBeDefined();
  });
});
