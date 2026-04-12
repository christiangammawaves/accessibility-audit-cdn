/**
 * Accessibility Audit Bundle
 *
 * Component registry and orchestration for page component audit modules.
 * Requires shared-helpers.js loaded first. Component implementations
 * are loaded from individual files in components/.
 *
 * Usage:
 *   const results = window.a11yAudit.runFullAudit();
 *   const detected = window.a11yAudit.detectComponents();
 *   const headerResults = window.a11yAudit.components.header();
 *
 * @module audit-bundle
 */

(function(window) {
  'use strict';

  if (!window.a11yHelpers) throw new Error('[audit-bundle] shared-helpers.js must be loaded first — check injection order');
  const helpers = window.a11yHelpers;

  // ==========================================================================
  // COMPONENT DETECTION
  // ==========================================================================

  const componentDetectors = {
    'page-structure': function() { return true; },
    'header': function() { return !!document.querySelector('header, [role="banner"], .header, #header'); },
    'navigation': function() { return !!document.querySelector('nav, [role="navigation"]'); },
    'breadcrumbs': function() { return !!document.querySelector('[class*="breadcrumb"]'); },
    'search': function() { return !!document.querySelector('[role="search"], input[type="search"], [class*="search"]'); },
    'cart': function() { return !!document.querySelector('[class*="cart"], [id*="cart"]'); },
    'hero': function() { return !!document.querySelector('[class*="hero"], [class*="slideshow"]:not([class*="product"])'); },
    'filters': function() { return !!document.querySelector('[class*="filter"], [class*="facet"]'); },
    'product-grid': function() { return !!document.querySelector('[class*="product-grid"], [class*="collection-products"]'); },
    'pagination': function() { return !!document.querySelector('[class*="pagination"]'); },
    // Keep in sync with CONFIG.scope in components/pdp.js
    'pdp': function() { return !!document.querySelector('[class*="product-detail"], [class*="product-page"], [class*="pdp"], #product, #ProductSection, .product-single, [data-product-page], main[class*="product"]'); },
    'tabs': function() { return !!document.querySelector('[role="tablist"], [class*="tabs"]'); },
    'accordions': function() { return !!document.querySelector('[class*="accordion"], details'); },
    'forms': function() { return !!document.querySelector('form, input:not([type="hidden"])'); },
    'footer': function() { return !!document.querySelector('footer, [role="contentinfo"]'); },
    'modals': function() { return !!document.querySelector('[role="dialog"], .modal, [class*="modal"]'); },
    'carousels': function() { return !!document.querySelector('[class*="carousel"], [class*="slider"], [class*="swiper"], [class*="slick"], [class*="flickity"]'); },
    'mega-menu': function() { return !!document.querySelector('[class*="mega-menu"], [class*="megamenu"], nav [aria-haspopup]'); },
    'newsletter-popups': function() { return !!document.querySelector('[class*="newsletter-popup"], [class*="klaviyo"], [class*="subscribe-popup"], [class*="exit-intent"]'); },
    'quick-view': function() { return !!document.querySelector('[class*="quick-view"], [class*="quickview"], [class*="quick-shop"]'); },
    'reviews': function() { return !!document.querySelector('[class*="yotpo"], [class*="jdgm"], [class*="stamped"], [class*="reviews"], #reviews'); },
    'announcements': function() { return !!document.querySelector('[class*="announcement"], [class*="promo-bar"], [class*="flash-sale"], [role="alert"], [role="status"]'); },
    'tooltips': function() { return !!document.querySelector('[role="tooltip"], [data-tooltip], [data-tippy], [title]:not(svg):not(iframe), [class*="tooltip"]'); },
    // L5 fix: Use more specific domain matching to avoid false positives
    'video-player': function() { return !!document.querySelector('video, iframe[src*="youtube.com"], iframe[src*="youtu.be"], iframe[src*="vimeo.com"], [class*="video-player"], [class*="video-container"]'); },
    'collections-nav': function() { return !!document.querySelector('[class*="collection-nav"], [class*="category-nav"], aside nav, [role="tree"], .sidebar nav, [class*="sidebar-nav"]'); },
    'buttons': function() { return !!document.querySelector('button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]'); },
    'color-contrast': function() { return true; },
    'iframes': function() { return !!document.querySelector('iframe, frame, object, embed'); },
    'images-of-text': function() { return !!document.querySelector('img[src], svg text, [style*="background-image"]'); },
    'keyboard-focus': function() { return !!document.querySelector('[tabindex], a[href], button, input, select, textarea'); },
    'language-context': function() { return !!document.querySelector('html[lang], [lang]'); },
    // Keep in sync with CONFIG.scope in components/motion-animation.js
    'motion-animation': function() { return !!document.querySelector('[class*="animate"], [class*="animation"], [class*="transition"], [class*="motion"], [class*="fade"], [class*="slide"], [class*="spin"], [class*="pulse"], [class*="bounce"], [style*="animation"], video, audio, marquee, .carousel, .slider'); },
    'reflow-spacing': function() { return true; },
    'status-messages': function() { return !!document.querySelector('[role="status"], [role="alert"], [aria-live], .toast, .notification'); },
    'wcag22-mobile': function() { return true; },
    'data-tables': function() { return !!document.querySelector('table:not([role="presentation"]):not([role="none"])'); },
    'date-picker': function() { return !!document.querySelector('[type="date"], [data-datepicker], .datepicker, .date-picker, .calendar-widget'); },
    'toast-notifications': function() { return !!document.querySelector('[role="alert"], [role="status"], .toast, .snackbar, [class*="toast"]'); },
    'tree-view': function() { return !!document.querySelector('[role="tree"], [role="treeitem"], .tree-view, .treeview'); },
    'progress-indicators': function() { return !!document.querySelector('[role="progressbar"], progress, .spinner, .loading, [aria-busy="true"]'); },
    'disclosure-widgets': function() { return !!document.querySelector('details, .disclosure, .collapsible, [data-toggle="collapse"]'); },
    'cookie-consent': function() { return !!document.querySelector('[class*="cookie"], [class*="consent"], [id*="cookie"], [data-cookie-consent]'); },
    'wishlist-favorites': function() { return !!document.querySelector('[class*="wishlist"], [class*="favorite"], .yotpo-heart, [class*="swym"], [data-wishlist]'); },
    'sticky-add-to-cart': function() { return !!document.querySelector('sticky-atc, sticky-add-to-cart, [class*="sticky-atc"], [class*="sticky-add-to-cart"]'); },
    // Keep in sync with CONFIG.scope in components/variant-selectors.js
    'variant-selectors': function() { return !!document.querySelector('variant-radios, variant-selects, variant-picker, [class*="variant-picker"], [class*="variant-selector"], [class*="swatch-list"], [class*="option-selector"], [data-variant-picker], .product-form__input[data-option]'); },
    'product-recommendations': function() { return !!document.querySelector('product-recommendations, recently-viewed-products, [class*="recommended"], [class*="you-may-also"], [class*="recently-viewed"]'); },
    'cart-drawer-upsells': function() { return !!document.querySelector('cart-discount, cart-discount-bar-component, [class*="cart-upsell"], [class*="shipping-bar"], [class*="free-shipping"]'); }
  };

  function detectComponents() {
    const detected = {};
    for (const component in componentDetectors) {
      detected[component] = componentDetectors[component]();
    }
    return detected;
  }

  // ==========================================================================
  // COMPONENT REGISTRY — All 47 components loaded from external files
  // ==========================================================================

  function getComponentFn(name) {
    const globalFnName = 'run' + name.split('-').map(function(s) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }).join('') + 'Audit';

    if (typeof window[globalFnName] === 'function') {
      return window[globalFnName];
    }
    return function() {
      return {
        component: name,
        issues: [],
        passed: [],
        manualChecks: [{ wcag: 'N/A', message: 'Component audit not loaded: ' + name }],
        stats: { elementsScanned: 0, issuesFound: 0, passedChecks: 0, manualChecksNeeded: 1, executionTimeMs: 0 }
      };
    };
  }

  const ALL_COMPONENTS = [
    'page-structure', 'header', 'navigation', 'breadcrumbs', 'search',
    'cart', 'hero', 'filters', 'product-grid', 'pagination',
    'pdp', 'tabs', 'accordions', 'forms', 'footer', 'modals',
    'carousels', 'mega-menu', 'newsletter-popups', 'quick-view', 'reviews',
    'announcements', 'tooltips', 'video-player', 'collections-nav',
    'buttons', 'keyboard-focus', 'motion-animation', 'iframes', 'status-messages',
    'images-of-text', 'color-contrast', 'wcag22-mobile', 'reflow-spacing', 'language-context',
    'data-tables', 'date-picker', 'toast-notifications', 'tree-view',
    'progress-indicators', 'disclosure-widgets', 'cookie-consent',
    'wishlist-favorites', 'sticky-add-to-cart', 'variant-selectors',
    'product-recommendations', 'cart-drawer-upsells'
  ];

  const components = {};
  ALL_COMPONENTS.forEach(function(name) {
    Object.defineProperty(components, name, {
      get: function() { return getComponentFn(name); },
      configurable: true,
      enumerable: true
    });
  });

  function refreshComponentRegistry() {
    ALL_COMPONENTS.forEach(function(name) {
      Object.defineProperty(components, name, {
        get: function() { return getComponentFn(name); },
        configurable: true,
        enumerable: true
      });
    });
  }

  window.a11yRefreshComponents = refreshComponentRegistry;

  // ==========================================================================
  // FULL AUDIT ORCHESTRATION (synchronous, bundle-only fallback)
  // The CANONICAL async implementation lives in audit-init.js.
  // This version is only used when audit-init.js is NOT loaded.
  // ==========================================================================

  // Module lists: use shared-helpers as single source of truth, with local fallback
  var BUNDLE_ALWAYS_RUN = (helpers && helpers.ALWAYS_RUN_MODULES)
    || ['page-structure', 'color-contrast', 'reflow-spacing', 'wcag22-mobile', 'images-of-text'];

  // v13.2.0: Removed 'forms' from fallback — too complex for source-only review
  var BUNDLE_SOURCE_REPLACEABLE = (helpers && helpers.SOURCE_REPLACEABLE_MODULES)
    || ['modals'];

  function runFullAudit(options) {
    // Guard: verify injected scripts are still present (page refresh detection)
    if (typeof window.a11yHelpers === 'undefined' || typeof window.A11Y_VERSION === 'undefined') {
      return {
        error: 'SCRIPTS_WIPED',
        message: 'Injected audit scripts are no longer present — the page likely refreshed. Re-inject scripts and re-initialize before running the audit.',
        audit: { timestamp: new Date().toISOString(), url: window.location.href },
        summary: { totalIssues: 0, componentsAudited: [] }
      };
    }

    // Safety net: re-resolve components in case they loaded after initial registration
    refreshComponentRegistry();

    options = options || {};
    var sourceAvailable = options.sourceAvailable || false;
    const startTime = performance.now();

    let componentsToRun = [];

    if (options.components && Array.isArray(options.components)) {
      componentsToRun = options.components.filter(function(c) { return components[c]; });
    } else if (options.includeAll) {
      componentsToRun = Object.keys(components);
    } else {
      const detected = detectComponents();
      componentsToRun = Object.keys(detected).filter(function(k) { return detected[k]; });
    }

    // Ensure always-run modules are included
    var componentsToRunSet = new Set(componentsToRun);
    BUNDLE_ALWAYS_RUN.forEach(function(mod) {
      if (components[mod] && !componentsToRunSet.has(mod)) {
        componentsToRun.unshift(mod);
        componentsToRunSet.add(mod);
      }
    });

    // When source is available, skip source-replaceable modules
    if (sourceAvailable) {
      componentsToRun = componentsToRun.filter(function(c) {
        return BUNDLE_SOURCE_REPLACEABLE.indexOf(c) === -1;
      });
    }

    const componentResults = {};
    let allIssues = [];
    let allPassed = [];
    let allManualChecks = [];
    let totalElementsScanned = 0;

    componentsToRun.forEach(function(componentName) {
      try {
        const result = components[componentName]();
        componentResults[componentName] = result;

        allIssues = allIssues.concat(result.issues.map(function(issue) {
          issue.component = componentName;
          return issue;
        }));

        allPassed = allPassed.concat(result.passed.map(function(pass) {
          pass.component = componentName;
          return pass;
        }));

        allManualChecks = allManualChecks.concat(result.manualChecks.map(function(check) {
          check.component = componentName;
          return check;
        }));

        totalElementsScanned += result.stats.elementsScanned;
      } catch (e) {
        componentResults[componentName] = { error: e.message, component: componentName };
      }
    });

    const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    allIssues.sort(function(a, b) {
      return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
    });

    const wcagSummary = {};
    allIssues.forEach(function(issue) {
      const wcag = issue.wcag;
      if (!wcagSummary[wcag]) {
        wcagSummary[wcag] = { criterion: issue.criterion, count: 0, severities: {} };
      }
      wcagSummary[wcag].count++;
      wcagSummary[wcag].severities[issue.severity] = (wcagSummary[wcag].severities[issue.severity] || 0) + 1;
    });

    const severityCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    allIssues.forEach(function(issue) {
      if (severityCounts[issue.severity] !== undefined) severityCounts[issue.severity]++;
    });

    return {
      audit: {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        title: document.title,
        executionTimeMs: Math.round(performance.now() - startTime)
      },
      summary: {
        componentsAudited: componentsToRun,
        totalIssues: allIssues.length,
        totalPassed: allPassed.length,
        totalManualChecks: allManualChecks.length,
        totalElementsScanned: totalElementsScanned,
        severityCounts: severityCounts
      },
      wcagSummary: wcagSummary,
      issues: allIssues,
      passed: allPassed,
      manualChecks: allManualChecks,
      componentResults: componentResults
    };
  }

  // ==========================================================================
  // EXPOSE API
  // ==========================================================================

  if (!window.a11yAudit) window.a11yAudit = {};
  window.a11yAudit.runFullAudit = runFullAudit;
  window.a11yAudit.detectComponents = detectComponents;
  if (!window.detectComponents) {
    window.detectComponents = detectComponents;
  }
  window.a11yAudit.components = components;
  window.a11yAudit.helpers = helpers;
  window.a11yAudit.refreshComponents = refreshComponentRegistry;
  window.a11yAudit.version = (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown';
  window.a11yAudit.bundleSize = '47 components';

  // Backward compatibility — pre-register global window.run*Audit stubs for every component.
  // These are overridden when the actual component files load and set their own globals.
  // audit-init.js's componentMap depends on these globals existing for on-demand lookups.
  // Call window.a11yAudit.refreshComponents() after lazy-loading components to re-resolve.
  ALL_COMPONENTS.forEach(function(name) {
    const globalFnName = 'run' + name.split('-').map(function(s) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }).join('') + 'Audit';
    // Only set stub wrapper if no real function already exists (e.g. from a pre-loaded component file)
    if (typeof window[globalFnName] !== 'function') {
      window[globalFnName] = function() { return components[name](); };
    }
  });

  var _log = (helpers && helpers.log) ? helpers.log
    : function(level, cat, msg) { console.log('[' + cat + '] ' + msg); };
  _log('INFO', 'a11yAudit', 'Bundle loaded v' + ((typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown') + ' - 47 components registered (all external)');

})(window);
