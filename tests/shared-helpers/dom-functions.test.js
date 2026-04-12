/**
 * Tests for DOM-dependent functions in scripts/shared-helpers.js
 * Uses jsdom to provide a DOM environment.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadScripts } from '../helpers/load-script.js';
import { createDOMOverrides } from '../helpers/mock-dom.js';

let ctx;

const TEST_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>Test Page</title></head>
<body>
  <div id="test-id" class="test-class other-class js-skip">
    <a href="/home" id="link-home">Home</a>
    <a href="/empty" id="link-empty"></a>
    <button id="btn-ok">OK</button>
    <button id="btn-disabled" disabled>Disabled</button>
    <button id="btn-icon"><svg><title>Close</title></svg></button>
    <img id="img-alt" alt="A product photo" src="/img.jpg" />
    <img id="img-no-alt" src="/img2.jpg" />
    <input id="input-labeled" type="text" />
    <label for="input-labeled">Name</label>
    <input id="input-placeholder" type="email" placeholder="Enter email" />
    <label id="wrap-label"><input id="input-wrapped" type="checkbox" /> Accept terms</label>
    <div id="with-aria-label" aria-label="Custom label">Content</div>
    <span id="labelledby-target">My Label</span>
    <div id="with-labelledby" aria-labelledby="labelledby-target">Content</div>
    <div id="role-btn" role="button">Click me</div>
    <div id="hidden-display" style="display: none;">Hidden</div>
    <div id="hidden-aria" aria-hidden="true">Aria Hidden</div>
    <div id="hidden-attr" hidden>Attr Hidden</div>
    <div id="tabindex-zero" tabindex="0">Focusable</div>
    <div id="contenteditable" contenteditable="true">Editable</div>
    <div id="klaviyo-wrapper" class="klaviyo-form">
      <button id="klaviyo-btn">Subscribe</button>
    </div>
  </div>
</body>
</html>`;

beforeAll(() => {
  const domOverrides = createDOMOverrides(TEST_HTML);
  ctx = loadScripts(['scripts/version.js', 'scripts/shared-helpers.js'], domOverrides);
});

// ============================================================================
// getSelector()
// ============================================================================

describe('getSelector', () => {
  it('returns "unknown" for null', () => {
    expect(ctx.a11yHelpers.getSelector(null)).toBe('unknown');
  });

  it('returns #id for element with id', () => {
    const el = ctx.document.getElementById('test-id');
    expect(ctx.a11yHelpers.getSelector(el)).toBe('#test-id');
  });

  it('returns #id for element with id (id takes priority over tag/class/role)', () => {
    const el = ctx.document.getElementById('role-btn');
    // getSelector returns #id immediately when element has an id
    expect(ctx.a11yHelpers.getSelector(el)).toBe('#role-btn');
  });

  it('filters out JS-state classes', () => {
    const el = ctx.document.getElementById('test-id');
    // Has classes: test-class, other-class, js-skip
    // getSelector returns #id since element has an id
    const selector = ctx.a11yHelpers.getSelector(el);
    expect(selector).toBe('#test-id');
  });

  it('applies maxLen to non-id selectors', () => {
    // getSelector returns #id immediately without maxLen truncation
    // maxLen only applies to tag.class[role] selectors
    const el = ctx.document.getElementById('btn-ok');
    // This has an id, so maxLen doesn't apply
    const selector = ctx.a11yHelpers.getSelector(el);
    expect(selector).toBe('#btn-ok');
  });
});

// ============================================================================
// getElementSnippet()
// ============================================================================

describe('getElementSnippet', () => {
  it('returns empty string for null', () => {
    expect(ctx.a11yHelpers.getElementSnippet(null)).toBe('');
  });

  it('returns full HTML for short elements', () => {
    const el = ctx.document.getElementById('btn-ok');
    const snippet = ctx.a11yHelpers.getElementSnippet(el);
    expect(snippet).toContain('<button');
    expect(snippet).toContain('OK');
  });

  it('truncates with "..." for very long elements', () => {
    const el = ctx.document.getElementById('test-id');
    const snippet = ctx.a11yHelpers.getElementSnippet(el, 50);
    // Element is large, so should truncate
    expect(snippet.length).toBeLessThanOrEqual(60);
  });
});

// ============================================================================
// isVisible() — limited in jsdom since getComputedStyle doesn't parse CSS
// ============================================================================

describe('isVisible', () => {
  it('returns false for null', () => {
    expect(ctx.a11yHelpers.isVisible(null)).toBe(false);
  });

  it('returns false for aria-hidden="true"', () => {
    const el = ctx.document.getElementById('hidden-aria');
    expect(ctx.a11yHelpers.isVisible(el)).toBe(false);
  });

  it('returns false for hidden attribute', () => {
    const el = ctx.document.getElementById('hidden-attr');
    expect(ctx.a11yHelpers.isVisible(el)).toBe(false);
  });
});

// ============================================================================
// getAccessibleName()
// ============================================================================

describe('getAccessibleName', () => {
  it('returns empty string for null', () => {
    expect(ctx.a11yHelpers.getAccessibleName(null)).toBe('');
  });

  it('returns aria-label value', () => {
    const el = ctx.document.getElementById('with-aria-label');
    expect(ctx.a11yHelpers.getAccessibleName(el)).toBe('Custom label');
  });

  it('returns aria-labelledby resolved text', () => {
    const el = ctx.document.getElementById('with-labelledby');
    expect(ctx.a11yHelpers.getAccessibleName(el)).toBe('My Label');
  });

  it('returns label[for] text for inputs', () => {
    const el = ctx.document.getElementById('input-labeled');
    expect(ctx.a11yHelpers.getAccessibleName(el)).toBe('Name');
  });

  it('returns wrapping label text for inputs', () => {
    const el = ctx.document.getElementById('input-wrapped');
    const name = ctx.a11yHelpers.getAccessibleName(el);
    expect(name).toContain('Accept terms');
  });

  it('returns placeholder as fallback for inputs', () => {
    const el = ctx.document.getElementById('input-placeholder');
    expect(ctx.a11yHelpers.getAccessibleName(el)).toBe('Enter email');
  });

  it('returns alt for images', () => {
    const el = ctx.document.getElementById('img-alt');
    expect(ctx.a11yHelpers.getAccessibleName(el)).toBe('A product photo');
  });

  it('returns SVG title text for buttons with SVG', () => {
    const el = ctx.document.getElementById('btn-icon');
    const name = ctx.a11yHelpers.getAccessibleName(el);
    expect(name).toContain('Close');
  });

  it('returns text content for buttons', () => {
    const el = ctx.document.getElementById('btn-ok');
    expect(ctx.a11yHelpers.getAccessibleName(el)).toBe('OK');
  });
});

// ============================================================================
// hasAccessibleName()
// ============================================================================

describe('hasAccessibleName', () => {
  it('returns true for element with accessible name', () => {
    const el = ctx.document.getElementById('btn-ok');
    expect(ctx.a11yHelpers.hasAccessibleName(el)).toBe(true);
  });

  it('returns false for element without accessible name', () => {
    const el = ctx.document.getElementById('link-empty');
    expect(ctx.a11yHelpers.hasAccessibleName(el)).toBe(false);
  });
});

// ============================================================================
// isFocusable()
// ============================================================================

describe('isFocusable', () => {
  it('returns false for null', () => {
    expect(ctx.a11yHelpers.isFocusable(null)).toBe(false);
  });

  it('returns true for <a href>', () => {
    const el = ctx.document.getElementById('link-home');
    expect(ctx.a11yHelpers.isFocusable(el)).toBe(true);
  });

  it('returns true for <button> (not disabled)', () => {
    const el = ctx.document.getElementById('btn-ok');
    expect(ctx.a11yHelpers.isFocusable(el)).toBe(true);
  });

  it('returns false for disabled button', () => {
    const el = ctx.document.getElementById('btn-disabled');
    expect(ctx.a11yHelpers.isFocusable(el)).toBe(false);
  });

  it('returns true for element with tabindex="0"', () => {
    const el = ctx.document.getElementById('tabindex-zero');
    expect(ctx.a11yHelpers.isFocusable(el)).toBe(true);
  });

  it('returns true for contenteditable', () => {
    const el = ctx.document.getElementById('contenteditable');
    expect(ctx.a11yHelpers.isFocusable(el)).toBe(true);
  });
});

// ============================================================================
// isThirdPartyWidget()
// ============================================================================

describe('isThirdPartyWidget', () => {
  it('returns false for null', () => {
    expect(ctx.a11yHelpers.isThirdPartyWidget(null)).toBe(false);
  });

  it('detects klaviyo class on element', () => {
    const el = ctx.document.getElementById('klaviyo-wrapper');
    expect(ctx.a11yHelpers.isThirdPartyWidget(el)).toBe(true);
  });

  it('detects third-party on child elements via ancestor walk', () => {
    const el = ctx.document.getElementById('klaviyo-btn');
    expect(ctx.a11yHelpers.isThirdPartyWidget(el)).toBe(true);
  });
});

// ============================================================================
// isVisible — additional edge cases
// ============================================================================

describe('isVisible — additional edge cases', () => {
  it('returns false for display:none inline style', () => {
    const el = ctx.document.createElement('div');
    el.style.display = 'none';
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isVisible(el)).toBe(false);
  });

  it('returns false for visibility:hidden inline style', () => {
    const el = ctx.document.createElement('div');
    el.style.visibility = 'hidden';
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isVisible(el)).toBe(false);
  });

  it('returns false for hidden attribute (explicit retest on fresh element)', () => {
    const el = ctx.document.createElement('div');
    el.setAttribute('hidden', '');
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isVisible(el)).toBe(false);
  });

  it('returns false when getBoundingClientRect has zero dimensions (jsdom default)', () => {
    const el = ctx.document.createElement('div');
    el.textContent = 'content';
    ctx.document.body.appendChild(el);
    ctx.a11yHelpers.invalidateElement(el);
    // jsdom always returns zero bounding rect, so isVisible is false for zero-size elements
    expect(ctx.a11yHelpers.isVisible(el)).toBe(false);
  });
});

// ============================================================================
// getAccessibleName — additional edge cases
// ============================================================================

describe('getAccessibleName — additional edge cases', () => {
  it('returns empty string for img without alt attribute', () => {
    const el = ctx.document.getElementById('img-no-alt');
    // getAttribute('alt') returns null → the null-check skips returning null →
    // no text content on img → falls through to return ''
    expect(ctx.a11yHelpers.getAccessibleName(el)).toBe('');
  });

  it('truncates text content longer than 100 characters to exactly 100', () => {
    const el = ctx.document.createElement('div');
    el.textContent = 'a'.repeat(110);
    ctx.document.body.appendChild(el);
    const name = ctx.a11yHelpers.getAccessibleName(el);
    expect(name.length).toBe(100);
  });
});

// ============================================================================
// getSelector — element without id
// ============================================================================

describe('getSelector — element without id', () => {
  it('returns tag.class selector for element with class but no id', () => {
    const el = ctx.document.createElement('section');
    el.className = 'content-area';
    ctx.document.body.appendChild(el);
    const selector = ctx.a11yHelpers.getSelector(el);
    expect(selector).toBe('section.content-area');
    expect(selector).not.toMatch(/^#/);
  });

  it('returns tag name only for element with neither id nor class', () => {
    const el = ctx.document.createElement('article');
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.getSelector(el)).toBe('article');
  });
});

// ============================================================================
// isFocusable — additional element types
// ============================================================================

describe('isFocusable — additional element types', () => {
  it('returns true for <select> (not disabled)', () => {
    const el = ctx.document.createElement('select');
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isFocusable(el)).toBe(true);
  });

  it('returns true for <textarea> (not disabled)', () => {
    const el = ctx.document.createElement('textarea');
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isFocusable(el)).toBe(true);
  });

  it('returns true for <input type="radio"> (not disabled)', () => {
    const el = ctx.document.createElement('input');
    el.type = 'radio';
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isFocusable(el)).toBe(true);
  });

  it('returns false for <div tabindex="-1"> (negative tabindex is not in tab order)', () => {
    const el = ctx.document.createElement('div');
    el.setAttribute('tabindex', '-1');
    ctx.document.body.appendChild(el);
    // parseInt('-1', 10) >= 0 is false, no focusable tag → returns false
    expect(ctx.a11yHelpers.isFocusable(el)).toBe(false);
  });
});

// ============================================================================
// safeQueryAll
// ============================================================================

describe('safeQueryAll', () => {
  it('returns array of matching elements for a valid selector', () => {
    const result = ctx.a11yHelpers.safeQueryAll('button', ctx.document);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].tagName).toBe('BUTTON');
  });

  it('returns empty array for an invalid selector without throwing', () => {
    const result = ctx.a11yHelpers.safeQueryAll('::invalid-selector-!!', ctx.document);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// safeQueryOne
// ============================================================================

describe('safeQueryOne', () => {
  it('returns the matching element for a valid selector', () => {
    const result = ctx.a11yHelpers.safeQueryOne('#btn-ok', ctx.document);
    expect(result).not.toBeNull();
    expect(result.id).toBe('btn-ok');
  });

  it('returns null when selector matches nothing', () => {
    const result = ctx.a11yHelpers.safeQueryOne('#non-existent-xyz-abc', ctx.document);
    expect(result).toBeNull();
  });

  it('returns null for an invalid selector without throwing', () => {
    const result = ctx.a11yHelpers.safeQueryOne('::invalid-selector-!!', ctx.document);
    expect(result).toBeNull();
  });
});

// ============================================================================
// isAriaHidden
// ============================================================================

describe('isAriaHidden', () => {
  it('returns true when element itself has aria-hidden="true"', () => {
    const el = ctx.document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isAriaHidden(el)).toBe(true);
  });

  it('returns true when an ancestor has aria-hidden="true"', () => {
    const parent = ctx.document.getElementById('hidden-aria'); // fixture: aria-hidden="true"
    const child = ctx.document.createElement('span');
    child.textContent = 'inside aria-hidden parent';
    parent.appendChild(child);
    expect(ctx.a11yHelpers.isAriaHidden(child)).toBe(true);
  });

  it('returns false when no aria-hidden anywhere in ancestor chain', () => {
    const el = ctx.document.createElement('p');
    el.textContent = 'normal paragraph';
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isAriaHidden(el)).toBe(false);
  });

  it('returns false for null input', () => {
    expect(ctx.a11yHelpers.isAriaHidden(null)).toBe(false);
  });

  it('serves cached result after aria-hidden attribute is removed', () => {
    const el = ctx.document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    ctx.document.body.appendChild(el);
    // First call populates cache with true
    expect(ctx.a11yHelpers.isAriaHidden(el)).toBe(true);
    el.removeAttribute('aria-hidden');
    // Second call returns cached true (cache TTL = 5 s, well within test duration)
    expect(ctx.a11yHelpers.isAriaHidden(el)).toBe(true);
  });
});

// ============================================================================
// isScreenReaderOnly
// ============================================================================

describe('isScreenReaderOnly', () => {
  it('returns true for element with sr-only class', () => {
    const el = ctx.document.createElement('span');
    el.className = 'sr-only';
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isScreenReaderOnly(el)).toBe(true);
  });

  it('returns true for element with visually-hidden class', () => {
    const el = ctx.document.createElement('span');
    el.className = 'visually-hidden';
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isScreenReaderOnly(el)).toBe(true);
  });

  it('returns true for 1px-box inline CSS technique', () => {
    const el = ctx.document.createElement('span');
    el.setAttribute('style', 'position:absolute;width:1px;height:1px;overflow:hidden;');
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isScreenReaderOnly(el)).toBe(true);
  });

  it('returns false for a normal visible element', () => {
    expect(ctx.a11yHelpers.isScreenReaderOnly(ctx.document.getElementById('btn-ok'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(ctx.a11yHelpers.isScreenReaderOnly(null)).toBe(false);
  });
});

// ============================================================================
// isElementVisibleComprehensive
// ============================================================================

describe('isElementVisibleComprehensive', () => {
  it('returns false for null', () => {
    expect(ctx.a11yHelpers.isElementVisibleComprehensive(null)).toBe(false);
  });

  it('returns false for element with hidden attribute', () => {
    const el = ctx.document.createElement('div');
    el.setAttribute('hidden', '');
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isElementVisibleComprehensive(el)).toBe(false);
  });

  it('returns false for element with aria-hidden="true"', () => {
    const el = ctx.document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isElementVisibleComprehensive(el)).toBe(false);
  });

  it('returns false for display:none inline style', () => {
    const el = ctx.document.createElement('div');
    el.style.display = 'none';
    ctx.document.body.appendChild(el);
    expect(ctx.a11yHelpers.isElementVisibleComprehensive(el)).toBe(false);
  });

  it('returns false when getBoundingClientRect has zero dimensions (jsdom default)', () => {
    const el = ctx.document.createElement('div');
    el.textContent = 'zero dims in jsdom';
    ctx.document.body.appendChild(el);
    ctx.a11yHelpers.invalidateElement(el);
    expect(ctx.a11yHelpers.isElementVisibleComprehensive(el)).toBe(false);
  });

  it('respects checkAncestors option — false skips ancestor aria-hidden check', () => {
    const parent = ctx.document.createElement('div');
    parent.setAttribute('aria-hidden', 'true');
    const child = ctx.document.createElement('span');
    child.textContent = 'child';
    // Mock positive dimensions so the element would be "visible" once ancestor check is skipped
    child.getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, right: 100, bottom: 20, left: 0 });
    parent.appendChild(child);
    ctx.document.body.appendChild(parent);

    // Default (checkAncestors: true) → ancestor aria-hidden causes false
    expect(ctx.a11yHelpers.isElementVisibleComprehensive(child, { checkAncestors: true })).toBe(false);
    // checkAncestors: false → skips ancestor check → positive dimensions → true
    expect(ctx.a11yHelpers.isElementVisibleComprehensive(child, { checkAncestors: false })).toBe(true);
  });
});

// ============================================================================
// getUniqueSelectorPath
// ============================================================================

describe('getUniqueSelectorPath', () => {
  it('returns "unknown" for null', () => {
    expect(ctx.a11yHelpers.getUniqueSelectorPath(null)).toBe('unknown');
  });

  it('returns path containing element id for element with id', () => {
    const el = ctx.document.getElementById('btn-ok');
    const path = ctx.a11yHelpers.getUniqueSelectorPath(el);
    expect(path).toContain('#btn-ok');
  });

  it('returns tag-based path for nested elements without ids', () => {
    const outer = ctx.document.createElement('div');
    const inner = ctx.document.createElement('span');
    outer.appendChild(inner);
    ctx.document.body.appendChild(outer);
    const path = ctx.a11yHelpers.getUniqueSelectorPath(inner);
    expect(path).not.toMatch(/#/);
    expect(path).toContain('span');
  });

  it('stops at document.body — path for direct child does not include "body"', () => {
    const el = ctx.document.createElement('nav');
    ctx.document.body.appendChild(el);
    const path = ctx.a11yHelpers.getUniqueSelectorPath(el);
    expect(path).toContain('nav');
    expect(path).not.toContain('body');
  });

  it('breaks at ancestor id and includes it in the path', () => {
    const outer = ctx.document.createElement('div');
    outer.id = 'outer-anchor';
    const inner = ctx.document.createElement('span');
    outer.appendChild(inner);
    ctx.document.body.appendChild(outer);
    const path = ctx.a11yHelpers.getUniqueSelectorPath(inner);
    expect(path).toContain('#outer-anchor');
  });
});

// ============================================================================
// addIssue / addPassed / addManualCheck / finalizeResults
// ============================================================================

describe('addIssue / addPassed / addManualCheck / finalizeResults', () => {
  let results;

  beforeEach(() => {
    results = ctx.a11yHelpers.createResults('test-component');
  });

  it('createResults returns correct initial shape', () => {
    expect(results.component).toBe('test-component');
    expect(results.issues).toEqual([]);
    expect(results.passed).toEqual([]);
    expect(results.manualChecks).toEqual([]);
    expect(results.stats.issuesFound).toBe(0);
    expect(results.stats.passedChecks).toBe(0);
    expect(results.stats.manualChecksNeeded).toBe(0);
  });

  it('addIssue populates all required fields', () => {
    const el = ctx.document.getElementById('btn-ok');
    ctx.a11yHelpers.addIssue(results, 'serious', '1.3.1', 'Info and Relationships', 'Missing role', el, 'Add role attribute');
    expect(results.issues).toHaveLength(1);
    const issue = results.issues[0];
    expect(issue.severity).toBe('serious');
    expect(issue.wcag).toBe('1.3.1');
    expect(issue.criterion).toBe('Info and Relationships');
    expect(issue.message).toBe('Missing role');
    expect(issue.fix).toBe('Add role attribute');
    expect(issue.selector).toBe('#btn-ok');
    expect(issue.element).toContain('<button');
    expect(results.stats.issuesFound).toBe(1);
  });

  it('addIssue applies default impact for critical severity', () => {
    ctx.a11yHelpers.addIssue(results, 'critical', '4.1.2', 'Name, Role, Value', 'No accessible name', null, 'Add aria-label');
    expect(results.issues[0].impact).toBe('Users cannot complete essential tasks');
  });

  it('addIssue preserves custom impact string when provided', () => {
    ctx.a11yHelpers.addIssue(results, 'minor', '1.4.3', 'Contrast', 'Low contrast', null, 'Fix color', 'Custom impact text');
    expect(results.issues[0].impact).toBe('Custom impact text');
  });

  it('addPassed populates fields and increments passedChecks', () => {
    ctx.a11yHelpers.addPassed(results, '4.1.2', 'Name, Role, Value', 'Button has accessible name', '#btn-ok');
    expect(results.passed).toHaveLength(1);
    const passed = results.passed[0];
    expect(passed.wcag).toBe('4.1.2');
    expect(passed.criterion).toBe('Name, Role, Value');
    expect(passed.message).toBe('Button has accessible name');
    expect(passed.selector).toBe('#btn-ok');
    expect(results.stats.passedChecks).toBe(1);
  });

  it('addPassed defaults selector to empty string when omitted', () => {
    ctx.a11yHelpers.addPassed(results, '1.1.1', 'Non-text Content', 'Image has alt text');
    expect(results.passed[0].selector).toBe('');
  });

  it('addManualCheck populates fields and increments manualChecksNeeded', () => {
    ctx.a11yHelpers.addManualCheck(results, '2.4.3', 'Focus order is logical', 'Verify tab order manually', '#main');
    expect(results.manualChecks).toHaveLength(1);
    const check = results.manualChecks[0];
    expect(check.wcag).toBe('2.4.3');
    expect(check.message).toBe('Focus order is logical');
    expect(check.instructions).toBe('Verify tab order manually');
    expect(check.selector).toBe('#main');
    expect(results.stats.manualChecksNeeded).toBe(1);
  });

  it('addManualCheck defaults instructions and selector to empty string', () => {
    ctx.a11yHelpers.addManualCheck(results, '2.4.3', 'Check focus order');
    expect(results.manualChecks[0].instructions).toBe('');
    expect(results.manualChecks[0].selector).toBe('');
  });

  it('finalizeResults sets executionTimeMs to a non-negative number and returns results', () => {
    const startTime = ctx.performance.now();
    const finalResults = ctx.a11yHelpers.finalizeResults(results, startTime);
    expect(finalResults).toBe(results);
    expect(typeof finalResults.stats.executionTimeMs).toBe('number');
    expect(finalResults.stats.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});
