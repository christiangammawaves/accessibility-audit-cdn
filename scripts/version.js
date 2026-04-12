/**
 * Accessibility Audit Unified - Version Information
 * 
 * SINGLE SOURCE OF TRUTH for version number.
 * All other scripts should reference this version.
 * Inject this FIRST before any other audit scripts.
 * 
 * @module version
 * @version 13.2.0
 */

(function(global) {
  'use strict';

  const VERSION_INFO = {
    version: '13.2.0',
    releaseDate: '2026-04-12',

    // Changelog for current version
    changes: [
      'DOC: Remove Quick audit tier — Standard is now the minimum for all audits',
      'DOC: Add Phase 2 completion gate — all layers (A-D) must produce results before proceeding',
      'DOC: Strengthen Phase 3 — mandatory remediation rewrite with file:line specifics for all findings',
      'DOC: Add Phase 3 Part B — source-unavailable fallback path moved into Phase 3',
      'DOC: Phase 4 (Interaction Testing) and Phase 5 (Visual Verification) now required for all audits',
      'DOC: Add Phase 5.75 Step e — remediation quality validation gate',
      'DOC: Add Common Failure Modes section to prevent anti-patterns',
      'DOC: Remove redundant Verified Working Approach section (covered by enforced Phase 2)',
      'FIX: Remove forms from SOURCE_REPLACEABLE_MODULES — too complex for source-only review',
      'FIX: Scope ge-005 exception to specific WCAG criteria instead of wildcard',
    ],

    // Previous version changes (13.1.0)
    previousChanges: [
      'DOC: Add Phase 2.5 — Independent Code Review for source-available audits',
      'DOC: Add Phase 5.75 — Post-Audit Enrichment (mandatory) for element_html, layer, confidence, component_type',
      'DOC: Define Audit Depth Tiers (Quick/Standard/Full) with mandatory minimums',
      'DOC: Update Dashboard Integration with real Edge Function endpoint and enriched payload mapping',
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
