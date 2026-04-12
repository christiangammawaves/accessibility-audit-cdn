/**
 * ARIA Accessibility Audit Script
 * Part of modular accessibility-audit-unified system
 * 
 * WCAG Success Criteria Covered:
 * - 4.1.2 Name, Role, Value (Level A)
 * - 4.1.3 Status Messages (Level AA)
 * 
 * @updated 2026-02-04
 * @requires shared-helpers.js must be loaded first
 * 
 * Usage:
 *   const results = await runAriaAudit();
 *   console.log(results);
 */

(function() {
  'use strict';

  // Use centralized version if available
  const SCRIPT_VERSION = (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown';

  if (typeof window.a11yHelpers === 'undefined') {
    throw new Error('shared-helpers.js must be loaded before aria-audit.js');
  }

  const helpers = window.a11yHelpers;

  /**
   * Valid ARIA roles
   */
  const VALID_ROLES = [
    'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell',
    'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition',
    'dialog', 'directory', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell',
    'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
    'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
    'navigation', 'none', 'note', 'option', 'presentation', 'progressbar', 'radio',
    'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search',
    'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab',
    'table', 'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip',
    'tree', 'treegrid', 'treeitem'
  ];

  /**
   * Required attributes for specific roles
   */
  const REQUIRED_ATTRS = {
    'checkbox': ['aria-checked'],
    'combobox': ['aria-expanded', 'aria-controls'],
    'radio': ['aria-checked'],
    'scrollbar': ['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-controls'],
    'slider': ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
    'spinbutton': ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
    'switch': ['aria-checked'],
    'tab': ['aria-selected'],
    'tabpanel': ['aria-labelledby']
  };

  /**
   * Roles that require accessible names
   */
  const ROLES_REQUIRING_NAME = [
    'button', 'link', 'checkbox', 'radio', 'combobox', 'listbox', 'menuitem',
    'option', 'progressbar', 'scrollbar', 'searchbox', 'slider', 'spinbutton',
    'switch', 'tab', 'textbox', 'tree', 'treegrid'
  ];

  /**
   * Valid ARIA attributes
   */
  const VALID_ARIA_ATTRS = [
    'aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-busy',
    'aria-checked', 'aria-colcount', 'aria-colindex', 'aria-colspan', 'aria-controls',
    'aria-current', 'aria-describedby', 'aria-details', 'aria-disabled',
    'aria-dropeffect', 'aria-errormessage', 'aria-expanded', 'aria-flowto',
    'aria-grabbed', 'aria-haspopup', 'aria-hidden', 'aria-invalid', 'aria-keyshortcuts',
    'aria-label', 'aria-labelledby', 'aria-level', 'aria-live', 'aria-modal',
    'aria-multiline', 'aria-multiselectable', 'aria-orientation', 'aria-owns',
    'aria-placeholder', 'aria-posinset', 'aria-pressed', 'aria-readonly',
    'aria-relevant', 'aria-required', 'aria-roledescription', 'aria-rowcount',
    'aria-rowindex', 'aria-rowspan', 'aria-selected', 'aria-setsize', 'aria-sort',
    'aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext'
  ];

  /**
   * Status/alert roles for 4.1.3
   */
  const STATUS_ROLES = ['alert', 'status', 'log', 'marquee', 'timer'];

  /**
   * Check if element has valid ARIA role
   */
  function checkRole(element) {
    const issues = [];
    const role = element.getAttribute('role');
    
    if (!role) return issues;

    const roles = role.split(/\s+/);
    
    for (const r of roles) {
      if (!VALID_ROLES.includes(r)) {
        issues.push({
          type: 'invalid-role',
          role: r,
          severity: 'critical',
          message: `Invalid ARIA role: "${r}"`
        });
      }
    }

    return issues;
  }

  /**
   * Check required attributes for role
   */
  function checkRequiredAttributes(element) {
    const issues = [];
    const role = element.getAttribute('role');
    
    if (!role || !REQUIRED_ATTRS[role]) return issues;

    const requiredAttrs = REQUIRED_ATTRS[role];
    
    for (const attr of requiredAttrs) {
      if (!element.hasAttribute(attr)) {
        issues.push({
          type: 'missing-required-attr',
          attribute: attr,
          role: role,
          severity: 'critical',
          message: `Role "${role}" requires ${attr} attribute`
        });
      }
    }

    return issues;
  }

  /**
   * Check for invalid ARIA attributes
   */
  function checkInvalidAttributes(element) {
    const issues = [];
    const attrs = element.attributes;
    
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      if (attr.name.startsWith('aria-')) {
        if (!VALID_ARIA_ATTRS.includes(attr.name)) {
          issues.push({
            type: 'invalid-attribute',
            attribute: attr.name,
            severity: 'moderate',
            message: `Invalid ARIA attribute: "${attr.name}"`
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check if role requires accessible name
   */
  function checkAccessibleName(element) {
    const issues = [];
    const role = element.getAttribute('role');
    
    if (!role || !ROLES_REQUIRING_NAME.includes(role)) return issues;

    const accessibleName = helpers.getAccessibleName(element);
    
    if (!accessibleName || accessibleName.trim().length === 0) {
      issues.push({
        type: 'missing-name',
        role: role,
        severity: 'critical',
        message: `Element with role="${role}" has no accessible name`
      });
    }

    return issues;
  }

  /**
   * Check aria-hidden on focusable elements
   */
  function checkAriaHidden(element) {
    const issues = [];
    const ariaHidden = element.getAttribute('aria-hidden');
    
    if (ariaHidden === 'true') {
      // Check if element or descendants are focusable
      const isFocusable = element.tabIndex >= 0 || 
                          ['a', 'button', 'input', 'select', 'textarea'].includes(element.tagName.toLowerCase());
      
      const hasFocusableDescendant = element.querySelector(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (isFocusable || hasFocusableDescendant) {
        issues.push({
          type: 'hidden-focusable',
          severity: 'critical',
          message: 'Element with aria-hidden="true" contains focusable content'
        });
      }
    }

    return issues;
  }

  /**
   * Check aria-labelledby and aria-describedby references
   */
  function checkAriaReferences(element) {
    const issues = [];
    
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const ids = labelledBy.split(/\s+/);
      for (const id of ids) {
        if (!document.getElementById(id)) {
          issues.push({
            type: 'broken-reference',
            attribute: 'aria-labelledby',
            targetId: id,
            severity: 'critical',
            message: `aria-labelledby references non-existent ID: "${id}"`
          });
        }
      }
    }

    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy) {
      const ids = describedBy.split(/\s+/);
      for (const id of ids) {
        if (!document.getElementById(id)) {
          issues.push({
            type: 'broken-reference',
            attribute: 'aria-describedby',
            targetId: id,
            severity: 'moderate',
            message: `aria-describedby references non-existent ID: "${id}"`
          });
        }
      }
    }

    const controls = element.getAttribute('aria-controls');
    if (controls) {
      const ids = controls.split(/\s+/);
      for (const id of ids) {
        if (!document.getElementById(id)) {
          issues.push({
            type: 'broken-reference',
            attribute: 'aria-controls',
            targetId: id,
            severity: 'moderate',
            message: `aria-controls references non-existent ID: "${id}"`
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check status messages (WCAG 4.1.3)
   */
  function checkStatusMessages() {
    const issues = [];
    
    // Look for elements that appear to be status messages without proper roles
    const possibleStatusElements = Array.from(document.querySelectorAll(
      '[class*="message"], [class*="alert"], [class*="notification"], ' +
      '[class*="toast"], [class*="status"], [id*="message"], [id*="alert"]'
    ));

    for (const element of possibleStatusElements) {
      if (!helpers.isVisible(element)) continue;

      const role = element.getAttribute('role');
      const ariaLive = element.getAttribute('aria-live');
      
      // If it looks like a status message but has no ARIA
      if (!role && !ariaLive) {
        const text = helpers.getVisibleText(element);
        if (text.length > 10) { // Has substantial content
          const selector = helpers.getSelector(element);
          issues.push({
            wcag: '4.1.3',
            level: 'AA',
            category: 'aria',
            severity: 'moderate',
            element: element.tagName.toLowerCase(),
            selector,
            message: 'Possible status message without ARIA role or live region',
            snippet: helpers.getElementSnippet(element),
            recommendation: 'Add role="status" or aria-live="polite" for status messages'
          });
        }
      }
    }

    return issues;
  }

  /**
   * Main audit function
   */
  async function runAriaAudit(options = {}) {
    // DEPRECATED: ARIA checks are now handled by individual component auditors.
    // This function returns a stub result to avoid breaking callers.
    return {
      component: 'aria-audit',
      deprecated: true,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      scope: 'N/A',
      issues: [],
      passed: [],
      manualChecks: [{
        wcag: 'N/A',
        message: 'aria-audit is deprecated. ARIA checks are now handled by individual component auditors.'
      }],
      stats: {
        elementsScanned: 0,
        issuesFound: 0,
        passedChecks: 0,
        manualChecksNeeded: 1,
        executionTimeMs: 0
      }
    };

    // --- Legacy implementation below (unreachable) ---
    console.warn('[DEPRECATED] runAriaAudit() is legacy. Use component-level ARIA checks instead.');
    const { skipHidden = true } = options;

    // v8.9.0 FIX (P4-2): Use standardized logging
    if (helpers.log) helpers.log('INFO', 'aria-audit', 'Starting ARIA Audit...');
    const startTime = performance.now();

    const issues = [];
    const stats = {
      totalElements: 0,
      elementsWithRole: 0,
      invalidRoles: 0,
      missingRequiredAttrs: 0,
      invalidAttributes: 0,
      missingNames: 0,
      brokenReferences: 0,
      hiddenFocusable: 0
    };

    // Find all elements with ARIA attributes or roles
    const ariaElements = Array.from(document.querySelectorAll('[role], [aria-label], [aria-labelledby], [aria-describedby], [class*="aria"], [aria-hidden]'));
    
    // Also check all interactive elements
    const interactiveElements = Array.from(document.querySelectorAll('button, [role="button"], input, select, textarea, a[href]'));
    
    const allElements = [...new Set([...ariaElements, ...interactiveElements])];
    stats.totalElements = allElements.length;

    for (const element of allElements) {
      if (skipHidden && !helpers.isVisible(element)) continue;

      const selector = helpers.getSelector(element);
      const elementIssues = [];

      // Check role validity
      const roleIssues = checkRole(element);
      if (roleIssues.length > 0) {
        stats.invalidRoles++;
        elementIssues.push(...roleIssues);
      }

      // Check required attributes
      const reqAttrIssues = checkRequiredAttributes(element);
      if (reqAttrIssues.length > 0) {
        stats.missingRequiredAttrs++;
        elementIssues.push(...reqAttrIssues);
      }

      // Check invalid attributes
      const invalidAttrIssues = checkInvalidAttributes(element);
      if (invalidAttrIssues.length > 0) {
        stats.invalidAttributes++;
        elementIssues.push(...invalidAttrIssues);
      }

      // Check accessible name
      const nameIssues = checkAccessibleName(element);
      if (nameIssues.length > 0) {
        stats.missingNames++;
        elementIssues.push(...nameIssues);
      }

      // Check aria-hidden
      const hiddenIssues = checkAriaHidden(element);
      if (hiddenIssues.length > 0) {
        stats.hiddenFocusable++;
        elementIssues.push(...hiddenIssues);
      }

      // Check ARIA references
      const refIssues = checkAriaReferences(element);
      if (refIssues.length > 0) {
        stats.brokenReferences++;
        elementIssues.push(...refIssues);
      }

      // Convert element issues to standard format
      for (const issue of elementIssues) {
        issues.push({
          wcag: '4.1.2',
          level: 'A',
          category: 'aria',
          severity: issue.severity,
          element: element.tagName.toLowerCase(),
          selector,
          message: issue.message,
          details: issue.type,
          snippet: helpers.getElementSnippet(element),
          recommendation: getRecommendation(issue)
        });
      }

      if (element.getAttribute('role')) {
        stats.elementsWithRole++;
      }
    }

    // Check status messages
    const statusIssues = checkStatusMessages();
    issues.push(...statusIssues);

    const duration = Math.round(performance.now() - startTime);
    const deduplicatedIssues = helpers.deduplicateIssues(issues);

    // v8.9.0 FIX (P4-2): Use standardized logging
    if (helpers.log) {
      helpers.log('INFO', 'aria-audit', `ARIA Audit complete in ${duration}ms`);
      helpers.log('INFO', 'aria-audit', `Found ${deduplicatedIssues.length} issues across ${stats.totalElements} elements`);
    }

    return {
      summary: {
        category: 'ARIA',
        duration,
        issueCount: deduplicatedIssues.length,
        criticalCount: deduplicatedIssues.filter(i => i.severity === 'critical').length,
        stats
      },
      issues: deduplicatedIssues
    };
  }

  /**
   * Get recommendation based on issue type
   */
  function getRecommendation(issue) {
    switch (issue.type) {
      case 'invalid-role':
        return 'Use valid ARIA role from ARIA 1.2 specification';
      case 'missing-required-attr':
        return `Add required ${issue.attribute} attribute for role="${issue.role}"`;
      case 'invalid-attribute':
        return 'Remove invalid ARIA attribute or use valid attribute name';
      case 'missing-name':
        return 'Add aria-label, aria-labelledby, or visible text content';
      case 'hidden-focusable':
        return 'Remove aria-hidden or make content non-focusable';
      case 'broken-reference':
        return `Ensure element with ID "${issue.targetId}" exists in the page`;
      default:
        return 'Fix ARIA implementation according to WCAG 4.1.2';
    }
  }

  window.runAriaAudit = runAriaAudit;

})();
