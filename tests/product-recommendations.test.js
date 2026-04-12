/**
 * Product Recommendations Accessibility Audit Tests
 */

import { describe, it, expect } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/product-recommendations.js'],
    domOverrides,
  );
}

describe('product-recommendations.js', () => {
  describe('detection', () => {
    it('returns empty results when no recommendation sections exist', () => {
      const ctx = loadWithHTML('<p>No recommendations</p>');
      const results = ctx.runProductRecommendationsAudit();
      expect(results.component).toBe('product-recommendations');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('happy path', () => {
    it('passes for well-formed recommendation section', () => {
      const ctx = loadWithHTML(`
        <section class="recommended-products" aria-label="Recommended products">
          <h2>You May Also Like</h2>
          <ul>
            <li><a href="/product-1">Linen Blazer</a><img src="blazer.jpg" alt="Linen Blazer"></li>
            <li><a href="/product-2">Cotton Shirt</a><img src="shirt.jpg" alt="Cotton Shirt"></li>
          </ul>
        </section>
      `);
      const results = ctx.runProductRecommendationsAudit();
      expect(results.component).toBe('product-recommendations');
      const headingPass = results.passed.filter(p => p.message.indexOf('heading') >= 0);
      expect(headingPass.length).toBeGreaterThan(0);
    });
  });

  describe('missing section heading', () => {
    it('flags recommendation section without heading or aria-label', () => {
      const ctx = loadWithHTML(`
        <div class="recommended-products">
          <a href="/product-1">Linen Blazer</a>
          <a href="/product-2">Cotton Shirt</a>
        </div>
      `);
      const results = ctx.runProductRecommendationsAudit();
      const issue = results.issues.find(i => i.message.indexOf('no heading or aria-label') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('moderate');
      expect(issue.wcag).toBe('2.4.6');
    });
  });

  describe('product image alt text', () => {
    it('flags product images without alt text', () => {
      const ctx = loadWithHTML(`
        <section class="recommended-products" aria-label="Recommendations">
          <h2>You May Also Like</h2>
          <a href="/product-1"><img src="blazer.jpg"></a>
        </section>
      `);
      const results = ctx.runProductRecommendationsAudit();
      const issue = results.issues.find(i => i.message.indexOf('no alt attribute') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('1.1.1');
    });

    it('flags filename-like alt text', () => {
      const ctx = loadWithHTML(`
        <section class="recommended-products" aria-label="Recommendations">
          <h2>You May Also Like</h2>
          <a href="/product-1"><img src="blazer.jpg" alt="IMG_1234.jpg"></a>
        </section>
      `);
      const results = ctx.runProductRecommendationsAudit();
      const issue = results.issues.find(i => i.message.indexOf('filename') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
    });
  });

  describe('product link accessible name', () => {
    it('flags product link with no accessible name', () => {
      const ctx = loadWithHTML(`
        <section class="recommended-products" aria-label="Recommendations">
          <h2>Recommended</h2>
          <a href="/product-1"><img src="blazer.jpg" alt=""></a>
        </section>
      `);
      const results = ctx.runProductRecommendationsAudit();
      const issue = results.issues.find(i => i.message.indexOf('no accessible name') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML(`
        <section class="recommended-products" aria-label="Recommendations">
          <h2>Recommended</h2>
          <a href="/product-1">Product</a>
        </section>
      `);
      const results = ctx.runProductRecommendationsAudit();
      expect(results).toHaveProperty('component', 'product-recommendations');
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
