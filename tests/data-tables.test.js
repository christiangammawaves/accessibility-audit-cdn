/**
 * Data Tables Accessibility Audit Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/data-tables.js'],
    domOverrides,
  );
}

describe('data-tables.js', () => {
  describe('detection', () => {
    it('returns empty results when no tables exist', () => {
      const ctx = loadWithHTML('<p>No tables here</p>');
      const results = ctx.runDataTablesAudit();
      expect(results.component).toBe('data-tables');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });

    it('ignores presentational tables', () => {
      const ctx = loadWithHTML('<table role="presentation"><tr><td>Layout</td></tr></table>');
      const results = ctx.runDataTablesAudit();
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('happy path', () => {
    it('passes for well-formed data table', () => {
      const ctx = loadWithHTML(`
        <table aria-label="Sales data">
          <caption>Quarterly Sales</caption>
          <thead>
            <tr>
              <th scope="col">Quarter</th>
              <th scope="col">Revenue</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Q1</td><td>$100k</td></tr>
            <tr><td>Q2</td><td>$120k</td></tr>
          </tbody>
        </table>
      `);
      const results = ctx.runDataTablesAudit();
      expect(results.component).toBe('data-tables');
      expect(results.issues.filter(i => i.severity === 'critical')).toEqual([]);
      expect(results.passed.length).toBeGreaterThan(0);
    });
  });

  describe('missing caption/label', () => {
    it('flags table with no caption or aria-label', () => {
      const ctx = loadWithHTML(`
        <table>
          <thead><tr><th scope="col">Name</th><th scope="col">Age</th></tr></thead>
          <tbody><tr><td>Alice</td><td>30</td></tr></tbody>
        </table>
      `);
      const results = ctx.runDataTablesAudit();
      const issue = results.issues.find(i => i.message.indexOf('no caption') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('1.3.1');
    });
  });

  describe('missing th elements', () => {
    it('flags table with no th elements', () => {
      const ctx = loadWithHTML(`
        <table aria-label="Data">
          <tr><td>Name</td><td>Age</td></tr>
          <tr><td>Alice</td><td>30</td></tr>
        </table>
      `);
      const results = ctx.runDataTablesAudit();
      const issue = results.issues.find(i => i.message.indexOf('no <th>') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
    });
  });

  describe('missing scope attribute', () => {
    it('flags th elements without scope', () => {
      const ctx = loadWithHTML(`
        <table aria-label="Data">
          <thead><tr><th>Name</th><th>Age</th></tr></thead>
          <tbody><tr><td>Alice</td><td>30</td></tr></tbody>
        </table>
      `);
      const results = ctx.runDataTablesAudit();
      const issue = results.issues.find(i => i.message.indexOf('missing scope') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
    });
  });

  describe('sortable columns', () => {
    it('flags sortable headers missing aria-sort', () => {
      const ctx = loadWithHTML(`
        <table aria-label="Data">
          <thead>
            <tr>
              <th scope="col" data-sortable="true">Name</th>
              <th scope="col">Age</th>
            </tr>
          </thead>
          <tbody><tr><td>Alice</td><td>30</td></tr></tbody>
        </table>
      `);
      const results = ctx.runDataTablesAudit();
      const issue = results.issues.find(i => i.message.indexOf('aria-sort') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('moderate');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML('<table aria-label="Test"><tr><th scope="col">A</th></tr><tr><td>B</td></tr></table>');
      const results = ctx.runDataTablesAudit();
      expect(results).toHaveProperty('component', 'data-tables');
      expect(results).toHaveProperty('timestamp');
      expect(results).toHaveProperty('issues');
      expect(results).toHaveProperty('passed');
      expect(results).toHaveProperty('manualChecks');
      expect(results).toHaveProperty('stats');
      expect(typeof results.stats.elementsScanned).toBe('number');
      expect(typeof results.stats.issuesFound).toBe('number');
      expect(typeof results.stats.executionTimeMs).toBe('number');
    });
  });
});
