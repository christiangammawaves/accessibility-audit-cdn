/**
 * Accessibility Audit Unified - Version Information
 * 
 * SINGLE SOURCE OF TRUTH for version number.
 * All other scripts should reference this version.
 * Inject this FIRST before any other audit scripts.
 * 
 * @module version
 * @version 13.3.1
 */

(function(global) {
  'use strict';

  const VERSION_INFO = {
    version: '13.3.1',
    releaseDate: '2026-04-12',

    // Changelog for current version
    changes: [
      'FIX: Escape numeric/special-char IDs with CSS.escape() in getSelector — fixes querySelector crash on Shopify-generated IDs',
    ],

    // Previous version changes (13.3.0)
    previousChanges: [
      'FIX: Resolve ReferenceError in keyboard-audit.js — undefined variable `h` replaced with window.a11yHelpers',
      'FIX: Normalize focus-trap-audit.js output fields to standard schema (message/fix/selector/criterion)',
      'FIX: Add missing selector field to all 8 color-contrast.js finding types',
      'FIX: safeSerialize now preserves string values in element-reference keys (only strips DOM objects)',
      'FIX: Increase getResultsSafe maxStringLength 500→2000 and maxArrayItems 200→500',
    ],

    // Core script versions (all synced to main version via A11Y_VERSION)
    // Note: All 63 component/audit scripts in /components/ also use A11Y_VERSION
    coreScripts: [
      'version.js',
      'shared-helpers.js',
      'issue-verifier.js',
      'audit-init.js',
      'snapshot-analyzer.js'
    ],
    
    // Compatibility info
    compatibility: {
      wcagVersion: '2.2',
      wcagLevel: 'AA',
      browserSupport: ['Chrome 90+', 'Firefox 88+', 'Safari 14+', 'Edge 90+'],
      nodeVersion: '16+',
      playwriterExtension: 'latest'
    }
  };

  // Export global version for other scripts to use
  global.A11Y_VERSION = VERSION_INFO.version;
  global.A11Y_VERSION_INFO = VERSION_INFO;

  // v8.6.4: Export WCAG constants for centralized management
  global.A11Y_WCAG_VERSION = VERSION_INFO.compatibility.wcagVersion;
  global.A11Y_WCAG_LEVEL = VERSION_INFO.compatibility.wcagLevel;

  // Also available via namespace
  if (!global.a11yAudit) global.a11yAudit = {};
  global.a11yAudit.VERSION = VERSION_INFO.version;
  global.a11yAudit.VERSION_INFO = VERSION_INFO;
  global.a11yAudit.WCAG_VERSION = VERSION_INFO.compatibility.wcagVersion;
  global.a11yAudit.WCAG_LEVEL = VERSION_INFO.compatibility.wcagLevel;

  // Log version on load
  console.log(`%c[a11y] Accessibility Audit Suite v${VERSION_INFO.version} (${VERSION_INFO.releaseDate})`, 
    'color: #4CAF50; font-weight: bold');

})(typeof window !== 'undefined' ? window : global);
