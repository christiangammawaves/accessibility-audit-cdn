/**
 * Date Picker Accessibility Audit Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/date-picker.js'],
    domOverrides,
  );
}

describe('date-picker.js', () => {
  describe('detection', () => {
    it('returns empty results when no date pickers exist', () => {
      const ctx = loadWithHTML('<p>No date pickers</p>');
      const results = ctx.runDatePickerAudit();
      expect(results.component).toBe('date-picker');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('native date input', () => {
    it('passes for native date input with label', () => {
      const ctx = loadWithHTML(`
        <label for="birthday">Birthday</label>
        <input type="date" id="birthday" aria-label="Birthday" />
      `);
      const results = ctx.runDatePickerAudit();
      expect(results.component).toBe('date-picker');
      const passes = results.passed.filter(p => p.message.indexOf('Native date input') >= 0);
      expect(passes.length).toBeGreaterThan(0);
    });
  });

  describe('missing label', () => {
    it('flags date picker with no accessible label', () => {
      const ctx = loadWithHTML(`
        <div class="datepicker">
          <table role="grid">
            <tr><td role="gridcell">1</td><td role="gridcell">2</td></tr>
          </table>
        </div>
      `);
      const results = ctx.runDatePickerAudit();
      const issue = results.issues.find(i => i.message.indexOf('no accessible label') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('calendar grid roles', () => {
    it('flags missing role="grid" on calendar', () => {
      const ctx = loadWithHTML(`
        <div class="datepicker" aria-label="Pick date">
          <table>
            <tr><td>1</td><td>2</td></tr>
          </table>
        </div>
      `);
      const results = ctx.runDatePickerAudit();
      const issue = results.issues.find(i => i.message.indexOf('missing role="grid"') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
    });

    it('passes when calendar uses role="grid" with gridcells', () => {
      const ctx = loadWithHTML(`
        <div class="datepicker" aria-label="Pick date">
          <input type="text" placeholder="mm/dd/yyyy" />
          <table role="grid">
            <tr>
              <td role="gridcell" aria-selected="true">1</td>
              <td role="gridcell">2</td>
            </tr>
          </table>
        </div>
      `);
      const results = ctx.runDatePickerAudit();
      const gridPass = results.passed.find(p => p.message.indexOf('role="grid"') >= 0);
      expect(gridPass).toBeDefined();
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML('<input type="date" aria-label="Date" />');
      const results = ctx.runDatePickerAudit();
      expect(results).toHaveProperty('component', 'date-picker');
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
