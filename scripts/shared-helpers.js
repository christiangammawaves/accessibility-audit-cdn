/**
 * Shared Helpers for Accessibility Audits
 * 
 * Common utility functions used across all component audits.
 * Inject this ONCE, then all components can use window.a11yHelpers.
 *
 * @updated 2026-02-05
 */

(function(global) {
  'use strict';

  // Prevent re-initialization
  if (global.a11yHelpers && global.a11yHelpers.version) {
    // Use direct console since log() isn't available yet
    console.log('%c[a11yHelpers] Already loaded v' + global.a11yHelpers.version, 'color: #757575');
    return;
  }

  // Use centralized version if available, otherwise define locally
  const HELPERS_VERSION = (global.A11Y_VERSION) || 'unknown';

  // ==========================================================================
  // SHARED MODULE LISTS (single source of truth for orchestrator + bundle)
  // ==========================================================================

  const ALWAYS_RUN_MODULES = ['page-structure', 'color-contrast', 'reflow-spacing', 'wcag22-mobile', 'images-of-text'];

  // v13.2.0: Removed 'forms' — too complex for source-only review (910+ lines, 20+ regex patterns)
  const SOURCE_REPLACEABLE_MODULES = ['modals'];

  // ==========================================================================
  // PERFORMANCE CACHES
  // ==========================================================================

  const queryCache = new Map();
  const queryCacheTimestamps = new Map();
  const QUERY_CACHE_TTL = 10000;  // Extended: DOM doesn't change during a single audit run
  const QUERY_CACHE_MAX_SIZE = 1000;

  // Unique container ID assignment for cache keys (avoids collision when
  // multiple containers share the same tagName and have no id attribute).
  let containerIdCounter = 0;
  const containerIdMap = new WeakMap();
  function getContainerId(container) {
    if (container === document) return 'doc';
    let id = containerIdMap.get(container);
    if (id === undefined) {
      id = 'c' + (containerIdCounter++);
      containerIdMap.set(container, id);
    }
    return id;
  }

  const VISIBILITY_CACHE_TTL = 10000;  // Extended: matches query cache TTL for audit-duration stability
  const VISIBILITY_CACHE_MAX_SIZE = 2000;
  const ARIA_CACHE_MAX_SIZE = 1000;

  let visibilityCache = new Map();
  let visibilityCacheTimestamps = new Map();
  // Secondary visibility cache keyed by stable selector string for cross-module cache hits.
  // Different component modules querying the same CSS selector get different JS object
  // references, causing cache misses with element-keyed Maps. This string-keyed Map
  // provides a fallback lookup.
  let visibilityCacheBySelector = new Map();
  let ariaHiddenCache = new Map();
  let ariaHiddenCacheTimestamps = new Map();

  function evictOldestEntries(cache, timestamps, maxSize) {
    if (cache.size <= maxSize) return;
    const entries = Array.from(timestamps.entries());
    entries.sort((a, b) => a[1] - b[1]);
    const toRemove = Math.ceil(cache.size * 0.2);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      cache.delete(entries[i][0]);
      timestamps.delete(entries[i][0]);
    }
  }

  function isCacheEntryValid(timestamps, key, ttl) {
    const timestamp = timestamps.get(key);
    if (!timestamp) return false;
    return (Date.now() - timestamp) < ttl;
  }

  // getComputedStyle cache — Map + TTL for SPA resilience (WeakMap entries GC too fast on SPAs)
  const STYLE_CACHE_TTL = 5000;
  const STYLE_CACHE_MAX_SIZE = 1000;
  let styleCache = new Map();
  let styleCacheTimestamps = new Map();

  function getStyle(element) {
    if (styleCache.has(element) && isCacheEntryValid(styleCacheTimestamps, element, STYLE_CACHE_TTL)) {
      cacheStats.styleCacheHits++;
      return styleCache.get(element);
    }
    var style = global.getComputedStyle(element);
    styleCache.set(element, style);
    styleCacheTimestamps.set(element, Date.now());
    evictOldestEntries(styleCache, styleCacheTimestamps, STYLE_CACHE_MAX_SIZE);
    cacheStats.styleCacheMisses++;
    return style;
  }

  function clearStyleCache() {
    styleCache.clear();
    styleCacheTimestamps.clear();
  }

  // queryOnce cache — keyed by CSS selector string, short TTL
  const queryOnceCache = new Map();
  const queryOnceCacheTimestamps = new Map();
  const QUERY_ONCE_TTL = 3000;

  // Selector normalization cache (used by normalizeSelector() for deduplication)
  const normalizeSelectorCache = new Map();
  const NORMALIZE_CACHE_MAX_SIZE = 2000;

  function queryOnce(selector, root) {
    root = root || document;
    var key = (root === document ? '' : 'scoped:') + selector;
    if (queryOnceCacheTimestamps.has(key) && (Date.now() - queryOnceCacheTimestamps.get(key)) < QUERY_ONCE_TTL) {
      cacheStats.queryOnceCacheHits++;
      return queryOnceCache.get(key);
    }
    var result = Array.from(root.querySelectorAll(selector));
    queryOnceCache.set(key, result);
    queryOnceCacheTimestamps.set(key, Date.now());
    cacheStats.queryOnceCacheMisses++;
    return result;
  }

  let cacheStats = {
    queryCacheHits: 0,
    queryCacheMisses: 0,
    visibilityCacheHits: 0,
    visibilityCacheMisses: 0,
    styleCacheHits: 0,
    styleCacheMisses: 0,
    queryOnceCacheHits: 0,
    queryOnceCacheMisses: 0
  };

  // ==========================================================================
  // ==========================================================================

  /**
   * Log levels with consistent styling
   * Usage guidelines:
   * - ERROR: Unrecoverable errors, audit failures, critical exceptions
   * - WARN: Recoverable issues, deprecated usage, potential problems
   * - INFO: Audit progress, significant events, initialization
   * - DEBUG: Detailed diagnostics, cache operations, internal state (off by default)
   */
  const LOG_LEVELS = {
    ERROR: { priority: 0, label: 'ERROR', color: '#D32F2F', enabled: true },
    WARN:  { priority: 1, label: 'WARN',  color: '#F57C00', enabled: true },
    INFO:  { priority: 2, label: 'INFO',  color: '#1976D2', enabled: true },
    DEBUG: { priority: 3, label: 'DEBUG', color: '#757575', enabled: false }
  };

  // Configurable minimum log level (set via a11yHelpers.setLogLevel)
  let currentLogLevel = LOG_LEVELS.INFO.priority;

  /**
   * Standardized logging function
   * @param {string} level - Log level: 'ERROR', 'WARN', 'INFO', 'DEBUG'
   * @param {string} module - Module prefix: 'a11yHelpers', 'verifier', 'audit', etc.
   * @param {string} message - Log message
   * @param {*} [data] - Optional data to log
   */
  function log(level, module, message, data) {
    const logLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    if (!logLevel.enabled || logLevel.priority > currentLogLevel) return;

    const prefix = `[${module}]`;
    const style = `color: ${logLevel.color}; font-weight: ${logLevel.priority < 2 ? 'bold' : 'normal'}`;

    if (data !== undefined) {
      console.log(`%c${prefix} ${message}`, style, data);
    } else {
      console.log(`%c${prefix} ${message}`, style);
    }
  }

  /**
   * Set minimum log level
   * @param {'ERROR'|'WARN'|'INFO'|'DEBUG'} level - Minimum level to display
   */
  function setLogLevel(level) {
    if (LOG_LEVELS[level]) {
      currentLogLevel = LOG_LEVELS[level].priority;
    }
  }

  /**
   * Enable or disable debug logging
   * @param {boolean} enabled - Whether to enable debug logging
   */
  function setDebugMode(enabled) {
    LOG_LEVELS.DEBUG.enabled = !!enabled;
    if (enabled) currentLogLevel = LOG_LEVELS.DEBUG.priority;
  }

  // ==========================================================================
  // END LOGGING SECTION
  // ==========================================================================

  /**
   * Cached query selector that returns array of elements
   * @param {string} selector - CSS selector
   * @param {number} ttl - Cache TTL in ms (default 2000)
   * @param {Element} container - Optional container element (default document)
   * @returns {Array<Element>} Array of matching elements
   */
  function cachedQueryAll(selector, ttl, container) {
    ttl = ttl || QUERY_CACHE_TTL;
    container = container || document;

    // Create cache key from selector + container identity
    const containerKey = getContainerId(container);
    const cacheKey = selector + '|' + containerKey;

    const cached = queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < ttl) {
      cacheStats.queryCacheHits++;
      queryCacheTimestamps.set(cacheKey, Date.now());
      return cached.results;
    }

    cacheStats.queryCacheMisses++;

    if (queryCache.size >= QUERY_CACHE_MAX_SIZE) {
      evictOldestEntries(queryCache, queryCacheTimestamps, QUERY_CACHE_MAX_SIZE * 0.8);
    }

    const results = Array.from(container.querySelectorAll(selector));
    const now = Date.now();
    queryCache.set(cacheKey, {
      results: results,
      timestamp: now
    });
    queryCacheTimestamps.set(cacheKey, now);

    return results;
  }

  /**
   * Clear all caches - call between pages or when DOM changes significantly
   */
  function clearCaches() {
    queryCache.clear();
    queryCacheTimestamps.clear();
    clearVisibilityCaches();
    clearStyleCache();
    normalizeSelectorCache.clear();
    queryOnceCache.clear();
    queryOnceCacheTimestamps.clear();
    cacheStats = { queryCacheHits: 0, queryCacheMisses: 0, visibilityCacheHits: 0, visibilityCacheMisses: 0, styleCacheHits: 0, styleCacheMisses: 0, queryOnceCacheHits: 0, queryOnceCacheMisses: 0 };
    log('DEBUG', 'a11yHelpers', 'All caches cleared');
  }

  /**
   * Clear visibility and aria-hidden caches explicitly
   */
  function clearVisibilityCaches() {
    visibilityCache.clear();
    visibilityCacheBySelector.clear();
    ariaHiddenCache.clear();
    visibilityCacheTimestamps.clear();
    ariaHiddenCacheTimestamps.clear();
  }

  /**
   * Use before testing components that may have changed state (modals, carousels, tabs)
   * @param {string} componentType - Component type: 'modal', 'carousel', 'tabs', 'accordion'
   */
  function clearCachesForComponent(componentType) {
    const selectorPatterns = {
      modal: ['[role="dialog"]', '.modal', '[aria-modal]', '.drawer'],
      carousel: ['.swiper', '.slick', '.splide', '.carousel', '[class*="carousel"]'],
      tabs: ['[role="tablist"]', '[role="tab"]', '[role="tabpanel"]'],
      accordion: ['[role="region"]', '.accordion', '[data-accordion]']
    };
    
    const patterns = selectorPatterns[componentType] || [];
    let clearedCount = 0;
    
    for (const [key] of queryCache) {
      for (const pattern of patterns) {
        if (key.includes(pattern)) {
          queryCache.delete(key);
          clearedCount++;
          break;
        }
      }
    }
    
    // Also clear visibility caches for these components
    clearVisibilityCaches();
    
    if (clearedCount > 0) {
      log('DEBUG', 'a11yHelpers', `Cleared ${clearedCount} cache entries for ${componentType}`);
    }
  }

  /**
   * Invalidate cache for a specific element (useful after state changes)
   * @param {Element} element - Element to invalidate
   * @param {number} maxDepth - Maximum recursion depth (default: 5)
   * @param {number} currentDepth - Current recursion depth (internal)
   */
  function invalidateElement(element, maxDepth, currentDepth) {
    maxDepth = maxDepth || 5;
    currentDepth = currentDepth || 0;

    if (!element) return;

    // Delete from visibility cache and timestamps
    if (visibilityCache.has(element)) {
      visibilityCache.delete(element);
      visibilityCacheTimestamps.delete(element);
    }

    // Delete from aria-hidden cache and timestamps
    if (ariaHiddenCache.has(element)) {
      ariaHiddenCache.delete(element);
      ariaHiddenCacheTimestamps.delete(element);
    }

    if (currentDepth >= maxDepth) return;

    // Also invalidate children (state change may affect descendants)
    if (element.children) {
      for (const child of element.children) {
        invalidateElement(child, maxDepth, currentDepth + 1);
      }
    }
  }

  /**
   * Create an isolated set of caches for parallel phase execution.
   * Each scope contains its own Maps so concurrent phases don't interfere.
   * @returns {Object} Cache scope with all cache Maps
   */
  function createCacheScope() {
    return {
      queryCache: new Map(),
      queryCacheTimestamps: new Map(),
      visibilityCache: new Map(),
      visibilityCacheTimestamps: new Map(),
      visibilityCacheBySelector: new Map(),
      ariaHiddenCache: new Map(),
      ariaHiddenCacheTimestamps: new Map(),
      styleCache: new Map(),
      styleCacheTimestamps: new Map(),
      queryOnceCache: new Map(),
      queryOnceCacheTimestamps: new Map(),
      normalizeSelectorCache: new Map()
    };
  }

  /**
   * Get cache statistics for debugging and monitoring
   */
  function getCacheStats() {
    const totalQueryOps = cacheStats.queryCacheHits + cacheStats.queryCacheMisses;
    const totalVisibilityOps = cacheStats.visibilityCacheHits + cacheStats.visibilityCacheMisses;
    
    return {
      // Query cache stats
      queryCacheSize: queryCache.size,
      queryCacheEntries: Array.from(queryCache.keys()).slice(0, 10),
      queryHits: cacheStats.queryCacheHits,
      queryMisses: cacheStats.queryCacheMisses,
      queryHitRate: totalQueryOps > 0 
        ? (cacheStats.queryCacheHits / totalQueryOps * 100).toFixed(1) + '%'
        : 'N/A',
      
      // Visibility cache stats
      visibilityCacheSize: visibilityCache.size,
      ariaHiddenCacheSize: ariaHiddenCache.size,
      visibilityHits: cacheStats.visibilityCacheHits,
      visibilityMisses: cacheStats.visibilityCacheMisses,
      visibilityHitRate: totalVisibilityOps > 0
        ? (cacheStats.visibilityCacheHits / totalVisibilityOps * 100).toFixed(1) + '%'
        : 'N/A',
      
      // Legacy fields for backwards compatibility
      hits: cacheStats.queryCacheHits,
      misses: cacheStats.queryCacheMisses,
      hitRate: totalQueryOps > 0 
        ? (cacheStats.queryCacheHits / totalQueryOps * 100).toFixed(1) + '%'
        : 'N/A',
      
      // Summary
      summary: {
        totalCachedElements: queryCache.size + visibilityCache.size + ariaHiddenCache.size,
        totalOperations: totalQueryOps + totalVisibilityOps,
        overallHitRate: (totalQueryOps + totalVisibilityOps) > 0
          ? ((cacheStats.queryCacheHits + cacheStats.visibilityCacheHits) / 
             (totalQueryOps + totalVisibilityOps) * 100).toFixed(1) + '%'
          : 'N/A'
      }
    };
  }

  /**
   * Invalidate specific query cache entries by selector pattern
   */
  function invalidateQueryCache(selectorPattern) {
    if (!selectorPattern) {
      queryCache.clear();
      return;
    }
    for (const key of queryCache.keys()) {
      if (key.includes(selectorPattern)) {
        queryCache.delete(key);
      }
    }
  }

  // ==========================================================================
  // ERROR BOUNDARY & SAFE EXECUTION
  // ==========================================================================

  /**
   * Wrap a function with error boundary for consistent error handling
   * 
   * Error return format:
   * {
   *   success: false,
   *   error: {
   *     message: string,
   *     context: string,
   *     timestamp: string,
   *     stack?: string
   *   },
   *   data: null
   * }
   * 
   * @param {Function} fn - Function to wrap
   * @param {string} context - Context name for error reporting
   * @returns {Function} - Wrapped function
   */
  function withErrorBoundary(fn, context = 'unknown') {
    return function(...args) {
      try {
        const result = fn.apply(this, args);
        // Handle promises
        if (result && typeof result.then === 'function') {
          return result.catch(error => {
            log('ERROR', 'a11yHelpers', `Error in ${context}:`, error);
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
          });
        }
        return result;
      } catch (error) {
        log('ERROR', 'a11yHelpers', `Error in ${context}:`, error);
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

  /**
   * Safe query selector that won't throw on invalid selectors
   * 
   * @param {string} selector - CSS selector
   * @param {Element} container - Optional container (default: document)
   * @returns {Array<Element>} - Array of elements (empty on error)
   */
  function safeQueryAll(selector, container = document) {
    try {
      return Array.from(container.querySelectorAll(selector));
    } catch (error) {
      log('WARN', 'a11yHelpers', `Invalid selector: ${selector}`, error.message);
      return [];
    }
  }

  /**
   * Safe query selector for single element
   *
   * @param {string} selector - CSS selector
   * @param {Element} container - Optional container (default: document)
   * @returns {Element|null} - Element or null on error
   */
  function safeQueryOne(selector, container = document) {
    try {
      return container.querySelector(selector);
    } catch (error) {
      log('WARN', 'a11yHelpers', `Invalid selector: ${selector}`, error.message);
      return null;
    }
  }

  // ==========================================================================
  // VISIBILITY & DISPLAY (with memoization)
  // ==========================================================================

  /**
   * Check if element is visible to users (not hidden via CSS or ARIA)
   * Uses Map memoization for performance
   */
  /**
   * Generate a stable string key for an element (for selector-based cache lookup).
   * Used as a secondary cache key when object-reference keys miss across modules.
   */
  function getVisibilityCacheKey(element) {
    const id = element.id ? '#' + element.id : '';
    const tag = element.tagName || 'UNKNOWN';
    const cls = element.className
      ? '.' + String(element.className).split(/\s+/).filter(Boolean).sort().join('.')
      : '';
    const idx = element.parentElement
      ? Array.from(element.parentElement.children).indexOf(element)
      : 0;
    return tag + id + cls + ':' + idx;
  }

  function isVisible(element) {
    if (!element) return false;

    // Primary cache: element object reference
    if (visibilityCache.has(element) && isCacheEntryValid(visibilityCacheTimestamps, element, VISIBILITY_CACHE_TTL)) {
      cacheStats.visibilityCacheHits++;
      return visibilityCache.get(element);
    }

    // Secondary cache: selector-based string key (cross-module hits)
    const selectorKey = getVisibilityCacheKey(element);
    if (visibilityCacheBySelector.has(selectorKey)) {
      const cached = visibilityCacheBySelector.get(selectorKey);
      if ((Date.now() - cached.ts) < VISIBILITY_CACHE_TTL) {
        cacheStats.visibilityCacheHits++;
        // Also populate primary cache for future direct hits
        visibilityCache.set(element, cached.value);
        visibilityCacheTimestamps.set(element, Date.now());
        return cached.value;
      }
    }

    cacheStats.visibilityCacheMisses++;

    evictOldestEntries(visibilityCache, visibilityCacheTimestamps, VISIBILITY_CACHE_MAX_SIZE);

    const style = global.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      visibilityCache.set(element, false);
      visibilityCacheTimestamps.set(element, Date.now());
      visibilityCacheBySelector.set(selectorKey, { value: false, ts: Date.now() });
      return false;
    }
    if (element.getAttribute('aria-hidden') === 'true') {
      visibilityCache.set(element, false);
      visibilityCacheTimestamps.set(element, Date.now());
      visibilityCacheBySelector.set(selectorKey, { value: false, ts: Date.now() });
      return false;
    }
    if (element.hasAttribute('hidden')) {
      visibilityCache.set(element, false);
      visibilityCacheTimestamps.set(element, Date.now());
      visibilityCacheBySelector.set(selectorKey, { value: false, ts: Date.now() });
      return false;
    }
    const rect = element.getBoundingClientRect();
    const result = rect.width > 0 || rect.height > 0;

    visibilityCache.set(element, result);
    visibilityCacheTimestamps.set(element, Date.now());
    visibilityCacheBySelector.set(selectorKey, { value: result, ts: Date.now() });
    return result;
  }

  /**
   * Check if element is hidden from screen readers only
   * Uses Map memoization for performance
   */
  function isAriaHidden(element) {
    if (!element) return false;

    // Check memoization cache first with TTL validation
    if (ariaHiddenCache.has(element) && isCacheEntryValid(ariaHiddenCacheTimestamps, element, VISIBILITY_CACHE_TTL)) {
      return ariaHiddenCache.get(element);
    }

    // Evict old entries if cache is too large
    evictOldestEntries(ariaHiddenCache, ariaHiddenCacheTimestamps, ARIA_CACHE_MAX_SIZE);

    if (element.getAttribute('aria-hidden') === 'true') {
      ariaHiddenCache.set(element, true);
      ariaHiddenCacheTimestamps.set(element, Date.now());
      return true;
    }

    // Check ancestors
    let parent = element.parentElement;
    while (parent) {
      if (parent.getAttribute('aria-hidden') === 'true') {
        ariaHiddenCache.set(element, true);
        ariaHiddenCacheTimestamps.set(element, Date.now());
        return true;
      }
      parent = parent.parentElement;
    }

    ariaHiddenCache.set(element, false);
    ariaHiddenCacheTimestamps.set(element, Date.now());
    return false;
  }

  /**
   * Check if element is visually hidden but accessible to screen readers
   */
  function isScreenReaderOnly(element) {
    if (!element) return false;
    const style = global.getComputedStyle(element);
    const className = typeof element.className === 'string' ? element.className : (element.className?.baseVal || element.getAttribute('class') || '');

    // Check common SR-only class patterns
    if (typeof className === 'string') {
      if (className.match(/\b(sr-only|visually-hidden|screen-reader|a11y-hidden)\b/i)) {
        return true;
      }
    }
    
    // Check CSS hiding patterns (clip-rect technique)
    if (style.position === 'absolute' && 
        (style.clip === 'rect(0px, 0px, 0px, 0px)' || 
         style.clip === 'rect(1px, 1px, 1px, 1px)' ||
         style.clipPath === 'inset(50%)')) {
      return true;
    }
    
    // 1px box technique
    if (style.position === 'absolute' && 
        style.width === '1px' && 
        style.height === '1px' &&
        style.overflow === 'hidden') {
      return true;
    }
    
    return false;
  }

  /**
   * Comprehensive visibility check - CANONICAL implementation
   * Combines all visibility checks in one function
   * 
   * @param {Element} element - Element to check
   * @param {Object} options - Options
   * @param {boolean} options.checkOffscreen - Check if element is off-screen (default: true)
   * @param {boolean} options.checkAncestors - Check ancestor aria-hidden (default: true)
   * @param {boolean} options.allowSrOnly - Allow screen-reader-only elements as "visible" (default: false)
   * @returns {boolean} - True if element is visible
   */
  function isElementVisibleComprehensive(element, options = {}) {
    if (!element) return false;
    
    const checkOffscreen = options.checkOffscreen !== false;
    const checkAncestors = options.checkAncestors !== false;
    const allowSrOnly = options.allowSrOnly === true;
    
    // Use cached result if available (for basic visibility)
    if (visibilityCache.has(element) && !checkOffscreen) {
      cacheStats.visibilityCacheHits++;
      return visibilityCache.get(element);
    }
    
    cacheStats.visibilityCacheMisses++;
    
    const style = global.getComputedStyle(element);
    
    // Check display/visibility/opacity
    if (style.display === 'none') {
      cacheResult(element, false);
      return false;
    }
    if (style.visibility === 'hidden') {
      cacheResult(element, false);
      return false;
    }
    // L1 fix: Use threshold instead of exact comparison for floating-point safety
    if (parseFloat(style.opacity) < 0.01) {
      cacheResult(element, false);
      return false;
    }
    
    // Check hidden attribute
    if (element.hasAttribute('hidden')) {
      cacheResult(element, false);
      return false;
    }
    
    // Check aria-hidden on element
    if (element.getAttribute('aria-hidden') === 'true') {
      cacheResult(element, false);
      return false;
    }
    
    // Check ancestor aria-hidden
    if (checkAncestors) {
      let current = element.parentElement;
      while (current && current !== document.body) {
        if (current.getAttribute('aria-hidden') === 'true') {
          cacheResult(element, false);
          return false;
        }
        current = current.parentElement;
      }
    }
    
    // Check dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      cacheResult(element, false);
      return false;
    }
    
    // Check if off-screen (but allow sr-only which is intentional)
    if (checkOffscreen && !allowSrOnly) {
      const isSrOnly = isScreenReaderOnly(element);
      if (!isSrOnly && (rect.right < 0 || rect.bottom < 0)) {
        cacheResult(element, false);
        return false;
      }
    }
    
    cacheResult(element, true);
    return true;
  }
  
  /**
   * Helper to cache visibility result with timestamp
   */
  function cacheResult(element, result) {
    visibilityCache.set(element, result);
    visibilityCacheTimestamps.set(element, Date.now());
  }

  // ==========================================================================
  // SELECTOR & ELEMENT IDENTIFICATION
  // ==========================================================================

  /**
   * Generate a CSS selector for an element
   */
  function getSelector(element, maxLen) {
    maxLen = maxLen || 150;
    if (!element) return 'unknown';
    if (element.id) return '#' + element.id;
    
    let selector = element.tagName.toLowerCase();
    
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(function(c) { 
        return c && !c.match(/^(js-|is-|has-|active|selected|hover|focus)/); 
      }).slice(0, 2);
      if (classes.length) selector += '.' + classes.join('.');
    }
    
    const role = element.getAttribute('role');
    if (role) selector += '[role="' + role + '"]';
    
    return selector.slice(0, maxLen);
  }

  /**
   * Get unique selector path for element
   */
  function getUniqueSelectorPath(element, maxDepth) {
    maxDepth = maxDepth || 3;
    if (!element) return 'unknown';
    
    const parts = [];
    let current = element;
    let depth = 0;
    
    while (current && current !== document.body && depth < maxDepth) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift('#' + current.id);
        break;
      }
      if (current.className && typeof current.className === 'string') {
        const cls = current.className.trim().split(/\s+/)[0];
        if (cls && !cls.match(/^(js-|is-|has-)/)) {
          part += '.' + cls;
        }
      }
      parts.unshift(part);
      current = current.parentElement;
      depth++;
    }
    
    return parts.join(' > ');
  }

  /**
   * Get HTML snippet of element (opening tag or truncated)
   */
  function getElementSnippet(element, maxLen) {
    maxLen = maxLen || 200;
    if (!element) return '';
    const html = element.outerHTML;
    if (html.length <= maxLen) return html;
    const match = html.match(/^<[^>]+>/);
    return match && match[0].length <= maxLen ? match[0] : html.slice(0, maxLen) + '...';
  }

  // ==========================================================================
  // ACCESSIBLE NAME COMPUTATION
  // ==========================================================================

  /**
   * Dramatically improves performance when same elements are checked multiple times
   */
  const accessibleNameCache = new WeakMap();
  let accessibleNameCacheHits = 0;
  let accessibleNameCacheMisses = 0;

  /**
   * Get accessible name for an element (simplified acc-name computation)
   */
  function getAccessibleName(element) {
    if (!element) return '';

    // Check cache first
    if (accessibleNameCache.has(element)) {
      accessibleNameCacheHits++;
      return accessibleNameCache.get(element);
    }
    accessibleNameCacheMisses++;

    const result = computeAccessibleName(element);
    accessibleNameCache.set(element, result);
    return result;
  }

  function computeAccessibleName(element) {
    if (!element) return '';
    
    // 1. aria-labelledby (highest priority)
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const names = labelledBy.split(/\s+/)
        .map(function(id) { return document.getElementById(id); })
        .filter(function(el) { return el; })
        .map(function(el) { return el.textContent.trim(); });
      if (names.length) return names.join(' ');
    }
    
    // 2. aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    
    // 3. Native labeling for form controls
    const tagName = element.tagName;
    if (tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA') {
      // Check for explicit label
      if (element.id) {
        const label = document.querySelector('label[for="' + element.id + '"]');
        if (label) return label.textContent.trim();
      }
      // Check for wrapping label
      const parentLabel = element.closest('label');
      if (parentLabel) {
        // Get label text excluding the input itself
        const clone = parentLabel.cloneNode(true);
        const inputs = clone.querySelectorAll('input, select, textarea');
        inputs.forEach(function(i) { i.remove(); });
        return clone.textContent.trim();
      }
      // Placeholder as last resort (not ideal but provides name)
      const placeholder = element.getAttribute('placeholder');
      if (placeholder) return placeholder;
    }
    
    // 4. Image alt
    if (tagName === 'IMG') {
      const alt = element.getAttribute('alt');
      if (alt !== null) return alt;
    }
    
    // 5. SVG title
    if (tagName === 'svg' || tagName === 'SVG') {
      const title = element.querySelector('title');
      if (title) return title.textContent.trim();
    }
    
    // 6. Buttons and links with icons
    if (tagName === 'BUTTON' || tagName === 'A' || element.getAttribute('role') === 'button') {
      // Check for img alt inside
      const img = element.querySelector('img[alt]');
      if (img && img.getAttribute('alt')) return img.getAttribute('alt');
      
      // Check for SVG title inside
      const svg = element.querySelector('svg');
      if (svg) {
        const svgTitle = svg.querySelector('title');
        if (svgTitle) return svgTitle.textContent.trim();
      }
    }
    
    // 7. title attribute (lower priority)
    const title = element.getAttribute('title');
    if (title && title.trim()) return title.trim();
    
    // 8. Text content
    const text = element.textContent;
    if (text) return text.trim().slice(0, 100);
    
    return '';
  }

  /**
   * Check if element has any accessible name
   */
  function hasAccessibleName(element) {
    return getAccessibleName(element).length > 0;
  }

  /**
   * Get visible text content from an element
   * Excludes hidden elements and script/style tags
   */
  function getVisibleText(element) {
    if (!element) return '';
    
    // Clone to avoid modifying original
    const clone = element.cloneNode(true);
    
    // Remove hidden elements
    const hiddenEls = clone.querySelectorAll('[aria-hidden="true"], [hidden], script, style, noscript');
    hiddenEls.forEach(function(el) { el.remove(); });
    
    // Get text and normalize whitespace
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  // ==========================================================================
  // FOCUSABILITY
  // ==========================================================================

  /**
   * Get all focusable elements within a container
   */
  function getFocusableElements(container, visibleOnly) {
    if (visibleOnly === undefined) visibleOnly = true;
    container = container || document;
    
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      'audio[controls]',
      'video[controls]',
      'details',
      'summary'
    ].join(', ');
    
    // Use cached query for performance
    let elements = cachedQueryAll(selector, 3000, container);
    
    if (visibleOnly) {
      elements = elements.filter(isVisible);
    }
    
    return elements;
  }

  /**
   * Check if element is focusable
   */
  function isFocusable(element) {
    if (!element) return false;
    
    const tabindex = element.getAttribute('tabindex');
    if (tabindex !== null && parseInt(tabindex, 10) >= 0) return true;
    
    const tagName = element.tagName;
    if (tagName === 'A' && element.hasAttribute('href')) return true;
    if (tagName === 'BUTTON' && !element.disabled) return true;
    if ((tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA') && !element.disabled) return true;
    if (element.getAttribute('contenteditable') === 'true') return true;
    
    return false;
  }

  // ==========================================================================
  // RESULTS HELPERS
  // ==========================================================================

  /**
   * Create a standard results object
   */
  function createResults(componentName, wcagVersion) {
    return {
      component: componentName || 'unknown',
      wcagVersion: wcagVersion || global.A11Y_WCAG_VERSION || '2.2',
      timestamp: new Date().toISOString(),
      issues: [],
      passed: [],
      manualChecks: [],
      stats: {
        elementsScanned: 0,
        issuesFound: 0,
        passedChecks: 0,
        manualChecksNeeded: 0,
        executionTimeMs: 0
      }
    };
  }

  /**
   * Get default impact description for severity level
   */
  function getDefaultImpact(severity) {
    const impacts = {
      critical: 'Users cannot complete essential tasks',
      serious: 'Users face significant barriers',
      moderate: 'Users experience frustration',
      minor: 'Minor inconvenience'
    };
    return impacts[severity] || 'Impact varies';
  }

  /**
   * Add an issue to results
   */
  function addIssue(results, severity, wcag, criterion, message, element, fix, impact) {
    results.issues.push({
      severity: severity,
      wcag: wcag,
      criterion: criterion,
      message: message,
      selector: getSelector(element),
      element: getElementSnippet(element),
      fix: fix,
      impact: impact || getDefaultImpact(severity)
    });
    results.stats.issuesFound++;
  }

  /**
   * Add a passed check to results
   */
  function addPassed(results, wcag, criterion, message, selector) {
    results.passed.push({
      wcag: wcag,
      criterion: criterion,
      message: message,
      selector: selector || ''
    });
    results.stats.passedChecks++;
  }

  /**
   * Add a manual check requirement to results
   */
  function addManualCheck(results, wcag, message, instructions, selector) {
    results.manualChecks.push({
      wcag: wcag,
      message: message,
      instructions: instructions || '',
      selector: selector || ''
    });
    results.stats.manualChecksNeeded++;
  }

  /**
   * Finalize results with timing
   */
  function finalizeResults(results, startTime) {
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  /**
   * Normalize CSS selectors for consistent deduplication
   * Handles variations like :nth-child(1) vs :first-child
   * @param {string} selector - CSS selector to normalize
   * @returns {string} - Normalized selector
   */
  function normalizeSelector(selector) {
    if (!selector) return 'unknown';

    // Check cache first
    if (normalizeSelectorCache.has(selector)) {
      return normalizeSelectorCache.get(selector);
    }

    // Evict oldest entries if cache is too large
    if (normalizeSelectorCache.size > NORMALIZE_CACHE_MAX_SIZE) {
      // L3 fix: Use proportional eviction instead of hardcoded 400
      const keysToDelete = Array.from(normalizeSelectorCache.keys()).slice(0, Math.ceil(normalizeSelectorCache.size * 0.2));
      for (const key of keysToDelete) {
        normalizeSelectorCache.delete(key);
      }
    }

    const result = selector
      // Normalize nth-child(1) to first-child
      .replace(/:nth-child\(1\)/g, ':first-child')
      // Normalize nth-last-child(1) to last-child
      .replace(/:nth-last-child\(1\)/g, ':last-child')
      // Normalize remaining nth-child/nth-of-type indices to wildcards for dedup grouping
      .replace(/:nth-child\(\d+\)/g, ':nth-child(*)')
      .replace(/:nth-last-child\(\d+\)/g, ':nth-last-child(*)')
      .replace(/:nth-of-type\(\d+\)/g, ':nth-of-type(*)')
      .replace(/:nth-last-of-type\(\d+\)/g, ':nth-last-of-type(*)')
      // Remove dynamic IDs (Shopify, React, etc.)
      .replace(/#[a-z]+-\d+/gi, '[id]')
      .replace(/#shopify-section-[^,\s]+/g, '[data-shopify-section]')
      // Normalize react/vue dynamic classes
      .replace(/\.[a-z]+_[a-f0-9]{5,}/gi, '[class]')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();

    normalizeSelectorCache.set(selector, result);
    return result;
  }

  /**
   * Create a deduplication key for an issue
   * @param {Object} issue - Issue object
   * @returns {string} - Unique key for deduplication
   */
  function createDedupeKey(issue) {
    const selector = normalizeSelector(issue.selector || 'unknown');
    const wcag = issue.wcag || 'unknown';
    const message = (issue.message || issue.issue || '').toLowerCase().substring(0, 50);
    return `${selector}|${wcag}|${message}`;
  }

  /**
   * Related WCAG criteria that often flag the same element
   * Used to prevent reporting the same issue under multiple criteria
   */
  const RELATED_WCAG_CRITERIA = {
    '1.1.1': ['4.1.2'],           // Non-text content and Name/Role/Value
    '4.1.2': ['1.1.1', '2.4.4'],  // Name/Role/Value with Non-text and Link purpose
    '2.4.4': ['4.1.2'],           // Link purpose and Name/Role/Value
    '1.3.1': ['4.1.2'],           // Info/Relationships and Name/Role/Value
  };

  /**
   * Deduplicate issues with sophisticated logic
   * - Selector normalization
   * - Related WCAG criteria (same element, different but related criteria)
   * - Full message comparison
   * 
   * @param {Array} issues - Array of issue objects
   * @param {Object} options - Options
   * @param {boolean} options.checkRelatedCriteria - Check for related WCAG duplicates (default: true)
   * @returns {Array} - Deduplicated issues
   */
  function deduplicateIssues(issues, options = {}) {
    const checkRelated = options.checkRelatedCriteria !== false;
    const seen = new Map();
    const seenByClassKey = new Map(); // Secondary dedup by element class/tag

    for (const issue of issues) {
      const normalizedSelector = normalizeSelector(issue.selector || 'unknown');
      const primaryKey = `${normalizedSelector}|${issue.wcag}|${issue.message || issue.issue || ''}`;

      // Secondary key: uses element tag+class instead of full selector path.
      // Catches cases where getSelector() produces different paths for same element class.
      const selectorStr = issue.selector || '';
      const tagMatch = selectorStr.match(/^([a-z][a-z0-9]*)/i);
      const classMatch = selectorStr.match(/\.([^\s>+~:[\]]+)/);
      const secondaryKey = (tagMatch ? tagMatch[1] : 'unknown') + '|' +
        (classMatch ? classMatch[1] : '') + '|' +
        issue.wcag + '|' +
        (issue.message || issue.issue || '').toLowerCase().substring(0, 50);

      // Check if this is a duplicate by primary or secondary key
      const existingByPrimary = seen.get(primaryKey);
      const existingBySecondary = seenByClassKey.get(secondaryKey);
      const existingIssue = existingByPrimary || existingBySecondary;

      if (existingIssue) {
        // Collapse into existing issue: track instance count and original selectors
        existingIssue.instanceCount = (existingIssue.instanceCount || 1) + 1;
        if (issue.selector) {
          if (!existingIssue.affectedSelectors) {
            existingIssue.affectedSelectors = [existingIssue.selector];
          }
          if (!existingIssue.affectedSelectors.includes(issue.selector)) {
            existingIssue.affectedSelectors.push(issue.selector);
          }
        }
      } else {
        let isDuplicate = false;

        // Check for related WCAG criteria duplicates
        if (checkRelated) {
          const related = RELATED_WCAG_CRITERIA[issue.wcag] || [];

          for (const relatedWcag of related) {
            const relatedKeyPrefix = `${normalizedSelector}|${relatedWcag}|`;

            for (const [key, existingRelated] of seen) {
              if (key.startsWith(relatedKeyPrefix) &&
                  existingRelated.severity === issue.severity) {
                // Same element, related criteria, same severity - duplicate
                isDuplicate = true;
                break;
              }
            }
            if (isDuplicate) break;
          }
        }

        if (!isDuplicate) {
          seen.set(primaryKey, issue);
          seenByClassKey.set(secondaryKey, issue);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Group identical issues into consolidated findings with instanceCount.
   * Runs after deduplication to collapse repeated findings (e.g., 8 images
   * with the same class all missing alt) into a single finding with a count.
   *
   * @param {Array} issues - Deduplicated issue array
   * @returns {Array} - Grouped issues with instanceCount and locations
   */
  function groupIdenticalIssues(issues) {
    const groups = new Map();

    for (const issue of issues) {
      // Group key: same WCAG + same message + same element class or tag
      const selectorStr = issue.selector || '';
      const classMatch = selectorStr.match(/\.([^\s>+~:[\]]+)/);
      const tagMatch = selectorStr.match(/^([a-z][a-z0-9]*)/i);
      const elementKey = classMatch ? classMatch[1] : (tagMatch ? tagMatch[1] : 'unknown');
      const groupKey = `${issue.wcag}|${(issue.message || issue.issue || '').toLowerCase().substring(0, 80)}|${elementKey}`;

      if (groups.has(groupKey)) {
        const group = groups.get(groupKey);
        group.count++;
        group.locations.push(issue.selector || 'unknown');
        // Keep the highest severity across the group
        const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
        if ((severityOrder[issue.severity] || 4) < (severityOrder[group.issue.severity] || 4)) {
          group.issue.severity = issue.severity;
        }
      } else {
        groups.set(groupKey, {
          issue: { ...issue },
          count: 1,
          locations: [issue.selector || 'unknown']
        });
      }
    }

    return Array.from(groups.values()).map(group => {
      if (group.count > 1) {
        group.issue.instanceCount = group.count;
        group.issue.locations = group.locations;
      }
      return group.issue;
    });
  }

  // ==========================================================================
  // ARIA HELPERS
  // ==========================================================================

  /**
   * Check if element has valid ARIA role
   */
  function hasValidRole(element, validRoles) {
    const role = element.getAttribute('role');
    if (!role) return false;
    return validRoles.includes(role);
  }

  /**
   * Get ARIA attribute value with fallback
   */
  function getAriaAttr(element, attr, fallback) {
    const value = element.getAttribute('aria-' + attr);
    return value !== null ? value : (fallback || null);
  }

  /**
   * Check if element is expanded (aria-expanded="true")
   */
  function isExpanded(element) {
    return element.getAttribute('aria-expanded') === 'true';
  }

  // ==========================================================================
  // THIRD-PARTY DETECTION
  // ==========================================================================

  /**
   * Uses WeakMap so entries are GC'd with elements
   */
  const thirdPartyCache = new WeakMap();

  const THIRD_PARTY_PATTERNS = [
    'klaviyo', 'yotpo', 'stamped', 'judge', 'loox', 'trustpilot',
    'gorgias', 'intercom', 'zendesk', 'drift', 'hubspot',
    'afterpay', 'klarna', 'affirm', 'sezzle',
    'recaptcha', 'hcaptcha', 'turnstile',
    'facebook', 'twitter', 'instagram', 'pinterest',
    'google-', 'youtube', 'vimeo', 'wistia',
    'cookiebot', 'onetrust', 'termly', 'osano'
  ];
  const THIRD_PARTY_REGEX = new RegExp(THIRD_PARTY_PATTERNS.join('|'), 'i');

  /**
   * Check if element is inside a third-party widget
   */
  function isThirdPartyWidget(element) {
    if (!element) return false;

    // Check cache first
    if (thirdPartyCache.has(element)) {
      return thirdPartyCache.get(element);
    }

    // Track elements we visit for caching
    const visited = [];
    let current = element;
    let result = false;

    while (current && current !== document.body) {
      // Check if this ancestor is already cached
      if (thirdPartyCache.has(current)) {
        result = thirdPartyCache.get(current);
        break;
      }

      visited.push(current);

      const className = (current.className || '').toString();
      const id = current.id || '';
      const src = current.src || '';

      // Use pre-compiled regex for faster matching
      if (THIRD_PARTY_REGEX.test(className) || THIRD_PARTY_REGEX.test(id) || THIRD_PARTY_REGEX.test(src)) {
        result = true;
        break;
      }

      // Check for iframe third-party
      if (current.tagName === 'IFRAME' && current.src) {
        if (THIRD_PARTY_REGEX.test(current.src)) {
          result = true;
          break;
        }
      }

      current = current.parentElement;
    }

    // Heuristic fallback if static patterns didn't match
    if (!result && isLikelyThirdParty(element)) {
      result = true;
    }

    // Cache all visited elements
    for (const el of visited) {
      thirdPartyCache.set(el, result);
    }

    return result;
  }

  // ==========================================================================
  // COLOR UTILITIES
  // ==========================================================================

  /**
   * Parse color string to RGB
   */
  function parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent') return null;
    
    // Handle rgb/rgba
    const rgbMatch = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10),
        a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
      };
    }
    
    // Handle hex
    const hexMatch = colorStr.match(/^#([0-9a-f]{3,8})$/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 1
        };
      } else if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 1
        };
      }
    }
    
    return null;
  }

  /**
   * Calculate relative luminance
   */
  function getLuminance(r, g, b) {
    const sRGB = [r, g, b].map(function(v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  }

  /**
   * Calculate contrast ratio between two colors
   */
  function getContrastRatio(color1, color2) {
    const l1 = getLuminance(color1.r, color1.g, color1.b);
    const l2 = getLuminance(color2.r, color2.g, color2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Walk up the DOM tree to find the first non-transparent background color.
   * Returns a simple {r, g, b} color object, defaulting to white.
   *
   * @param {Element} element - DOM element to start from
   * @returns {{r: number, g: number, b: number}} - Background color
   */
  function getBackgroundColor(element) {
    let current = element;
    while (current && current !== document.documentElement) {
      const style = window.getComputedStyle(current);
      const bg = parseColor(style.backgroundColor);
      if (bg && bg.a >= 0.9) return bg;
      current = current.parentElement;
    }
    return { r: 255, g: 255, b: 255 }; // Default white
  }

  // ==========================================================================
  // ELEMENT DEDUPLICATION & CONTEXT HELPERS
  // ==========================================================================

  /**
   * Filter an array of elements to remove any that are descendants of others
   * in the array. Returns only top-level containers.
   * Fixes Pattern A: wildcard selectors matching parent AND child elements.
   *
   * @param {Element[]} elements - Array of DOM elements from querySelectorAll
   * @returns {Element[]} - Only top-level elements (no nested duplicates)
   */
  function deduplicateElements(elements) {
    if (!elements || elements.length <= 1) return Array.from(elements || []);
    const arr = Array.from(elements);
    return arr.filter(function(el) {
      return !arr.some(function(other) {
        return other !== el && other.contains(el);
      });
    });
  }

  /**
   * Check if an element is exposed to assistive technology.
   * Returns false if the element is inside aria-hidden="true", [hidden],
   * [inert], or a collapsed <details> (without open attribute).
   * Fixes Pattern C: no visibility checks before flagging children.
   *
   * @param {Element} element - DOM element to check
   * @returns {boolean} - true if element is exposed to AT
   */
  function isExposedToAT(element) {
    if (!element) return false;

    // Check the element itself
    if (element.getAttribute('aria-hidden') === 'true') return false;
    if (element.hasAttribute('hidden')) return false;
    if (element.hasAttribute('inert')) return false;

    // Walk up ancestors
    var current = element.parentElement;
    while (current) {
      if (current.getAttribute('aria-hidden') === 'true') return false;
      if (current.hasAttribute('hidden')) return false;
      if (current.hasAttribute('inert')) return false;
      // Collapsed <details> hides all content except <summary>
      if (current.tagName === 'DETAILS' && !current.hasAttribute('open')) {
        // The <summary> is still visible, but other children are not
        if (element.tagName !== 'SUMMARY' && !element.closest('summary')) {
          return false;
        }
      }
      current = current.parentElement;
    }
    return true;
  }

  /**
   * Native HTML attribute to ARIA attribute equivalence map.
   * Keys are CSS selectors, values are the ARIA attribute they replace.
   */
  var NATIVE_ARIA_EQUIVALENTS = {
    'required':       'aria-required',
    'disabled':       'aria-disabled',
    'readonly':       'aria-readonly',
    'checked':        'aria-checked',
    'multiple':       'aria-multiselectable',
    'placeholder':    'aria-placeholder'
  };

  /**
   * Tag-specific native semantic equivalents that don't need ARIA supplements.
   */
  var NATIVE_SEMANTIC_ROLES = {
    'DETAILS':  { implicitState: 'aria-expanded', checkAttr: 'open' },
    'SUMMARY':  { implicitRole: 'button' },
    'NAV':      { implicitRole: 'navigation' },
    'MAIN':     { implicitRole: 'main' },
    'HEADER':   { implicitRole: 'banner' },
    'FOOTER':   { implicitRole: 'contentinfo' },
    'ASIDE':    { implicitRole: 'complementary' },
    'FORM':     { implicitRole: 'form' },
    'SECTION':  { implicitRole: 'region' },
    'ARTICLE':  { implicitRole: 'article' },
    'DIALOG':   { implicitRole: 'dialog' }
  };

  /**
   * Check if a native HTML attribute provides the same semantics as a
   * requested ARIA attribute, making the ARIA attribute unnecessary.
   * Fixes Pattern B: native HTML semantics not recognized.
   *
   * @param {Element} element - DOM element to check
   * @param {string} ariaAttribute - ARIA attribute name (e.g., 'aria-required', 'aria-expanded')
   * @returns {boolean} - true if native semantics already provide the equivalent
   */
  function hasNativeSemanticEquivalent(element, ariaAttribute) {
    if (!element || !ariaAttribute) return false;

    var tagName = element.tagName;

    // Check tag-specific implicit states (e.g., <details> has implicit aria-expanded)
    var tagInfo = NATIVE_SEMANTIC_ROLES[tagName];
    if (tagInfo) {
      if (ariaAttribute === 'role' && tagInfo.implicitRole) return true;
      if (tagInfo.implicitState === ariaAttribute) return true;
    }

    // Check native HTML attribute equivalents (e.g., required -> aria-required)
    // L2 fix: Add hasOwnProperty guard to prevent prototype pollution
    for (var nativeAttr in NATIVE_ARIA_EQUIVALENTS) {
      if (!NATIVE_ARIA_EQUIVALENTS.hasOwnProperty(nativeAttr)) continue;
      if (NATIVE_ARIA_EQUIVALENTS[nativeAttr] === ariaAttribute) {
        if (element.hasAttribute(nativeAttr)) return true;
      }
    }

    // Special case: <input type="checkbox"> has implicit aria-checked
    if (ariaAttribute === 'aria-checked' && tagName === 'INPUT') {
      var type = (element.getAttribute('type') || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') return true;
    }

    return false;
  }

  /**
   * Get contextual information about an element's container hierarchy.
   * Returns the nearest heading, landmark, article, list item, table row,
   * card pattern, etc. Used for context-sensitive checks.
   * Fixes Pattern D: context-insensitive pattern matching.
   *
   * @param {Element} element - DOM element to analyze
   * @returns {Object} - Context object with ancestor information
   */
  function getAncestorContext(element) {
    if (!element) return {};

    var context = {
      nearestHeading: null,
      nearestLandmark: null,
      nearestArticle: null,
      nearestListItem: null,
      nearestTableRow: null,
      nearestCard: null,
      nearestLink: null,
      insideNav: false,
      insideForm: false,
      insideTable: false
    };

    var current = element.parentElement;
    while (current && current !== document.body) {
      var tag = current.tagName;
      var role = current.getAttribute('role');

      // Heading
      if (!context.nearestHeading && /^H[1-6]$/.test(tag)) {
        context.nearestHeading = {
          level: parseInt(tag.charAt(1), 10),
          text: (current.textContent || '').trim().substring(0, 80)
        };
      }

      // Landmark
      if (!context.nearestLandmark) {
        var landmarkRole = role || (NATIVE_SEMANTIC_ROLES[tag] && NATIVE_SEMANTIC_ROLES[tag].implicitRole);
        if (landmarkRole && ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'region', 'form', 'search'].indexOf(landmarkRole) !== -1) {
          context.nearestLandmark = { role: landmarkRole, tag: tag };
        }
      }

      // Article / card pattern
      if (!context.nearestArticle && (tag === 'ARTICLE' || role === 'article')) {
        context.nearestArticle = current;
      }
      if (!context.nearestCard && (
        (current.className && typeof current.className === 'string' && /card|product|item/i.test(current.className)) ||
        tag === 'ARTICLE'
      )) {
        context.nearestCard = current;
      }

      // List item
      if (!context.nearestListItem && (tag === 'LI' || role === 'listitem')) {
        context.nearestListItem = current;
      }

      // Table row
      if (!context.nearestTableRow && (tag === 'TR' || role === 'row')) {
        context.nearestTableRow = current;
      }

      // Link ancestor
      if (!context.nearestLink && (tag === 'A' || role === 'link')) {
        context.nearestLink = current;
      }

      // Flags
      if (tag === 'NAV' || role === 'navigation') context.insideNav = true;
      if (tag === 'FORM' || role === 'form') context.insideForm = true;
      if (tag === 'TABLE' || role === 'table' || role === 'grid') context.insideTable = true;

      current = current.parentElement;
    }

    // Also check for heading siblings (e.g., heading before the element in same container)
    if (!context.nearestHeading && element.parentElement) {
      var siblings = element.parentElement.children;
      for (var i = 0; i < siblings.length; i++) {
        if (/^H[1-6]$/.test(siblings[i].tagName)) {
          context.nearestHeading = {
            level: parseInt(siblings[i].tagName.charAt(1), 10),
            text: (siblings[i].textContent || '').trim().substring(0, 80),
            isSibling: true
          };
          break;
        }
      }
    }

    return context;
  }

  /**
   * Check if an element is inside a modal/dialog container.
   * Returns true if element is inside a role="dialog", <dialog>, or
   * aria-modal="true" container.
   *
   * @param {Element} element - DOM element to check
   * @returns {boolean} - true if inside a modal container
   */
  function isInsideModal(element) {
    if (!element) return false;
    return !!element.closest('[role="dialog"], [role="alertdialog"], dialog, [aria-modal="true"]');
  }

  // ==========================================================================
  // FRAMEWORK DETECTION (v12.4.0)
  // ==========================================================================

  /**
   * Detect which frontend framework(s) the page uses.
   * Non-destructive, read-only DOM checks.
   * @returns {Object} Boolean flags for detected frameworks
   */
  function detectFrameworks() {
    return {
      react: !!(global.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
                document.querySelector('[data-reactroot], [data-reactid]') ||
                document.querySelector('#__next')),
      vue: !!(global.__VUE__ ||
              document.querySelector('[data-v-], [data-vue-app]') ||
              document.querySelector('#__nuxt')),
      svelte: !!document.querySelector('[class*="svelte-"]'),
      angular: !!(global.ng ||
                  document.querySelector('[ng-version], [_nghost], [_ngcontent]')),
      shopify: !!(global.Shopify ||
                  document.querySelector('[data-shopify]') ||
                  document.querySelector('script[src*="cdn.shopify.com"]')),
      wordpress: !!document.querySelector('meta[name="generator"][content*="WordPress"]'),
      webflow: !!document.querySelector('html[data-wf-site]')
    };
  }

  // ==========================================================================
  // THIRD-PARTY HEURISTIC DETECTION (v12.4.0)
  // ==========================================================================

  /**
   * Detect if an element is likely injected by a third-party script.
   * Uses heuristics rather than a static list. Lower confidence (65%) than static matches.
   * @param {Element} element - DOM element to check
   * @returns {boolean} true if likely third-party
   */
  function isLikelyThirdParty(element) {
    if (!element) return false;

    // Inside an iframe (third-party embed)
    if (element.ownerDocument !== document) return true;

    // Inside Shopify app block container
    var container = element.closest('[data-shopify-block-type], [data-app-block]');
    if (container) return true;

    // Common third-party class/ID prefixes
    var thirdPartyPrefixes = [
      'klaviyo', 'rebuy', 'judgeme', 'jdgm', 'gorgias', 'tidio', 'recharge',
      'yotpo', 'stamped', 'loox', 'afterpay', 'klarna', 'sezzle', 'affirm',
      'omnisend', 'privy', 'justuno', 'wisepops', 'hotjar', 'intercom',
      'drift', 'crisp', 'tawk', 'zendesk', 'freshdesk', 'hubspot'
    ];
    var classes = (typeof element.className === 'string' ? element.className : (element.className?.baseVal || element.getAttribute('class') || '')).toLowerCase();
    var id = (element.id || '').toLowerCase();
    if (thirdPartyPrefixes.some(function(prefix) { return classes.indexOf(prefix) !== -1 || id.indexOf(prefix) !== -1; })) {
      return true;
    }

    // Very high z-index + inline styles = likely overlay widget
    var style = element.getAttribute('style');
    if (style && style.indexOf('z-index') !== -1 && parseInt(element.style.zIndex) > 9000) {
      return true;
    }

    return false;
  }

  // ==========================================================================
  // SHADOW DOM AWARENESS (v12.4.0)
  // ==========================================================================

  /**
   * Query selector that traverses into open shadow DOMs.
   * Closed shadow DOMs are intentionally inaccessible.
   * WARNING: Expensive — traverses every element. Only use when shadow DOM is expected.
   * @param {string} selector - CSS selector
   * @param {Node} [root] - Root node (defaults to document)
   * @returns {Element[]} Matching elements including those inside open shadow roots
   */
  function querySelectorAllDeep(selector, root) {
    root = root || document;
    var results = Array.from(root.querySelectorAll(selector));

    var allElements = root.querySelectorAll('*');
    for (var i = 0; i < allElements.length; i++) {
      if (allElements[i].shadowRoot) {
        var shadowResults = querySelectorAllDeep(selector, allElements[i].shadowRoot);
        results = results.concat(shadowResults);
      }
    }

    return results;
  }

  // ==========================================================================
  // EXPOSE API
  // ==========================================================================

  global.a11yHelpers = {
    version: HELPERS_VERSION,
    
    // Performance caches (enhanced with component-targeted clearing)
    getStyle: getStyle,
    queryOnce: queryOnce,
    cachedQueryAll: cachedQueryAll,
    clearCaches: clearCaches,
    clearStyleCache: clearStyleCache,
    clearVisibilityCaches: clearVisibilityCaches,
    clearCachesForComponent: clearCachesForComponent,
    createCacheScope: createCacheScope,
    invalidateElement: invalidateElement,
    getCacheStats: getCacheStats,
    invalidateQueryCache: invalidateQueryCache,
    
    // Error boundaries
    withErrorBoundary: withErrorBoundary,
    safeQueryAll: safeQueryAll,
    safeQueryOne: safeQueryOne,
    
    isVisible: isVisible,
    isAriaHidden: isAriaHidden,
    isScreenReaderOnly: isScreenReaderOnly,
    isElementVisibleComprehensive: isElementVisibleComprehensive,
    
    // Selectors
    getSelector: getSelector,
    getUniqueSelectorPath: getUniqueSelectorPath,
    getElementSnippet: getElementSnippet,
    
    // Accessible names
    getAccessibleName: getAccessibleName,
    hasAccessibleName: hasAccessibleName,
    getVisibleText: getVisibleText,
    
    // Focusability
    getFocusableElements: getFocusableElements,
    isFocusable: isFocusable,
    
    // Results
    createResults: createResults,
    getDefaultImpact: getDefaultImpact,
    addIssue: addIssue,
    addPassed: addPassed,
    addManualCheck: addManualCheck,
    finalizeResults: finalizeResults,
    
    normalizeSelector: normalizeSelector,
    createDedupeKey: createDedupeKey,
    deduplicateIssues: deduplicateIssues,
    groupIdenticalIssues: groupIdenticalIssues,

    // ARIA
    hasValidRole: hasValidRole,
    getAriaAttr: getAriaAttr,
    isExpanded: isExpanded,

    // Third-party
    isThirdPartyWidget: isThirdPartyWidget,

    // Element deduplication & context (v11.0.0)
    deduplicateElements: deduplicateElements,
    isExposedToAT: isExposedToAT,
    hasNativeSemanticEquivalent: hasNativeSemanticEquivalent,
    getAncestorContext: getAncestorContext,
    isInsideModal: isInsideModal,

    // Color
    parseColor: parseColor,
    getLuminance: getLuminance,
    getContrastRatio: getContrastRatio,
    getBackgroundColor: getBackgroundColor,

    // Module lists (shared single source of truth)
    ALWAYS_RUN_MODULES: ALWAYS_RUN_MODULES,
    SOURCE_REPLACEABLE_MODULES: SOURCE_REPLACEABLE_MODULES,

    // Detection utilities (v12.4.0)
    detectFrameworks: detectFrameworks,
    isLikelyThirdParty: isLikelyThirdParty,
    querySelectorAllDeep: querySelectorAllDeep,

    log: log,
    setLogLevel: setLogLevel,
    setDebugMode: setDebugMode,
    LOG_LEVELS: LOG_LEVELS
  };

  log('INFO', 'a11yHelpers', `Shared helpers loaded v${HELPERS_VERSION}`);

})(typeof window !== 'undefined' ? window : global);
