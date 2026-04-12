/**
 * Accessibility Audit Initialization System
 *
 * SINGLE ENTRY POINT for accessibility audits.
 * This script handles all initialization automatically:
 *
 * 1. Loads learned exceptions (pass via initAudit({ exceptions }))
 * 2. Provides single initAudit() function that sets up everything
 * 3. Makes verification MANDATORY - results are pending until verified
 * 4. Integrates axe-core results for cross-validation
 * 5. Provides global deduplication across all phases/components
 *
 * Usage:
 *   // Load exceptions from file
 *   const exceptionsJSON = await (await fetch('learned-exceptions.json')).json();
 *
 *   // Initialize with exceptions
 *   const audit = await initAudit({ exceptions: exceptionsJSON });
 *
 *   // Run audits (auto-verifies results)
 *   const results = await audit.runFullAudit();
 *
 *   // L1: Get exceptions with updated counts for saving
 *   const updatedExceptions = audit.getExceptionsWithStats();
 *
 *   // L2: Get audit intelligence
 *   const intelligence = audit.getIntelligence();
 *
 * @requires shared-helpers.js
 * @requires issue-verifier.js
 * @requires audit-intelligence.js (optional, for L2)
 */

(function(global) {
  'use strict';

  const INIT_VERSION = (global.A11Y_VERSION) || 'unknown';
  const LOG_PREFIX = '[a11y-init]';

  // Size limit for global deduplication map to prevent memory leaks
  const GLOBAL_DEDUP_MAP_MAX_SIZE = 10000;

  // ============================================================================
  // EXCEPTIONS LOADING
  //
  // USAGE: Pass exceptions via initAudit({ exceptions: exceptionsJSON })
  //
  // The learned-exceptions.json file is the single source of truth.
  // Load it with: const exceptions = JSON.parse(await fetch('/path/to/learned-exceptions.json').then(r => r.text()));
  // Then pass to: await initAudit({ exceptions });
  // ============================================================================

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  let initState = {
    initialized: false,
    exceptionsLoaded: false,
    helpersLoaded: false,
    verifierLoaded: false,
    axeResultsIngested: false,
    auditInProgress: false,
    verificationInProgress: false,
    lastAuditResults: null,
    verificationRequired: true, // [CRITICAL FIX #3]
    globalDeduplicationMap: new Map(),
    exceptionsAppliedLog: []
  };

  // Pending results that haven't been verified yet
  let pendingResults = {
    issues: [],
    passed: [],
    manualChecks: [],
    axeIssues: [],
    verified: false
  };

  // ============================================================================
  // LOGGING
  // ============================================================================

  function log(message, type = 'info') {
    const levelMap = { info: 'INFO', success: 'INFO', warning: 'WARN', error: 'ERROR', critical: 'ERROR' };
    const helpers = global.a11yHelpers;
    if (helpers && helpers.log) {
      helpers.log(levelMap[type] || 'INFO', 'AuditInit', message);
    } else {
      const styles = {
        info: 'color: #2196F3',
        success: 'color: #4CAF50; font-weight: bold',
        warning: 'color: #FF9800',
        error: 'color: #f44336; font-weight: bold',
        critical: 'color: #fff; background: #f44336; padding: 2px 6px; border-radius: 3px'
      };
      console.log(`%c${LOG_PREFIX} ${message}`, styles[type] || styles.info);
    }
  }

  // ============================================================================
  // ERROR BOUNDARY WRAPPER
  // ============================================================================

  /**
   * Wrap a function with error boundary for consistent error handling
   */
  function withErrorBoundary(fn, context = 'unknown') {
    return async function(...args) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        log(`Error in ${context}: ${error.message}`, 'error');
        console.error(`[${context}] Stack trace:`, error);
        return {
          success: false,
          error: {
            message: error.message,
            context: context,
            timestamp: new Date().toISOString(),
            stack: error.stack
          },
          data: null
        };
      }
    };
  }

  // ============================================================================
  // INITIALIZATION
  // [CRITICAL FIX #2] - Single entry point
  // ============================================================================

  /**
   * Initialize the audit system. This is the ONLY function you need to call.
   * Everything else is automatic.
   *
   * @param {Object} options - Configuration options
   * @param {boolean} options.loadHelpers - Auto-load shared helpers (default: true)
   * @param {boolean} options.loadVerifier - Auto-load issue verifier (default: true)
   * @param {Object} options.exceptions - REQUIRED: Learned exceptions JSON object
   * @param {Object} options.customExceptions - Additional exceptions to merge (optional)
   * @returns {Object} - Audit API object with all methods
   * @throws {Error} If shared-helpers.js is not loaded
   * @throws {Error} If issue-verifier.js is not loaded
   * @throws {Error} If exceptions parameter is missing or invalid format
   */
  async function initAudit(options = {}) {
    const config = {
      loadHelpers: options.loadHelpers ?? true,
      loadVerifier: options.loadVerifier ?? true,
      exceptions: options.exceptions ?? null,
      customExceptions: options.customExceptions ?? null,
      verificationThreshold: options.verificationThreshold ?? 20,
      flagThreshold: options.flagThreshold ?? 50,
      mode: options.mode ?? 'adaptive', // 'adaptive' | 'full'
      sourceAvailable: options.sourceAvailable ?? false,
      ...options
    };

    // Backward compatibility: convert legacy modes
    if (config.mode === 'with-source') {
      config.mode = 'adaptive';
      config.sourceAvailable = true;
      log('Legacy "with-source" mode converted to adaptive + sourceAvailable=true', 'info');
    }
    if (config.mode === 'no-source') {
      config.mode = 'adaptive';
      config.sourceAvailable = false;
      log('Legacy "no-source" mode converted to adaptive', 'info');
    }

    // Store mode for use by orchestrator
    initState.mode = config.mode;
    initState.sourceAvailable = config.sourceAvailable;

    log('Initializing accessibility audit system...', 'info');

    // Step 1: Check for required dependencies
    if (config.loadHelpers && !global.a11yHelpers) {
      log('shared-helpers.js not loaded. Please inject it first.', 'error');
      throw new Error('shared-helpers.js must be loaded before audit-init.js');
    }
    initState.helpersLoaded = !!global.a11yHelpers;

    // Step 2: Check for verifier
    if (config.loadVerifier && !global.verifyAuditResults) {
      log('issue-verifier.js not loaded. Please inject it first.', 'error');
      throw new Error('issue-verifier.js must be loaded before audit-init.js');
    }
    initState.verifierLoaded = !!global.verifyAuditResults;

    // Step 3: LOAD LEARNED EXCEPTIONS (required via config.exceptions)
    log('Loading learned exceptions...', 'info');
    
    if (!config.exceptions) {
      log('ERROR: No exceptions provided.', 'error');
      log('Pass window.__A11Y_EXCEPTIONS via initAudit({ exceptions: window.__A11Y_EXCEPTIONS })', 'error');
      throw new Error(
        'Exceptions required. Pass window.__A11Y_EXCEPTIONS to initAudit({ exceptions: window.__A11Y_EXCEPTIONS }). ' +
        'Exceptions are embedded in the CDN bundle automatically.'
      );
    }
    
    // Validate exceptions structure
    if (!config.exceptions.global || !Array.isArray(config.exceptions.global)) {
      log('ERROR: Invalid exceptions format - missing global array', 'error');
      throw new Error('Invalid exceptions format: must have "global" array. Check learned-exceptions.json structure.');
    }
    
    // Build exceptions object from provided data
    let exceptionsToLoad = { ...config.exceptions };
    
    // Merge custom exceptions if provided
    if (config.customExceptions) {
      if (config.customExceptions.global) {
        exceptionsToLoad.global = [
          ...(exceptionsToLoad.global || []),
          ...config.customExceptions.global
        ];
      }
      if (config.customExceptions.siteSpecific) {
        exceptionsToLoad.siteSpecific = {
          ...(exceptionsToLoad.siteSpecific || {}),
          ...config.customExceptions.siteSpecific
        };
      }
    }

    // Load into verifier
    if (global.loadLearnedExceptions) {
      const loadResult = global.loadLearnedExceptions(exceptionsToLoad);
      if (loadResult && loadResult.success) {
        initState.exceptionsLoaded = true;
        log(`[OK] Loaded ${loadResult.loaded} global exceptions`, 'success');
        if (loadResult.siteSpecificDomains > 0) {
          log(`[OK] Loaded site-specific exceptions for ${loadResult.siteSpecificDomains} domain(s)`, 'success');
        }
      } else {
        const errorMsg = loadResult?.error || 'Unknown error loading exceptions';
        log(`CRITICAL: Failed to load exceptions - ${errorMsg}`, 'error');
        // Don't throw here, but mark state clearly
        initState.exceptionsLoadError = errorMsg;
      }
    } else {
      log('loadLearnedExceptions not available - verifier may not be loaded', 'warning');
    }

    // Step 4: Clear any stale caches
    if (global.a11yHelpers && global.a11yHelpers.clearCaches) {
      global.a11yHelpers.clearCaches();
      log('[OK] Caches cleared', 'success');
    }

    // Step 5: Reset state
    pendingResults = {
      issues: [],
      passed: [],
      manualChecks: [],
      axeIssues: [],
      verified: false
    };
    initState.globalDeduplicationMap.clear();
    initState.initialized = true;
    initState.auditInProgress = false;
    initState.verificationThreshold = config.verificationThreshold;

    // Step 6: Profile the site if profiler is available (for L2 Intelligence)
    initState.siteProfile = null;
    if (global.profileSite) {
      try {
        initState.siteProfile = await global.profileSite();
        log('[OK] Site profile generated', 'success');
      } catch (e) {
        log('Site profiling skipped: ' + e.message, 'warning');
        initState.siteProfile = null;
      }
    }

    log(`[OK] Audit system initialized v${INIT_VERSION}`, 'success');
    log(`  Exceptions: ${initState.exceptionsLoaded ? 'loaded' : 'NOT loaded'}`, 'info');
    log(`  Helpers: ${initState.helpersLoaded ? 'loaded' : 'NOT loaded'}`, 'info');
    log(`  Verifier: ${initState.verifierLoaded ? 'loaded' : 'NOT loaded'}`, 'info');
    log(`  Site Profile: ${initState.siteProfile ? 'generated' : 'not available'}`, 'info');

    // Return the audit API
    return createAuditAPI(config);
  }

  // ============================================================================
  // COMPONENT MAP & MODULE INTROSPECTION
  // ============================================================================

  // Map component names to their global function names
  // Used by both runComponentAudit() and getLoadedModules()
  const componentMap = {
    // Audit modules (moved from scripts/ to components/)
    'images': 'runImagesAudit',
    'images-audit': 'runImagesAudit',
    'links-buttons': 'runLinksButtonsAudit',
    'links-buttons-audit': 'runLinksButtonsAudit',
    'headings-landmarks': 'runHeadingsLandmarksAudit',
    'aria': 'runAriaAudit',
    'context-changes': 'runContextChangesAudit',
    'keyboard': 'runKeyboardAudit',
    'keyboard-audit': 'runKeyboardAudit',
    'wcag22': 'auditWCAG22',
    'focus-trap': 'auditFocusTraps',
    'hover-focus': 'auditHoverFocusContent',
    'zoom': 'auditZoomHeuristics',
    'dynamic': 'auditDynamicComponents',
    // Page components
    'forms': 'runFormsAudit',
    'page-structure': 'runPageStructureAudit',
    'motion-animation': 'runMotionAnimationAudit',
    'color-contrast': 'runColorContrastAudit',
    'carousels': 'runCarouselsAudit',
    'header': 'runHeaderAudit',
    'navigation': 'runNavigationAudit',
    'footer': 'runFooterAudit',
    'modals': 'runModalsAudit',
    'tabs': 'runTabsAudit',
    'accordions': 'runAccordionsAudit',
    'cart': 'runCartAudit',
    'search': 'runSearchAudit',
    'pdp': 'runPdpAudit',
    'product-grid': 'runProductGridAudit',
    'hero': 'runHeroAudit',
    'breadcrumbs': 'runBreadcrumbsAudit',
    'mega-menu': 'runMegaMenuAudit',
    'video-player': 'runVideoPlayerAudit',
    'data-tables': 'runDataTablesAudit',
    'tooltips': 'runTooltipsAudit',
    'buttons': 'runButtonsAudit',
    'iframes': 'runIframesAudit',
    'pagination': 'runPaginationAudit',
    'filters': 'runFiltersAudit',
    'reviews': 'runReviewsAudit',
    'quick-view': 'runQuickViewAudit'
  };

  /**
   * Returns which audit modules are currently loaded (have their global function available)
   * @returns {{ loaded: string[], notLoaded: string[] }}
   */
  function getLoadedModules() {
    const allModules = Object.entries(componentMap);
    const loaded = allModules.filter(([name, fnName]) => typeof global[fnName] === 'function');
    const notLoaded = allModules.filter(([name, fnName]) => typeof global[fnName] !== 'function');
    return { loaded: loaded.map(([n]) => n), notLoaded: notLoaded.map(([n]) => n) };
  }

  // ============================================================================
  // AUDIT API
  // ============================================================================

  function createAuditAPI(config) {
    return {
      // Metadata
      version: INIT_VERSION,
      initialized: true,
      config: config,

      // Core audit functions (with error boundaries)
      runFullAudit: withErrorBoundary(runFullAudit, 'runFullAudit'),
      runComponentAudit: withErrorBoundary(runComponentAudit, 'runComponentAudit'),
      runPhase: withErrorBoundary(runPhase, 'runPhase'),
      
      // Axe integration [SERIOUS FIX]
      ingestAxeResults: withErrorBoundary(ingestAxeResults, 'ingestAxeResults'),
      
      // Results access (REQUIRES verification)
      getResults: getVerifiedResults,
      getResultsSafe: getResultsSafe,
      // getPendingResults requires explicit DEBUG flag to prevent accidental use
      getPendingResults: (options = {}) => {
        if (!options.DEBUG_BYPASS_VERIFICATION) {
          log('CRITICAL: getPendingResults requires { DEBUG_BYPASS_VERIFICATION: true }', 'critical');
          log('Use getResults() for verified results, or verifyResults() first', 'warning');
          throw new Error(
            'getPendingResults blocked - pass { DEBUG_BYPASS_VERIFICATION: true } to acknowledge ' +
            'you are accessing UNVERIFIED results that may contain false positives'
          );
        }
        log('WARNING: Returning UNVERIFIED results - may contain false positives', 'warning');
        return {
          ...pendingResults,
          _unverified: true,
          _debugBypass: true,
          warning: 'UNVERIFIED RESULTS - May contain false positives. Do NOT use for reporting.'
        };
      },
      
      // Verification
      verifyResults: withErrorBoundary(verifyAllResults, 'verifyResults'),
      isVerified: () => pendingResults.verified,
      
      // Carousel verification
      verifyCarouselWithHTML: verifyCarouselWithHTML,

      // Exception management
      addException: global.addLearnedException,
      getExceptions: global.getLearnedExceptions,
      exportExceptions: global.exportExceptions,
      getExceptionLog: global.getExceptionLog,

      // L1: Exception usage tracking
      getExceptionsWithStats: global.getExceptionsWithStats || (() => {
        log('issue-verifier.js not loaded - getExceptionsWithStats unavailable', 'warning');
        return null;
      }),
      getExceptionUsageStats: global.getExceptionUsageStats || (() => {
        log('issue-verifier.js not loaded - getExceptionUsageStats unavailable', 'warning');
        return null;
      }),
      
      // L2: Audit intelligence
      getIntelligence: () => {
        if (global.generateAuditIntelligence) {
          return global.generateAuditIntelligence(
            { data: { issues: pendingResults.issues } },
            initState.siteProfile || null
          );
        }
        log('audit-intelligence.js not loaded', 'warning');
        return null;
      },
      generateIntelligence: global.generateAuditIntelligence || (() => {
        log('audit-intelligence.js not loaded - generateIntelligence unavailable', 'warning');
        return null;
      }),
      formatIntelligenceAsMarkdown: global.formatIntelligenceAsMarkdown || (() => {
        log('audit-intelligence.js not loaded - formatIntelligenceAsMarkdown unavailable', 'warning');
        return '';
      }),
      
      // State
      getState: () => ({ ...initState }),
      getMode: () => initState.mode || 'adaptive',
      isSourceAvailable: () => initState.sourceAvailable || false,
      reset: resetAuditState,

      // Snapshot ingestion (v11.0.0)
      ingestSnapshot: function(snapshotText) {
        if (!snapshotText) return { error: 'No snapshot text provided' };
        if (global.analyzeSnapshot) {
          const results = global.analyzeSnapshot(snapshotText);
          initState.snapshotResults = results;
          log(`Snapshot ingested: ${results.issues?.length || 0} issues found`, 'info');
          return results;
        }
        log('snapshot-analyzer.js not loaded', 'warning');
        return { error: 'snapshot-analyzer.js not loaded' };
      },

      // Global deduplication
      getDeduplicatedIssues: getGloballyDeduplicatedIssues,

      // Module introspection
      getLoadedModules: getLoadedModules,

      // Component detection convenience method
      detectComponents: function() {
        if (window.a11yAudit && window.a11yAudit.detectComponents) {
          const results = window.a11yAudit.detectComponents();
          initState._detectedComponents = results;
          return results;
        }
        return {};
      },

      // Return cached detection results, or run detection if not yet cached
      getDetectedComponents: function() {
        if (initState._detectedComponents) return initState._detectedComponents;
        return this.detectComponents();
      }
    };
  }

  // ============================================================================
  // CORE AUDIT FUNCTIONS
  // ============================================================================

  /**
   * Run full orchestrated accessibility audit
   *
   * Executes a comprehensive DOM-wide accessibility scan covering WCAG 2.2 Level AA.
   * Automatically verifies results if the issue-verifier module is loaded.
   *
   * @async
   * @param {Object} [options={}] - Audit configuration options
   * @param {boolean} [options.includeWarnings=true] - Include warning-level issues
   * @param {boolean} [options.skipHidden=true] - Skip hidden elements from audit
   * @param {string[]|null} [options.categories=null] - Specific categories to scan (null = all)
   * @returns {Promise<Object>} Verified audit results with issues, passed checks, and manual checks
   * @throws {Error} If audit not initialized (call initAudit() first)
   * @throws {Error} If no audit system is loaded (orchestrator or audit-bundle)
   * @example
   * await initAudit({ verifyResults: true });
   * const results = await runFullAudit();
   */
  async function runFullAudit(options = {}) {
    if (!initState.initialized) {
      throw new Error('Audit not initialized. Call initAudit() first.');
    }

    // Prevent concurrent audits that could corrupt shared state
    if (initState.auditInProgress) {
      log('Audit already in progress - skipping concurrent request', 'warning');
      return { success: false, error: 'Audit already in progress', concurrent: true };
    }
    initState.auditInProgress = true; // Set IMMEDIATELY after check, before any async work

    log('Starting full audit...', 'info');

    try {
      let results = null;

      // Prefer orchestrator (runs all phases including component-based audits)
      if (global.runOrchestratedAudit) {
        log(`Using orchestrated audit (mode: ${initState.mode || 'adaptive'})`, 'info');
        // Pass mode from initialization to orchestrator
        const orchestratorOptions = {
          ...options,
          mode: options.mode || initState.mode || 'adaptive',
          sourceAvailable: options.sourceAvailable ?? initState.sourceAvailable ?? false
        };
        results = await global.runOrchestratedAudit(orchestratorOptions);

        // Orchestrator returns status object; extract results from global
        if (results && results.status) {
          const fullResults = global.__a11yFullResults || global.getFullAuditResults?.();
          if (fullResults) {
            pendingResults.issues = fullResults.allIssues || [];
            pendingResults.passed = fullResults.allPassed || [];
            pendingResults.manualChecks = fullResults.allManualChecks || [];
          }
        }
      }
      // Fall back to component bundle (all components via includeAll)
      else if (global.a11yAudit && global.a11yAudit.runFullAudit) {
        log('Using component-based audit (audit-bundle)', 'info');
        results = global.a11yAudit.runFullAudit({ includeAll: true });

        if (results && results.error) {
          throw new Error('audit-bundle.runFullAudit failed: ' + (typeof results.error === 'string' ? results.error : JSON.stringify(results.error)));
        }

        if (results) {
          pendingResults.issues = results.issues || [];
          pendingResults.passed = results.passed || [];
          pendingResults.manualChecks = results.manualChecks || [];
        }
      }
      else {
        throw new Error(
          'No audit system loaded. Inject full-audit-orchestrator.js or audit-bundle.js.'
        );
      }

      // Detect if all components reported "not loaded" — indicates registration failure
      var mcChecks = pendingResults.manualChecks || [];
      if (mcChecks.length > 5) {
        var allNotLoaded = mcChecks.every(function(mc) {
          return mc.message && mc.message.indexOf('Component audit not loaded') !== -1;
        });
        if (allNotLoaded) {
          log('WARNING: All ' + mcChecks.length + ' components reported "not loaded" — component registration may have failed. Try calling window.a11yRefreshComponents() or re-injecting scripts.', 'warning');
          pendingResults.manualChecks.unshift({
            wcag: 'N/A',
            message: 'AUDIT WARNING: All ' + mcChecks.length + ' component modules reported "not loaded". This typically means component scripts were injected but never registered with the audit bundle. Call refreshComponentRegistry() or re-inject scripts.',
            component: '_system'
          });
        }
      }

      // Auto-verify if we have the verifier
      if (initState.verifierLoaded && global.verifyAuditResults) {
        try {
          await verifyAllResults();
        } catch (verifyError) {
          log('Auto-verification failed: ' + verifyError.message + '. Results available unverified.', 'error');
        }
      }

      return getVerifiedResults();
    } finally {
      initState.auditInProgress = false;
    }
  }

  /**
   * Run audit for a specific component type
   *
   * Executes targeted accessibility audit for a single component category.
   *
   * @async
   * @param {string} componentName - Component to audit: 'images', 'links-buttons', 'forms',
   *   'headings-landmarks', 'aria', 'structure', 'motion-timing', 'context-changes',
   *   'iframes-objects', 'status-messages', 'focus-management', 'modal', 'carousel', 'tabs'
   * @param {Object} [options={}] - Audit options passed to the component auditor
   * @returns {Promise<Object|null>} Component audit results or null if component not found
   * @throws {Error} If audit not initialized (call initAudit() first)
   * @throws {Error} If component audit function not found (ensure script is loaded)
   */
  async function runComponentAudit(componentName, options = {}) {
    if (!initState.initialized) {
      throw new Error('Audit not initialized. Call initAudit() first.');
    }

    if (initState.verificationInProgress) {
      return { success: false, error: 'Cannot run component audit during verification' };
    }

    log(`Running ${componentName} audit...`, 'info');

    const fnName = componentMap[componentName] || `run${capitalize(componentName)}Audit`;
    const fn = global[fnName];

    if (!fn) {
      throw new Error(`Component audit function '${fnName}' not found. Ensure the script is loaded.`);
    }

    const result = await fn(options);
    
    // Add to pending results — tag each issue with its source component
    if (result.issues) {
      result.issues.forEach(issue => {
        if (!issue.component) issue.component = componentName;
        if (!issue.source) issue.source = componentName;
      });
      pendingResults.issues.push(...result.issues);
    }
    if (result.passed) {
      pendingResults.passed.push(...result.passed);
    }
    if (result.manualChecks) {
      pendingResults.manualChecks.push(...result.manualChecks);
    }

    const MAX_PENDING_ISSUES = 1000;
    if (pendingResults.issues.length > MAX_PENDING_ISSUES) {
      log(`WARNING: ${pendingResults.issues.length} issues accumulated. Consider running verifyAllResults() to process.`, 'warning');
    }

    // Apply global deduplication
    pendingResults.issues = globalDeduplicate(pendingResults.issues);

    return {
      component: componentName,
      issueCount: result.issues?.length || 0,
      verified: false,
      message: 'Call verifyResults() before using these results'
    };
  }

  /**
   * Run specific phase of the audit
   *
   * @async
   * @param {number} phaseNumber - Phase to run (1-4)
   * @param {Object} [options={}] - Phase-specific options
   * @returns {Promise<Object>} Phase audit results
   * @throws {Error} If audit not initialized (call initAudit() first)
   * @throws {Error} If orchestrator not loaded
   * @deprecated Use runFullAudit() or runComponentAudit() instead. Phase-based auditing
   *   is being replaced by component-based auditing for better modularity.
   */
  async function runPhase(phaseNumber, options = {}) {
    if (!initState.initialized) {
      throw new Error('Audit not initialized. Call initAudit() first.');
    }

    if (global.runOrchestratedAudit) {
      return await global.runOrchestratedAudit({ phase: phaseNumber, ...options });
    }

    throw new Error('Orchestrator not loaded');
  }

  // ============================================================================
  // AXE-CORE INTEGRATION
  // [SERIOUS FIX] - Ingest axe results for cross-validation
  // ============================================================================

  /**
   * Ingest axe-core results and convert to our format
   * This allows cross-validation between axe and our custom scripts
   * 
   * @param {Object} axeResults - Results from axe.run()
   */
  function ingestAxeResults(axeResults) {
    if (!axeResults || !axeResults.violations) {
      log('Invalid axe results format', 'warning');
      return { success: false, error: 'Invalid format' };
    }

    log(`Ingesting ${axeResults.violations.length} axe violations...`, 'info');

    const convertedIssues = [];

    for (const violation of axeResults.violations) {
      for (const node of violation.nodes) {
        const issue = {
          source: 'axe-core',
          axeRuleId: violation.id,
          wcag: extractWCAGFromAxe(violation.tags || []),
          criterion: violation.help,
          message: violation.description,
          impact: mapAxeImpact(violation.impact),
          severity: mapAxeImpact(violation.impact),
          selector: node.target?.[0] || 'unknown',
          element: node.html,
          failureSummary: node.failureSummary,
          helpUrl: violation.helpUrl
        };

        convertedIssues.push(issue);
      }
    }

    // Store axe issues separately for deduplication
    pendingResults.axeIssues = convertedIssues;

    // Deduplicate against existing issues
    const deduplicatedAxe = deduplicateAgainstExisting(convertedIssues, pendingResults.issues);
    
    // Add unique axe issues to pending
    pendingResults.issues.push(...deduplicatedAxe.unique);

    initState.axeResultsIngested = true;
    
    log(`[OK] Added ${deduplicatedAxe.unique.length} unique axe issues (${deduplicatedAxe.duplicates.length} duplicates found)`, 'success');

    return {
      success: true,
      added: deduplicatedAxe.unique.length,
      duplicatesFound: deduplicatedAxe.duplicates.length,
      totalAxeViolations: axeResults.violations.length
    };
  }

  function extractWCAGFromAxe(tags) {
    const wcagTags = tags.filter(t => t.startsWith('wcag') && /\d/.test(t));
    if (wcagTags.length === 0) return 'unknown';
    
    // Convert wcag111 to 1.1.1
    const tag = wcagTags[0].replace('wcag', '');
    if (tag.length >= 3) {
      return `${tag[0]}.${tag[1]}.${tag.slice(2)}`;
    }
    return tag;
  }

  function mapAxeImpact(impact) {
    const mapping = {
      'critical': 'critical',
      'serious': 'serious',
      'moderate': 'moderate',
      'minor': 'minor'
    };
    return mapping[impact] || 'moderate';
  }

  function deduplicateAgainstExisting(newIssues, existingIssues) {
    const existingKeys = new Set();
    
    const createKey = (global.a11yHelpers && global.a11yHelpers.createDedupeKey)
      ? global.a11yHelpers.createDedupeKey 
      : (issue) => `${issue.selector}|${issue.wcag}|${(issue.message || '').substring(0, 50)}`;
    
    for (const issue of existingIssues) {
      const key = createKey(issue);
      existingKeys.add(key);
    }

    const unique = [];
    const duplicates = [];

    for (const issue of newIssues) {
      const key = createKey(issue);
      if (existingKeys.has(key)) {
        duplicates.push(issue);
      } else {
        unique.push(issue);
        existingKeys.add(key);
      }
    }

    return { unique, duplicates };
  }

  // ============================================================================
  // GLOBAL DEDUPLICATION
  // ============================================================================

  function enforceDeduplicationMapLimit() {
    if (initState.globalDeduplicationMap.size > GLOBAL_DEDUP_MAP_MAX_SIZE) {
      const evictCount = Math.floor(GLOBAL_DEDUP_MAP_MAX_SIZE * 0.2);
      const keysToDelete = Array.from(initState.globalDeduplicationMap.keys()).slice(0, evictCount);
      for (const key of keysToDelete) {
        initState.globalDeduplicationMap.delete(key);
      }
      log(`Evicted ${evictCount} entries from global dedup map (was ${initState.globalDeduplicationMap.size + evictCount})`, 'warning');
    }
  }

  function globalDeduplicate(issues) {
    // Pre-check: evict if already over limit
    enforceDeduplicationMapLimit();

    // Use the canonical implementation from shared-helpers
    if (global.a11yHelpers && global.a11yHelpers.deduplicateIssues) {
      const deduplicated = global.a11yHelpers.deduplicateIssues(issues);

      // Update global map for tracking
      for (const issue of deduplicated) {
        const key = global.a11yHelpers.createDedupeKey(issue);
        initState.globalDeduplicationMap.set(key, issue);
      }

      // Post-check: evict if batch pushed us over
      enforceDeduplicationMapLimit();

      return deduplicated;
    }

    // Fallback if helpers not loaded (shouldn't happen)
    log('Warning: shared-helpers not loaded, using fallback deduplication', 'warning');
    const seen = new Map();
    for (const issue of issues) {
      const key = `${issue.selector}|${issue.wcag}|${(issue.message || '').substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.set(key, issue);
        initState.globalDeduplicationMap.set(key, issue);
      }
    }

    // Post-check for fallback path too
    enforceDeduplicationMapLimit();

    return Array.from(seen.values());
  }

  function getGloballyDeduplicatedIssues() {
    return Array.from(initState.globalDeduplicationMap.values());
  }

  // ============================================================================
  // VERIFICATION (MANDATORY)
  // [CRITICAL FIX #3] - Results must be verified before use
  // ============================================================================

  /**
   * Verify all pending results
   * This MUST be called before accessing results
   */
  async function verifyAllResults(options = {}) {
    if (!initState.verifierLoaded) {
      log('Verifier not loaded - returning unverified results', 'warning');
      pendingResults.verified = false;
      return pendingResults;
    }

    if (pendingResults.issues.length === 0) {
      pendingResults.verified = true;
      return pendingResults;
    }

    if (initState.exceptionsLoadError) {
      log('WARNING: Exceptions failed to load — verification will not filter false positives', 'warning');
      pendingResults.exceptionsLoadWarning = initState.exceptionsLoadError;
    }

    log(`Verifying ${pendingResults.issues.length} issues...`, 'info');

    const config = {
      removeBelow: options.removeBelow ?? initState.verificationThreshold ?? 0,
      flagBelow: options.flagBelow ?? 50,
      includeFalsePositives: options.includeFalsePositives ?? false
    };

    initState.verificationInProgress = true;
    try {
      const verificationResult = await global.verifyAuditResults(
        { data: { issues: pendingResults.issues } },
        config
      );

      if (verificationResult.success && verificationResult.data) {
        const beforeCount = pendingResults.issues.length;
        pendingResults.issues = verificationResult.data.issues;
        pendingResults.verified = true;
        pendingResults.verificationStats = verificationResult.data.statistics;

        log(`[OK] Verification complete: ${beforeCount - pendingResults.issues.length} removed, ${pendingResults.issues.length} verified`, 'success');
      } else {
        log('Verification failed', 'error');
        pendingResults.verified = false;
      }
    } catch (verificationError) {
      log('Verification threw an error: ' + verificationError.message, 'error');
      log('Results will be returned unverified. Fix the verification error for production use.', 'warning');
      pendingResults.verified = false;
      pendingResults.verificationError = verificationError.message;
    } finally {
      initState.verificationInProgress = false;
    }

    return pendingResults;
  }

  /**
   * Get verified results — THROWS if results haven't been verified.
   * @throws {Error} If results haven't been verified
   */
  function getVerifiedResults() {
    // Guard: detect if injected scripts were wiped by a page refresh
    if (typeof global.a11yHelpers === 'undefined' || typeof global.A11Y_VERSION === 'undefined') {
      return {
        success: false,
        error: 'SCRIPTS_WIPED',
        message: 'Page context lost — injected scripts no longer present. Re-inject and re-run.',
        data: { issues: [], passed: [], manualChecks: [] }
      };
    }

    if (!pendingResults.verified && initState.verificationRequired) {
      // If verification was attempted but crashed, return results with warning
      if (pendingResults.verificationError) {
        log('WARNING: Returning unverified results due to verification error: ' + pendingResults.verificationError, 'warning');
        return {
          success: true,
          verified: false,
          verificationError: pendingResults.verificationError,
          data: {
            issues: pendingResults.issues,
            passed: pendingResults.passed,
            manualChecks: pendingResults.manualChecks,
            statistics: {
              total: pendingResults.issues.length,
              verified: 0,
              unverified: pendingResults.issues.length
            }
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: INIT_VERSION,
            exceptionsLoaded: initState.exceptionsLoaded,
            axeIngested: initState.axeResultsIngested,
            cacheStats: global.a11yHelpers ? global.a11yHelpers.getCacheStats() : null,
            exceptionsApplied: initState.exceptionsAppliedLog || []
          }
        };
      }
      // Otherwise verification was never called — throw as before
      const errorMessage = 'Results must be verified before use. Call audit.verifyResults() first. Verification is MANDATORY to prevent false positives from being reported.';
      log('CRITICAL: ' + errorMessage, 'critical');
      throw new Error(errorMessage);
    }

    return {
      success: true,
      verified: pendingResults.verified,
      data: {
        issues: pendingResults.issues,
        passed: pendingResults.passed,
        manualChecks: pendingResults.manualChecks,
        statistics: pendingResults.verificationStats || {
          total: pendingResults.issues.length,
          verified: pendingResults.issues.length
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: INIT_VERSION,
        exceptionsLoaded: initState.exceptionsLoaded,
        axeIngested: initState.axeResultsIngested,
        cacheStats: global.a11yHelpers ? global.a11yHelpers.getCacheStats() : null,
        exceptionsApplied: initState.exceptionsAppliedLog || []
      }
    };
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  /**
   * Safe serialization — strips DOM element references and truncates long strings
   * to prevent token overflow when returning results through page.evaluate().
   * Added for Issue #3 fix.
   */
  function safeSerialize(obj, maxStringLength = 500, maxArrayItems = 200, seen) {
    if (!seen) seen = new WeakSet();
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
    if (typeof obj === 'string') {
      return obj.length > maxStringLength ? obj.substring(0, maxStringLength) + '...[truncated]' : obj;
    }
    if (obj instanceof HTMLElement || obj instanceof Element || obj instanceof Node) {
      return '[Element: ' + (obj.tagName || 'unknown') + ']';
    }
    if (typeof obj === 'object') {
      if (seen.has(obj)) return '[Circular]';
      seen.add(obj);
    }
    if (Array.isArray(obj)) {
      const items = obj.slice(0, maxArrayItems);
      return items.map(item => safeSerialize(item, maxStringLength, maxArrayItems, seen));
    }
    if (typeof obj === 'object') {
      const safe = {};
      for (const key of Object.keys(obj)) {
        if (key === 'element' || key === 'node' || key === 'domElement' || key === 'parentElement') {
          const val = obj[key];
          if (val && typeof val === 'object') {
            safe[key] = '[Element]';
          } else {
            safe[key] = safeSerialize(val, maxStringLength, maxArrayItems, seen);
          }
          continue;
        }
        safe[key] = safeSerialize(obj[key], maxStringLength, maxArrayItems, seen);
      }
      return safe;
    }
    return String(obj);
  }

  /**
   * Get results with safe serialization — prevents token overflow.
   * Use this instead of getResults() when extracting via page.evaluate().
   * Added for Issue #3 fix.
   */
  function getResultsSafe(options = {}) {
    const results = getVerifiedResults();
    const maxStringLength = options.maxStringLength ?? 2000;
    const maxArrayItems = options.maxIssues ?? options.maxArrayItems ?? 500;
    return safeSerialize(results, maxStringLength, maxArrayItems);
  }

  function resetAuditState() {
    pendingResults = {
      issues: [],
      passed: [],
      manualChecks: [],
      axeIssues: [],
      verified: false
    };
    initState.globalDeduplicationMap.clear();
    initState.exceptionsAppliedLog = [];
    initState.auditInProgress = false;
    initState.axeResultsIngested = false;
    
    if (global.a11yHelpers && global.a11yHelpers.clearCaches) {
      global.a11yHelpers.clearCaches();
    }
    
    if (global.clearExceptionUsageStats) {
      global.clearExceptionUsageStats();
    }

    log('Audit state reset', 'info');
  }

  // ============================================================================
  // CAROUSEL HTML VERIFICATION ENFORCEMENT
  // [MODERATE FIX] - Enforce HTML verification for carousels
  // ============================================================================

  /**
   * Verify carousel issues with HTML check
   * MANDATORY before creating tasks about carousel live regions
   */
  async function verifyCarouselWithHTML(selector, options = {}) {
    log('Carousel verification requires HTML inspection', 'warning');
    log('Use getCleanHTML({ locator: page.locator("' + selector + '") }) to inspect HTML', 'info');

    return {
      verified: false,
      requiresHtmlCheck: true,
      selector: selector,
      instructions: [
        `1. Call getCleanHTML({ locator: page.locator('${selector}') })`,
        '2. Check WHERE aria-live is placed:',
        '   - If on wrapper (swiper-wrapper, slick-list): MISCONFIGURED',
        '   - If on separate element: LIKELY CORRECT',
        '3. Check if slides have aria-label="X of Y"',
        '4. Only create task after confirming with HTML'
      ]
    };
  }

  // ============================================================================
  // EXPOSE GLOBAL API
  // ============================================================================

  global.initAudit = initAudit;
  global.getResultsSafe = getResultsSafe;
  global.verifyCarouselWithHTML = verifyCarouselWithHTML;
  
  // Also expose state check
  global.isAuditInitialized = () => initState.initialized;
  global.getAuditState = () => ({ ...initState });

  // Namespace
  global.a11yInit = {
    version: INIT_VERSION,
    init: initAudit,
    isInitialized: () => initState.initialized,
    getState: () => ({ ...initState })
  };

  log(`Audit Init System v${INIT_VERSION} loaded`, 'success');
  log('Call: const audit = await initAudit({ exceptions: ... }) to start', 'info');
  log('Load exceptions from learned-exceptions.json before calling initAudit()', 'info');

})(typeof window !== 'undefined' ? window : global);
