/**
 * Issue Verification & Confidence Scoring System
 * 
 * Provides:
 * 1. Secondary verification pass before reporting issues
 * 2. Confidence scoring (0-100%) for each issue
 * 3. Learned exceptions checking
 * 4. Site-specific exception management
 * 5. L1: Exception usage tracking with verifiedCount increments
 *
 * Inject after audit scripts but before generating reports.
 * 
 * Usage:
 *   // Load exceptions (REQUIRED - do this first!)
 *   loadLearnedExceptions(exceptionsJsonContent);
 *   
 *   // Verify all issues from an audit
 *   const verified = await verifyAuditResults(auditResults);
 *   
 *   // Check which exceptions were applied
 *   const log = getExceptionLog();
 *   
 *   // L1: Get exceptions with updated counts for saving
 *   const updatedExceptions = getExceptionsWithStats();
 *   // Save to file: JSON.stringify(updatedExceptions, null, 2)
 *   
 *   // Add a new learned exception
 *   addLearnedException({ ... });
 * 
 */

(function(global) {
  'use strict';

  // Use centralized version if available, otherwise define locally
  const VERIFIER_VERSION = (global.A11Y_VERSION) || 'unknown';
  const LOG_PREFIX = '[a11y-verifier]';
  
  // Schema version for learned-exceptions.json
  const SCHEMA_VERSION = '1.1.0';

  // ============================================================================
  // LEARNED EXCEPTIONS STORAGE
  // ============================================================================

  // In-memory exceptions (loaded from JSON or added during session)
  let learnedExceptions = {
    global: [],
    siteSpecific: {},
    sessionAdded: [] // Exceptions added during this session (not yet persisted)
  };

  // Build WCAG-criterion index for faster lookup
  let exceptionIndex = null;
  function buildExceptionIndex() {
    exceptionIndex = {};
    for (const exc of learnedExceptions.global) {
      for (const criterion of (exc.wcag || ['*'])) {
        (exceptionIndex[criterion] ||= []).push(exc);
      }
    }
  }

  // ============================================================================
  // CONFIDENCE SCORING RULES
  // ============================================================================

  /**
   * Base confidence scores by issue type and detection method.
   * These are starting points, adjusted by verification checks.
   */
  const BASE_CONFIDENCE = {
    // High confidence (80-100%) - Clear-cut violations
    'missing-alt-no-role': 95,
    'empty-button-no-label': 95,
    'empty-link-no-label': 95,
    'missing-form-label': 90,
    'missing-lang-attribute': 100,
    'duplicate-id': 100,
    'color-contrast-fail': 85,
    'missing-skip-link': 90,
    
    // Medium confidence (50-79%) - Context-dependent
    'button-with-icon-only': 65,
    'link-with-icon-only': 65,
    'image-alt-suspicious': 60,
    'heading-order-skip': 70,
    'landmark-missing': 65,
    'focus-not-visible': 65,
    'aria-invalid-value': 75,
    
    // Lower confidence (30-49%) - Needs manual verification
    'touch-target-size': 55,
    'timing-adjustable': 40,
    'motion-animation': 55,
    'cognitive-load': 35,
    'reading-level': 30,
    
    // Default for unknown types
    'default': 70
  };

  /**
   * Confidence adjustments based on verification results.
   */
  const CONFIDENCE_ADJUSTMENTS = {
    // Positive adjustments (increase confidence)
    'verified-in-dom': +10,
    'computed-styles-confirm': +10,
    'no-aria-override': +5,
    'not-in-exception-list': +5,
    'multiple-detection-methods': +10,
    'parent-context-confirms': +5,
    'confirmed-by-snapshot': +10,
    'confirmed-by-axe': +15,
    'confirmed-by-multiple-components': +10,
    'multiple-instances': +5,
    'matches-known-pattern': +5,

    // Negative adjustments (decrease confidence)
    'element-hidden': -30,
    'has-aria-label': -25,
    'has-aria-labelledby': -25,
    'has-title-attribute': -20,
    'inside-third-party': -25,
    'parent-has-label': -20,
    'sr-only-text-nearby': -25,
    'dynamic-content-area': -15,
    'framework-generated': -10,
    'matches-exception-pattern': -25
  };

  /**
   * Exception types that are informational/review-oriented (not suppressions).
   * These get a reduced confidence penalty (-10 instead of -25).
   */
  const INFORMATIONAL_EXCEPTION_TYPES = new Set([
    'focus-order-manual-review',
    'transparent-background-contrast',
    'aria-labelledby-review',
    'wcag-scope-exclusion'
  ]);

  /**
   * Used in verifyIssue() to categorize issues by confidence level
   */
  const CONFIDENCE_THRESHOLDS = {
    LIKELY_FALSE_POSITIVE: 30,   // Below this = likely false positive
    NEEDS_MANUAL_REVIEW: 50,     // Below this = needs manual review
    PROBABLE_ISSUE: 70,          // Below this = probable issue, above = confirmed
    MIN: 0,                      // Minimum confidence score
    MAX: 100                     // Maximum confidence score
  };

  /**
   * Used in getConfidenceLabel() for reporting
   */
  const CONFIDENCE_LABELS = {
    VERY_HIGH: 90,
    HIGH: 75,
    MEDIUM_HIGH: 60,
    MEDIUM: 45,
    LOW_MEDIUM: 30,
    LOW: 15
    // Below LOW = 'Very Low'
  };

  const EXCEPTION_DEFAULTS = {
    CONFIDENCE: 85,              // Default confidence for matched exceptions
    MAX_CONFIDENCE: 99,          // Maximum confidence after boosts
    ELEMENT_NOT_FOUND_PENALTY: 20,  // Penalty when element not in DOM
    SELECTOR_ERROR_PENALTY: 10      // Penalty when selector fails
  };

  /**
   * Unified confidence configuration (v12.0.0).
   * Single source of truth for all threshold decisions.
   * Replaces the previously scattered hardcoded values in orchestrator and MCP server.
   */
  const CONFIDENCE_CONFIG = {
    REMOVE_BELOW: 30,     // Issues below this are filtered (but tracked in results.filtered[])
    FLAG_BELOW: 50,        // Issues below this flagged for manual review
    CONFIRMED_ABOVE: 70,   // Issues above this are confirmed findings
    MIN: 10,               // Floor — penalties cannot push below this
    MAX: 100
  };

  const CONFIDENCE_TIERS = {
    FILTERED: 'filtered',           // Below REMOVE_BELOW (30%) — removed from results
    LOW_CONFIDENCE: 'low_confidence', // 30-50% — included but flagged as low confidence
    NEEDS_REVIEW: 'needs_review',    // 50-70% — included but needs manual verification
    CONFIRMED: 'confirmed'           // 70%+ — high confidence, confirmed finding
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  function log(message, type = 'info') {
    const levelMap = { info: 'INFO', success: 'INFO', warning: 'WARN', error: 'ERROR', critical: 'ERROR' };
    const helpers = global.a11yHelpers;
    if (helpers && helpers.log) {
      helpers.log(levelMap[type] || 'INFO', 'IssueVerifier', message);
    } else {
      const styles = {
        info: 'color: #2196F3',
        success: 'color: #4CAF50; font-weight: bold',
        warning: 'color: #FF9800',
        error: 'color: #f44336; font-weight: bold'
      };
      console.log(`%c${LOG_PREFIX} ${message}`, styles[type] || styles.info);
    }
  }

  /**
   * Get computed accessible name for an element
   */
  function getAccessibleName(element) {
    // Use shared-helpers canonical implementation if available
    if (global.a11yHelpers && global.a11yHelpers.getAccessibleName) {
      return global.a11yHelpers.getAccessibleName(element);
    }
    
    // Fallback for when shared-helpers not loaded (shouldn't happen)
    if (!element) return '';
    
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const names = labelledBy.split(/\s+/).map(id => {
        const el = document.getElementById(id);
        return el ? el.textContent.trim() : '';
      }).filter(Boolean);
      if (names.length) return names.join(' ');
    }
    
    const title = element.getAttribute('title');
    if (title && title.trim()) return title.trim();
    
    const text = element.textContent?.trim();
    if (text) return text;
    
    if (element.tagName === 'IMG') {
      return element.getAttribute('alt') || '';
    }
    
    return '';
  }

  /**
   * Check if element is truly visible to users
   */
  function isElementVisible(element) {
    // Use shared-helpers canonical implementation if available
    if (global.a11yHelpers && global.a11yHelpers.isElementVisibleComprehensive) {
      return global.a11yHelpers.isElementVisibleComprehensive(element, {
        checkOffscreen: true,
        checkAncestors: true,
        allowSrOnly: false
      });
    }
    
    // Fallback for when shared-helpers not loaded (shouldn't happen)
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    if (element.hasAttribute('hidden')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    
    return true;
  }

  /**
   * Check if element is inside a third-party widget
   */
  function isInsideThirdParty(element) {
    // Use shared-helpers canonical implementation if available
    if (global.a11yHelpers && global.a11yHelpers.isThirdPartyWidget) {
      return global.a11yHelpers.isThirdPartyWidget(element);
    }
    
    // Fallback with combined patterns from both implementations
    const thirdPartySelectors = [
      // Captcha & Security
      '[class*="recaptcha"]', '[id*="recaptcha"]',
      // Social
      '[class*="fb-"]', '[class*="twitter-"]',
      // Payment
      '[class*="stripe"]', '[class*="paypal"]',
      '[class*="afterpay"]', '[class*="klarna"]',
      '[class*="shopify-payment"]', '[class*="shopify-buy"]',
      // Support & Chat
      '[id*="intercom"]', '[id*="gorgias"]',
      // Marketing & Reviews
      '[class*="klaviyo"]', '[class*="yotpo"]', 
      '[class*="judgeme"]', '[class*="stamped"]',
      // Cookie consent (added from shared-helpers)
      '[class*="cookiebot"]', '[class*="onetrust"]',
      // Recommendations & Subscriptions
      '[class*="rebuy"]', '[id*="rebuy"]', '[data-rebuy]',
      '[class*="recharge"]', '[id*="recharge"]', '[data-recharge]',
      '[class*="loox"]', '[data-loox]',
      // Chat widgets
      '[class*="tidio"]', '#tidio-chat', '[data-tidio]',
      // Media embeds
      'iframe[src*="youtube"]', 'iframe[src*="vimeo"]',
      'iframe[src*="facebook"]', 'iframe[src*="twitter"]'
    ];
    
    let current = element;
    while (current && current !== document.body) {
      for (const selector of thirdPartySelectors) {
        try {
          if (current.matches(selector)) return true;
        } catch (e) { log('Invalid third-party selector: ' + selector, 'warning'); }
      }
      current = current.parentElement;
    }
    
    return false;
  }

  /**
   * Check if there's screen-reader-only text nearby
   */
  function hasSrOnlyTextNearby(element) {
    if (!element) return false;
    
    const parent = element.parentElement;
    if (!parent) return false;
    
    const srOnlySelectors = ['.sr-only', '.visually-hidden', '.screen-reader-text', '[class*="sr-only"]'];
    
    for (const selector of srOnlySelectors) {
      const srElements = parent.querySelectorAll(selector);
      if (srElements.length > 0) {
        for (const sr of srElements) {
          if (sr.textContent.trim()) return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Determine issue type from message and WCAG criterion
   */
  function getIssueType(issue) {
    const msg = (issue.message || '').toLowerCase();
    const wcag = issue.wcag || '';
    
    // Match specific patterns
    if (msg.includes('missing alt') && !msg.includes('role')) return 'missing-alt-no-role';
    if (msg.includes('button') && (msg.includes('empty') || msg.includes('no accessible name'))) return 'empty-button-no-label';
    if (msg.includes('link') && (msg.includes('empty') || msg.includes('no accessible name'))) return 'empty-link-no-label';
    if (msg.includes('form') && msg.includes('label')) return 'missing-form-label';
    if (msg.includes('lang') && msg.includes('attribute')) return 'missing-lang-attribute';
    if (msg.includes('duplicate') && msg.includes('id')) return 'duplicate-id';
    if (msg.includes('contrast')) return 'color-contrast-fail';
    if (msg.includes('skip') && msg.includes('link')) return 'missing-skip-link';
    if (msg.includes('icon') && msg.includes('button')) return 'button-with-icon-only';
    if (msg.includes('icon') && msg.includes('link')) return 'link-with-icon-only';
    if (msg.includes('heading') && (msg.includes('order') || msg.includes('skip'))) return 'heading-order-skip';
    if (msg.includes('landmark')) return 'landmark-missing';
    if (msg.includes('focus') && msg.includes('visible')) return 'focus-not-visible';
    if (msg.includes('aria') && msg.includes('invalid')) return 'aria-invalid-value';
    if (msg.includes('touch') || msg.includes('target size')) return 'touch-target-size';
    
    return 'default';
  }

  // ============================================================================
  // EXCEPTION CHECKING
  // ============================================================================

  const EXCEPTION_LOG_MAX_SIZE = 1000;  // Max exception log entries
  const EXCEPTION_STATS_MAX_SIZE = 500; // Max unique exceptions to track

  // Track exceptions applied during this verification session
  let sessionExceptionLog = [];

  // L1: Track usage statistics per exception ID (for export with updated counts)
  let exceptionUsageStats = {};

  /**
   * Check if an issue matches any learned exception
   */
  function matchesException(issue, element) {
    const hostname = (typeof window !== 'undefined' && window.location) ? window.location.hostname : '';

    // Priority order: session (user overrides) → global → site-specific
    // Session exceptions take highest priority as they represent explicit user decisions

    // 1. Check session-added exceptions first (highest priority — user overrides)
    // H8 fix: Build lightweight WCAG index for session exceptions to avoid O(n*m) linear scan
    const issueWcagForSession = issue.wcag || issue.criterion;
    const sessionCandidates = learnedExceptions.sessionAdded.filter(exc => {
      const excWcag = exc.wcag || ['*'];
      return excWcag.includes('*') || excWcag.includes(issueWcagForSession);
    });
    for (const exception of sessionCandidates) {
      const matchResult = checkExceptionMatch(issue, element, exception);
      if (matchResult) {
        logExceptionMatch(exception, issue, 'session');
        trackExceptionUsage(exception.id); // L1
        const result = { matched: true, exception, source: 'session' };
        if (typeof matchResult === 'object' && matchResult.action) {
          result.action = matchResult.action;
          result.modifiedSeverity = matchResult.modifiedSeverity;
        }
        return result;
      }
    }

    // 2. Check global exceptions
    const issueWcag = issue.wcag || issue.criterion;
    const candidates = exceptionIndex
      ? [...(exceptionIndex[issueWcag] || []), ...(exceptionIndex['*'] || [])]
      : learnedExceptions.global;
    // De-duplicate in case an exception appears in both buckets
    const seen = new Set();
    for (const exception of candidates) {
      if (seen.has(exception.id)) continue;
      seen.add(exception.id);
      const matchResult = checkExceptionMatch(issue, element, exception);
      if (matchResult) {
        logExceptionMatch(exception, issue, 'global');
        trackExceptionUsage(exception.id); // L1
        const result = { matched: true, exception, source: 'global' };
        if (typeof matchResult === 'object' && matchResult.action) {
          result.action = matchResult.action;
          result.modifiedSeverity = matchResult.modifiedSeverity;
        }
        return result;
      }
    }

    // 3. Check site-specific exceptions last (lowest priority)
    const siteExceptions = learnedExceptions.siteSpecific[hostname] || [];
    // Also apply Shopify-specific exceptions when on a Shopify platform
    const isShopify = (typeof window !== 'undefined' && typeof window.Shopify !== 'undefined') ||
      (typeof document !== 'undefined' && document.querySelector('meta[name="shopify-checkout-api-token"]') !== null);
    const shopifyExceptions = isShopify ? (learnedExceptions.siteSpecific.shopify || []) : [];
    const allSiteExceptions = [...siteExceptions, ...shopifyExceptions];
    for (const exception of allSiteExceptions) {
      const matchResult = checkExceptionMatch(issue, element, exception);
      if (matchResult) {
        logExceptionMatch(exception, issue, 'site-specific');
        trackExceptionUsage(exception.id); // L1
        const result = { matched: true, exception, source: 'site-specific' };
        // Propagate severity-modifier action if returned as object
        if (typeof matchResult === 'object' && matchResult.action) {
          result.action = matchResult.action;
          result.modifiedSeverity = matchResult.modifiedSeverity;
        }
        return result;
      }
    }

    return { matched: false };
  }

  /**
   * L1: Track exception usage for verifiedCount increments
   * @param {string} exceptionId - The ID of the exception that matched
   */
  function trackExceptionUsage(exceptionId) {
    const currentSize = Object.keys(exceptionUsageStats).length;
    if (!exceptionUsageStats[exceptionId] && currentSize >= EXCEPTION_STATS_MAX_SIZE) {
      return; // Don't add new entries if at limit
    }

    if (!exceptionUsageStats[exceptionId]) {
      exceptionUsageStats[exceptionId] = {
        sessionCount: 0,
        lastUsed: null
      };
    }
    exceptionUsageStats[exceptionId].sessionCount++;
    exceptionUsageStats[exceptionId].lastUsed = new Date().toISOString();
  }

  /**
   * L1: Get exceptions with updated usage statistics
   * Returns structure ready to save back to learned-exceptions.json.
   * Note: Stats are per-session (in-memory only). Persistent tracking requires
   * the MCP server to call this after audit completion and write back to learned-exceptions.json.
   * @returns {Object} Updated exceptions with incremented verifiedCount and lastVerified
   */
  function getExceptionsWithStats() {
    const timestamp = new Date().toISOString();
    
    // Deep clone the loaded exceptions
    const updated = {
      schemaVersion: SCHEMA_VERSION,
      lastUpdated: timestamp,
      description: learnedExceptions.description || 'Learned accessibility audit exceptions with usage tracking.',
      global: learnedExceptions.global.map(exc => {
        const stats = exceptionUsageStats[exc.id];
        if (stats && stats.sessionCount > 0) {
          return {
            ...exc,
            verifiedCount: (exc.verifiedCount || 0) + stats.sessionCount,
            lastVerified: stats.lastUsed,
            // L1: Calculate dynamic confidence based on usage
            // A9: Bonus capped at +10 via Math.min(5, log10(...)) so high-use exceptions
            // don't asymptotically inflate confidence beyond what's warranted.
            // Formula: baseConfidence + min(5, log10(verifiedCount + 1)) * 2, capped at MAX_CONFIDENCE
            confidence: Math.min(EXCEPTION_DEFAULTS.MAX_CONFIDENCE, Math.round(
              (exc.confidence || EXCEPTION_DEFAULTS.CONFIDENCE) + (Math.min(5, Math.log10((exc.verifiedCount || 0) + stats.sessionCount + 1)) * 2)
            ))
          };
        }
        return { ...exc };
      }),
      // M3 FIX: Also update siteSpecific exceptions with usage stats
      siteSpecific: Object.fromEntries(
        Object.entries(learnedExceptions.siteSpecific).map(([hostname, exceptions]) => [
          hostname,
          exceptions.map(exc => {
            const stats = exceptionUsageStats[exc.id];
            if (stats && stats.sessionCount > 0) {
              return {
                ...exc,
                verifiedCount: (exc.verifiedCount || 0) + stats.sessionCount,
                lastVerified: stats.lastUsed,
                confidence: Math.min(EXCEPTION_DEFAULTS.MAX_CONFIDENCE, Math.round(
                  (exc.confidence || EXCEPTION_DEFAULTS.CONFIDENCE) + (Math.min(5, Math.log10((exc.verifiedCount || 0) + stats.sessionCount + 1)) * 2)
                ))
              };
            }
            return { ...exc };
          })
        ])
      ),
      recentlyAdded: learnedExceptions.recentlyAdded || [],
      statistics: {
        totalGlobal: learnedExceptions.global.length,
        totalSiteSpecific: Object.values(learnedExceptions.siteSpecific).flat().length,
        falsePositivesPrevented: Object.values(exceptionUsageStats).reduce(
          (sum, stats) => sum + stats.sessionCount, 0
        ),
        lastAnalyzed: timestamp
      }
    };
    
    return updated;
  }

  /**
   * L1: Get usage statistics summary for this session
   * @returns {Object} Summary of exception usage
   */
  function getExceptionUsageStats() {
    const stats = {
      totalMatches: 0,
      uniqueExceptionsUsed: 0,
      byException: {},
      mostUsed: null
    };
    
    for (const [id, usage] of Object.entries(exceptionUsageStats)) {
      stats.totalMatches += usage.sessionCount;
      stats.uniqueExceptionsUsed++;
      stats.byException[id] = usage;
      
      if (!stats.mostUsed || usage.sessionCount > stats.byException[stats.mostUsed]?.sessionCount) {
        stats.mostUsed = id;
      }
    }
    
    return stats;
  }

  /**
   * L1: Clear usage stats (call at start of new audit)
   */
  function clearExceptionUsageStats() {
    exceptionUsageStats = {};
  }

  /**
   * Log when an exception matches an issue
   */
  function logExceptionMatch(exception, issue, source) {
    const logEntry = {
      exceptionId: exception.id,
      description: exception.pattern?.description || exception.reason,
      reason: exception.reason,
      confidence: exception.confidence || EXCEPTION_DEFAULTS.CONFIDENCE,
      source: source,
      issueWcag: issue.wcag,
      issueMessage: (issue.message || '').substring(0, 50),
      timestamp: new Date().toISOString()
    };
    
    // M12 fix: More aggressive trimming — keep 50% instead of 80% to prevent unbounded growth
    if (sessionExceptionLog.length >= EXCEPTION_LOG_MAX_SIZE) {
      sessionExceptionLog = sessionExceptionLog.slice(-Math.floor(EXCEPTION_LOG_MAX_SIZE * 0.5));
    }
    sessionExceptionLog.push(logEntry);

    // Console log for visibility during audit
    log(`Exception applied: ${exception.id}`, 'info');
    log(`  Pattern: ${exception.pattern?.description || 'N/A'}`, 'info');
    log(`  Reason: ${exception.reason}`, 'info');
    log(`  Source: ${source}`, 'info');
  }

  /**
   * Get the exception log for this session
   */
  function getExceptionLog() {
    // Aggregate by exception ID
    const aggregated = {};
    for (const entry of sessionExceptionLog) {
      if (!aggregated[entry.exceptionId]) {
        aggregated[entry.exceptionId] = {
          id: entry.exceptionId,
          description: entry.description,
          reason: entry.reason,
          confidence: entry.confidence,
          source: entry.source,
          count: 0,
          wcagAffected: new Set()
        };
      }
      aggregated[entry.exceptionId].count++;
      aggregated[entry.exceptionId].wcagAffected.add(entry.issueWcag);
    }
    
    // Convert Sets to arrays for JSON serialization
    return Object.values(aggregated).map(e => ({
      ...e,
      wcagAffected: Array.from(e.wcagAffected)
    }));
  }

  /**
   * Clear the exception log (call at start of new audit)
   */
  function clearExceptionLog() {
    sessionExceptionLog = [];
    clearExceptionUsageStats(); // L1: Also clear usage stats
  }

  /**
   * Check if a specific exception matches an issue
   */
  function checkExceptionMatch(issue, element, exception) {
    // Check WCAG criterion match
    if (exception.wcag && exception.wcag !== '*') {
      const wcagList = Array.isArray(exception.wcag) ? exception.wcag : [exception.wcag];
      if (!wcagList.includes(issue.wcag) && !wcagList.includes('*')) {
        return false;
      }
    }

    const pattern = exception.pattern;
    if (!pattern) return false;

    // Some pattern types don't require an element (they match on issue/page metadata)
    const elementOptionalTypes = [
      'wcag-scope-exclusion', 'focus-order-manual-review',
      'third-party-form-override', 'library-not-present',
      'css-rule-check', 'css-rule-override'
    ];
    if (!element && !elementOptionalTypes.includes(pattern.type)) return false;

    // Selector constraint validation: if the exception defines selectors,
    // the element must match at least one before proceeding.
    // This prevents overly broad exceptions from matching unrelated element types.
    if (element && pattern.selectors && Array.isArray(pattern.selectors)) {
      const matchesAnySelector = pattern.selectors.some(sel => {
        try { return element.matches(sel); } catch { return false; }
      });
      if (!matchesAnySelector) return false;
    }

    switch (pattern.type) {
      case 'element-context':
        return checkElementContextMatch(element, pattern);
      
      case 'selector-match':
        return checkSelectorMatch(element, pattern);
      
      case 'third-party':
        return checkThirdPartyMatch(element, pattern);
      
      case 'hidden-content':
        return !isElementVisible(element);
      
      case 'third-party-aria':
        return checkThirdPartyAriaMatch(element, pattern);
      
      case 'carousel-live-region':
        return checkCarouselLiveRegionMatch(element, pattern);

      // Pre-existing types (previously unhandled)
      case 'skip-link-visibility':
        return checkSkipLinkVisibilityMatch(element, pattern);

      case 'focus-order-manual-review':
        return checkFocusOrderManualReviewMatch(issue, pattern);

      case 'transparent-background-contrast':
        return checkTransparentBackgroundContrastMatch(element, pattern);

      case 'aria-labelledby-review':
        return checkAriaLabelledbyReviewMatch(element, pattern);

      case 'css-rule-check':
        return checkCssRuleCheckMatch(pattern);

      // New types from v10.2.0 Shopify audit learnings
      case 'third-party-form-override':
        return checkThirdPartyFormOverrideMatch(element, pattern);

      case 'wcag-scope-exclusion':
        return checkWcagScopeExclusionMatch(issue, pattern);

      case 'severity-modifier':
        return checkSeverityModifierMatch(element, pattern);

      case 'audit-rule':
        return checkAuditRuleMatch(element, pattern);

      case 'library-not-present':
        return checkLibraryNotPresentMatch(element, pattern, issue);

      case 'css-rule-override':
        return checkCssRuleOverrideMatch(pattern);

      default:
        log(`Unknown pattern type: ${pattern.type}`, 'warning');
        return false;
    }
  }

  /**
   * Check third-party ARIA pattern match (e.g., Splide pagination with role="tab")
   * Handles parentSelector checks with exists condition and negation
   */
  function checkThirdPartyAriaMatch(element, pattern) {
    // Check if element matches any of the defined selectors
    if (pattern.selectors) {
      const matchesSelector = pattern.selectors.some(sel => {
        try { return element.matches(sel); } catch { return false; }
      });
      if (!matchesSelector) return false;
    }
    
    // Process checks array with support for parentSelector and negation
    if (!pattern.checks) return true;
    
    for (const check of pattern.checks) {
      // Handle parentSelector check
      if (check.parentSelector) {
        const parent = element.closest(check.parentSelector);
        if (check.condition === 'exists' && !parent) return false;
        if (check.condition === 'not-exists' && parent) return false;
      }
      
      // Handle negation (not: {...})
      if (check.not) {
        if (check.not.parentSelector) {
          const negParent = element.closest(check.not.parentSelector);
          if (check.not.condition === 'exists' && negParent) return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Check carousel live region pattern match
   * Checks for slide position labels and live region configuration
   */
  function checkCarouselLiveRegionMatch(element, pattern) {
    if (!pattern.checks) return false;
    
    for (const check of pattern.checks) {
      if (check.or) {
        // OR logic - at least one must match
        const anyMatch = check.or.some(subCheck => evaluateCarouselCheck(element, subCheck));
        if (!anyMatch) return false;
      } else {
        // AND logic - must match
        if (!evaluateCarouselCheck(element, check)) return false;
      }
    }
    
    return true;
  }

  /**
   * Evaluate a single carousel check condition
   */
  function evaluateCarouselCheck(element, check) {
    // Check for descendant elements
    if (check.descendant) {
      const descendant = element.querySelector(check.descendant);
      if (check.condition === 'exists') return !!descendant;
      if (check.condition === 'not-exists') return !descendant;
    }
    
    // Check for attribute on element itself
    if (check.attribute) {
      if (check.condition === 'exists') return element.hasAttribute(check.attribute);
      if (check.condition === 'not-exists') return !element.hasAttribute(check.attribute);
    }
    
    return false;
  }

  function checkElementContextMatch(element, pattern) {
    if (!pattern.checks) return false;
    
    for (const check of pattern.checks) {
      if (check.or) {
        // OR logic - at least one must match
        const anyMatch = check.or.some(subCheck => evaluateCheck(element, subCheck));
        if (!anyMatch) return false;
      } else {
        // AND logic - all must match
        if (!evaluateCheck(element, check)) return false;
      }
    }
    
    return true;
  }

  function evaluateCheck(element, check) {
    if (check.attribute) {
      const value = element.getAttribute(check.attribute);
      
      switch (check.condition) {
        case 'exists':
          return element.hasAttribute(check.attribute);
        case 'exists-and-non-empty':
          return value && value.trim().length > 0;
        case 'equals':
          return value === check.value;
        case 'in':
          return check.values && check.values.includes(value);
        case 'references-visible-element':
          if (!value) return false;
          const refEl = document.getElementById(value);
          return refEl && isElementVisible(refEl);
        case 'has-associated-label':
          if (!value) return false;
          try {
            return !!document.querySelector(`label[for="${CSS.escape(value)}"]`);
          } catch { return false; }
        default:
          return false;
      }
    }
    
    if (check.child) {
      const child = element.querySelector(check.child);
      return check.condition === 'exists' ? !!child : !child;
    }
    
    if (check.textContent) {
      const text = element.textContent?.trim();
      return check.condition === 'non-empty-excluding-hidden' ? 
        (text && text.length > 0) : !!text;
    }
    
    if (check.style) {
      const computed = window.getComputedStyle(element);
      const value = computed[check.style];
      return check.condition === 'equals' ? value === check.value : !!value;
    }
    
    return false;
  }

  function checkSelectorMatch(element, pattern) {
    if (pattern.selectors) {
      const matches = pattern.selectors.some(sel => {
        try { return element.matches(sel); } catch { return false; }
      });
      if (!matches) return false;
    }
    
    if (pattern.textContains) {
      const text = element.textContent?.toLowerCase() || '';
      return pattern.textContains.some(t => text.includes(t.toLowerCase()));
    }
    
    return true;
  }

  function checkThirdPartyMatch(element, pattern) {
    if (!pattern.selectorPatterns) return isInsideThirdParty(element);
    
    let current = element;
    while (current && current !== document.body) {
      for (const selector of pattern.selectorPatterns) {
        try {
          if (current.matches(selector)) return true;
        } catch { /* Skip invalid selector */ }
      }
      current = current.parentElement;
    }
    
    return false;
  }

  // ============================================================================
  // PRE-EXISTING PATTERN HANDLERS (previously unhandled in switch)
  // ============================================================================

  /**
   * Check skip-link-visibility pattern — selector match + attribute checks
   * Validates hidden-until-focused skip links are WCAG compliant
   */
  function checkSkipLinkVisibilityMatch(element, pattern) {
    // Check selector match first
    if (pattern.selectors) {
      const matches = pattern.selectors.some(sel => {
        try { return element.matches(sel); } catch { return false; }
      });
      if (!matches) return false;
    }
    // Run checks (reuse element-context logic)
    if (pattern.checks) {
      return checkElementContextMatch(element, pattern);
    }
    return true;
  }

  /**
   * Check focus-order-manual-review pattern — match triggers against issue metadata
   * Flags focus order issues that need manual review
   */
  function checkFocusOrderManualReviewMatch(issue, pattern) {
    if (!pattern.triggers || !Array.isArray(pattern.triggers)) return false;
    const msg = (issue.message || issue.description || '').toLowerCase();
    const meta = issue.metadata || {};
    return pattern.triggers.some(trigger => {
      const t = trigger.toLowerCase();
      return msg.includes(t) ||
        (meta.trigger && meta.trigger.toLowerCase() === t) ||
        (meta.type && meta.type.toLowerCase() === t);
    });
  }

  /**
   * Check transparent-background-contrast pattern
   * Matches elements with transparent or low-alpha backgrounds
   */
  function checkTransparentBackgroundContrastMatch(element, pattern) {
    if (!element) return false;
    try {
      const computed = window.getComputedStyle(element);
      const bg = computed.backgroundColor || '';
      // Check for transparent or low-alpha backgrounds
      const isTransparent = bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
      const isLowAlpha = bg.startsWith('rgba') && parseFloat(bg.split(',')[3]) < 0.1;
      return isTransparent || isLowAlpha;
    } catch {
      return false;
    }
  }

  /**
   * Check aria-labelledby-review pattern — attribute checks with negation
   * Validates aria-labelledby presence with manual review context
   */
  function checkAriaLabelledbyReviewMatch(element, pattern) {
    if (!pattern.checks) return false;
    for (const check of pattern.checks) {
      if (check.attribute) {
        if (!evaluateCheck(element, check)) return false;
      }
      if (check.not) {
        // Negation: if the negated condition is true, the match fails
        if (check.not.labelFor === 'exists') {
          const id = element.getAttribute('id');
          // H3/L8 fix: Use CSS.escape() for safe selector construction + try-catch
          if (id) {
            try {
              const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
              if (document.querySelector('label[for="' + escapedId + '"]')) return false;
            } catch (e) { /* invalid selector — skip check */ }
          }
        }
      }
    }
    return true;
  }

  /**
   * Check css-rule-check pattern — inspect page stylesheets for CSS rules
   * Used for checking :focus-visible styles that getComputedStyle misses
   */
  function checkCssRuleCheckMatch(pattern) {
    if (!pattern.cssRulePatterns || !Array.isArray(pattern.cssRulePatterns)) return false;
    try {
      const sheets = document.styleSheets;
      // H2 fix: Cache compiled regex patterns on the pattern object to avoid recompiling per-issue
      if (!pattern._compiledRegex) {
        pattern._compiledRegex = pattern.cssRulePatterns.map(p => {
          try { return new RegExp(p, 'i'); } catch { return null; }
        }).filter(Boolean);
      }
      const compiledPatterns = pattern._compiledRegex;
      if (compiledPatterns.length === 0) return false;
      for (let i = 0; i < sheets.length; i++) {
        let rules;
        try { rules = sheets[i].cssRules || sheets[i].rules; } catch { continue; }
        if (!rules) continue;
        for (let j = 0; j < rules.length; j++) {
          const ruleText = rules[j].cssText || '';
          for (const regex of compiledPatterns) {
            if (regex.test(ruleText)) return true;
          }
        }
      }
    } catch {
      // Cross-origin stylesheets or invalid regex may throw
    }
    return false;
  }

  // ============================================================================
  // NEW PATTERN HANDLERS (v10.2.0 — Shopify audit learnings)
  // ============================================================================

  /**
   * Check third-party-form-override pattern
   * Suppresses findings on native forms when a third-party form embed is present
   */
  function checkThirdPartyFormOverrideMatch(element, pattern) {
    if (!pattern.overrideSelectors || !pattern.nativeFormSelectors) return false;
    // Check if any third-party form override is present on the page
    const overridePresent = pattern.overrideSelectors.some(sel => {
      try { return !!document.querySelector(sel); } catch { return false; }
    });
    if (!overridePresent) return false;
    // Check if the flagged element is inside or is a native form
    if (!element) return overridePresent;
    return pattern.nativeFormSelectors.some(sel => {
      try { return element.matches(sel) || !!element.closest(sel); } catch { return false; }
    });
  }

  /**
   * Check wcag-scope-exclusion pattern
   * Suppresses findings for WCAG criteria that are out of scope for the audit level
   */
  function checkWcagScopeExclusionMatch(issue, pattern) {
    if (!pattern.criterion || !pattern.level) return false;
    const issueCriterion = issue.wcag || issue.criterion;
    if (!issueCriterion) return false;
    // Match if the issue's WCAG criterion matches the excluded criterion
    // and the excluded level is higher than the audit scope
    if (issueCriterion === pattern.criterion) {
      const levelOrder = { 'A': 1, 'AA': 2, 'AAA': 3 };
      const auditScope = pattern.scope || 'AA';
      return (levelOrder[pattern.level] || 0) > (levelOrder[auditScope] || 0);
    }
    return false;
  }

  /**
   * Check severity-modifier pattern
   * Returns match result with modified severity instead of suppressing the finding
   * @returns {boolean|Object} false if no match, or { matched: true, action: 'modify-severity', modifiedSeverity: string }
   */
  function checkSeverityModifierMatch(element, pattern) {
    if (!element) return false;
    // Check selector match
    if (pattern.selectors) {
      const matches = pattern.selectors.some(sel => {
        try { return element.matches(sel) || !!element.closest(sel); } catch { return false; }
      });
      if (!matches) return false;
    }
    // Check for mitigating control (checks array with or/and logic)
    if (pattern.checks) {
      for (const check of pattern.checks) {
        if (check.or) {
          const anyMatch = check.or.some(sub => evaluateCarouselCheck(element, sub));
          if (!anyMatch) return false;
        } else {
          if (!evaluateCarouselCheck(element, check)) return false;
        }
      }
    }
    // Return special severity-modifier result
    return {
      matched: true,
      action: 'modify-severity',
      modifiedSeverity: pattern.modifiedSeverity || 'minor'
    };
  }

  /**
   * Check audit-rule pattern
   * Evaluates interpretive rules about how to assess issues (e.g., contrast exemptions)
   */
  function checkAuditRuleMatch(element, pattern) {
    if (!pattern.rule) return false;

    switch (pattern.rule) {
      case 'contrast-disabled-exemption':
        // Only match (exempt) if element has native disabled attribute
        if (!element) return false;
        if (element.hasAttribute('disabled')) {
          return true; // Native disabled — exempt from contrast check
        }
        // Check if element uses non-native disabled patterns
        if (pattern.excludes) {
          for (const excludePattern of pattern.excludes) {
            try {
              if (element.matches('[' + excludePattern + ']') || element.hasAttribute(excludePattern)) {
                return false; // Non-native disabled — NOT exempt
              }
            } catch {
              // Invalid selector, skip
            }
          }
        }
        return false;

      default:
        log(`Unknown audit rule: ${pattern.rule}`, 'warning');
        return false;
    }
  }

  /**
   * Check library-not-present pattern
   * Suppresses findings attributed to a JS library not present in the DOM.
   * Only matches findings whose selector or message references the library.
   */
  function checkLibraryNotPresentMatch(element, pattern, issue) {
    if (!pattern.selectorPatterns || !Array.isArray(pattern.selectorPatterns)) return false;

    // Only match findings whose selector or message references this library
    var findingSelector = (issue && issue.selector || '').toLowerCase();
    var findingMessage = (issue && issue.message || '').toLowerCase();
    var libraryNames = pattern.libraries || [];
    var isRelated = libraryNames.some(function(lib) {
      var lower = lib.toLowerCase();
      return findingSelector.indexOf(lower) !== -1 || findingMessage.indexOf(lower) !== -1;
    });
    if (!isRelated && element) {
      isRelated = pattern.selectorPatterns.some(function(sel) {
        try { return element.matches(sel); } catch(e) { return false; }
      });
    }
    if (!isRelated) return false;

    // Check if ANY library selectors exist in the page
    var libraryPresent = pattern.selectorPatterns.some(function(sel) {
      try { return !!document.querySelector(sel); } catch(e) { return false; }
    });
    // If library IS present, this exception doesn't apply
    if (libraryPresent) return false;
    // The library isn't in the DOM and the finding targets it — false positive
    return true;
  }

  /**
   * Check css-rule-override pattern
   * Detects CSS rules with !important that block remediation
   */
  function checkCssRuleOverrideMatch(pattern) {
    if (!pattern.cssProperty) return false;
    try {
      const sheets = document.styleSheets;
      for (let i = 0; i < sheets.length; i++) {
        let rules;
        try { rules = sheets[i].cssRules || sheets[i].rules; } catch { continue; }
        if (!rules) continue;
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];
          if (rule.style && rule.style.getPropertyPriority) {
            const priority = rule.style.getPropertyPriority(pattern.cssProperty);
            if (priority === 'important') return true;
          }
        }
      }
    } catch {
      // Cross-origin stylesheets may throw
    }
    return false;
  }

  // ============================================================================
  // ISSUE VERIFICATION
  // ============================================================================

  /**
   * Verify a single issue and calculate confidence score
   */
  function verifyIssue(issue) {
    const startConfidence = BASE_CONFIDENCE[getIssueType(issue)] || BASE_CONFIDENCE.default;
    let confidence = startConfidence;
    const adjustments = [];
    const verificationNotes = [];
    
    // Try to find the element
    let element = null;
    let selectorError = false;
    if (issue.selector) {
      try {
        element = document.querySelector(issue.selector);
      } catch (e) {
        selectorError = true;
        verificationNotes.push('Could not locate element with selector');
        confidence -= EXCEPTION_DEFAULTS.SELECTOR_ERROR_PENALTY;
      }
    }

    // Verification checks
    if (element) {
      adjustments.push({ name: 'verified-in-dom', value: CONFIDENCE_ADJUSTMENTS['verified-in-dom'] });
      confidence += CONFIDENCE_ADJUSTMENTS['verified-in-dom'];
      
      // Check visibility
      if (!isElementVisible(element)) {
        adjustments.push({ name: 'element-hidden', value: CONFIDENCE_ADJUSTMENTS['element-hidden'] });
        confidence += CONFIDENCE_ADJUSTMENTS['element-hidden'];
        verificationNotes.push('Element is hidden from all users');
      }

      // Check AT exposure (element may be visible but hidden from assistive technology)
      const helpers = global.a11yHelpers;
      if (helpers && helpers.isExposedToAT && !helpers.isExposedToAT(element)) {
        const atPenalty = -40;
        adjustments.push({ name: 'not-exposed-to-at', value: atPenalty });
        confidence += atPenalty;
        verificationNotes.push('Element not exposed to assistive technology (aria-hidden, inert, or hidden ancestor)');
      }

      // Check for ARIA overrides
      const accessibleName = getAccessibleName(element);
      if (accessibleName) {
        if (element.hasAttribute('aria-label')) {
          adjustments.push({ name: 'has-aria-label', value: CONFIDENCE_ADJUSTMENTS['has-aria-label'] });
          confidence += CONFIDENCE_ADJUSTMENTS['has-aria-label'];
          verificationNotes.push(`Has aria-label: "${accessibleName.substring(0, 50)}"`);
        } else if (element.hasAttribute('aria-labelledby')) {
          adjustments.push({ name: 'has-aria-labelledby', value: CONFIDENCE_ADJUSTMENTS['has-aria-labelledby'] });
          confidence += CONFIDENCE_ADJUSTMENTS['has-aria-labelledby'];
          verificationNotes.push(`Has aria-labelledby: "${accessibleName.substring(0, 50)}"`);
        } else if (element.hasAttribute('title')) {
          adjustments.push({ name: 'has-title-attribute', value: CONFIDENCE_ADJUSTMENTS['has-title-attribute'] });
          confidence += CONFIDENCE_ADJUSTMENTS['has-title-attribute'];
          verificationNotes.push(`Has title attribute: "${accessibleName.substring(0, 50)}"`);
        }
      }
      
      // Check third-party
      if (isInsideThirdParty(element)) {
        adjustments.push({ name: 'inside-third-party', value: CONFIDENCE_ADJUSTMENTS['inside-third-party'] });
        confidence += CONFIDENCE_ADJUSTMENTS['inside-third-party'];
        verificationNotes.push('Inside third-party widget');
      }
      
      // Check for SR-only text nearby
      if (hasSrOnlyTextNearby(element)) {
        adjustments.push({ name: 'sr-only-text-nearby', value: CONFIDENCE_ADJUSTMENTS['sr-only-text-nearby'] });
        confidence += CONFIDENCE_ADJUSTMENTS['sr-only-text-nearby'];
        verificationNotes.push('Screen-reader-only text found nearby');
      }
      
      // Check learned exceptions
      const exceptionMatch = matchesException(issue, element);
      if (exceptionMatch.matched) {
        if (exceptionMatch.action === 'modify-severity') {
          // Severity modifier: adjust severity instead of suppressing
          issue.originalSeverity = issue.severity;
          issue.severity = exceptionMatch.modifiedSeverity;
          adjustments.push({ name: 'severity-modified', value: -5 });
          confidence -= 5;
          verificationNotes.push(`Severity modified from ${issue.originalSeverity} to ${issue.severity}: ${exceptionMatch.exception.reason}`);
        } else {
          const isInformational = INFORMATIONAL_EXCEPTION_TYPES.has(exceptionMatch.exception.pattern?.type);
          let penalty;
          let matchQuality;
          if (isInformational) {
            penalty = -10;
            matchQuality = 'informational';
          } else if (exceptionMatch.exception.pattern?.selectors && Array.isArray(exceptionMatch.exception.pattern.selectors)) {
            // Full match: exception has selectors and element matched one (already validated in checkExceptionMatch)
            penalty = CONFIDENCE_ADJUSTMENTS['matches-exception-pattern']; // -25
            matchQuality = 'full';
          } else {
            // Partial match: exception has no selectors constraint (broad match)
            penalty = -10;
            matchQuality = 'partial';
          }
          adjustments.push({ name: 'matches-exception-pattern', value: penalty });
          confidence += penalty;
          verificationNotes.push(`Matches exception (${matchQuality}): ${exceptionMatch.exception.reason}`);
        }
      }
    } else if (issue.selector && !selectorError) {
      verificationNotes.push('Element no longer in DOM (may be dynamic content)');
      confidence -= EXCEPTION_DEFAULTS.ELEMENT_NOT_FOUND_PENALTY;
    }

    // Check element-optional exceptions (wcag-scope-exclusion, etc.) even without element
    if (!element) {
      const exceptionMatch = matchesException(issue, null);
      if (exceptionMatch.matched) {
        const isInformational = INFORMATIONAL_EXCEPTION_TYPES.has(exceptionMatch.exception.pattern?.type);
        const penalty = isInformational ? -10 : CONFIDENCE_ADJUSTMENTS['matches-exception-pattern'];
        adjustments.push({ name: 'matches-exception-pattern', value: penalty });
        confidence += penalty;
        verificationNotes.push(`Matches exception${isInformational ? ' (informational)' : ''}: ${exceptionMatch.exception.reason}`);
      }
    }

    // Positive confidence signals: boost when multiple sources confirm the issue
    if (issue.sources && Array.isArray(issue.sources) && issue.sources.length > 1) {
      const boost = CONFIDENCE_ADJUSTMENTS['multiple-detection-methods'];
      adjustments.push({ name: 'multiple-detection-methods', value: boost });
      confidence += boost;
      verificationNotes.push(`Confirmed by ${issue.sources.length} detection sources`);
    }
    if (issue.confirmedBySnapshot) {
      adjustments.push({ name: 'confirmed-by-snapshot', value: CONFIDENCE_ADJUSTMENTS['confirmed-by-snapshot'] });
      confidence += CONFIDENCE_ADJUSTMENTS['confirmed-by-snapshot'];
      verificationNotes.push('Also found in accessibility snapshot');
    }
    if (issue.confirmedByAxe) {
      adjustments.push({ name: 'confirmed-by-axe', value: CONFIDENCE_ADJUSTMENTS['confirmed-by-axe'] });
      confidence += CONFIDENCE_ADJUSTMENTS['confirmed-by-axe'];
      verificationNotes.push('Also flagged by axe-core');
    }
    // Boost if same issue (selector + WCAG) flagged by multiple component modules
    if (issue.componentSources && Array.isArray(issue.componentSources) && issue.componentSources.length >= 2) {
      adjustments.push({ name: 'confirmed-by-multiple-components', value: CONFIDENCE_ADJUSTMENTS['confirmed-by-multiple-components'] });
      confidence += CONFIDENCE_ADJUSTMENTS['confirmed-by-multiple-components'];
      verificationNotes.push(`Flagged by ${issue.componentSources.length} component modules: ${issue.componentSources.join(', ')}`);
    }
    if (issue.instanceCount && issue.instanceCount > 1) {
      adjustments.push({ name: 'multiple-instances', value: CONFIDENCE_ADJUSTMENTS['multiple-instances'] });
      confidence += CONFIDENCE_ADJUSTMENTS['multiple-instances'];
      verificationNotes.push(`Found ${issue.instanceCount} instances of same pattern`);
    }

    // Framework-aware confidence adjustments (v12.4.0)
    if (global.a11yHelpers && global.a11yHelpers.detectFrameworks) {
      var frameworks = global.a11yHelpers.detectFrameworks();
      // React Portal focus management — may handle focus internally
      if (frameworks.react && issue.wcag === '2.4.3' && issue.message && issue.message.indexOf('focus') !== -1) {
        var frameworkAdj = CONFIDENCE_ADJUSTMENTS['framework-generated'];
        adjustments.push({ name: 'framework-generated', value: frameworkAdj });
        confidence += frameworkAdj;
        verificationNotes.push('React detected — focus management may be handled by portal/context');
      }
      // Vue transition states — elements may be mid-transition
      if (frameworks.vue && issue.selector && issue.selector.indexOf('[data-v-') !== -1) {
        var vueAdj = CONFIDENCE_ADJUSTMENTS['framework-generated'];
        adjustments.push({ name: 'framework-generated', value: vueAdj });
        confidence += vueAdj;
        verificationNotes.push('Vue detected — element may be in transition state');
      }
    }

    // Penalty stacking floor: prevent stacked negative adjustments from over-penalizing.
    // Cap total penalty at 60% of base confidence (minimum 40% of base preserved).
    const totalPenalty = adjustments
      .filter(a => a.value < 0)
      .reduce((sum, a) => sum + a.value, 0);
    const maxPenalty = -(startConfidence * 0.6);
    if (totalPenalty < maxPenalty) {
      confidence = startConfidence + maxPenalty;
      verificationNotes.push(`Penalty capped at 60% of base confidence (${Math.abs(totalPenalty)} -> ${Math.abs(maxPenalty)})`);
    }

    // Clamp confidence to valid range with floor from CONFIDENCE_CONFIG
    confidence = Math.max(CONFIDENCE_CONFIG.MIN, Math.min(CONFIDENCE_THRESHOLDS.MAX, Math.round(confidence)));

    // Determine verification status based on confidence thresholds
    let status = 'verified';
    if (confidence < CONFIDENCE_THRESHOLDS.LIKELY_FALSE_POSITIVE) {
      status = 'likely-false-positive';
    } else if (confidence < CONFIDENCE_THRESHOLDS.NEEDS_MANUAL_REVIEW) {
      status = 'needs-manual-review';
    } else if (confidence < CONFIDENCE_THRESHOLDS.PROBABLE_ISSUE) {
      status = 'probable-issue';
    } else {
      status = 'confirmed-issue';
    }
    
    return {
      ...issue,
      verification: {
        status,
        confidence,
        confidenceLabel: getConfidenceLabel(confidence),
        baseConfidence: startConfidence,
        adjustments,
        notes: verificationNotes,
        verifiedAt: new Date().toISOString(),
        verifierVersion: VERIFIER_VERSION
      }
    };
  }

  /**
   * Get human-readable confidence label
   */
  function getConfidenceLabel(confidence) {
    if (confidence >= CONFIDENCE_LABELS.VERY_HIGH) return 'Very High';
    if (confidence >= CONFIDENCE_LABELS.HIGH) return 'High';
    if (confidence >= CONFIDENCE_LABELS.MEDIUM_HIGH) return 'Medium-High';
    if (confidence >= CONFIDENCE_LABELS.MEDIUM) return 'Medium';
    if (confidence >= CONFIDENCE_LABELS.LOW_MEDIUM) return 'Low-Medium';
    if (confidence >= CONFIDENCE_LABELS.LOW) return 'Low';
    return 'Very Low';
  }

  // ============================================================================
  // MAIN API FUNCTIONS
  // ============================================================================

  /**
   * Verify all issues from an audit result
   * @param {Object} auditResults - Results from runAudit() or runComponentAudit()
   * @param {Object} options - Verification options
   * @returns {Object} Verified results with confidence scores
   */
  /**
   * Group similar issues that differ only by numeric values.
   * E.g., "Image alt text is very long (174 characters)" x14 → 1 grouped issue.
   * Added for Issue #8 fix.
   */
  function groupSimilarIssues(issues) {
    if (!Array.isArray(issues) || issues.length === 0) return issues;

    const groups = new Map();

    for (const issue of issues) {
      // Create pattern key by replacing numbers with placeholder
      const msg = issue.message || issue.description || '';
      const patternKey = msg.replace(/\d+/g, '#NUM#').trim();
      const groupKey = (issue.wcag || '') + '::' + patternKey;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          ...issue,
          _instances: [issue],
          _count: 1
        });
      } else {
        const group = groups.get(groupKey);
        group._instances.push(issue);
        group._count++;
        // Keep highest confidence
        const issueConfidence = issue.verification?.confidence ?? issue.confidence ?? 0;
        if (issueConfidence > (group.confidence || 0)) {
          group.confidence = issueConfidence;
        }
      }
    }

    // Convert groups back to array, annotating grouped issues
    const result = [];
    for (const [key, group] of groups) {
      if (group._count > 1) {
        group.message = group.message + ' (' + group._count + ' instances)';
        group.instanceCount = group._count;
        group.instances = group._instances.map(i => ({
          selector: i.selector || i.element,
          message: i.message || i.description
        }));
      }
      delete group._instances;
      delete group._count;
      result.push(group);
    }

    return result;
  }

  async function verifyAuditResults(auditResults, options = {}) {
    const startTime = performance.now();
    const config = {
      removeBelow: options.removeBelow ?? CONFIDENCE_CONFIG.REMOVE_BELOW,
      flagBelow: options.flagBelow ?? CONFIDENCE_CONFIG.FLAG_BELOW,
      includeFalsePositives: options.includeFalsePositives ?? false,
      ...options
    };
    
    clearExceptionLog();
    
    log(`Verifying ${auditResults?.data?.issues?.length || 0} issues...`);
    
    if (!auditResults?.data?.issues) {
      return {
        success: false,
        error: 'No issues to verify',
        data: null
      };
    }
    
    const issues = auditResults.data.issues;
    const verified = [];
    const removed = [];
    const flaggedForReview = [];
    
    for (const issue of issues) {
      const verifiedIssue = verifyIssue(issue);
      const conf = verifiedIssue.verification.confidence;

      if (conf < config.removeBelow) {
        verifiedIssue.verification.tier = CONFIDENCE_TIERS.FILTERED;
        removed.push(verifiedIssue);
      } else {
        if (conf < config.flagBelow) {
          verifiedIssue.verification.tier = CONFIDENCE_TIERS.LOW_CONFIDENCE;
          flaggedForReview.push(verifiedIssue);
        } else if (conf < CONFIDENCE_CONFIG.CONFIRMED_ABOVE) {
          verifiedIssue.verification.tier = CONFIDENCE_TIERS.NEEDS_REVIEW;
        } else {
          verifiedIssue.verification.tier = CONFIDENCE_TIERS.CONFIRMED;
        }
        verified.push(verifiedIssue);
      }
    }
    
    // Sort by confidence (highest first for reporting)
    verified.sort((a, b) => b.verification.confidence - a.verification.confidence);
    
    const exceptionsApplied = getExceptionLog();
    const totalFiltered = exceptionsApplied.reduce((sum, e) => sum + e.count, 0);
    
    // Log exception summary for visibility (MODERATE FIX #2)
    if (exceptionsApplied.length > 0) {
      console.log('%c[a11y-verifier] Exception Summary:', 'color: #9C27B0; font-weight: bold');
      console.log(`  Patterns matched: ${exceptionsApplied.length}`);
      console.log(`  Total issues affected: ${totalFiltered}`);
      for (const exc of exceptionsApplied) {
        console.log(`    ${exc.id}: ${exc.count} issues - "${exc.description}"`);
      }
    }
    
    // Calculate statistics
    const stats = {
      total: issues.length,
      verified: verified.length,
      removed: removed.length,
      flaggedForReview: flaggedForReview.length,
      byConfidence: {
        veryHigh: verified.filter(i => i.verification.confidence >= 90).length,
        high: verified.filter(i => i.verification.confidence >= 75 && i.verification.confidence < 90).length,
        mediumHigh: verified.filter(i => i.verification.confidence >= 60 && i.verification.confidence < 75).length,
        medium: verified.filter(i => i.verification.confidence >= 45 && i.verification.confidence < 60).length,
        lowMedium: verified.filter(i => i.verification.confidence >= 30 && i.verification.confidence < 45).length,
        low: verified.filter(i => i.verification.confidence < 30).length
      },
      averageConfidence: verified.length > 0 
        ? Math.round(verified.reduce((sum, i) => sum + i.verification.confidence, 0) / verified.length)
        : 0,
      exceptionsApplied: exceptionsApplied.length,
      issuesFilteredByExceptions: totalFiltered
    };
    
    const executionTime = Math.round(performance.now() - startTime);
    log(`Verification complete in ${executionTime}ms. ${stats.removed} issues filtered, ${stats.flaggedForReview} flagged for review.`, 'success');
    
    // Build filtered array with reasons for transparency (v12.0.0)
    const filtered = removed.map(r => ({
      ...r,
      filterReason: r.verification.adjustments
        .filter(a => a.value < 0)
        .map(a => a.name).join(', ') || 'below-threshold'
    }));

    return {
      success: true,
      data: {
        issues: verified,
        removed: config.includeFalsePositives ? removed : undefined,
        filtered,  // Always included — transparent record of what was removed and why
        flaggedForReview,
        statistics: stats,
        exceptionsApplied
      },
      meta: {
        timing: executionTime,
        timestamp: new Date().toISOString(),
        operation: 'verifyAuditResults',
        version: VERIFIER_VERSION,
        config
      }
    };
  }

  /**
   * Load learned exceptions from JSON
   *
   * @param {Object|string} exceptionsData - JSON object or string from learned-exceptions.json
   * @returns {Object} - { success: boolean, error?: string, loaded?: number }
   */
  function loadLearnedExceptions(exceptionsData) {
    if (!exceptionsData) {
      const error = 'No exceptions data provided';
      log(error, 'warning');
      return { success: false, error };
    }

    // Parse if string
    if (typeof exceptionsData === 'string') {
      try {
        exceptionsData = JSON.parse(exceptionsData);
      } catch (e) {
        const error = `Failed to parse exceptions JSON: ${e.message}`;
        log(error, 'error');
        return { success: false, error, parseError: e.message };
      }
    }

    // Validate structure
    if (typeof exceptionsData !== 'object') {
      const error = 'Invalid exceptions data format - expected object';
      log(error, 'error');
      return { success: false, error };
    }

    if (!exceptionsData.global) {
      const error = 'Invalid exceptions format - missing "global" property';
      log(error, 'error');
      return { success: false, error };
    }

    if (!Array.isArray(exceptionsData.global)) {
      const error = 'Invalid exceptions format - "global" must be an array';
      log(error, 'error');
      return { success: false, error };
    }

    if (exceptionsData.siteSpecific && typeof exceptionsData.siteSpecific !== 'object') {
      const error = 'Invalid exceptions format - "siteSpecific" must be an object';
      log(error, 'error');
      return { success: false, error };
    }

    if (exceptionsData.sessionAdded && !Array.isArray(exceptionsData.sessionAdded)) {
      const error = 'Invalid exceptions format - "sessionAdded" must be an array';
      log(error, 'error');
      return { success: false, error };
    }

    // Load global exceptions
    if (exceptionsData.global && Array.isArray(exceptionsData.global)) {
      learnedExceptions.global = exceptionsData.global;
      log(`Loaded ${learnedExceptions.global.length} global exceptions`, 'success');
    }
    
    // Load site-specific exceptions
    if (exceptionsData.siteSpecific && typeof exceptionsData.siteSpecific === 'object') {
      learnedExceptions.siteSpecific = exceptionsData.siteSpecific;
      const siteCount = Object.keys(learnedExceptions.siteSpecific).length;
      if (siteCount > 0) {
        log(`Loaded site-specific exceptions for ${siteCount} domain(s)`, 'success');
      }
    }
    
    // Log summary of what was loaded
    const summary = {
      globalCount: learnedExceptions.global.length,
      siteSpecificDomains: Object.keys(learnedExceptions.siteSpecific).length,
      patterns: learnedExceptions.global.map(e => e.id).join(', ')
    };

    log(`Exception patterns: ${summary.patterns || 'none'}`, 'info');

    // Build WCAG-criterion index for faster global exception lookup
    buildExceptionIndex();

    return {
      success: true,
      loaded: summary.globalCount,
      siteSpecificDomains: summary.siteSpecificDomains,
      patterns: summary.patterns
    };
  }

  /**
   * Applies special checks for carousel live regions and position labels
   */
  function verifyCarouselIssue(issue, element) {
    if (!element) return { isCarousel: false };
    
    // Check if this is a carousel-related element
    const carouselSelectors = ['.swiper', '.slick', '.splide', '.carousel', '[class*="carousel"]'];
    const isCarousel = carouselSelectors.some(sel => {
      try { return element.closest(sel); } catch { return false; }
    });
    
    if (!isCarousel) return { isCarousel: false };
    
    const carouselContainer = element.closest('.swiper, .slick, .splide, .carousel, [class*="carousel"]');
    
    // Check for position labels on slides
    const slides = carouselContainer?.querySelectorAll('[role="group"][aria-label*="of"], .swiper-slide[aria-label], .slick-slide[aria-label]') || [];
    const hasPositionLabels = slides.length > 0;
    
    // Check where aria-live is placed
    const liveRegion = carouselContainer?.querySelector('[aria-live]');
    const ariaLiveOnWrapper = carouselContainer?.querySelector('.swiper-wrapper[aria-live], .slick-list[aria-live], .splide__list[aria-live]');
    
    return {
      isCarousel: true,
      hasPositionLabels,
      hasLiveRegion: !!liveRegion,
      liveRegionMisconfigured: !!ariaLiveOnWrapper,
      slideCount: slides.length
    };
  }

  /**
   * Add a new learned exception (session only until persisted)
   */
  function addLearnedException(exception) {
    const newException = {
      id: `se-${Date.now()}`,
      ...exception,
      addedDate: new Date().toISOString().split('T')[0],
      addedBy: 'session',
      verifiedCount: 0
    };
    
    learnedExceptions.sessionAdded.push(newException);
    log(`Added session exception: ${exception.pattern?.description || exception.id}`, 'success');
    
    return newException;
  }

  /**
   * Add a site-specific exception
   */
  function addSiteException(hostname, exception) {
    if (!learnedExceptions.siteSpecific[hostname]) {
      learnedExceptions.siteSpecific[hostname] = [];
    }
    
    const newException = {
      id: `site-${Date.now()}`,
      ...exception,
      addedDate: new Date().toISOString().split('T')[0],
      addedBy: 'session',
      verifiedCount: 0
    };
    
    learnedExceptions.siteSpecific[hostname].push(newException);
    log(`Added site exception for ${hostname}: ${exception.pattern?.description || exception.id}`, 'success');
    
    return newException;
  }

  /**
   * Get current learned exceptions (for export/persistence)
   */
  function getLearnedExceptions() {
    return {
      global: learnedExceptions.global,
      siteSpecific: learnedExceptions.siteSpecific,
      sessionAdded: learnedExceptions.sessionAdded,
      statistics: {
        totalGlobal: learnedExceptions.global.length,
        totalSiteSpecific: Object.values(learnedExceptions.siteSpecific).flat().length,
        totalSession: learnedExceptions.sessionAdded.length
      }
    };
  }

  /**
   * Export exceptions as JSON (for saving to file)
   */
  function exportExceptions() {
    const merged = {
      schemaVersion: SCHEMA_VERSION,
      lastUpdated: new Date().toISOString(),
      global: [
        ...learnedExceptions.global,
        ...learnedExceptions.sessionAdded.filter(e => !e.siteSpecific)
      ],
      siteSpecific: { ...learnedExceptions.siteSpecific },
      statistics: {
        totalGlobal: learnedExceptions.global.length + learnedExceptions.sessionAdded.length,
        totalSiteSpecific: Object.values(learnedExceptions.siteSpecific).flat().length
      }
    };
    
    return JSON.stringify(merged, null, 2);
  }

  /**
   * Mark an issue as false positive and create exception
   */
  function markAsFalsePositive(issue, reason, siteSpecific = false) {
    const hostname = window.location.hostname;
    
    const exception = {
      pattern: {
        type: 'selector-match',
        description: `False positive: ${issue.message?.substring(0, 50)}`,
        selectors: issue.selector ? [issue.selector] : []
      },
      wcag: [issue.wcag],
      reason: reason || 'Marked as false positive during audit review',
      confidence: 90
    };
    
    if (siteSpecific) {
      return addSiteException(hostname, exception);
    } else {
      return addLearnedException(exception);
    }
  }

  // ============================================================================
  // EXPOSE GLOBAL API
  // ============================================================================

  global.verifyAuditResults = verifyAuditResults;
  global.CONFIDENCE_CONFIG = CONFIDENCE_CONFIG;
  global.groupSimilarIssues = groupSimilarIssues;
  global.loadLearnedExceptions = loadLearnedExceptions;
  global.addLearnedException = addLearnedException;
  global.addSiteException = addSiteException;
  global.getLearnedExceptions = getLearnedExceptions;
  global.exportExceptions = exportExceptions;
  global.markAsFalsePositive = markAsFalsePositive;
  global.verifyIssue = verifyIssue;
  global.verifyCarouselIssue = verifyCarouselIssue;
  global.getExceptionLog = getExceptionLog;
  global.clearExceptionLog = clearExceptionLog;
  global.getExceptionsWithStats = getExceptionsWithStats;
  global.getExceptionUsageStats = getExceptionUsageStats;
  global.clearExceptionUsageStats = clearExceptionUsageStats;

  // Also expose via a11yVerifier namespace
  global.a11yVerifier = {
    version: VERIFIER_VERSION,
    verifyAuditResults,
    loadLearnedExceptions,
    addLearnedException,
    addSiteException,
    getLearnedExceptions,
    exportExceptions,
    markAsFalsePositive,
    verifyIssue,
    verifyCarouselIssue,
    getExceptionLog,
    clearExceptionLog,
    getExceptionsWithStats,
    getExceptionUsageStats,
    clearExceptionUsageStats,
    BASE_CONFIDENCE,
    CONFIDENCE_ADJUSTMENTS
  };

  log(`Issue Verifier v${VERIFIER_VERSION} loaded`, 'success');

})(typeof window !== 'undefined' ? window : global);
