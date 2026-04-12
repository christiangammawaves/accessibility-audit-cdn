/**
 * Images of Text Accessibility Audit Tests
 * Tests for WCAG 1.4.5 — SVG text detection, background-image scanning, and img scanning
 */

import { describe, it, expect } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/images-of-text.js'],
    domOverrides,
  );
}

/**
 * Make all matching elements "visible" to isVisible() by mocking getBoundingClientRect.
 * jsdom returns zero dimensions by default, which makes isVisible() return false.
 */
function makeVisible(ctx, selector) {
  const elements = ctx.document.querySelectorAll(selector);
  elements.forEach(el => {
    el.getBoundingClientRect = () => ({ width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0 });
  });
}

describe('images-of-text.js', () => {
  describe('basic detection', () => {
    it('returns empty results when no images exist', () => {
      const ctx = loadWithHTML('<p>No images here</p>');
      const results = ctx.runImagesOfTextAudit();
      expect(results.component).toBe('images-of-text');
      expect(results.issues).toEqual([]);
    });

    it('returns standard result structure', () => {
      const ctx = loadWithHTML('<p>Nothing</p>');
      const results = ctx.runImagesOfTextAudit();
      expect(results).toHaveProperty('component');
      expect(results).toHaveProperty('issues');
      expect(results).toHaveProperty('passed');
      expect(results).toHaveProperty('manualChecks');
      expect(results).toHaveProperty('stats');
      expect(results.stats).toHaveProperty('executionTimeMs');
    });
  });

  describe('img element scanning', () => {
    it('flags images with text indicators in filename', () => {
      const ctx = loadWithHTML(`
        <img src="/assets/heading-text.png" alt="Welcome heading">
      `);
      makeVisible(ctx, 'img');
      const results = ctx.runImagesOfTextAudit();
      const check = results.manualChecks.find(c => c.message.indexOf('Verify image does not contain text') >= 0);
      expect(check).toBeDefined();
      expect(check.wcag).toBe('1.4.5');
    });

    it('passes logos as exceptions', () => {
      const ctx = loadWithHTML(`
        <img src="/images/logo.png" alt="Company Logo">
      `);
      makeVisible(ctx, 'img');
      const results = ctx.runImagesOfTextAudit();
      const pass = results.passed.find(p => p.message.indexOf('logo') >= 0);
      expect(pass).toBeDefined();
    });

    it('skips decorative images with empty alt', () => {
      const ctx = loadWithHTML(`
        <img src="/images/decoration.png" alt="">
      `);
      makeVisible(ctx, 'img');
      const results = ctx.runImagesOfTextAudit();
      // Should not flag decorative images as likely-text
      const textIssue = results.manualChecks.find(c => c.message.indexOf('Verify image does not contain text') >= 0);
      expect(textIssue).toBeUndefined();
    });
  });

  describe('SVG text detection', () => {
    it('flags SVG with text element', () => {
      const ctx = loadWithHTML(`
        <svg width="200" height="50">
          <text x="10" y="30" font-size="20">Hello World</text>
        </svg>
      `);
      makeVisible(ctx, 'svg, svg text');
      const results = ctx.runImagesOfTextAudit();
      const check = results.manualChecks.find(c => c.message.indexOf('SVG contains text element') >= 0);
      expect(check).toBeDefined();
      expect(check.wcag).toBe('1.4.5');
    });

    it('flags SVG with textPath element', () => {
      const ctx = loadWithHTML(`
        <svg width="200" height="50">
          <defs>
            <path id="curve" d="M10 80 Q 95 10 180 80"/>
          </defs>
          <text>
            <textPath href="#curve">Text along a path</textPath>
          </text>
        </svg>
      `);
      makeVisible(ctx, 'svg, svg text, svg textPath');
      const results = ctx.runImagesOfTextAudit();
      const check = results.manualChecks.find(c =>
        c.message.indexOf('SVG contains text element') >= 0
      );
      expect(check).toBeDefined();
    });

    it('skips decorative SVG with aria-hidden', () => {
      const ctx = loadWithHTML(`
        <svg aria-hidden="true" width="200" height="50">
          <text x="10" y="30">Decorative text</text>
        </svg>
      `);
      makeVisible(ctx, 'svg, svg text');
      const results = ctx.runImagesOfTextAudit();
      const check = results.manualChecks.find(c => c.message.indexOf('SVG contains text element') >= 0);
      expect(check).toBeUndefined();
    });

    it('skips SVG with role=img and aria-label', () => {
      const ctx = loadWithHTML(`
        <svg role="img" aria-label="Company Logo" width="200" height="50">
          <text x="10" y="30">ACME</text>
        </svg>
      `);
      makeVisible(ctx, 'svg, svg text');
      const results = ctx.runImagesOfTextAudit();
      const check = results.manualChecks.find(c => c.message.indexOf('SVG contains text element') >= 0);
      expect(check).toBeUndefined();
    });
  });

  describe('background-image scanning', () => {
    it('flags elements with text class and background-image style', () => {
      const ctx = loadWithHTML(`
        <div class="hero-heading" style="background-image: url('/img/hero.jpg')">
          Welcome to our site
        </div>
      `);
      makeVisible(ctx, 'div.hero-heading');
      const results = ctx.runImagesOfTextAudit();
      // The element has class matching /heading/ and background-image in style
      const check = results.manualChecks.find(c => c.message.indexOf('background images') >= 0);
      expect(check).toBeDefined();
    });

    it('does not flag elements without background images', () => {
      const ctx = loadWithHTML(`
        <div class="hero-banner">
          No background image here
        </div>
      `);
      makeVisible(ctx, 'div');
      const results = ctx.runImagesOfTextAudit();
      const check = results.manualChecks.find(c => c.message.indexOf('background images') >= 0);
      expect(check).toBeUndefined();
    });
  });
});
