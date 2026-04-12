/**
 * Regression tests for bugs fixed in v8.9.2
 * These tests ensure the specific P0/P1 bugs don't recur.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

const ROOT = resolve(import.meta.dirname, '..', '..');

// ============================================================================
// P0: capitalize() function body correctness
// Bug: capitalize() was swallowing safeSerialize()/getResultsSafe()
// due to missing function body
// ============================================================================

describe('P0: capitalize() function body', () => {
  let capitalize;

  beforeAll(() => {
    const source = readFileSync(resolve(ROOT, 'scripts/audit-init.js'), 'utf-8');
    const match = source.match(/function capitalize\(str\)\s*\{([^}]+)\}/);
    capitalize = new Function('str', match[1]);
  });

  it('returns correct capitalized string for simple input', () => {
    expect(capitalize('images')).toBe('Images');
  });

  it('returns correct camelCase for hyphenated input', () => {
    expect(capitalize('links-buttons')).toBe('LinksButtons');
  });

  it('does NOT return undefined or empty string', () => {
    const result = capitalize('test');
    expect(result).toBeDefined();
    expect(result).not.toBe('');
    expect(result).toBe('Test');
  });

  it('does NOT swallow the return value', () => {
    // The bug was that capitalize had no function body, so it returned undefined
    const result = capitalize('color-contrast');
    expect(result).toBe('ColorContrast');
  });
});

// ============================================================================
// P0: safeSerialize() handles circular references via WeakSet
// Bug: safeSerialize was failing on circular references
// ============================================================================

describe('P0: safeSerialize() circular reference protection', () => {
  let safeSerialize;

  beforeAll(() => {
    const source = readFileSync(resolve(ROOT, 'scripts/audit-init.js'), 'utf-8');
    const match = source.match(/function safeSerialize\(obj.*?\n  \}/ms);

    const sandbox = {
      console: { log: () => {}, warn: () => {}, error: () => {} },
      Map, WeakMap, Set, WeakSet, Array, Date, Object, JSON, Math, RegExp,
      String, Number, Boolean, parseInt, parseFloat, Error, TypeError,
      HTMLElement: class HTMLElement {},
      Element: class Element {},
      Node: class Node {},
      performance: { now: () => Date.now() },
    };

    const ctx = vm.createContext({ ...sandbox, _fn: null });
    vm.runInContext(`${match[0]}\n_fn = safeSerialize;`, ctx);
    safeSerialize = ctx._fn;
  });

  it('handles simple circular reference', () => {
    const obj = { a: 1 };
    obj.self = obj;
    const result = safeSerialize(obj);
    expect(result.self).toBe('[Circular]');
    expect(result.a).toBe(1);
  });

  it('handles deeply nested circular reference', () => {
    const obj = { a: { b: { c: {} } } };
    obj.a.b.c.back = obj;
    const result = safeSerialize(obj);
    expect(result.a.b.c.back).toBe('[Circular]');
  });

  it('does NOT throw on circular references', () => {
    const obj = { a: 1 };
    obj.self = obj;
    expect(() => safeSerialize(obj)).not.toThrow();
  });

  it('uses WeakSet (not Set) for seen tracking', () => {
    // Verify the source code uses WeakSet
    const source = readFileSync(resolve(ROOT, 'scripts/audit-init.js'), 'utf-8');
    const fnMatch = source.match(/function safeSerialize[\s\S]*?(?=\n  function|\n  \/\*\*)/);
    expect(fnMatch[0]).toContain('WeakSet');
  });
});

// ============================================================================
// P1: Standard result structure has required fields
// Bug: 6 components were missing scope, passed, manualChecks, stats
// ============================================================================

describe('P1: Standard result structure', () => {
  let createResults;

  beforeAll(async () => {
    const { loadScripts } = await import('../helpers/load-script.js');
    const ctx = loadScripts(['scripts/version.js', 'scripts/shared-helpers.js'], {
      document: { querySelectorAll: () => [], querySelector: () => null, body: {}, getElementById: () => null },
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    });
    createResults = ctx.a11yHelpers.createResults;
  });

  it('includes scope field (via component name)', () => {
    const results = createResults('header');
    expect(results.component).toBe('header');
  });

  it('includes passed array', () => {
    const results = createResults('header');
    expect(Array.isArray(results.passed)).toBe(true);
  });

  it('includes manualChecks array', () => {
    const results = createResults('header');
    expect(Array.isArray(results.manualChecks)).toBe(true);
  });

  it('includes stats object with all required fields', () => {
    const results = createResults('header');
    expect(results.stats).toHaveProperty('elementsScanned');
    expect(results.stats).toHaveProperty('issuesFound');
    expect(results.stats).toHaveProperty('passedChecks');
    expect(results.stats).toHaveProperty('manualChecksNeeded');
    expect(results.stats).toHaveProperty('executionTimeMs');
  });
});
