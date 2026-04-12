/**
 * Toast Notifications Accessibility Audit Tests
 */

import { describe, it, expect } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/toast-notifications.js'],
    domOverrides,
  );
}

describe('toast-notifications.js', () => {
  describe('detection', () => {
    it('returns empty results when no toasts exist', () => {
      const ctx = loadWithHTML('<p>No toasts</p>');
      const results = ctx.runToastNotificationsAudit();
      expect(results.component).toBe('toast-notifications');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('happy path', () => {
    it('passes for well-formed alert toast', () => {
      const ctx = loadWithHTML(`
        <div role="alert" aria-live="assertive">
          Item added to cart
          <button aria-label="Dismiss">×</button>
        </div>
      `);
      const results = ctx.runToastNotificationsAudit();
      expect(results.component).toBe('toast-notifications');
      const passes = results.passed.filter(p => p.message.indexOf('role="alert"') >= 0);
      expect(passes.length).toBeGreaterThan(0);
    });

    it('passes for status toast', () => {
      const ctx = loadWithHTML('<div role="status">Saved successfully</div>');
      const results = ctx.runToastNotificationsAudit();
      const passes = results.passed.filter(p => p.message.indexOf('role="status"') >= 0);
      expect(passes.length).toBeGreaterThan(0);
    });
  });

  describe('missing role', () => {
    it('flags toast with no role or aria-live', () => {
      const ctx = loadWithHTML('<div class="toast">Something happened</div>');
      const results = ctx.runToastNotificationsAudit();
      const issue = results.issues.find(i => i.message.indexOf('missing role=') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.3');
    });
  });

  describe('missing aria-live', () => {
    it('flags toast with no live region at all', () => {
      const ctx = loadWithHTML('<div class="snackbar">Update available</div>');
      const results = ctx.runToastNotificationsAudit();
      const liveIssue = results.issues.find(i => i.message.indexOf('no aria-live') >= 0);
      expect(liveIssue).toBeDefined();
      expect(liveIssue.severity).toBe('serious');
    });
  });

  describe('auto-dismiss timing', () => {
    it('flags fast auto-dismiss', () => {
      const ctx = loadWithHTML('<div role="status" data-duration="3000">Quick toast</div>');
      const results = ctx.runToastNotificationsAudit();
      const issue = results.issues.find(i => i.message.indexOf('less than 5 seconds') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('moderate');
      expect(issue.wcag).toBe('2.2.1');
    });

    it('passes for sufficient auto-dismiss time', () => {
      const ctx = loadWithHTML('<div role="status" data-duration="6000">Slow toast</div>');
      const results = ctx.runToastNotificationsAudit();
      const pass = results.passed.find(p => p.message.indexOf('6000ms') >= 0);
      expect(pass).toBeDefined();
    });
  });

  describe('toast with actions and auto-dismiss', () => {
    it('flags auto-dismissing toast with action buttons', () => {
      const ctx = loadWithHTML(`
        <div role="alert" data-duration="5000">
          New update available
          <button>Update now</button>
          <button aria-label="Dismiss">×</button>
        </div>
      `);
      const results = ctx.runToastNotificationsAudit();
      const issue = results.issues.find(i => i.message.indexOf('action buttons auto-dismisses') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML('<div role="alert">Test</div>');
      const results = ctx.runToastNotificationsAudit();
      expect(results).toHaveProperty('component', 'toast-notifications');
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
