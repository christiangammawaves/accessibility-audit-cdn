/**
 * Progress Indicators Accessibility Audit Tests
 */

import { describe, it, expect } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/progress-indicators.js'],
    domOverrides,
  );
}

describe('progress-indicators.js', () => {
  describe('detection', () => {
    it('returns empty results when no progress indicators exist', () => {
      const ctx = loadWithHTML('<p>No progress</p>');
      const results = ctx.runProgressIndicatorsAudit();
      expect(results.component).toBe('progress-indicators');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('happy path', () => {
    it('passes for well-formed progress bar', () => {
      const ctx = loadWithHTML(`
        <div role="progressbar" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress">
          50%
        </div>
      `);
      const results = ctx.runProgressIndicatorsAudit();
      expect(results.component).toBe('progress-indicators');
      const passes = results.passed.filter(p => p.message.indexOf('all value attributes') >= 0);
      expect(passes.length).toBeGreaterThan(0);
    });

    it('passes for native progress element', () => {
      const ctx = loadWithHTML('<progress value="70" max="100" aria-label="Loading">70%</progress>');
      const results = ctx.runProgressIndicatorsAudit();
      const passes = results.passed.filter(p => p.message.indexOf('native <progress>') >= 0);
      expect(passes.length).toBeGreaterThan(0);
    });
  });

  describe('missing ARIA attributes', () => {
    it('flags progress bar missing value attributes', () => {
      const ctx = loadWithHTML('<div role="progressbar" aria-label="Loading">Loading...</div>');
      const results = ctx.runProgressIndicatorsAudit();
      const issue = results.issues.find(i => i.message.indexOf('missing:') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('missing label', () => {
    it('flags progress bar without accessible label', () => {
      const ctx = loadWithHTML('<div role="progressbar" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100">50%</div>');
      const results = ctx.runProgressIndicatorsAudit();
      const issue = results.issues.find(i => i.message.indexOf('no accessible label') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('moderate');
    });
  });

  describe('spinner without text', () => {
    it('flags spinner with no screen reader text', () => {
      const ctx = loadWithHTML('<div class="spinner"></div>');
      const results = ctx.runProgressIndicatorsAudit();
      const issue = results.issues.find(i => i.message.indexOf('no screen-reader-accessible text') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.2');
    });

    it('passes for spinner with aria-label', () => {
      const ctx = loadWithHTML('<div class="spinner" aria-label="Loading"></div>');
      const results = ctx.runProgressIndicatorsAudit();
      const passes = results.passed.filter(p => p.message.indexOf('aria-label') >= 0);
      expect(passes.length).toBeGreaterThan(0);
    });
  });

  describe('step indicators', () => {
    it('flags step indicator without aria-current', () => {
      const ctx = loadWithHTML(`
        <div class="step-indicator">
          <div class="step">Step 1</div>
          <div class="step active">Step 2</div>
          <div class="step">Step 3</div>
        </div>
      `);
      const results = ctx.runProgressIndicatorsAudit();
      const issue = results.issues.find(i => i.message.indexOf('aria-current="step"') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('moderate');
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML('<progress value="50" max="100" aria-label="Test">50%</progress>');
      const results = ctx.runProgressIndicatorsAudit();
      expect(results).toHaveProperty('component', 'progress-indicators');
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
