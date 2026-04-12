/**
 * Wishlist / Favorites Accessibility Audit Tests
 */

import { describe, it, expect } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/wishlist-favorites.js'],
    domOverrides,
  );
}

describe('wishlist-favorites.js', () => {
  describe('detection', () => {
    it('returns empty results when no wishlist elements exist', () => {
      const ctx = loadWithHTML('<p>No wishlist</p>');
      const results = ctx.runWishlistFavoritesAudit();
      expect(results.component).toBe('wishlist-favorites');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('happy path', () => {
    it('passes for well-formed wishlist button with name and state', () => {
      const ctx = loadWithHTML(`
        <button class="wishlist-btn" aria-label="Add to wishlist" aria-pressed="false">
          <svg aria-hidden="true"><path d="M12 21l-1-1C5 14 2 11 2 7a5 5 0 015-5c1.5 0 3 .5 4 2a6 6 0 014-2 5 5 0 015 5c0 4-3 7-9 13l-1 1z"/></svg>
        </button>
      `);
      const results = ctx.runWishlistFavoritesAudit();
      expect(results.component).toBe('wishlist-favorites');
      const passes = results.passed.filter(p => p.message.indexOf('accessible name') >= 0);
      expect(passes.length).toBeGreaterThan(0);
      const statePass = results.passed.filter(p => p.message.indexOf('aria-pressed') >= 0);
      expect(statePass.length).toBeGreaterThan(0);
    });
  });

  describe('missing accessible name', () => {
    it('flags wishlist button with no label (icon-only)', () => {
      const ctx = loadWithHTML(`
        <button class="wishlist-btn">
          <svg><path d="M12 21l-1-1"/></svg>
        </button>
      `);
      const results = ctx.runWishlistFavoritesAudit();
      const issue = results.issues.find(i => i.message.indexOf('no accessible name') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('missing toggle state', () => {
    it('flags wishlist button without aria-pressed', () => {
      const ctx = loadWithHTML(`
        <button class="wishlist-btn" aria-label="Add to wishlist">
          <svg aria-hidden="true"><path d="M12 21l-1-1"/></svg>
        </button>
      `);
      const results = ctx.runWishlistFavoritesAudit();
      const issue = results.issues.find(i => i.message.indexOf('does not communicate') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('non-button element', () => {
    it('flags div-based wishlist element without role="button"', () => {
      const ctx = loadWithHTML(`
        <div class="wishlist-icon" data-wishlist="true">
          <svg><path d="M12 21l-1-1"/></svg>
        </div>
      `);
      const results = ctx.runWishlistFavoritesAudit();
      const issue = results.issues.find(i => i.message.indexOf('lacks role="button"') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('moderate');
    });
  });

  describe('keyboard reachability', () => {
    it('flags wishlist button with tabindex="-1"', () => {
      const ctx = loadWithHTML(`
        <button class="wishlist-btn" aria-label="Add to wishlist" aria-pressed="false" tabindex="-1">
          <svg aria-hidden="true"><path d="M12 21"/></svg>
        </button>
      `);
      const results = ctx.runWishlistFavoritesAudit();
      const issue = results.issues.find(i => i.message.indexOf('tabindex="-1"') >= 0);
      expect(issue).toBeDefined();
      expect(issue.wcag).toBe('2.1.1');
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML('<button class="wishlist-btn" aria-label="Wishlist" aria-pressed="false">Fav</button>');
      const results = ctx.runWishlistFavoritesAudit();
      expect(results).toHaveProperty('component', 'wishlist-favorites');
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
