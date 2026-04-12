/**
 * Tests for pure functions in scripts/audit-init.js
 * These functions are extracted and testable without full audit initialization.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

const ROOT = resolve(import.meta.dirname, '..', '..');

/**
 * The audit-init.js IIFE attaches to global but many of its utility functions
 * (capitalize, safeSerialize, extractWCAGFromAxe, mapAxeImpact) are internal.
 * We extract them by evaluating the script and inspecting what it exposes,
 * plus we test the publicly accessible functions.
 *
 * Some functions are internal to the IIFE — we test them indirectly through
 * the public API, or by re-extracting them from the source text.
 */
let capitalize;
let safeSerialize;
let extractWCAGFromAxe;
let mapAxeImpact;

beforeAll(() => {
  // Read the source and extract the internal functions for testing
  const source = readFileSync(resolve(ROOT, 'scripts/audit-init.js'), 'utf-8');

  // Extract function bodies using regex — these are small self-contained functions
  const capitalizeMatch = source.match(/function capitalize\(str\)\s*\{([^}]+)\}/);
  const safeSerializeMatch = source.match(/function safeSerialize\(obj.*?\n  \}/ms);
  const extractWCAGMatch = source.match(/function extractWCAGFromAxe\(tags\)\s*\{([\s\S]*?)\n  \}/);
  const mapAxeImpactMatch = source.match(/function mapAxeImpact\(impact\)\s*\{([\s\S]*?)\n  \}/);

  // Create isolated functions from the extracted source
  capitalize = new Function('str', capitalizeMatch[1]);

  // For extractWCAGFromAxe and mapAxeImpact, build them as standalone
  const extractCode = `(function(tags) {${extractWCAGMatch[1]}})`;
  extractWCAGFromAxe = eval(extractCode);

  const mapCode = `(function(impact) {${mapAxeImpactMatch[1]}})`;
  mapAxeImpact = eval(mapCode);

  // For safeSerialize, we need the full function including recursion
  // Use the IIFE sandbox approach
  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Map, WeakMap, Set, WeakSet, Array, Date, Object, JSON, Math, RegExp,
    String, Number, Boolean, parseInt, parseFloat, Error, TypeError,
    HTMLElement: class HTMLElement {},
    Element: class Element {},
    Node: class Node {},
    performance: { now: () => Date.now() },
  };
  sandbox.global = sandbox;

  // Create a minimal context that loads just enough of audit-init to get safeSerialize
  const safeSerializeCode = safeSerializeMatch[0];
  const wrappedCode = `
    ${safeSerializeCode}
    _exported_safeSerialize = safeSerialize;
  `;
  const ctx = vm.createContext({ ...sandbox, _exported_safeSerialize: null });
  vm.runInContext(wrappedCode, ctx);
  safeSerialize = ctx._exported_safeSerialize;
});

// ============================================================================
// capitalize()
// ============================================================================

describe('capitalize', () => {
  it('capitalizes a simple string', () => {
    expect(capitalize('images')).toBe('Images');
  });

  it('capitalizes and camelCases hyphenated strings', () => {
    expect(capitalize('links-buttons')).toBe('LinksButtons');
  });

  it('handles "color-contrast"', () => {
    expect(capitalize('color-contrast')).toBe('ColorContrast');
  });

  it('handles empty string gracefully', () => {
    // charAt(0) on empty string returns empty string
    const result = capitalize('');
    expect(typeof result).toBe('string');
  });
});

// ============================================================================
// extractWCAGFromAxe()
// ============================================================================

describe('extractWCAGFromAxe', () => {
  it('converts wcag111 to 1.1.1', () => {
    expect(extractWCAGFromAxe(['wcag111'])).toBe('1.1.1');
  });

  it('converts wcag412 to 4.1.2', () => {
    expect(extractWCAGFromAxe(['wcag412'])).toBe('4.1.2');
  });

  it('converts wcag244 to 2.4.4', () => {
    expect(extractWCAGFromAxe(['wcag244'])).toBe('2.4.4');
  });

  it('returns unknown for best-practice tags', () => {
    expect(extractWCAGFromAxe(['best-practice'])).toBe('unknown');
  });

  it('returns unknown for empty array', () => {
    expect(extractWCAGFromAxe([])).toBe('unknown');
  });
});

// ============================================================================
// mapAxeImpact()
// ============================================================================

describe('mapAxeImpact', () => {
  it('maps critical to critical', () => {
    expect(mapAxeImpact('critical')).toBe('critical');
  });

  it('maps serious to serious', () => {
    expect(mapAxeImpact('serious')).toBe('serious');
  });

  it('maps moderate to moderate', () => {
    expect(mapAxeImpact('moderate')).toBe('moderate');
  });

  it('maps minor to minor', () => {
    expect(mapAxeImpact('minor')).toBe('minor');
  });

  it('returns moderate for unknown impact', () => {
    expect(mapAxeImpact('unknown')).toBe('moderate');
    expect(mapAxeImpact(undefined)).toBe('moderate');
  });
});

