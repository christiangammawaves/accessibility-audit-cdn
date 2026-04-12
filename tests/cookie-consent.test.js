/**
 * Cookie Consent Accessibility Audit Tests
 */

import { describe, it, expect } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/cookie-consent.js'],
    domOverrides,
  );
}

describe('cookie-consent.js', () => {
  describe('detection', () => {
    it('returns empty results when no consent banners exist', () => {
      const ctx = loadWithHTML('<p>No cookies</p>');
      const results = ctx.runCookieConsentAudit();
      expect(results.component).toBe('cookie-consent');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('happy path', () => {
    it('passes for well-formed cookie consent banner', () => {
      const ctx = loadWithHTML(`
        <div class="cookie-consent" aria-label="Cookie consent">
          <p>We use cookies to improve your experience.</p>
          <button>Accept All</button>
          <button>Reject All</button>
        </div>
      `);
      const results = ctx.runCookieConsentAudit();
      expect(results.component).toBe('cookie-consent');
      const passes = results.passed.filter(p => p.message.indexOf('aria-label') >= 0);
      expect(passes.length).toBeGreaterThan(0);
    });
  });

  describe('missing accessible name', () => {
    it('flags consent banner without aria-label', () => {
      const ctx = loadWithHTML(`
        <div class="cookie-banner">
          <p>We use cookies.</p>
          <button>Accept</button>
        </div>
      `);
      const results = ctx.runCookieConsentAudit();
      const issue = results.issues.find(i => i.message.indexOf('no accessible name') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('keyboard accessibility', () => {
    it('flags buttons with tabindex="-1"', () => {
      const ctx = loadWithHTML(`
        <div class="cookie-consent" aria-label="Cookie consent">
          <button tabindex="-1">Accept</button>
        </div>
      `);
      const results = ctx.runCookieConsentAudit();
      const issue = results.issues.find(i => i.message.indexOf('tabindex="-1"') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('2.1.1');
    });

    it('passes when all buttons are accessible', () => {
      const ctx = loadWithHTML(`
        <div class="cookie-consent" aria-label="Cookie consent">
          <button>Accept</button>
          <button>Reject</button>
        </div>
      `);
      const results = ctx.runCookieConsentAudit();
      const passes = results.passed.filter(p => p.message.indexOf('keyboard accessible') >= 0);
      expect(passes.length).toBeGreaterThan(0);
    });
  });

  describe('missing reject option', () => {
    it('flags consent with Accept but no Reject', () => {
      const ctx = loadWithHTML(`
        <div class="cookie-consent" aria-label="Cookie consent">
          <button>Accept All</button>
          <button>Manage Preferences</button>
        </div>
      `);
      const results = ctx.runCookieConsentAudit();
      const issue = results.issues.find(i => i.message.indexOf('no Reject') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('moderate');
    });
  });

  describe('modal focus trapping', () => {
    it('flags dialog without aria-modal', () => {
      const ctx = loadWithHTML(`
        <div class="cookie-consent" role="dialog" aria-label="Cookie consent">
          <button>Accept</button>
        </div>
      `);
      const results = ctx.runCookieConsentAudit();
      const issue = results.issues.find(i => i.message.indexOf('aria-modal') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('2.4.3');
    });
  });

  describe('preference toggles', () => {
    it('flags custom toggles without proper roles', () => {
      const ctx = loadWithHTML(`
        <div class="cookie-consent" aria-label="Cookie consent">
          <button>Accept</button>
          <div class="cookie-toggle">Analytics</div>
        </div>
      `);
      const results = ctx.runCookieConsentAudit();
      const issue = results.issues.find(i => i.message.indexOf('toggles lack proper') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('moderate');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML('<div class="cookie-consent" aria-label="Cookies"><button>OK</button></div>');
      const results = ctx.runCookieConsentAudit();
      expect(results).toHaveProperty('component', 'cookie-consent');
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
