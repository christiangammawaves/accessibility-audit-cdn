/**
 * @module full-audit-orchestrator
 * Orchestrates phased accessibility audits with checkpointing and resume capability.
 */

(function(global) {
  'use strict';

  const ORCHESTRATOR_VERSION = (global.A11Y_VERSION) || 'unknown';

  // ============================================================================
  // AUDIT MODES (v12.0.0)
  // ============================================================================
  // adaptive (default): detectComponents() at runtime → run only matched modules.
  //   When sourceAvailable=true, skips SOURCE_REPLACEABLE modules (code review covers them).
  // full: All phases, backwards compatible (debug/escape hatch)
  // ============================================================================

  // Module lists: use shared-helpers as single source of truth, with local fallback
  const ALWAYS_RUN_MODULES = (global.a11yHelpers && global.a11yHelpers.ALWAYS_RUN_MODULES)
    || ['page-structure', 'color-contrast', 'reflow-spacing', 'wcag22-mobile', 'images-of-text'];

  // v13.2.0: Removed 'forms' — forms.js (910+ lines, 20+ regex patterns) cannot be
  // replicated by human source review. Only 'modals' remains source-replaceable.
  const SOURCE_REPLACEABLE_MODULES = (global.a11yHelpers && global.a11yHelpers.SOURCE_REPLACEABLE_MODULES)
    || ['modals'];

  const PHASES = [
    {
      id: 1,
      name: 'Structure & Navigation',
      description: 'Page structure, header, navigation, breadcrumbs, footer, mega-menu, language-context',
      components: ['page-structure', 'header', 'navigation', 'breadcrumbs', 'footer', 'mega-menu', 'language-context'],
      scripts: [],
      estimatedTime: '10-15 seconds',
      parallel: true
    },
    {
      id: 2,
      name: 'Interactive Components',
      description: 'Forms, search, cart, modals, tabs, accordions, buttons, data-tables, date-picker, disclosure-widgets, cookie-consent',
      components: ['forms', 'search', 'cart', 'modals', 'tabs', 'accordions', 'buttons', 'data-tables', 'date-picker', 'disclosure-widgets', 'cookie-consent'],
      scripts: [],
      estimatedTime: '10-15 seconds',
      parallel: true
    },
    {
      id: 3,
      name: 'Content & Products',
      description: 'Hero, product grid, PDP, pagination, filters, collections-nav',
      components: ['hero', 'product-grid', 'pdp', 'pagination', 'filters', 'collections-nav'],
      scripts: [],
      estimatedTime: '10-15 seconds',
      parallel: true
    },
    {
      id: 4,
      name: 'E-commerce & Interactive',
      description: 'Carousels, quick-view, reviews, announcements, newsletter-popups, keyboard-focus, motion-animation, wishlist-favorites, sticky-add-to-cart, variant-selectors, product-recommendations, cart-drawer-upsells',
      components: ['carousels', 'quick-view', 'reviews', 'announcements', 'newsletter-popups', 'keyboard-focus', 'motion-animation', 'wishlist-favorites', 'sticky-add-to-cart', 'variant-selectors', 'product-recommendations', 'cart-drawer-upsells'],
      scripts: [],
      estimatedTime: '15-20 seconds',
      parallel: true
    },
    {
      id: 5,
      name: 'Media, Tooltips & Content Validation',
      description: 'Video player, tooltips, iframes, status messages, images of text, toast-notifications, progress-indicators, tree-view',
      components: ['video-player', 'tooltips', 'iframes', 'status-messages', 'images-of-text', 'toast-notifications', 'progress-indicators', 'tree-view'],
      scripts: [],
      estimatedTime: '10-15 seconds',
      parallel: true
    },
    {
      id: 6,
      name: 'Color, Contrast & Reflow',
      description: 'Color contrast, WCAG 2.2 mobile, reflow, spacing',
      components: ['color-contrast', 'wcag22-mobile', 'reflow-spacing'],
      scripts: [],
      estimatedTime: '15-20 seconds',
      parallel: true
    },
    {
      id: 7,
      name: 'WCAG 2.2 & Advanced',
      description: 'WCAG 2.2 new criteria, focus traps, keyboard, dynamic components',
      components: [],
      scripts: ['wcag22', 'focus-trap', 'keyboard', 'dynamic'],
      estimatedTime: '15-20 seconds'
    },
    {
      id: 8,
      name: 'Visual & Layout',
      description: 'Hover/focus content (WCAG 1.4.13)',
      components: [],
      scripts: ['hover-focus'],
      estimatedTime: '10-15 seconds'
    }
  ];

  let checkpoint = {
    version: ORCHESTRATOR_VERSION,
    url: null,
    startedAt: null,
    lastUpdated: null,
    currentPhase: 0,
    completedPhases: [],
    failedPhases: [],
    status: 'not_started', // not_started, in_progress, completed, completed_with_errors, failed, error
    error: null
  };

  let fullResults = {
    meta: {
      orchestratorVersion: ORCHESTRATOR_VERSION,
      url: null,
      title: null,
      startedAt: null,
      completedAt: null,
      totalExecutionTimeMs: 0,
      phasesCompleted: 0,
      totalPhases: PHASES.length
    },
    summary: {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      total: 0,
      passed: 0,
      manualChecks: 0
    },
    phaseResults: {},
    allIssues: [],
    allPassed: [],
    allManualChecks: [],
    errors: [],
    componentBreakdown: {},
    wcagBreakdown: {}
  };

  function log(message, type = 'info') {
    const levelMap = { info: 'INFO', success: 'INFO', warning: 'WARN', error: 'ERROR', phase: 'INFO' };
    if (global.a11yHelpers && global.a11yHelpers.log) {
      global.a11yHelpers.log(levelMap[type] || 'INFO', 'Orchestrator', message);
    } else {
      const prefix = '[A11y Orchestrator]';
      const styles = {
        info: 'color: #2196F3',
        success: 'color: #4CAF50; font-weight: bold',
        warning: 'color: #FF9800',
        error: 'color: #f44336; font-weight: bold',
        phase: 'color: #9C27B0; font-weight: bold'
      };
      console.log(`%c${prefix} ${message}`, styles[type] || styles.info);
    }
  }

  function updateCheckpoint(updates) {
    checkpoint = { ...checkpoint, ...updates, lastUpdated: new Date().toISOString() };
    global.__a11yCheckpoint = checkpoint;
  }

  function updateResults(phaseId, phaseResults) {
    fullResults.phaseResults[phaseId] = phaseResults;
    fullResults.meta.lastUpdated = new Date().toISOString();
    fullResults.meta.phasesCompleted = Object.keys(fullResults.phaseResults).length;
    
    global.__a11yFullResults = fullResults;
  }

  function deduplicateIssues(issues) {
    if (!global.a11yHelpers) throw new Error('[full-audit-orchestrator] shared-helpers.js must be loaded first — check injection order');
    return global.a11yHelpers.deduplicateIssues(issues, { checkRelatedCriteria: true });
  }

  function normalizeSelector(selector) {
    if (!global.a11yHelpers) throw new Error('[full-audit-orchestrator] shared-helpers.js must be loaded first — check injection order');
    return global.a11yHelpers.normalizeSelector(selector);
  }

  async function mergePhaseResults() {
    fullResults.allIssues = [];
    fullResults.allPassed = [];
    fullResults.allManualChecks = [];
    fullResults.errors = [];
    fullResults.summary = { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0, passed: 0, manualChecks: 0 };
    fullResults.componentBreakdown = {};
    fullResults.wcagBreakdown = {};
    fullResults.verification = { applied: false, removed: 0, flagged: 0 };

    for (const [phaseId, phaseData] of Object.entries(fullResults.phaseResults)) {
      if (phaseData.issues) {
        fullResults.allIssues.push(...phaseData.issues);
      }
      if (phaseData.passed) {
        fullResults.allPassed.push(...phaseData.passed);
      }
      if (phaseData.manualChecks) {
        fullResults.allManualChecks.push(...phaseData.manualChecks);
      }
      if (phaseData.errors && Array.isArray(phaseData.errors)) {
        fullResults.errors.push(...phaseData.errors);
      } else if (phaseData.error) {
        fullResults.errors.push({
          phase: phaseId,
          error: phaseData.error,
          timestamp: phaseData.errorTimestamp
        });
      }
    }

    fullResults.allIssues = deduplicateIssues(fullResults.allIssues);

    // Group identical issues (e.g., 8 images with same class missing alt → 1 finding with instanceCount)
    if (global.a11yHelpers && global.a11yHelpers.groupIdenticalIssues) {
      fullResults.allIssues = global.a11yHelpers.groupIdenticalIssues(fullResults.allIssues);
    }

    // Cross-reference: merge snapshot results with DOM findings
    if (fullResults.snapshotAnalysis && fullResults.snapshotAnalysis.issues &&
        global.mergeSnapshotResults) {
      try {
        const mergedResult = global.mergeSnapshotResults(fullResults.snapshotAnalysis, {
          issues: fullResults.allIssues,
          summary: fullResults.summary
        });
        fullResults.allIssues = mergedResult.issues || fullResults.allIssues;
        if (mergedResult.snapshotAnalysis) {
          fullResults.snapshotAnalysis.mergeStats = mergedResult.snapshotAnalysis;
        }
        log(`Snapshot cross-reference: ${mergedResult.snapshotAnalysis?.issuesAdded || 0} new issues from snapshot`, 'info');
      } catch (err) {
        log(`Snapshot cross-reference failed: ${err.message}`, 'warning');
      }
    }

    if (global.verifyAuditResults && typeof global.verifyAuditResults === 'function') {
      try {
        log('Applying verification and confidence scoring...', 'info');
        const verificationResult = await global.verifyAuditResults(
          { data: { issues: fullResults.allIssues } },
          { includeFalsePositives: false }  // Thresholds use CONFIDENCE_CONFIG defaults from issue-verifier.js
        );
        
        if (verificationResult.success && verificationResult.data) {
          const beforeCount = fullResults.allIssues.length;
          fullResults.allIssues = verificationResult.data.issues;
          fullResults.verification = {
            applied: true,
            removed: verificationResult.data.statistics?.removed || (beforeCount - fullResults.allIssues.length),
            flagged: verificationResult.data.statistics?.flaggedForReview || 0,
            averageConfidence: verificationResult.data.statistics?.averageConfidence || 0,
            exceptionsApplied: verificationResult.data.exceptionsApplied || [],
            exceptionsCount: verificationResult.data.statistics?.exceptionsApplied || 0,
            issuesFilteredByExceptions: verificationResult.data.statistics?.issuesFilteredByExceptions || 0
          };
          fullResults.flaggedForReview = verificationResult.data.flaggedForReview || [];
          
          if (fullResults.verification.exceptionsApplied.length > 0) {
            log(`Exceptions applied: ${fullResults.verification.exceptionsApplied.length} patterns filtered ${fullResults.verification.issuesFilteredByExceptions} issues`, 'info');
          }
          
          log(`Verification complete: ${fullResults.verification.removed} removed, ${fullResults.verification.flagged} flagged`, 'success');
        } else {
          const errorMsg = verificationResult.error || 'Verification returned unsuccessful result';
          log(`CRITICAL: Verification failed - ${errorMsg}`, 'error');
          fullResults.verification = {
            applied: false,
            error: errorMsg,
            requiresAttention: true
          };
          fullResults.unverified = true;
          fullResults.verificationFailed = true; // C2 fix: Explicit flag for Dashboard consumers
          fullResults.verificationWarning = 'CRITICAL: Verification failed. All findings are unverified and should not be included in client reports without manual re-verification.';
          fullResults.allIssues = fullResults.allIssues.map(issue => ({
            ...issue,
            unverified: true,
            confidence: Math.min(issue.confidence || 50, 50)
          }));
        }
      } catch (err) {
        log(`CRITICAL: Verification error - ${err.message}`, 'error');
        console.error('[orchestrator] Verification stack:', err.stack);
        fullResults.verification = {
          applied: false,
          error: err.message,
          stack: err.stack,
          requiresAttention: true
        };
        fullResults.unverified = true;
        fullResults.verificationFailed = true; // C2 fix: Explicit flag for Dashboard consumers
        fullResults.verificationWarning = 'CRITICAL: Verification threw an error (' + err.message + '). All findings are unverified.';
        fullResults.allIssues = fullResults.allIssues.map(issue => ({
          ...issue,
          unverified: true,
          confidence: Math.min(issue.confidence || 50, 50)
        }));
      }
    } else {
      log('Issue verifier not loaded - results are unverified. Load issue-verifier.js for confidence scoring.', 'warning');
      fullResults.verification = { applied: false, reason: 'verifier-not-loaded' };
      fullResults.unverified = true;
    }

    for (const issue of fullResults.allIssues) {
      const severity = issue.severity || 'moderate';
      fullResults.summary[severity] = (fullResults.summary[severity] || 0) + 1;
      
      const component = issue.component || issue.category || 'uncategorized';
      if (!fullResults.componentBreakdown[component]) {
        fullResults.componentBreakdown[component] = { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 };
      }
      fullResults.componentBreakdown[component][severity]++;
      fullResults.componentBreakdown[component].total++;

      const wcag = issue.wcag || 'unknown';
      if (!fullResults.wcagBreakdown[wcag]) {
        fullResults.wcagBreakdown[wcag] = { 
          criterion: issue.criterion || issue.wcagCriterion || wcag, 
          critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 
        };
      }
      fullResults.wcagBreakdown[wcag][severity]++;
      fullResults.wcagBreakdown[wcag].total++;
    }

    fullResults.summary.total = fullResults.allIssues.length;
    fullResults.summary.passed = fullResults.allPassed.length;
    fullResults.summary.manualChecks = fullResults.allManualChecks.length;

    const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    fullResults.allIssues.sort((a, b) => 
      (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
    );

    global.__a11yFullResults = fullResults;
  }

  /**
   * M9: Safe wrapper that handles both sync and async functions.
   * Duck-types the return value: if it has a .then(), attach a .catch().
   * This means callers can use await on the result regardless of whether fn() is sync or async.
   * @param {Function} fn - Function to execute (may return a value or a Promise)
   * @param {string} label - Phase/component label for error reporting
   * @returns {*|Promise} The function result or a standardized error object
   */
  function safeExecute(fn, label) {
    try {
      const result = fn();
      if (result && typeof result.then === 'function') {
        return result.catch(err => {
          const message = String(err?.message || err || 'Unknown error');
          return {
            __error: true,
            label,
            message,
            stack: err?.stack
          };
        });
      }
      return result;
    } catch (err) {
      const message = String(err?.message || err || 'Unknown error');
      return {
        __error: true,
        label,
        message,
        stack: err?.stack
      };
    }
  }

  function normalizeResult(raw) {
    if (raw === null || raw === undefined) {
      return { issues: [], passed: [], manualChecks: [], stats: null, __noReturn: true };
    }
    if (raw.__error) return { issues: [], passed: [], manualChecks: [], stats: null };
    if (Array.isArray(raw)) return { issues: raw, passed: [], manualChecks: [], stats: null };
    return {
      issues: Array.isArray(raw.issues) ? raw.issues : [],
      passed: Array.isArray(raw.passed) ? raw.passed : [],
      manualChecks: Array.isArray(raw.manualChecks) ? raw.manualChecks : [],
      stats: raw.stats || null
    };
  }

  async function executePhase(phase, config, options) {
    options = options || {};
    const phaseStartTime = performance.now();
    log(`Starting Phase ${phase.id}: ${phase.name}`, 'phase');

    // Skip cache clearing for parallel phases — shared caches remain valid since
    // the DOM doesn't change during an audit. Clearing mid-parallel would wipe
    // other phases' cached data.
    if (!options.skipCacheClear && global.a11yHelpers && global.a11yHelpers.clearCaches) {
      try {
        global.a11yHelpers.clearCaches();
        log(`  Cache cleared for phase ${phase.id}`);
      } catch (cacheErr) {
        log(`  Cache clear failed (non-fatal): ${cacheErr.message}`, 'warning');
      }
    }

    const phaseResults = {
      phaseId: phase.id,
      phaseName: phase.name,
      startedAt: new Date().toISOString(),
      completedAt: null,
      executionTimeMs: 0,
      issues: [],
      passed: [],
      manualChecks: [],
      componentsRun: [],
      scriptsRun: [],
      errors: []
    };

    if (phase.components.length > 0 && global.a11yAudit) {
      // Use cached detection results if available (populated by upfront call in runOrchestratedAudit)
      const detected = config.detectionCache || global.a11yAudit.detectComponents();
      for (const componentName of phase.components) {
        try {
          if (global.a11yAudit.components[componentName]) {

            if (detected[componentName] || ALWAYS_RUN_MODULES.includes(componentName)) {
              log(`  Running component: ${componentName}`);
              const rawResult = await safeExecute(
                () => global.a11yAudit.components[componentName](),
                `component:${componentName}`
              );

              if (rawResult && rawResult.__error) {
                phaseResults.errors.push({ component: componentName, error: rawResult.message, recoverable: true });
                log(`  Error in ${componentName}: ${rawResult.message}`, 'error');
                continue;
              }

              const result = normalizeResult(rawResult);
              if (result.__noReturn) {
                log(`  Warning: ${componentName} returned null/undefined`, 'warning');
              }
              phaseResults.componentsRun.push(componentName);

              if (result.issues.length > 0) {
                phaseResults.issues.push(...result.issues.map(issue => ({
                  ...issue,
                  component: componentName,
                  phase: phase.id
                })));
              }
              if (result.passed.length > 0) {
                phaseResults.passed.push(...result.passed.map(p => ({
                  ...p,
                  component: componentName
                })));
              }
              if (result.manualChecks.length > 0) {
                phaseResults.manualChecks.push(...result.manualChecks.map(m => ({
                  ...m,
                  component: componentName
                })));
              }
            } else {
              log(`  Skipping ${componentName} (not detected on page)`);
            }
          }
        } catch (err) {
          phaseResults.errors.push({ component: componentName, error: err.message, recoverable: true });
          log(`  Error in ${componentName}: ${err.message}`, 'error');
        }
      }
    }

    for (const scriptName of phase.scripts) {
      try {
        let result = null;
        let functionMissing = false;
        
        switch (scriptName) {
          case 'color-contrast':
            if (global.auditColorContrast) {
              log(`  Running color contrast analysis`);
              result = await global.auditColorContrast();
              phaseResults.scriptsRun.push('color-contrast.js');
            } else {
              functionMissing = true;
              log(`  [!] Missing: auditColorContrast - ensure color-contrast.js is loaded`, 'warning');
            }
            break;
            
          case 'wcag22':
            if (global.runWCAG22Audit) {
              log(`  Running WCAG 2.2 audit`);
              result = await global.runWCAG22Audit();
              phaseResults.scriptsRun.push('wcag22-audit.js');
            } else if (global.auditWCAG22) {
              log(`  Running WCAG 2.2 audit (via auditWCAG22)`);
              result = await global.auditWCAG22();
              phaseResults.scriptsRun.push('wcag22-audit.js');
            } else {
              functionMissing = true;
              log(`  [!] Missing: runWCAG22Audit/auditWCAG22 - ensure wcag22-audit.js is loaded`, 'warning');
            }
            break;
            
          case 'focus-trap':
            if (global.auditFocusTraps) {
              log(`  Running focus trap audit`);
              result = await global.auditFocusTraps();
              phaseResults.scriptsRun.push('focus-trap-audit.js');
            } else {
              functionMissing = true;
              log(`  [!] Missing: auditFocusTraps - ensure focus-trap-audit.js is loaded`, 'warning');
            }
            break;
            
          case 'keyboard':
            if (global.runKeyboardAudit) {
              log(`  Running keyboard audit`);
              result = await global.runKeyboardAudit();
              phaseResults.scriptsRun.push('keyboard-audit.js');
            } else if (global.auditKeyboardNavigation) {
              log(`  Running keyboard audit (via auditKeyboardNavigation)`);
              result = global.auditKeyboardNavigation();
              phaseResults.scriptsRun.push('keyboard-audit.js');
            } else {
              functionMissing = true;
              log(`  [!] Missing: runKeyboardAudit/auditKeyboardNavigation - ensure keyboard-audit.js is loaded`, 'warning');
            }
            break;
            
          case 'dynamic':
            if (global.auditDynamicComponents) {
              log(`  Running dynamic components audit`);
              result = await global.auditDynamicComponents();
              phaseResults.scriptsRun.push('dynamic-components.js');
            } else {
              functionMissing = true;
              log(`  [!] Missing: auditDynamicComponents - ensure dynamic-components.js is loaded`, 'warning');
            }
            break;
            
            
          case 'hover-focus':
            if (global.auditHoverFocusContent) {
              log(`  Running hover/focus content audit (WCAG 1.4.13)`);
              result = await global.auditHoverFocusContent();
              phaseResults.scriptsRun.push('hover-focus-audit.js');
            } else {
              functionMissing = true;
              log(`  [!] Missing: auditHoverFocusContent - ensure hover-focus-audit.js is loaded`, 'warning');
            }
            break;
            
          default:
            log(`  [!] Unknown script: ${scriptName}`, 'warning');
        }

        if (functionMissing) {
          phaseResults.errors.push({ 
            script: scriptName, 
            error: 'Function not found - script may not be loaded',
            type: 'missing_function'
          });
        }

        if (result) {
          const normalized = normalizeResult(result);
          if (normalized.issues.length > 0) {
            phaseResults.issues.push(...normalized.issues.map(issue => ({
              ...issue,
              script: scriptName,
              phase: phase.id
            })));
          }
          if (normalized.passed.length > 0) {
            phaseResults.passed.push(...normalized.passed);
          }
          if (normalized.manualChecks.length > 0) {
            phaseResults.manualChecks.push(...normalized.manualChecks);
          }
        }
      } catch (err) {
        phaseResults.errors.push({ script: scriptName, error: err.message, recoverable: true });
        log(`  Error in ${scriptName}: ${err.message}`, 'error');
      }
    }

    phaseResults.completedAt = new Date().toISOString();
    phaseResults.executionTimeMs = Math.round(performance.now() - phaseStartTime);
    
    log(`  Phase ${phase.id} complete: ${phaseResults.issues.length} issues found (${phaseResults.executionTimeMs}ms)`, 'success');
    
    return phaseResults;
  }

  async function runOrchestratedAudit(options = {}) {
    const config = {
      resume: options.resume ?? false,
      phase: options.phase ?? null,  // Run specific phase only
      startPhase: options.startPhase ?? 1,
      endPhase: options.endPhase ?? PHASES.length,
      skipInitCheck: options.skipInitCheck ?? false,
      mode: options.mode ?? 'adaptive',  // 'adaptive' | 'full'
      sourceAvailable: options.sourceAvailable ?? false,
      detectionCache: null,  // Populated by first detectComponents() call
      snapshotText: options.snapshotText ?? null,  // Raw snapshot text for analysis
      ...options
    };

    const auditStartTime = performance.now();

    if (!config.skipInitCheck && global.isAuditInitialized && !global.isAuditInitialized()) {
      log('audit-init.js detected but not initialized — call initAudit() first', 'warning');
      log('Hint: await initAudit({ exceptions: exceptionsJSON }) before runOrchestratedAudit()', 'info');
      return {
        status: 'error',
        error: 'Audit not initialized. Call initAudit({ exceptions: ... }) before running the orchestrator.',
        hint: 'Pass { skipInitCheck: true } to bypass this check (not recommended).',
        summary: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0, passed: 0, manualChecks: 0 }
      };
    }

    let shouldResume = false;

    if (config.resume && global.__a11yCheckpoint) {
      const savedCheckpoint = global.__a11yCheckpoint;

      if (savedCheckpoint.version !== ORCHESTRATOR_VERSION) {
        log(`Checkpoint version mismatch: saved=${savedCheckpoint.version}, current=${ORCHESTRATOR_VERSION}`, 'warning');
        log('Starting fresh audit due to version mismatch (audit logic may have changed)', 'info');
        // Fall through to fresh start
      } else if (savedCheckpoint.url !== window.location.href) {
        log(`Checkpoint URL mismatch: saved=${savedCheckpoint.url}, current=${window.location.href}`, 'warning');
        log('Starting fresh audit due to URL mismatch', 'info');
        // Fall through to fresh start
      } else {
        checkpoint = savedCheckpoint;
        fullResults = global.__a11yFullResults || fullResults;
        log(`Resuming from Phase ${checkpoint.currentPhase + 1} (v${savedCheckpoint.version})`, 'success');
        shouldResume = true;
      }
    }

    if (!shouldResume) {
      checkpoint = {
        version: ORCHESTRATOR_VERSION,
        url: window.location.href,
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        currentPhase: 0,
        completedPhases: [],
        failedPhases: [],
        status: 'in_progress',
        error: null,
        mode: config.mode
      };

      fullResults = {
        meta: {
          orchestratorVersion: ORCHESTRATOR_VERSION,
          url: window.location.href,
          title: document.title,
          startedAt: new Date().toISOString(),
          completedAt: null,
          totalExecutionTimeMs: 0,
          phasesCompleted: 0,
          totalPhases: PHASES.length,
          mode: config.mode
        },
        summary: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0, passed: 0, manualChecks: 0 },
        phaseResults: {},
        allIssues: [],
        allPassed: [],
        allManualChecks: [],
        errors: [],
        componentBreakdown: {},
        wcagBreakdown: {},
        snapshotAnalysis: null
      };

      // Phase 0: Snapshot Analysis (runs before DOM modules in all modes)
      if (config.snapshotText && global.analyzeSnapshot) {
        try {
          log('Phase 0: Running snapshot analysis...', 'phase');
          const snapshotResults = global.analyzeSnapshot(config.snapshotText);
          fullResults.snapshotAnalysis = snapshotResults;
          log(`Snapshot analysis: ${snapshotResults.issues?.length || 0} issues found`, 'success');
        } catch (err) {
          log(`Snapshot analysis failed: ${err.message}`, 'error');
          fullResults.errors.push({ phase: 0, error: err.message });
        }
      }
    }

    updateCheckpoint({ status: 'in_progress' });

    let phasesToRun = [];
    
    if (config.phase !== null) {
      const targetPhase = PHASES.find(p => p.id === config.phase);
      if (targetPhase) {
        phasesToRun = [targetPhase];
      }
    } else if (config.resume) {
      const completedIds = checkpoint.completedPhases || [];
      phasesToRun = PHASES.filter(p => 
        !completedIds.includes(p.id) && 
        p.id >= config.startPhase && 
        p.id <= config.endPhase
      );
    } else {
      phasesToRun = PHASES.filter(p => 
        p.id >= config.startPhase && 
        p.id <= config.endPhase
      );
    }

    // Mode-based filtering: adaptive resolves at runtime, full runs all phases
    let allowedModules = null;

    if (config.mode === 'adaptive') {
      // Adaptive mode: detect page components at runtime, run only matched modules.
      // Detection result is cached and reused by per-phase execution.
      const detectFn = (global.a11yAudit && global.a11yAudit.detectComponents)
        ? global.a11yAudit.detectComponents
        : (typeof global.detectComponents === 'function' ? global.detectComponents : null);
      if (detectFn) {
        try {
          const detected = config.detectionCache || detectFn();
          config.detectionCache = detected; // Cache for per-phase use
          const activeComponents = Object.keys(detected).filter(k => detected[k]);
          allowedModules = [...new Set([...activeComponents, ...ALWAYS_RUN_MODULES])];
          if (config.sourceAvailable) {
            allowedModules = allowedModules.filter(
              m => !SOURCE_REPLACEABLE_MODULES.includes(m)
            );
            // Guard: ensure ALWAYS_RUN modules survive filtering
            if (allowedModules.length === 0) {
              allowedModules = [...ALWAYS_RUN_MODULES];
            }
            log('Source available: skipping source-replaceable modules', 'info');
          }
          log(`Adaptive mode: ${allowedModules.length}/${Object.keys(detected).length} modules allowed: ${allowedModules.join(', ')}`, 'info');
        } catch (e) {
          log(`detectComponents() failed: ${e.message}, falling back to full mode`, 'warning');
        }
      } else {
        log('Adaptive mode: detectComponents() not available, falling back to full mode', 'warning');
      }
    }

    if (allowedModules) {
      phasesToRun = phasesToRun.map(phase => {
        const filteredComponents = phase.components.filter(c => allowedModules.includes(c));
        if (filteredComponents.length === 0 && phase.components.length > 0) {
          return null; // Skip entire phase if no components match
        }
        return { ...phase, components: filteredComponents };
      }).filter(Boolean);
      log(`Mode "${config.mode}": ${allowedModules.length} modules allowed`, 'info');
    }

    log(`Running ${phasesToRun.length} phase(s): ${phasesToRun.map(p => p.id).join(', ')}`);

    const failedPhases = [];

    function recordPhaseFailure(phase, err) {
      log(`Phase ${phase.id} failed: ${err.message}`, 'error');
      failedPhases.push({ phase: phase.id, name: phase.name, error: err.message });
      checkpoint.failedPhases.push(phase.id);
      updateCheckpoint({ failedPhases: checkpoint.failedPhases, status: 'failed' });
      updateResults(phase.id, {
        phaseId: phase.id,
        phaseName: phase.name,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        executionTimeMs: 0,
        issues: [],
        passed: [],
        manualChecks: [],
        componentsRun: [],
        scriptsRun: [],
        errors: [{ phase: phase.id, error: err.message, fatal: true }]
      });
    }

    // Capture pre-interaction contrast snapshot before any phases modify the DOM.
    // Uses cached getComputedStyle via shared-helpers to avoid layout thrashing.
    try {
      const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, button, label, span, li, td, th');
      const sampleSize = Math.min(textElements.length, 500);
      const contrastSnapshot = {};
      const getCachedStyle = (global.a11yHelpers && global.a11yHelpers.getStyle)
        ? global.a11yHelpers.getStyle
        : function(el) { return window.getComputedStyle(el); };
      const getSelector = (global.a11yHelpers && global.a11yHelpers.getSelector)
        ? global.a11yHelpers.getSelector
        : function() { return ''; };

      // Batch all style reads in a single pass to avoid forced reflows
      for (let i = 0; i < sampleSize; i++) {
        const el = textElements[i];
        const style = getCachedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          const selector = getSelector(el);
          contrastSnapshot[selector] = {
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight
          };
        }
      }
      config.contrastSnapshot = contrastSnapshot;
      log(`Captured pre-interaction contrast data for ${Object.keys(contrastSnapshot).length} elements`, 'success');
    } catch (err) {
      log(`Contrast snapshot failed (non-critical): ${err.message}`, 'warning');
    }

    // H5: Phase parallelism is disabled. Enabling would save ~50-65 seconds per audit.
    // To enable:
    // Parallel execution for Phases 1-6 (marked parallel: true).
    // Cache safety: clearCaches() is called once before parallel phases start, not per-phase.
    // Since the DOM doesn't change during an audit run, shared caches remain valid across phases.
    // Per-phase cache scopes available via a11yHelpers.createCacheScope() for future isolation.
    const FORCE_SEQUENTIAL = false;

    const parallelPhases = FORCE_SEQUENTIAL ? [] : phasesToRun.filter(p => p.parallel);
    const sequentialPhases = FORCE_SEQUENTIAL ? phasesToRun : phasesToRun.filter(p => !p.parallel);

    if (parallelPhases.length > 0) {
      log(`Running ${parallelPhases.length} parallel phase(s): ${parallelPhases.map(p => p.id).join(', ')}`, 'phase');

      // Clear caches once before parallel execution starts (not per-phase)
      if (global.a11yHelpers && global.a11yHelpers.clearCaches) {
        try {
          global.a11yHelpers.clearCaches();
          log('  Caches cleared before parallel phase execution');
        } catch (cacheErr) {
          log(`  Cache clear failed (non-fatal): ${cacheErr.message}`, 'warning');
        }
      }

      const settled = await Promise.allSettled(
        parallelPhases.map(async (phase) => {
          updateCheckpoint({ currentPhase: phase.id });
          const phaseResults = await executePhase(phase, config, { skipCacheClear: true });
          updateResults(phase.id, phaseResults);
          checkpoint.completedPhases.push(phase.id);
          updateCheckpoint({ completedPhases: checkpoint.completedPhases });
        })
      );
      settled.forEach((result, i) => {
        if (result.status === 'rejected') {
          recordPhaseFailure(parallelPhases[i], result.reason);
        }
      });
    }

    for (const phase of sequentialPhases) {
      try {
        updateCheckpoint({ currentPhase: phase.id });

        const phaseResults = await executePhase(phase, config);
        updateResults(phase.id, phaseResults);

        checkpoint.completedPhases.push(phase.id);
        updateCheckpoint({ completedPhases: checkpoint.completedPhases });

      } catch (err) {
        recordPhaseFailure(phase, err);
      }
    }

    if (failedPhases.length > 0) {
      fullResults.failedPhases = failedPhases;
    }

    await mergePhaseResults();
    
    const totalTime = Math.round(performance.now() - auditStartTime);
    fullResults.meta.totalExecutionTimeMs = totalTime;
    fullResults.meta.completedAt = new Date().toISOString();
    
    const allComplete = PHASES.every(p => checkpoint.completedPhases.includes(p.id));
    const hasFailures = failedPhases.length > 0;
    updateCheckpoint({
      status: allComplete ? (hasFailures ? 'completed_with_errors' : 'completed') : checkpoint.status,
      totalExecutionTimeMs: totalTime,
      failedPhases: hasFailures ? failedPhases : undefined
    });

    // Include mode and detection metadata in results for debugging
    Object.assign(fullResults.meta, {
      mode: config.mode,
      sourceAvailable: config.sourceAvailable,
      detectedComponents: config.detectionCache
        ? Object.keys(config.detectionCache).filter(k => config.detectionCache[k])
        : null
    });

    global.__a11yFullResults = fullResults;
    global.__a11yCheckpoint = checkpoint;

    log(`Audit ${allComplete ? 'completed' : 'paused'}: ${fullResults.summary.total} issues (${totalTime}ms)`, 'success');

    return getAuditStatus();
  }

  function getAuditStatus() {
    return {
      status: checkpoint.status,
      url: checkpoint.url,
      progress: {
        completedPhases: checkpoint.completedPhases?.length || 0,
        totalPhases: PHASES.length,
        currentPhase: checkpoint.currentPhase,
        nextPhase: getNextPhase()
      },
      summary: fullResults.summary,
      topIssues: {
        critical: fullResults.allIssues.filter(i => i.severity === 'critical').length,
        serious: fullResults.allIssues.filter(i => i.severity === 'serious').length
      },
      componentsAudited: Object.keys(fullResults.componentBreakdown),
      canResume: ['in_progress', 'error', 'failed'].includes(checkpoint.status),
      resultsAvailable: fullResults.allIssues.length > 0,
      failedPhases: fullResults.failedPhases || [],
      hasPartialResults: !!(fullResults.failedPhases && fullResults.failedPhases.length > 0 && fullResults.allIssues.length > 0)
    };
  }

  function getNextPhase() {
    const completed = checkpoint.completedPhases || [];
    const next = PHASES.find(p => !completed.includes(p.id));
    return next ? { id: next.id, name: next.name } : null;
  }

  function getFullAuditResults() {
    return global.__a11yFullResults || fullResults;
  }

  function getAuditCheckpoint() {
    return global.__a11yCheckpoint || checkpoint;
  }

  function getIssuesBySeverity(severity) {
    const results = getFullAuditResults();
    return results.allIssues.filter(i => i.severity === severity);
  }

  function getIssuesByComponent(component) {
    const results = getFullAuditResults();
    return results.allIssues.filter(i => 
      i.component === component || i.category === component
    );
  }

  function getIssuesByWCAG(wcag) {
    const results = getFullAuditResults();
    return results.allIssues.filter(i => i.wcag === wcag);
  }

  function generateMarkdownReport() {
    const results = getFullAuditResults();
    const { summary, allIssues, allManualChecks, componentBreakdown, wcagBreakdown } = results;
    
    let md = `# Accessibility Audit Report\n\n`;
    md += `**URL:** ${results.meta.url}\n`;
    md += `**Date:** ${new Date(results.meta.completedAt || results.meta.startedAt).toLocaleDateString()}\n`;
    md += `**Standard:** WCAG 2.2 Level AA\n\n`;
    
    md += `## Summary\n\n`;
    md += `| Severity | Count |\n|----------|-------|\n`;
    md += `| Critical | ${summary.critical} |\n`;
    md += `| Serious | ${summary.serious} |\n`;
    md += `| Moderate | ${summary.moderate} |\n`;
    md += `| Minor | ${summary.minor} |\n`;
    md += `| **Total** | **${summary.total}** |\n\n`;
    
    if (summary.critical > 0) {
      md += `## Critical Issues\n\n`;
      for (const issue of allIssues.filter(i => i.severity === 'critical')) {
        md += `### ${issue.message || issue.issue}\n`;
        md += `- **WCAG:** ${issue.wcag} - ${issue.criterion || ''}\n`;
        md += `- **Element:** \`${issue.selector}\`\n`;
        md += `- **Impact:** ${issue.impact || 'Users cannot complete essential tasks'}\n`;
        md += `- **Fix:** ${issue.fix || issue.recommendation || 'Review and remediate this issue'}\n`;
        if (issue.element) md += `- **HTML:** \`${issue.element}\`\n`;
        md += `\n`;
      }
    }
    
    if (summary.serious > 0) {
      md += `## Serious Issues\n\n`;
      for (const issue of allIssues.filter(i => i.severity === 'serious')) {
        md += `### ${issue.message || issue.issue}\n`;
        md += `- **WCAG:** ${issue.wcag} - ${issue.criterion || ''}\n`;
        md += `- **Element:** \`${issue.selector}\`\n`;
        md += `- **Impact:** ${issue.impact || 'Users face significant barriers'}\n`;
        md += `- **Fix:** ${issue.fix || issue.recommendation || 'Review and remediate this issue'}\n`;
        if (issue.element) md += `- **HTML:** \`${issue.element}\`\n`;
        md += `\n`;
      }
    }
    
    if (summary.moderate > 0) {
      md += `## Moderate Issues\n\n`;
      for (const issue of allIssues.filter(i => i.severity === 'moderate')) {
        md += `### ${issue.message || issue.issue}\n`;
        md += `- **WCAG:** ${issue.wcag} - ${issue.criterion || ''}\n`;
        md += `- **Element:** \`${issue.selector}\`\n`;
        md += `- **Fix:** ${issue.fix || issue.recommendation || 'Review and remediate this issue'}\n`;
        md += `\n`;
      }
    }
    
    if (summary.minor > 0) {
      md += `## Minor Issues\n\n`;
      for (const issue of allIssues.filter(i => i.severity === 'minor')) {
        md += `- **${issue.message || issue.issue}** (${issue.wcag}) - \`${issue.selector}\`\n`;
      }
      md += `\n`;
    }
    
    if (allManualChecks.length > 0) {
      md += `## Manual Checks Required\n\n`;
      for (const check of allManualChecks) {
        md += `- **${check.wcag || 'N/A'}:** ${check.message || check.description}\n`;
        if (check.howToTest) md += `  - Test: ${check.howToTest}\n`;
      }
    }
    
    return md;
  }

  function clearAuditData() {
    checkpoint = {
      version: ORCHESTRATOR_VERSION,
      url: null,
      startedAt: null,
      lastUpdated: null,
      currentPhase: 0,
      completedPhases: [],
      status: 'not_started',
      error: null
    };
    
    fullResults = {
      meta: {},
      summary: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0, passed: 0, manualChecks: 0 },
      phaseResults: {},
      allIssues: [],
      allPassed: [],
      allManualChecks: [],
      errors: [],
      componentBreakdown: {},
      wcagBreakdown: {}
    };

    delete global.__a11yCheckpoint;
    delete global.__a11yFullResults;
    
    log('Audit data cleared', 'warning');
  }

  global.a11yOrchestrator = {
    runOrchestratedAudit,
    getAuditStatus,
    getFullAuditResults,
    getAuditCheckpoint,
    clearAuditData,
    getIssuesBySeverity,
    getIssuesByComponent,
    getIssuesByWCAG,
    generateMarkdownReport,
    version: ORCHESTRATOR_VERSION,
    phases: PHASES
  };

  global.runOrchestratedAudit = runOrchestratedAudit;
  global.getAuditStatus = getAuditStatus;
  global.getFullAuditResults = getFullAuditResults;
  global.getAuditCheckpoint = getAuditCheckpoint;
  global.generateMarkdownReport = generateMarkdownReport;

  if (!global.runAudit) {
    global.runAudit = runOrchestratedAudit;
  }
  if (!global.runComponentAudit) {
    global.runComponentAudit = async function(components) {
      if (!global.a11yAudit) {
        console.error('[runComponentAudit] a11yAudit not loaded');
        return { error: 'a11yAudit not loaded' };
      }
      if (components === 'all') {
        const detected = global.a11yAudit.detectComponents();
        components = Object.keys(detected).filter(k => detected[k]);
      }
      if (typeof components === 'string') components = [components];
      const results = {
        meta: { url: window.location.href, timestamp: new Date().toISOString(), auditType: 'component-targeted', components },
        summary: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 },
        issues: [], passed: [], manualChecks: []
      };
      for (const name of components) {
        if (global.a11yAudit.components[name]) {
          try {
            const r = global.a11yAudit.components[name]();
            if (r.issues) results.issues.push(...r.issues.map(i => ({ ...i, component: name })));
            if (r.passed) results.passed.push(...r.passed);
            if (r.manualChecks) results.manualChecks.push(...r.manualChecks);
          } catch (err) { console.error(`[runComponentAudit] ${name}:`, err); }
        }
      }
      for (const issue of results.issues) {
        results.summary[issue.severity] = (results.summary[issue.severity] || 0) + 1;
        results.summary.total++;
      }
      return results;
    };
  }
  if (!global.detectComponents) {
    global.detectComponents = function() {
      if (global.a11yAudit && global.a11yAudit.detectComponents) return global.a11yAudit.detectComponents();
      console.warn('[detectComponents] a11yAudit not loaded');
      return {};
    };
  }

  log(`Orchestrator loaded - ${PHASES.length} phases defined`, 'success');

})(typeof window !== 'undefined' ? window : global);
