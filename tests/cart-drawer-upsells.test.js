/**
 * Cart Drawer Upsells & Sub-Components Accessibility Audit Tests
 */

import { describe, it, expect } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/cart-drawer-upsells.js'],
    domOverrides,
  );
}

describe('cart-drawer-upsells.js', () => {
  describe('detection', () => {
    it('returns empty results when no cart sub-components exist', () => {
      const ctx = loadWithHTML('<p>No cart upsells</p>');
      const results = ctx.runCartDrawerUpsellsAudit();
      expect(results.component).toBe('cart-drawer-upsells');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('happy path', () => {
    it('passes for well-formed discount code input', () => {
      const ctx = loadWithHTML(`
        <div class="cart-discount">
          <label for="discount-input">Discount code</label>
          <input type="text" id="discount-input" name="discount">
          <button>Apply</button>
        </div>
      `);
      const results = ctx.runCartDrawerUpsellsAudit();
      expect(results.component).toBe('cart-drawer-upsells');
      const passes = results.passed.filter(p => p.message.indexOf('accessible label') >= 0);
      expect(passes.length).toBeGreaterThan(0);
    });
  });

  describe('discount code input label', () => {
    it('flags discount input without label', () => {
      const ctx = loadWithHTML(`
        <div class="cart-discount">
          <input type="text" placeholder="Enter discount code">
          <button>Apply</button>
        </div>
      `);
      const results = ctx.runCartDrawerUpsellsAudit();
      const issue = results.issues.find(i => i.message.indexOf('no accessible label') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('3.3.2');
    });

    it('passes for discount input with aria-label', () => {
      const ctx = loadWithHTML(`
        <div class="cart-discount">
          <input type="text" aria-label="Discount code">
          <button>Apply</button>
        </div>
      `);
      const results = ctx.runCartDrawerUpsellsAudit();
      const pass = results.passed.filter(p => p.message.indexOf('accessible label') >= 0);
      expect(pass.length).toBeGreaterThan(0);
    });
  });

  describe('shipping progress bar', () => {
    it('flags visual-only shipping progress bar', () => {
      const ctx = loadWithHTML(`
        <div class="shipping-bar">
          <p>Spend $30 more for free shipping!</p>
          <div class="shipping-bar-track">
            <div class="shipping-bar-fill" style="width: 60%;"></div>
          </div>
        </div>
      `);
      const results = ctx.runCartDrawerUpsellsAudit();
      const issue = results.issues.find(i => i.message.indexOf('visual-only') >= 0 || i.message.indexOf('progressbar') >= 0);
      expect(issue).toBeDefined();
      expect(issue.wcag).toBe('4.1.2');
    });

    it('passes for shipping bar with role="progressbar"', () => {
      const ctx = loadWithHTML(`
        <div class="shipping-bar">
          <p>Spend $30 more for free shipping!</p>
          <div role="progressbar" aria-valuenow="70" aria-valuemin="0" aria-valuemax="100" aria-label="Free shipping progress">
            <div style="width: 70%;"></div>
          </div>
        </div>
      `);
      const results = ctx.runCartDrawerUpsellsAudit();
      const pass = results.passed.filter(p => p.message.indexOf('proper ARIA attributes') >= 0);
      expect(pass.length).toBeGreaterThan(0);
    });
  });

  describe('gift note label', () => {
    it('flags gift note textarea without label', () => {
      const ctx = loadWithHTML(`
        <div class="cart-gift">
          <textarea name="note" placeholder="Add a gift message"></textarea>
        </div>
      `);
      const results = ctx.runCartDrawerUpsellsAudit();
      const issue = results.issues.find(i => i.message.indexOf('Gift note textarea has no accessible label') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('minor');
      expect(issue.wcag).toBe('3.3.2');
    });
  });

  describe('upsell product buttons', () => {
    it('flags upsell button without accessible name', () => {
      const ctx = loadWithHTML(`
        <div class="cart-upsell">
          <a href="/product">Linen Blazer</a>
          <button><svg><path d="M0 0"/></svg></button>
        </div>
      `);
      const results = ctx.runCartDrawerUpsellsAudit();
      const issue = results.issues.find(i => i.message.indexOf('no accessible name') >= 0);
      expect(issue).toBeDefined();
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML(`
        <div class="cart-discount">
          <label for="dc">Code</label>
          <input id="dc" type="text">
          <button>Apply</button>
        </div>
      `);
      const results = ctx.runCartDrawerUpsellsAudit();
      expect(results).toHaveProperty('component', 'cart-drawer-upsells');
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
