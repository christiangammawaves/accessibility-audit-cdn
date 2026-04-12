/**
 * Tree View Accessibility Audit Tests
 */

import { describe, it, expect } from 'vitest';
import { loadScripts } from './helpers/load-script.js';
import { createDOMOverrides } from './helpers/mock-dom.js';

function loadWithHTML(html) {
  const fullHTML = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>${html}</body></html>`;
  const domOverrides = createDOMOverrides(fullHTML);
  return loadScripts(
    ['scripts/version.js', 'scripts/shared-helpers.js', 'components/_audit-utils.js', 'components/tree-view.js'],
    domOverrides,
  );
}

describe('tree-view.js', () => {
  describe('detection', () => {
    it('returns empty results when no tree views exist', () => {
      const ctx = loadWithHTML('<p>No trees</p>');
      const results = ctx.runTreeViewAudit();
      expect(results.component).toBe('tree-view');
      expect(results.issues).toEqual([]);
      expect(results.stats.elementsScanned).toBe(0);
    });
  });

  describe('happy path', () => {
    it('passes for well-formed tree view', () => {
      const ctx = loadWithHTML(`
        <ul role="tree" aria-label="File browser">
          <li role="treeitem" aria-expanded="true" aria-selected="true">
            Documents
            <ul role="group">
              <li role="treeitem">report.pdf</li>
              <li role="treeitem">notes.txt</li>
            </ul>
          </li>
          <li role="treeitem" aria-expanded="false">
            Images
          </li>
        </ul>
      `);
      const results = ctx.runTreeViewAudit();
      expect(results.component).toBe('tree-view');
      expect(results.issues.filter(i => i.severity === 'critical' || i.severity === 'serious')).toEqual([]);
      expect(results.passed.length).toBeGreaterThan(0);
    });
  });

  describe('missing role="tree"', () => {
    it('flags custom tree widget without role', () => {
      const ctx = loadWithHTML(`
        <div class="tree-view">
          <div>Item 1</div>
          <div>Item 2</div>
        </div>
      `);
      const results = ctx.runTreeViewAudit();
      const issue = results.issues.find(i => i.message.indexOf('missing role="tree"') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('missing treeitem roles', () => {
    it('flags tree with no treeitems', () => {
      const ctx = loadWithHTML(`
        <ul role="tree" aria-label="Files">
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `);
      const results = ctx.runTreeViewAudit();
      const issue = results.issues.find(i => i.message.indexOf('no items with role="treeitem"') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
    });
  });

  describe('missing aria-expanded', () => {
    it('flags expandable nodes without aria-expanded', () => {
      const ctx = loadWithHTML(`
        <ul role="tree" aria-label="Files">
          <li role="treeitem">
            Folder
            <ul role="group">
              <li role="treeitem">File</li>
            </ul>
          </li>
        </ul>
      `);
      const results = ctx.runTreeViewAudit();
      const issue = results.issues.find(i => i.message.indexOf('missing aria-expanded') >= 0);
      expect(issue).toBeDefined();
      expect(issue.severity).toBe('serious');
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('missing accessible name', () => {
    it('flags tree without aria-label', () => {
      const ctx = loadWithHTML(`
        <ul role="tree">
          <li role="treeitem">Item 1</li>
        </ul>
      `);
      const results = ctx.runTreeViewAudit();
      const issue = results.issues.find(i => i.message.indexOf('no accessible name') >= 0);
      expect(issue).toBeDefined();
      expect(issue.wcag).toBe('4.1.2');
    });
  });

  describe('result structure', () => {
    it('has correct result shape', () => {
      const ctx = loadWithHTML('<ul role="tree" aria-label="Test"><li role="treeitem">A</li></ul>');
      const results = ctx.runTreeViewAudit();
      expect(results).toHaveProperty('component', 'tree-view');
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
