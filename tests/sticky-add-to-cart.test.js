/**
 * Sticky Add-to-Cart Bar Accessibility Audit Tests
 */

import { describe, it, expect } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/sticky-add-to-cart.js'],
    domOverrides,
  );
}

describe('sticky-add-to-cart.js', () => {
  describe('detection', () => {
    it('returns empty results when no sticky bar exists', () => {
      const ctx = loadWithHTML('<p>No sticky bar</p>');
      const results = ctx.runStickyAddToCartAudit();
      expect(results.component).toBe('sticky-add-to-cart');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('happy path', () => {
    it('passes for well-formed sticky add-to-cart bar', () => {
      const ctx = loadWithHTML(`
        <div class="sticky-add-to-cart" aria-label="Sticky add to cart">
          <select aria-label="Select size">
            <option>Small</option>
            <option>Medium</option>
          </select>
          <button>Add to Cart</button>
        </div>
      `);
      const results = ctx.runStickyAddToCartAudit();
      expect(results.component).toBe('sticky-add-to-cart');
      const passes = results.passed.filter(p => p.message.indexOf('accessible name') >= 0);
      expect(passes.length).toBeGreaterThan(0);
    });
  });

  describe('missing button name', () => {
    it('flags sticky bar button with no accessible name', () => {
      const ctx = loadWithHTML(`
        <div class="sticky-add-to-cart">
          <button><svg><path d="M0 0"/></svg></button>
        </div>
      `);
      const results = ctx.runStickyAddToCartAudit();
      const issue = results.issues.find(i => i.message.indexOf('no accessible name') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('unlabeled variant selector', () => {
    it('flags select element without label', () => {
      const ctx = loadWithHTML(`
        <div class="sticky-add-to-cart">
          <select>
            <option>S</option>
            <option>M</option>
          </select>
          <button>Add to Cart</button>
        </div>
      `);
      const results = ctx.runStickyAddToCartAudit();
      const issue = results.issues.find(i => i.message.indexOf('variant selector has no accessible label') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('moderate');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('aria-hidden with interactive content', () => {
    it('flags bar with aria-hidden but interactive elements', () => {
      const ctx = loadWithHTML(`
        <div class="sticky-add-to-cart" aria-hidden="true">
          <button>Add to Cart</button>
        </div>
      `);
      const results = ctx.runStickyAddToCartAudit();
      const issue = results.issues.find(i => i.message.indexOf('aria-hidden="true"') >= 0 && i.message.indexOf('interactive') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML('<div class="sticky-add-to-cart"><button>Add to Cart</button></div>');
      const results = ctx.runStickyAddToCartAudit();
      expect(results).toHaveProperty('component', 'sticky-add-to-cart');
      expect(results).toHaveProperty('timestamp');
      expect(results).toHaveProperty('issues');
      expect(results).toHaveProperty('passed');
      expect(results).toHaveProperty('manualChecks');
      expect(results).toHaveProperty('stats');
      expect(typeof results.stats.elementsScanned).toBe('number');
      expect(typeof results.stats.issuesFound).toBe('number');
    });
  });
});
