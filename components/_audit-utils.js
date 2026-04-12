/**
 * Shared Audit Helpers for Component Modules
 *
 * Provides initComponent(name, scope) that returns results object + helper functions,
 * replacing ~50 lines of boilerplate per component file.
 *
 * @module _audit-utils
 */

(function(global) {
  'use strict';

  if (!global.a11yAudit) global.a11yAudit = {};

  // M7 fix: Shared performance constants for consistent timeout behavior across modules
  global.a11yAudit.PERF = {
    TIMEOUT_MS: 2000,         // Max time for any single loop/scan before breaking
    SAMPLING_INTERVAL: 500    // Check elapsed time every N elements
  };

  var IMPACT_MAP = {
    critical: 'Users cannot complete essential tasks',
    serious: 'Users face significant barriers',
    moderate: 'Users experience frustration',
    minor: 'Minor inconvenience'
  };

  /**
   * Initialize a component audit with standard results object and helper functions.
   * @param {string} name - Component name (e.g., 'breadcrumbs')
   * @param {string|string[]} scope - CSS selector(s) describing audit scope
   * @returns {{ results, h, addIssue, addPassed, addManualCheck, getDefaultImpact }}
   */
  global.a11yAudit.initComponent = function initComponent(name, scope) {
    if (!global.a11yHelpers) {
      throw new Error('[' + name + '.js] Required dependency missing: shared-helpers.js must be loaded before this component.');
    }

    var h = global.a11yHelpers;
    var scopeStr = Array.isArray(scope) ? scope.join(', ') : (scope || '');

    var results = {
      component: name,
      timestamp: new Date().toISOString(),
      url: global.location ? global.location.href : '',
      scope: scopeStr,
      issues: [],
      passed: [],
      manualChecks: [],
      stats: { elementsScanned: 0, issuesFound: 0, passedChecks: 0, manualChecksNeeded: 0, executionTimeMs: 0 }
    };

    function getDefaultImpact(severity) {
      return IMPACT_MAP[severity] || 'Impact varies';
    }

    function addIssue(severity, wcag, criterion, message, element, fix, impact) {
      results.issues.push({
        severity: severity,
        wcag: wcag,
        criterion: criterion,
        message: message,
        selector: h.getSelector ? h.getSelector(element) : '',
        element: h.getElementSnippet ? h.getElementSnippet(element) : '',
        fix: fix,
        impact: impact || getDefaultImpact(severity)
      });
    }

    function addPassed(wcag, criterion, message, selector) {
      results.passed.push({ wcag: wcag, criterion: criterion, message: message, selector: selector });
    }

    function addManualCheck(wcag, message, howToTest, selector) {
      results.manualChecks.push({ wcag: wcag, message: message, howToTest: howToTest, selector: selector || null });
    }

    return { results: results, h: h, addIssue: addIssue, addPassed: addPassed, addManualCheck: addManualCheck, getDefaultImpact: getDefaultImpact };
  };

  // ==========================================================================
  // SEVERITY DECISION MATRIX
  // ==========================================================================

  /**
   * Standardized severity assignments for common issue types.
   * Components should reference this rather than hardcoding severity.
   */
  var SEVERITY_MATRIX = {
    // User completely blocked from essential task
    'blocked-essential': 'critical',
    'missing-name-interactive': 'critical',
    'keyboard-trap': 'critical',

    // Significant difficulty completing task
    'significant-barrier': 'serious',
    'missing-label': 'serious',
    'incorrect-role': 'serious',
    'focus-not-visible': 'serious',
    'contrast-fail': 'serious',

    // User experiences friction but can complete task
    'friction': 'moderate',
    'heading-hierarchy': 'moderate',
    'target-size-near-miss': 'moderate',
    'missing-landmark': 'moderate',

    // Minor annoyance, workaround exists
    'minor-annoyance': 'minor',
    'redundant-aria': 'minor',
    'best-practice': 'minor'
  };

  /**
   * Get recommended severity for an issue type, with optional context modifiers.
   * @param {string} issueType - Key from SEVERITY_MATRIX
   * @param {object} [context] - Optional context modifiers
   * @param {boolean} [context.criticalPath] - Is this on a critical user path (checkout, signup)?
   * @param {boolean} [context.hasWorkaround] - Does a workaround exist?
   * @returns {string} Severity: critical, serious, moderate, or minor
   */
  function getSeverity(issueType, context) {
    var base = SEVERITY_MATRIX[issueType] || 'moderate';

    if (context) {
      if (context.criticalPath && base === 'moderate') base = 'serious';
      if (context.criticalPath && base === 'minor') base = 'moderate';
      if (context.hasWorkaround && base === 'serious') base = 'moderate';
      if (context.hasWorkaround && base === 'critical') base = 'serious';
    }

    return base;
  }

  global.a11yAudit.SEVERITY_MATRIX = SEVERITY_MATRIX;
  global.a11yAudit.getSeverity = getSeverity;

})(typeof window !== 'undefined' ? window : global);