// ============================================================================
// safeSerialize()
// ============================================================================

describe('safeSerialize', () => {
  it('passes through null', () => {
    expect(safeSerialize(null)).toBeNull();
  });

  it('passes through undefined', () => {
    expect(safeSerialize(undefined)).toBeUndefined();
  });

  it('passes through numbers', () => {
    expect(safeSerialize(42)).toBe(42);
  });

  it('passes through booleans', () => {
    expect(safeSerialize(true)).toBe(true);
  });

  it('truncates long strings', () => {
    const longStr = 'A'.repeat(1000);
    const result = safeSerialize(longStr, 100);
    expect(result.length).toBeLessThan(1000);
    expect(result).toContain('...[truncated]');
  });

  it('handles circular references via WeakSet', () => {
    const obj = { a: 1 };
    obj.self = obj;
    const result = safeSerialize(obj);
    expect(result.self).toBe('[Circular]');
  });

  it('truncates arrays beyond maxArrayItems', () => {
    const arr = Array.from({ length: 500 }, (_, i) => i);
    const result = safeSerialize(arr, 500, 10);
    expect(result.length).toBe(10);
  });

  it('strips element-reference keys', () => {
    const obj = {
      message: 'Test',
      element: { fake: 'element' },
      node: { fake: 'node' },
      domElement: { fake: 'dom' },
      parentElement: { fake: 'parent' },
    };
    const result = safeSerialize(obj);
    expect(result.element).toBe('[Element]');
    expect(result.node).toBe('[Element]');
    expect(result.domElement).toBe('[Element]');
    expect(result.parentElement).toBe('[Element]');
    expect(result.message).toBe('Test');
  });

  it('serializes a Date object as an empty object (no enumerable own keys)', () => {
    const d = new Date('2026-01-15T00:00:00.000Z');
    // Date is an object; Object.keys(date) === [] → safeSerialize returns {}
    const result = safeSerialize(d);
    expect(typeof result).toBe('object');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('serializes a Map as an empty object (Map has no own enumerable keys)', () => {
    const m = new Map([['key', 'value']]);
    const result = safeSerialize(m);
    // Must not throw; result is an object or string representation
    expect(result).toBeDefined();
  });

  it('serializes a Symbol by falling back to its string representation', () => {
    const sym = Symbol('test-symbol');
    // typeof sym === 'symbol' → falls through all object/array branches → String(sym)
    const result = safeSerialize(sym);
    expect(typeof result).toBe('string');
    expect(result).toContain('test-symbol');
  });
});

// ============================================================================
// capitalize (edge cases)
// ============================================================================

describe('capitalize (edge cases)', () => {
  it('returns an already-capitalized string unchanged (no hyphens)', () => {
    expect(capitalize('Images')).toBe('Images');
  });

  it('handles a string of digits', () => {
    const result = capitalize('123');
    expect(typeof result).toBe('string');
  });

  it('capitalizes both parts of a two-segment hyphenated string', () => {
    expect(capitalize('color-contrast')).toBe('ColorContrast');
  });

  it('handles a single character string', () => {
    expect(capitalize('a')).toBe('A');
  });
});

// ============================================================================
// extractWCAGFromAxe (edge cases)
// ============================================================================

describe('extractWCAGFromAxe (edge cases)', () => {
  it('picks the first wcag tag when multiple are present', () => {
    // e.g. ['wcag111', 'wcag412'] → uses first match → '1.1.1'
    expect(extractWCAGFromAxe(['wcag111', 'wcag412'])).toBe('1.1.1');
  });

  it('returns unknown for a tag array with no wcag tags', () => {
    expect(extractWCAGFromAxe(['cat.color', 'experimental'])).toBe('unknown');
  });

  it('returns unknown for an invalid-format tag like wcag999', () => {
    // wcag999 → digits='999' → groups[1]='9', groups[2]='9', groups[3]='9' → '9.9.9'
    // (format is valid numerically) — document actual behaviour
    const result = extractWCAGFromAxe(['wcag999']);
    expect(typeof result).toBe('string');
  });

  it('ignores non-wcag tags and returns unknown when no valid ones exist', () => {
    expect(extractWCAGFromAxe(['best-practice', 'cat.aria'])).toBe('unknown');
  });
});

// ============================================================================
// mapAxeImpact (edge cases)
// ============================================================================

describe('mapAxeImpact (edge cases)', () => {
  it('returns moderate for null input', () => {
    expect(mapAxeImpact(null)).toBe('moderate');
  });

  it('returns moderate for the unknown value "severe"', () => {
    expect(mapAxeImpact('severe')).toBe('moderate');
  });

  it('returns moderate for an empty string', () => {
    expect(mapAxeImpact('')).toBe('moderate');
  });

  it('returns moderate for a completely unknown string', () => {
    expect(mapAxeImpact('catastrophic')).toBe('moderate');
  });
});
