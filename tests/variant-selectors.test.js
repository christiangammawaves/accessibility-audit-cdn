/**
 * Variant Selectors Accessibility Audit Tests
 */

import { describe, it, expect } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/variant-selectors.js'],
    domOverrides,
  );
}

describe('variant-selectors.js', () => {
  describe('detection', () => {
    it('returns empty results when no variant selectors exist', () => {
      const ctx = loadWithHTML('<p>No variants</p>');
      const results = ctx.runVariantSelectorsAudit();
      expect(results.component).toBe('variant-selectors');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('happy path', () => {
    it('passes for well-formed variant selector with fieldset/legend', () => {
      const ctx = loadWithHTML(`
        <fieldset class="variant-picker">
          <legend>Size</legend>
          <input type="radio" id="size-s" name="size" value="Small">
          <label for="size-s">Small</label>
          <input type="radio" id="size-m" name="size" value="Medium" checked>
          <label for="size-m">Medium</label>
          <input type="radio" id="size-l" name="size" value="Large">
          <label for="size-l">Large</label>
        </fieldset>
      `);
      const results = ctx.runVariantSelectorsAudit();
      expect(results.component).toBe('variant-selectors');
      const groupPass = results.passed.filter(p => p.message.indexOf('accessible label') >= 0);
      expect(groupPass.length).toBeGreaterThan(0);
      const optionPass = results.passed.filter(p => p.message.indexOf('accessible name') >= 0);
      expect(optionPass.length).toBeGreaterThan(0);
    });
  });

  describe('missing group label', () => {
    it('flags variant group without fieldset/legend or aria-label', () => {
      const ctx = loadWithHTML(`
        <div class="variant-picker">
          <input type="radio" id="size-s" name="size" value="Small">
          <label for="size-s">Small</label>
          <input type="radio" id="size-m" name="size" value="Medium">
          <label for="size-m">Medium</label>
        </div>
      `);
      const results = ctx.runVariantSelectorsAudit();
      const issue = results.issues.find(i => i.message.indexOf('no accessible group label') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('1.3.1');
    });
  });

  describe('color swatch without text name', () => {
    it('flags color swatch relying solely on color', () => {
      const ctx = loadWithHTML(`
        <fieldset class="variant-picker">
          <legend>Color</legend>
          <button class="color-swatch" tabindex="0" style="background-color: red;"></button>
          <button class="color-swatch" tabindex="0" style="background-color: blue;"></button>
        </fieldset>
      `);
      const results = ctx.runVariantSelectorsAudit();
      const issue = results.issues.find(i => i.message.indexOf('relies solely on color') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('1.4.1');
    });

    it('passes for color swatch with aria-label', () => {
      const ctx = loadWithHTML(`
        <fieldset class="variant-picker">
          <legend>Color</legend>
          <button class="color-swatch" aria-label="Red" tabindex="0" style="background-color: red;"></button>
          <button class="color-swatch" aria-label="Blue" tabindex="0" style="background-color: blue;"></button>
        </fieldset>
      `);
      const results = ctx.runVariantSelectorsAudit();
      const colorIssues = results.issues.filter(i => i.wcag === '1.4.1');
      expect(colorIssues.length).toBe(0);
    });
  });

  describe('missing selected state', () => {
    it('flags buttons without aria-checked or aria-pressed', () => {
      const ctx = loadWithHTML(`
        <div class="variant-picker" role="radiogroup" aria-label="Size">
          <button role="radio" aria-label="Small">S</button>
          <button role="radio" aria-label="Medium">M</button>
        </div>
      `);
      const results = ctx.runVariantSelectorsAudit();
      // role="radio" should have aria-checked — but our test checks for *any* state indicator
      // Since role="radio" buttons don't have aria-checked set, should flag
      const issue = results.issues.find(i => i.message.indexOf('do not communicate selected') >= 0);
      // With role="radio" but no aria-checked, the check should still pass because
      // some() checks for attribute existence. Let's verify the behavior:
      // The test checks if any option has aria-checked !== null — since none do, it should flag
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('unavailable variant accessibility', () => {
    it('flags sold-out variant without aria-disabled', () => {
      const ctx = loadWithHTML(`
        <fieldset class="variant-picker">
          <legend>Size</legend>
          <button class="sold-out" aria-label="Size: XL">XL</button>
        </fieldset>
      `);
      const results = ctx.runVariantSelectorsAudit();
      const issue = results.issues.find(i => i.message.indexOf('only visually indicated') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('moderate');
      expect(issue.wcag).toBe('4.1.2');
    });

    it('passes for sold-out variant with aria-disabled', () => {
      const ctx = loadWithHTML(`
        <fieldset class="variant-picker">
          <legend>Size</legend>
          <button class="sold-out" aria-label="Size: XL" aria-disabled="true">XL</button>
        </fieldset>
      `);
      const results = ctx.runVariantSelectorsAudit();
      const pass = results.passed.filter(p => p.message.indexOf('marked as disabled') >= 0);
      expect(pass.length).toBeGreaterThan(0);
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML(`
        <fieldset class="variant-picker">
          <legend>Size</legend>
          <input type="radio" id="s" name="size" value="S"><label for="s">Small</label>
        </fieldset>
      `);
      const results = ctx.runVariantSelectorsAudit();
      expect(results).toHaveProperty('component', 'variant-selectors');
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
