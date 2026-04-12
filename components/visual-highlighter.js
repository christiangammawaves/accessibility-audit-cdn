/**
 * Visual Highlighter for Accessibility Issues
 *
 * Injects visual highlights onto elements with accessibility issues,
 * enabling screenshot capture for documentation and client reports.
 *
 * Features:
 * - Color-coded highlighting by issue type
 * - Configurable styles (outline color, width, offset)
 * - Issue type legend generation
 * - Highlight by CSS selector, element, or audit results
 * - Single issue type highlighting with descriptive labels
 * - Fix type classification (templated vs unique) via DOM heuristic
 * - Sequential issue type iteration with async screenshot callbacks
 * - Representative element mode for templated issues
 * - Per-element screenshot support for unique issues
 * - Clear/reset functionality
 * - Screenshot-ready styling
 *
 * Usage (in Claude conversation with Playwriter):
 *   1. Navigate to page with page.goto(url)
 *   2. Inject this script with page.addScriptTag({ path })
 *   3. Call highlightA11yIssues() or highlightIssueType('img-no-alt')
 *   4. Take screenshot with screenshotWithAccessibilityLabels() or page.screenshot()
 *   5. Optionally call clearA11yHighlights() to reset
 *
 * @updated 2026-03-04
 */

(function(global) {
  'use strict';

  const SCRIPT_VERSION = global.A11Y_VERSION || 'unknown';
  const STYLE_ID = 'a11y-visual-highlighter-styles';

  /**
   * Default color palette for issue types
   * Colors chosen for visibility and differentiation
   */
  const DEFAULT_COLORS = {
    // Critical issues - Red family
    'img-no-alt': '#DC2626',           // Red-600
    'button-no-name': '#DC2626',       // Red-600
    'link-no-name': '#DC2626',         // Red-600
    'input-no-label': '#DC2626',       // Red-600
    'empty-heading': '#DC2626',        // Red-600

    // Serious issues - Orange family
    'svg-no-name': '#EA580C',          // Orange-600
    'missing-landmark': '#EA580C',     // Orange-600
    'contrast-fail': '#EA580C',        // Orange-600

    // Moderate issues - Yellow/Amber family
    'heading-hierarchy': '#D97706',    // Amber-600
    'generic-interactive': '#D97706',  // Amber-600
    'focus-order': '#D97706',          // Amber-600

    // Minor issues - Blue family
    'decorative-not-hidden': '#2563EB', // Blue-600
    'redundant-alt': '#2563EB',         // Blue-600

    // Manual review - Purple family
    'manual-review': '#7C3AED',         // Violet-600

    // Default fallback
    'default': '#DC2626'                // Red-600
  };

  /**
   * Issue type descriptions for legend
   */
  const ISSUE_DESCRIPTIONS = {
    'img-no-alt': 'Image missing alt text',
    'svg-no-name': 'SVG missing accessible name',
    'button-no-name': 'Button missing accessible name',
    'link-no-name': 'Link missing accessible name',
    'input-no-label': 'Form input missing label',
    'empty-heading': 'Heading with no text content',
    'missing-landmark': 'Missing required landmark',
    'contrast-fail': 'Insufficient color contrast',
    'heading-hierarchy': 'Heading hierarchy issue',
    'generic-interactive': 'Clickable element without proper role',
    'focus-order': 'Focus order issue',
    'decorative-not-hidden': 'Decorative element exposed to AT',
    'redundant-alt': 'Redundant or unclear alt text',
    'manual-review': 'Requires manual verification'
  };

  /**
   * Issue configuration for common accessibility problems
   * Each entry defines a selector, filter, label, and fix type classification
   *
   * Fix types:
   * - 'templated': All instances get the same programmatic fix. Only need 1 representative screenshot + count.
   * - 'unique': Each instance needs individual human attention. Per-element screenshots are valuable.
   * - 'auto': Auto-detect at scan time using DOM similarity heuristic.
   */
  const ISSUE_CONFIG = {
    'img-no-alt': {
      selector: 'img:not([alt]), img[alt=""]',
      filter: (el) => {
        // Skip tiny images (likely decorative)
        if (el.offsetWidth < 20 || el.offsetHeight < 20) return false;
        // Skip hidden images
        if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
        // Skip images with role="presentation" or aria-hidden
        if (el.getAttribute('role') === 'presentation') return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        return true;
      },
      label: 'Missing alt',
      fixType: 'unique'  // Each image needs unique human-written alt text
    },

    'svg-no-name': {
      selector: 'svg',
      filter: (el) => {
        // Skip if has accessible name
        if (el.getAttribute('aria-label')) return false;
        if (el.getAttribute('aria-labelledby')) return false;
        if (el.querySelector('title')) return false;
        // Skip if decorative
        if (el.getAttribute('role') === 'presentation') return false;
        if (el.getAttribute('role') === 'none') return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        // Skip tiny SVGs (likely decorative icons)
        if (el.offsetWidth < 16 || el.offsetHeight < 16) return false;
        return true;
      },
      label: 'SVG no name',
      fixType: 'auto'  // Depends on context — auto-detect via DOM similarity
    },

    'button-no-name': {
      selector: 'button, [role="button"]',
      filter: (el) => {
        // Check text content
        const text = el.textContent?.trim();
        if (text) return false;
        // Check aria-label
        if (el.getAttribute('aria-label')) return false;
        // Check aria-labelledby
        if (el.getAttribute('aria-labelledby')) return false;
        // Check for img with alt inside
        const img = el.querySelector('img[alt]:not([alt=""])');
        if (img) return false;
        // Check for svg with title inside
        const svg = el.querySelector('svg title');
        if (svg) return false;
        return true;
      },
      label: 'No button name',
      fixType: 'auto'
    },

    'link-no-name': {
      selector: 'a[href]',
      filter: (el) => {
        // Check text content
        const text = el.textContent?.trim();
        if (text) return false;
        // Check aria-label
        if (el.getAttribute('aria-label')) return false;
        // Check aria-labelledby
        if (el.getAttribute('aria-labelledby')) return false;
        // Check for img with alt inside
        const img = el.querySelector('img[alt]:not([alt=""])');
        if (img) return false;
        return true;
      },
      label: 'No link name',
      fixType: 'auto'  // Could be templated (nav links) or unique (content links)
    },

    'input-no-label': {
      selector: 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea',
      filter: (el) => {
        // Check aria-label
        if (el.getAttribute('aria-label')) return false;
        // Check aria-labelledby
        if (el.getAttribute('aria-labelledby')) return false;
        // Check for associated label
        const id = el.id;
        if (id && document.querySelector(`label[for="${id}"]`)) return false;
        // Check if wrapped in label
        if (el.closest('label')) return false;
        // Check title attribute (valid but not preferred)
        if (el.getAttribute('title')) return false;
        return true;
      },
      label: 'No label',
      fixType: 'auto'
    },

    'empty-heading': {
      selector: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
      filter: (el) => {
        const text = el.textContent?.trim();
        if (text) return false;
        // Check for images with alt
        const img = el.querySelector('img[alt]:not([alt=""])');
        if (img) return false;
        return true;
      },
      label: 'Empty heading',
      fixType: 'unique'  // Each heading needs unique content
    },

    'generic-interactive': {
      selector: 'div[onclick], span[onclick], div[tabindex="0"], span[tabindex="0"]',
      filter: (el) => {
        // Skip if has a proper role
        const role = el.getAttribute('role');
        if (role === 'button' || role === 'link' || role === 'menuitem') return false;
        // Check cursor style
        const cursor = getComputedStyle(el).cursor;
        if (cursor !== 'pointer') return false;
        return true;
      },
      label: 'Generic interactive',
      fixType: 'auto'
    }
  };

  /**
   * WCAG 2.2 criterion mapping for issue types
   */
  const WCAG_MAPPING = {
    'img-no-alt': { criterion: '1.1.1', name: 'Non-text Content' },
    'svg-no-name': { criterion: '1.1.1', name: 'Non-text Content' },
    'button-no-name': { criterion: '4.1.2', name: 'Name, Role, Value' },
    'link-no-name': { criterion: '2.4.4', name: 'Link Purpose (In Context)' },
    'input-no-label': { criterion: '1.3.1', name: 'Info and Relationships' },
    'empty-heading': { criterion: '2.4.6', name: 'Headings and Labels' },
    'generic-interactive': { criterion: '4.1.2', name: 'Name, Role, Value' },
    'heading-hierarchy': { criterion: '1.3.1', name: 'Info and Relationships' },
    'contrast-fail': { criterion: '1.4.3', name: 'Contrast (Minimum)' },
    'missing-landmark': { criterion: '1.3.1', name: 'Info and Relationships' },
    'focus-order': { criterion: '2.4.3', name: 'Focus Order' },
    'decorative-not-hidden': { criterion: '1.1.1', name: 'Non-text Content' },
    'redundant-alt': { criterion: '1.1.1', name: 'Non-text Content' },
    'manual-review': { criterion: 'Various', name: 'Manual Verification Required' }
  };

  /**
   * Track highlighted elements for cleanup
   */
  let highlightedElements = new Set();
  let issueStats = {};

  /**
   * Inject highlight styles into the page
   */
  function injectStyles() {
    // Remove existing styles if present
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .a11y-highlight {
        outline-style: solid !important;
        outline-offset: 2px !important;
      }

      .a11y-highlight-pulse {
        animation: a11y-pulse 1.5s ease-in-out infinite !important;
      }

      @keyframes a11y-pulse {
        0%, 100% { outline-offset: 2px; }
        50% { outline-offset: 4px; }
      }

      .a11y-highlight-label {
        position: absolute !important;
        top: -24px !important;
        left: 0 !important;
        background: var(--a11y-color, #DC2626) !important;
        color: white !important;
        padding: 2px 8px !important;
        font-size: 11px !important;
        font-weight: bold !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        border-radius: 3px !important;
        z-index: 999999 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
      }

      .a11y-highlight-label.a11y-label-descriptive {
        font-size: 13px !important;
        padding: 4px 10px !important;
        top: -28px !important;
        max-width: 300px !important;
        border: 1px solid rgba(255,255,255,0.3) !important;
        letter-spacing: 0.2px !important;
      }

      .a11y-element-focus {
        outline-width: 6px !important;
        outline-style: solid !important;
        box-shadow: 0 0 0 4px rgba(0,0,0,0.3), 0 0 20px rgba(255,0,0,0.4) !important;
        position: relative;
        z-index: 10001 !important;
      }

      .a11y-highlight-dimmed {
        opacity: 0.7 !important;
      }

      .a11y-legend {
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        background: white !important;
        border: 2px solid #333 !important;
        border-radius: 8px !important;
        padding: 12px 16px !important;
        z-index: 999999 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 12px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        max-width: 280px !important;
      }

      .a11y-legend-title {
        font-weight: bold !important;
        font-size: 14px !important;
        margin-bottom: 8px !important;
        color: #333 !important;
        border-bottom: 1px solid #ddd !important;
        padding-bottom: 6px !important;
      }

      .a11y-legend-item {
        display: flex !important;
        align-items: center !important;
        margin: 6px 0 !important;
        color: #333 !important;
      }

      .a11y-legend-color {
        width: 16px !important;
        height: 16px !important;
        border-radius: 3px !important;
        margin-right: 8px !important;
        flex-shrink: 0 !important;
      }

      .a11y-legend-count {
        margin-left: auto !important;
        background: #f0f0f0 !important;
        padding: 1px 6px !important;
        border-radius: 10px !important;
        font-size: 11px !important;
        color: #666 !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Highlight a single element
   *
   * @param {HTMLElement} element - Element to highlight
   * @param {Object} options - Highlight options
   * @param {string} options.color - Outline color
   * @param {string} options.width - Outline width (default: 4px)
   * @param {string} options.type - Issue type for tracking
   * @param {boolean} options.showLabel - Show floating label
   * @param {string} options.labelText - Custom label text
   * @param {boolean} options.pulse - Animate the highlight
   */
  function highlightElement(element, options = {}) {
    const {
      color = DEFAULT_COLORS.default,
      width = '4px',
      type = 'default',
      showLabel = false,
      labelText = null,
      pulse = false
    } = options;

    // Apply highlight
    element.classList.add('a11y-highlight');
    if (pulse) element.classList.add('a11y-highlight-pulse');

    element.style.setProperty('--a11y-color', color);
    element.style.outlineColor = color;
    element.style.outlineWidth = width;

    // Track for cleanup
    highlightedElements.add(element);

    // Track stats
    issueStats[type] = (issueStats[type] || 0) + 1;

    // Add label if requested
    if (showLabel && labelText) {
      // Ensure element can contain absolute positioned children
      const computedPosition = getComputedStyle(element).position;
      if (computedPosition === 'static') {
        element.style.position = 'relative';
        element.dataset.a11yPositionAdded = 'true';
      }

      const label = document.createElement('span');
      label.className = 'a11y-highlight-label';
      label.textContent = labelText;
      label.style.setProperty('--a11y-color', color);
      label.style.background = color;
      label.dataset.a11yLabel = 'true';
      element.appendChild(label);
    }

    return element;
  }

  /**
   * Highlight elements by CSS selector
   *
   * @param {string} selector - CSS selector
   * @param {Object} options - Highlight options
   * @returns {number} Number of elements highlighted
   */
  function highlightBySelector(selector, options = {}) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => highlightElement(el, options));
    return elements.length;
  }

  /**
   * Highlight common accessibility issues automatically
   * Detects and highlights elements with known a11y problems
   *
   * @param {Object} options - Configuration options
   * @param {boolean} options.showLabels - Show labels on elements (default: false)
   * @param {boolean} options.pulse - Animate highlights (default: false)
   * @param {boolean} options.showLegend - Show color legend (default: true)
   * @returns {Object} Statistics of issues found
   */
  function highlightCommonA11yIssues(options = {}) {
    const {
      showLabels = false,
      pulse = false,
      showLegend = true
    } = options;

    // Ensure styles are injected
    injectStyles();

    // Reset stats
    issueStats = {};

    // Process each issue type
    for (const [type, config] of Object.entries(ISSUE_CONFIG)) {
      const elements = document.querySelectorAll(config.selector);

      elements.forEach(el => {
        // Apply filter
        if (config.filter && !config.filter(el)) return;

        highlightElement(el, {
          color: DEFAULT_COLORS[type] || DEFAULT_COLORS.default,
          type: type,
          showLabel: showLabels,
          labelText: config.label,
          pulse: pulse
        });
      });
    }

    // Show legend if requested
    if (showLegend && Object.keys(issueStats).length > 0) {
      showColorLegend();
    }

    return {
      total: Object.values(issueStats).reduce((a, b) => a + b, 0),
      byType: { ...issueStats },
      colors: DEFAULT_COLORS
    };
  }

  /**
   * Highlight elements from audit results
   *
   * @param {Array} issues - Array of issue objects from audit
   * @param {Object} options - Highlight options
   * @returns {Object} Statistics
   */
  function highlightFromAuditResults(issues, options = {}) {
    const {
      showLabels = false,
      pulse = false,
      showLegend = true
    } = options;

    injectStyles();
    issueStats = {};

    for (const issue of issues) {
      // Try to find element by selector
      if (issue.selector) {
        try {
          const elements = document.querySelectorAll(issue.selector);
          elements.forEach(el => {
            const issueType = mapWcagToIssueType(issue.wcag) || 'default';
            highlightElement(el, {
              color: DEFAULT_COLORS[issueType] || DEFAULT_COLORS.default,
              type: issueType,
              showLabel: showLabels,
              labelText: issue.wcag || 'Issue',
              pulse: pulse
            });
          });
        } catch (e) {
          console.warn(`[a11y-highlighter] Invalid selector: ${issue.selector}`);
        }
      }
    }

    if (showLegend && Object.keys(issueStats).length > 0) {
      showColorLegend();
    }

    return {
      total: Object.values(issueStats).reduce((a, b) => a + b, 0),
      byType: { ...issueStats }
    };
  }

  /**
   * Map WCAG criterion to issue type
   */
  function mapWcagToIssueType(wcag) {
    const mapping = {
      '1.1.1': 'img-no-alt',
      '1.3.1': 'heading-hierarchy',
      '1.4.3': 'contrast-fail',
      '2.4.4': 'link-no-name',
      '2.4.6': 'empty-heading',
      '4.1.2': 'button-no-name'
    };
    return mapping[wcag];
  }

  /**
   * Show color legend overlay (all issues mode)
   */
  function showColorLegend() {
    // Remove existing legend
    const existing = document.querySelector('.a11y-legend');
    if (existing) existing.remove();

    const legend = document.createElement('div');
    legend.className = 'a11y-legend';

    const title = document.createElement('div');
    title.className = 'a11y-legend-title';
    title.textContent = 'Accessibility Issues Found';
    legend.appendChild(title);

    for (const [type, count] of Object.entries(issueStats)) {
      if (count > 0) {
        const color = DEFAULT_COLORS[type] || DEFAULT_COLORS.default;
        const description = ISSUE_DESCRIPTIONS[type] || type;
        const item = document.createElement('div');
        item.className = 'a11y-legend-item';
        const colorSpan = document.createElement('span');
        colorSpan.className = 'a11y-legend-color';
        colorSpan.style.background = color;
        item.appendChild(colorSpan);
        const descSpan = document.createElement('span');
        descSpan.textContent = description;
        item.appendChild(descSpan);
        const countSpan = document.createElement('span');
        countSpan.className = 'a11y-legend-count';
        countSpan.textContent = String(count);
        item.appendChild(countSpan);
        legend.appendChild(item);
      }
    }

    const total = Object.values(issueStats).reduce((a, b) => a + b, 0);
    const totalItem = document.createElement('div');
    totalItem.className = 'a11y-legend-item';
    totalItem.style.cssText = 'border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px; font-weight: bold;';
    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'Total Issues';
    totalItem.appendChild(totalLabel);
    const totalCountSpan = document.createElement('span');
    totalCountSpan.className = 'a11y-legend-count';
    totalCountSpan.textContent = String(total);
    totalItem.appendChild(totalCountSpan);
    legend.appendChild(totalItem);
    document.body.appendChild(legend);

    return legend;
  }

  /**
   * Show legend overlay for a single issue type
   *
   * @param {string} issueType - Issue type key from ISSUE_CONFIG
   * @param {number} count - Number of instances found
   * @param {Object} options - Legend options
   * @param {string} options.fixType - Resolved fix type ('templated' or 'unique')
   * @param {number} options.representativeCount - For templated: how many are shown
   * @param {number} options.totalCount - For templated: total instances
   * @returns {HTMLElement} The legend element
   */
  function showSingleIssueLegend(issueType, count, options = {}) {
    const { fixType, representativeCount, totalCount } = options;

    // Remove existing legend
    const existing = document.querySelector('.a11y-legend');
    if (existing) existing.remove();

    const legend = document.createElement('div');
    legend.className = 'a11y-legend';

    const color = DEFAULT_COLORS[issueType] || DEFAULT_COLORS.default;
    const description = ISSUE_DESCRIPTIONS[issueType] || issueType;
    const wcag = WCAG_MAPPING[issueType];

    const titleEl = document.createElement('div');
    titleEl.className = 'a11y-legend-title';
    titleEl.textContent = 'Issue: ' + description;
    legend.appendChild(titleEl);

    // WCAG criterion subtitle
    if (wcag) {
      const wcagEl = document.createElement('div');
      wcagEl.style.cssText = 'font-size: 11px; color: #666; margin-bottom: 8px;';
      wcagEl.textContent = 'WCAG 2.2 \u2014 ' + wcag.criterion + ' ' + wcag.name;
      legend.appendChild(wcagEl);
    }

    // Color swatch + count
    const item = document.createElement('div');
    item.className = 'a11y-legend-item';
    const colorSpan = document.createElement('span');
    colorSpan.className = 'a11y-legend-color';
    colorSpan.style.background = color;
    item.appendChild(colorSpan);
    const countLabel = document.createElement('span');
    countLabel.textContent = count + ' instance' + (count !== 1 ? 's' : '') + ' found';
    item.appendChild(countLabel);
    legend.appendChild(item);

    // Quick scan for total issues across all types for context
    let totalAllIssues = 0;
    for (const [type, config] of Object.entries(ISSUE_CONFIG)) {
      const els = document.querySelectorAll(config.selector);
      els.forEach(el => {
        if (!config.filter || config.filter(el)) totalAllIssues++;
      });
    }
    if (totalAllIssues > count) {
      const contextEl = document.createElement('div');
      contextEl.style.cssText = 'font-size: 11px; color: #999; margin-top: 4px;';
      contextEl.textContent = count + ' of ' + totalAllIssues + ' total issues on this page';
      legend.appendChild(contextEl);
    }

    // Templated fix type badge
    if (fixType === 'templated' && representativeCount && totalCount) {
      const badgeEl = document.createElement('div');
      badgeEl.style.cssText = 'font-size: 11px; color: #059669; margin-top: 6px; padding: 4px 8px; background: #ecfdf5; border-radius: 4px;';
      badgeEl.textContent = 'Showing ' + representativeCount + ' of ' + totalCount + ' instances \u2014 all require the same fix';
      legend.appendChild(badgeEl);
    }
    document.body.appendChild(legend);

    return legend;
  }

  /**
   * Hide the color legend
   */
  function hideLegend() {
    const legend = document.querySelector('.a11y-legend');
    if (legend) legend.remove();
  }

  /**
   * Clear all highlights from the page
   */
  function clearHighlights() {
    // Remove highlight classes and styles
    highlightedElements.forEach(el => {
      el.classList.remove('a11y-highlight', 'a11y-highlight-pulse', 'a11y-element-focus', 'a11y-highlight-dimmed');
      el.style.outlineColor = '';
      el.style.outlineWidth = '';
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.boxShadow = '';
      el.style.borderRadius = '';
      el.style.opacity = '';
      el.style.removeProperty('--a11y-color');

      // Remove added position
      if (el.dataset.a11yPositionAdded) {
        el.style.position = '';
        delete el.dataset.a11yPositionAdded;
      }

      // Remove annotation data attribute
      delete el.dataset.a11yAnnotated;

      // Remove labels (including descriptive and annotation pills)
      const labels = el.querySelectorAll('[data-a11y-label]');
      labels.forEach(label => label.remove());
    });

    // Also clean up any annotation pills and element-focus classes on non-tracked elements
    document.querySelectorAll('.a11y-annotation-pill').forEach(el => el.remove());
    document.querySelectorAll('[data-a11y-annotated]').forEach(el => {
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.boxShadow = '';
      el.style.borderRadius = '';
      delete el.dataset.a11yAnnotated;
    });
    document.querySelectorAll('.a11y-element-focus').forEach(el => {
      el.classList.remove('a11y-element-focus');
    });

    highlightedElements.clear();
    issueStats = {};

    // Remove styles
    const styles = document.getElementById(STYLE_ID);
    if (styles) styles.remove();

    // Remove legend
    hideLegend();

    return { cleared: true };
  }

  /**
   * Get current highlight statistics
   */
  function getStats() {
    return {
      highlighted: highlightedElements.size,
      byType: { ...issueStats },
      total: Object.values(issueStats).reduce((a, b) => a + b, 0)
    };
  }

  /**
   * Quick highlight with custom selector and color
   *
   * @param {string} selector - CSS selector
   * @param {string} color - Color (name or hex)
   * @param {string} type - Type label for stats
   */
  function quickHighlight(selector, color = 'red', type = 'custom') {
    injectStyles();

    const colorMap = {
      red: '#DC2626',
      orange: '#EA580C',
      yellow: '#D97706',
      green: '#16A34A',
      blue: '#2563EB',
      purple: '#7C3AED',
      pink: '#DB2777'
    };

    const resolvedColor = colorMap[color] || color;
    return highlightBySelector(selector, { color: resolvedColor, type });
  }

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  /**
   * Truncate a string to a maximum length
   *
   * @param {string} str - String to truncate
   * @param {number} maxLen - Maximum length
   * @returns {string} Truncated string
   */
  function truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
  }

  /**
   * Get a human-readable identifier for an element
   *
   * @param {HTMLElement} element - Element to identify
   * @returns {string} Human-readable identifier
   */
  function getElementIdentifier(element) {
    // 1. alt attribute (for images)
    if (element.alt) return truncate(element.alt, 50);
    // 2. aria-label
    if (element.getAttribute('aria-label')) return truncate(element.getAttribute('aria-label'), 50);
    // 3. text content
    const text = element.textContent?.trim();
    if (text && text.length > 0) return truncate(text, 50);
    // 4. src filename (for images/media)
    if (element.src) {
      const filename = element.src.split('/').pop().split('?')[0];
      return truncate(filename, 50);
    }
    // 5. id
    if (element.id) return `#${element.id}`;
    // 6. class-based selector
    if (element.className && typeof element.className === 'string') {
      return `${element.tagName.toLowerCase()}.${element.className.split(' ')[0]}`;
    }
    // 7. Fallback: tag + nth-of-type
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === element.tagName);
      const index = siblings.indexOf(element) + 1;
      return `${element.tagName.toLowerCase()}:nth-of-type(${index})`;
    }
    return element.tagName.toLowerCase();
  }

  /**
   * Classify fix type using DOM similarity heuristic
   * Resolves 'auto' to 'templated' or 'unique' at scan time
   *
   * @param {HTMLElement[]} elements - Matched elements
   * @param {string} configFixType - Fix type from ISSUE_CONFIG ('templated', 'unique', or 'auto')
   * @returns {string} Resolved fix type: 'templated' or 'unique' (never 'auto')
   */
  function classifyFixType(elements, configFixType) {
    // If explicitly set to 'templated' or 'unique', return as-is
    if (configFixType === 'templated' || configFixType === 'unique') {
      return configFixType;
    }

    // Auto-detect based on DOM similarity
    if (elements.length <= 3) {
      return 'unique'; // Few enough that individual screenshots are fine
    }

    // Heuristic 1: Check if elements share a common parent
    const parents = new Set(elements.map(el => el.parentElement));
    const sharedParentRatio = 1 - (parents.size / elements.length);
    // If >60% share the same parent, likely a repeated pattern
    if (sharedParentRatio > 0.6) return 'templated';

    // Heuristic 2: Check if elements share the same tag + class pattern
    const signatures = elements.map(el => {
      const classes = Array.from(el.classList).sort().join('.');
      return `${el.tagName}.${classes}`;
    });
    const uniqueSignatures = new Set(signatures);
    const signatureRatio = uniqueSignatures.size / signatures.length;
    // If >70% of elements have the same tag+class signature, it's a template
    if (signatureRatio < 0.3) return 'templated';

    // Heuristic 3: Check if elements are structurally similar
    const structures = elements.map(el => ({
      tag: el.tagName,
      childCount: el.children.length,
      attrCount: el.attributes.length
    }));
    const structureKeys = structures.map(s => `${s.tag}-${s.childCount}-${s.attrCount}`);
    const uniqueStructures = new Set(structureKeys);
    if (uniqueStructures.size / structureKeys.length < 0.3) return 'templated';

    // Default to unique if no clear pattern
    return 'unique';
  }

  /**
   * Highlight only representative elements for templated issue types
   *
   * @param {HTMLElement[]} elements - All matched elements
   * @param {Object} config - Issue config entry from ISSUE_CONFIG
   * @param {number} maxCount - Maximum representative elements to highlight fully
   * @returns {Object} Result with representative and total counts
   */
  function highlightRepresentativeElements(elements, config, maxCount = 3) {
    const issueType = Object.keys(ISSUE_CONFIG).find(k => ISSUE_CONFIG[k] === config);
    const color = DEFAULT_COLORS[issueType] || DEFAULT_COLORS.default;

    // Pick representative elements: first, middle, and last
    const representatives = [];
    if (elements.length <= maxCount) {
      representatives.push(...elements);
    } else {
      representatives.push(elements[0]); // first
      representatives.push(elements[Math.floor(elements.length / 2)]); // middle
      representatives.push(elements[elements.length - 1]); // last
    }

    // Highlight representatives with labels
    representatives.forEach((el, i) => {
      highlightElement(el, {
        color,
        type: issueType,
        showLabel: true,
        labelText: `${ISSUE_DESCRIPTIONS[issueType]} (${i + 1} of ${elements.length})`,
        pulse: false
      });

      // Add descriptive label class
      const label = el.querySelector('[data-a11y-label]');
      if (label) label.classList.add('a11y-label-descriptive');
    });

    // Dim (but lightly outline) the remaining elements so they're visible but not prominent
    elements.forEach(el => {
      if (!representatives.includes(el)) {
        el.style.outline = `2px dashed ${color}40`; // 25% opacity dashed outline
        el.classList.add('a11y-highlight-dimmed');
        highlightedElements.add(el);
      }
    });

    return {
      representativeCount: representatives.length,
      totalCount: elements.length,
      representatives: representatives.map(el => ({
        tagName: el.tagName.toLowerCase(),
        identifier: getElementIdentifier(el),
        boundingRect: (() => {
          const r = el.getBoundingClientRect();
          return { top: r.top, left: r.left, width: r.width, height: r.height };
        })()
      }))
    };
  }

  /**
   * Prepare an element for a focused screenshot
   * Thin wrapper around annotateElement() — scrolls element into view and adds prominent focus highlight.
   * For highlight + pill label, use annotateElement() directly.
   *
   * @param {HTMLElement} element - Element to prepare
   * @returns {Object|null} Element info including bounding rect and identifier
   */
  function prepareElementForScreenshot(element) {
    return annotateElement(element, null);
  }

  /**
   * Restore state after an element screenshot
   * Removes focused highlight class and annotation pills from all elements
   */
  function restoreAfterElementScreenshot() {
    clearAnnotations();
    document.querySelectorAll('.a11y-element-focus').forEach(el => {
      el.classList.remove('a11y-element-focus');
    });
  }

  // ==========================================================================
  // SINGLE ISSUE TYPE & SEQUENTIAL FUNCTIONS
  // ==========================================================================

  /**
   * Highlight only elements matching a single issue type
   *
   * @param {string} issueType - Key from ISSUE_CONFIG (e.g., 'img-no-alt')
   * @param {Object} options - Configuration options
   * @param {boolean} options.showLabels - Show labels on elements (default: true)
   * @param {boolean} options.pulse - Animate highlights (default: false)
   * @param {boolean} options.showLegend - Show legend overlay (default: true)
   * @param {string} options.labelStyle - 'descriptive' for longer labels (default: 'descriptive')
   * @returns {Object} Result with issueType, description, count, color, fixType, elements
   */
  function highlightSingleIssueType(issueType, options = {}) {
    const {
      showLabels = true,
      pulse = false,
      showLegend = true,
      labelStyle = 'descriptive'
    } = options;

    // Clear existing highlights first
    clearHighlights();
    injectStyles();

    // Validate issue type
    const config = ISSUE_CONFIG[issueType];
    if (!config) {
      const validTypes = Object.keys(ISSUE_CONFIG).join(', ');
      throw new Error(`Unknown issue type: "${issueType}". Valid types: ${validTypes}`);
    }

    // Query and filter elements
    const allElements = document.querySelectorAll(config.selector);
    const matchedElements = [];
    allElements.forEach(el => {
      if (!config.filter || config.filter(el)) {
        matchedElements.push(el);
      }
    });

    // Resolve fix type
    const fixType = classifyFixType(matchedElements, config.fixType);

    // Highlight matched elements
    const color = DEFAULT_COLORS[issueType] || DEFAULT_COLORS.default;
    const description = ISSUE_DESCRIPTIONS[issueType] || issueType;

    matchedElements.forEach(el => {
      const labelText = labelStyle === 'descriptive' ? description : config.label;
      highlightElement(el, {
        color,
        type: issueType,
        showLabel: showLabels,
        labelText,
        pulse
      });

      // Add descriptive class to labels
      if (showLabels && labelStyle === 'descriptive') {
        const label = el.querySelector('[data-a11y-label]');
        if (label) label.classList.add('a11y-label-descriptive');
      }
    });

    // Show single-issue legend
    if (showLegend && matchedElements.length > 0) {
      showSingleIssueLegend(issueType, matchedElements.length, { fixType });
    }

    return {
      issueType,
      description,
      count: matchedElements.length,
      color,
      fixType,
      elements: matchedElements.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName.toLowerCase(),
          identifier: getElementIdentifier(el),
          dimensions: { width: rect.width, height: rect.height },
          boundingRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        };
      })
    };
  }

  /**
   * Get all available issue types with their configuration
   *
   * @returns {Array} Array of issue type descriptor objects
   */
  function getAvailableIssueTypes() {
    return Object.entries(ISSUE_CONFIG).map(([key, config]) => ({
      key,
      label: config.label,
      description: ISSUE_DESCRIPTIONS[key],
      color: DEFAULT_COLORS[key],
      selector: config.selector,
      fixType: config.fixType
    }));
  }

  /**
   * Iterate through each issue type with screenshot callbacks
   * Adapts screenshot strategy based on fix type classification
   *
   * @param {Object} options - Configuration options
   * @param {Function} options.onAfterHighlight - Async callback fired after each issue type is highlighted
   * @param {Function} options.onAfterElementHighlight - Async callback fired for each element (unique fixType only)
   * @param {boolean} options.showLabels - Show labels (default: true)
   * @param {boolean} options.includeOverview - Include all-issues overview first (default: true)
   * @param {number} options.maxRepresentativeElements - For templated issues, how many to show (default: 3)
   * @returns {Object} Summary with overview and issueTypes array
   */
  async function highlightIssueTypesSequentially(options = {}) {
    const {
      onAfterHighlight,
      onAfterElementHighlight,
      showLabels = true,
      includeOverview = true,
      maxRepresentativeElements = 3
    } = options;

    const issueTypesResult = [];

    // Step 1: Overview screenshot
    if (includeOverview) {
      clearHighlights();
      const overviewStats = highlightCommonA11yIssues({ showLabels: false, showLegend: true });
      if (onAfterHighlight) {
        await onAfterHighlight({ type: 'overview', stats: overviewStats });
      }
    }

    // Step 2: Per-issue-type screenshots
    for (const [issueType, config] of Object.entries(ISSUE_CONFIG)) {
      // Query and filter elements for this type
      const allElements = document.querySelectorAll(config.selector);
      const matchedElements = [];
      allElements.forEach(el => {
        if (!config.filter || config.filter(el)) {
          matchedElements.push(el);
        }
      });

      // Skip types with no issues
      if (matchedElements.length === 0) continue;

      // Resolve fix type
      const fixType = classifyFixType(matchedElements, config.fixType);
      const color = DEFAULT_COLORS[issueType] || DEFAULT_COLORS.default;
      const description = ISSUE_DESCRIPTIONS[issueType] || issueType;

      // Build element info array (for all elements regardless of mode)
      const allElementInfo = matchedElements.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName.toLowerCase(),
          identifier: getElementIdentifier(el),
          dimensions: { width: rect.width, height: rect.height },
          boundingRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        };
      });

      if (fixType === 'templated') {
        // Templated: highlight only representatives
        clearHighlights();
        injectStyles();
        issueStats = {};

        const repResult = highlightRepresentativeElements(matchedElements, config, maxRepresentativeElements);

        // Show legend with templated badge
        showSingleIssueLegend(issueType, matchedElements.length, {
          fixType: 'templated',
          representativeCount: repResult.representativeCount,
          totalCount: repResult.totalCount
        });

        // Fire callback once for the representative group
        if (onAfterHighlight) {
          await onAfterHighlight({
            type: issueType,
            description,
            count: matchedElements.length,
            color,
            fixType: 'templated',
            representativeCount: repResult.representativeCount
          });
        }
        // Do NOT fire onAfterElementHighlight for templated types

        issueTypesResult.push({
          key: issueType,
          description,
          count: matchedElements.length,
          color,
          fixType: 'templated',
          screenshotMode: 'representative',
          elements: allElementInfo
        });

      } else {
        // Unique: highlight all elements, then per-element screenshots
        const result = highlightSingleIssueType(issueType, { showLabels, showLegend: true });

        // Fire callback for the type overview
        if (onAfterHighlight) {
          await onAfterHighlight({
            type: issueType,
            description,
            count: matchedElements.length,
            color,
            fixType: 'unique',
            elements: allElementInfo
          });
        }

        // Per-element screenshots with annotation pills
        if (onAfterElementHighlight) {
          for (let i = 0; i < matchedElements.length; i++) {
            const el = matchedElements[i];
            const elementInfo = annotateElement(el, description);
            if (elementInfo) {
              await onAfterElementHighlight({
                type: issueType,
                element: elementInfo,
                index: i,
                total: matchedElements.length
              });
            }
            restoreAfterElementScreenshot();
          }
        }

        issueTypesResult.push({
          key: issueType,
          description,
          count: matchedElements.length,
          color,
          fixType: 'unique',
          screenshotMode: 'per-element',
          elements: allElementInfo
        });
      }
    }

    // Step 3: Clean up
    clearHighlights();

    return {
      overview: { total: issueTypesResult.reduce((sum, t) => sum + t.count, 0) },
      issueTypes: issueTypesResult
    };
  }

  // ==========================================================================
  // PER-ELEMENT ANNOTATION FUNCTIONS
  // ==========================================================================

  /**
   * Annotate a single element with a red highlight box and pill label
   * For per-element Teamwork ticket screenshots. Superset of prepareElementForScreenshot().
   *
   * @param {string|HTMLElement} selectorOrElement - CSS selector or DOM element
   * @param {string|null} label - Pill label text (e.g., 'focus missing', 'alt missing'). Null for highlight-only.
   * @param {Object} [options] - Configuration options
   * @param {boolean} [options.scroll=true] - Scroll element into viewport center
   * @param {string} [options.borderColor='#FF4D4D'] - Highlight border color
   * @returns {Object|null} Element info with boundingRect, identifier, tagName, src, annotationElement — or null on error
   */
  function annotateElement(selectorOrElement, label, options = {}) {
    const {
      scroll = true,
      borderColor = '#FF4D4D'
    } = options;

    // Resolve element
    let element;
    if (typeof selectorOrElement === 'string') {
      element = document.querySelector(selectorOrElement);
      if (!element) {
        console.warn(`[annotateElement] No element found for selector: ${selectorOrElement}`);
        return null;
      }
    } else {
      element = selectorOrElement;
    }

    // Validate element is visible
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      console.warn(`[annotateElement] Element is not visible: ${getElementIdentifier(element)}`);
      return null;
    }
    if (element.offsetWidth === 0 && element.offsetHeight === 0) {
      console.warn(`[annotateElement] Element has zero dimensions: ${getElementIdentifier(element)}`);
      return null;
    }

    // Remove any existing annotation on this element (idempotent)
    const existingAnnotation = element.querySelector('.a11y-annotation-pill');
    if (existingAnnotation) existingAnnotation.remove();
    const existingBox = element.dataset.a11yAnnotated;
    if (existingBox) {
      element.style.outline = '';
      element.style.outlineOffset = '';
      element.style.boxShadow = '';
      element.style.borderRadius = '';
    }

    // Scroll into view
    if (scroll) {
      element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    }

    // Apply highlight box (red rounded-rect per visual spec)
    element.style.outline = `3px solid ${borderColor}`;
    element.style.outlineOffset = '5px';
    element.style.borderRadius = '8px';
    element.style.boxShadow = `0 0 0 5px rgba(255, 77, 77, 0.12)`;
    element.classList.add('a11y-element-focus');
    element.dataset.a11yAnnotated = 'true';

    // Track for cleanup
    highlightedElements.add(element);

    let annotationElement = null;

    // Add pill label if provided
    if (label) {
      // Ensure element can contain absolute positioned children
      const computedPosition = getComputedStyle(element).position;
      if (computedPosition === 'static') {
        element.style.position = 'relative';
        element.dataset.a11yPositionAdded = 'true';
      }

      annotationElement = document.createElement('div');
      annotationElement.className = 'a11y-annotation-pill';
      annotationElement.textContent = label;
      annotationElement.setAttribute('data-a11y-label', 'true');

      // Pill inline styles matching visual spec
      Object.assign(annotationElement.style, {
        position: 'absolute',
        background: borderColor,
        color: 'white',
        fontWeight: '600',
        fontSize: '13px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        lineHeight: '24px',
        height: '24px',
        padding: '0 10px',
        borderRadius: '12px',
        whiteSpace: 'nowrap',
        zIndex: '10002',
        pointerEvents: 'none',
        boxSizing: 'border-box'
      });

      element.appendChild(annotationElement);

      // Position the pill: try right, then left, then top-right fallback
      const elRect = element.getBoundingClientRect();
      const pillRect = annotationElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Default: to the right, vertically centered
      const topOffset = Math.round((elRect.height - 24) / 2);
      annotationElement.style.top = `${Math.max(0, topOffset)}px`;
      annotationElement.style.left = `calc(100% + 10px)`;
      annotationElement.style.right = 'auto';

      // Check if pill overflows right edge
      const rightEdge = elRect.right + 10 + pillRect.width;
      if (rightEdge > viewportWidth) {
        // Try left side
        annotationElement.style.left = 'auto';
        annotationElement.style.right = `calc(100% + 10px)`;

        // Check if left side also overflows
        const leftEdge = elRect.left - 10 - pillRect.width;
        if (leftEdge < 0) {
          // Fallback: top-right corner overlapping
          annotationElement.style.top = '-28px';
          annotationElement.style.right = '0';
          annotationElement.style.left = 'auto';
        }
      }
    }

    // Return element info
    const rect = element.getBoundingClientRect();
    return {
      boundingRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      identifier: getElementIdentifier(element),
      tagName: element.tagName.toLowerCase(),
      src: element.tagName === 'IMG' ? element.src : null,
      annotationElement
    };
  }

  /**
   * Annotate a group of elements with individual highlight boxes and one shared pill label
   * For templated issues where multiple elements share the same problem.
   *
   * @param {string|HTMLElement[]} selectorOrElements - CSS selector or array of DOM elements
   * @param {string} label - Shared pill label text (e.g., 'aria-label missing')
   * @param {Object} [options] - Configuration options
   * @param {boolean} [options.scroll=true] - Scroll first element into viewport
   * @param {string} [options.borderColor='#FF4D4D'] - Highlight border color
   * @returns {Object|null} Group info with elements array, count, and annotationElement — or null on error
   */
  function annotateGroup(selectorOrElements, label, options = {}) {
    // Resolve elements
    let elements;
    if (typeof selectorOrElements === 'string') {
      elements = Array.from(document.querySelectorAll(selectorOrElements));
      if (elements.length === 0) {
        console.warn(`[annotateGroup] No elements found for selector: ${selectorOrElements}`);
        return null;
      }
    } else {
      elements = Array.from(selectorOrElements);
    }

    // Annotate first element with pill label
    const firstResult = annotateElement(elements[0], label, options);
    if (!firstResult) return null;

    // Annotate remaining elements without pill labels (highlight box only)
    const results = [firstResult];
    for (let i = 1; i < elements.length; i++) {
      const result = annotateElement(elements[i], null, { ...options, scroll: false });
      if (result) results.push(result);
    }

    return {
      elements: results,
      count: results.length,
      annotationElement: firstResult.annotationElement
    };
  }

  /**
   * Clear only annotation pills without clearing overview highlights
   * Useful for re-annotating without losing the full-page highlight state.
   */
  function clearAnnotations() {
    // Remove pill labels
    document.querySelectorAll('.a11y-annotation-pill').forEach(el => el.remove());

    // Remove annotation highlight styles and data attributes
    document.querySelectorAll('[data-a11y-annotated]').forEach(el => {
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.boxShadow = '';
      el.style.borderRadius = '';
      el.classList.remove('a11y-element-focus');
      delete el.dataset.a11yAnnotated;

      if (el.dataset.a11yPositionAdded) {
        el.style.position = '';
        delete el.dataset.a11yPositionAdded;
      }
    });

    return { cleared: true };
  }

  // ==========================================================================
  // EXPORTS
  // ==========================================================================

  global.visualHighlighter = {
    version: SCRIPT_VERSION,

    // Core functions
    highlightElement,
    highlightBySelector,
    highlightCommonA11yIssues,
    highlightFromAuditResults,

    // Quick helpers
    quickHighlight,

    // Per-element annotation (for Teamwork ticket screenshots)
    annotateElement,
    annotateGroup,
    clearAnnotations,

    // Single issue type & sequential
    highlightSingleIssueType,
    getAvailableIssueTypes,
    highlightIssueTypesSequentially,
    showSingleIssueLegend,
    classifyFixType,
    prepareElementForScreenshot,
    restoreAfterElementScreenshot,
    getElementIdentifier,
    highlightRepresentativeElements,

    // Legend
    showColorLegend,
    hideLegend,

    // Cleanup
    clearHighlights,

    // Stats
    getStats,

    // Configuration (now accessible)
    colors: DEFAULT_COLORS,
    descriptions: ISSUE_DESCRIPTIONS,
    issueConfig: ISSUE_CONFIG,
    wcagMapping: WCAG_MAPPING
  };

  // Convenient global shortcuts
  global.highlightA11yIssues = highlightCommonA11yIssues;
  global.clearA11yHighlights = clearHighlights;
  global.quickHighlight = quickHighlight;

  // Single issue type shortcuts
  global.highlightIssueType = highlightSingleIssueType;
  global.getIssueTypes = getAvailableIssueTypes;
  global.highlightIssuesSequentially = highlightIssueTypesSequentially;

  // Annotation shortcuts
  global.annotateElement = annotateElement;
  global.annotateGroup = annotateGroup;
  global.clearAnnotations = clearAnnotations;

  console.log([
    `Visual Highlighter v${SCRIPT_VERSION} loaded. Available commands:`,
    '  highlightA11yIssues()            \u2014 Highlight all issues (overview mode)',
    '  highlightIssueType("img-no-alt") \u2014 Highlight a single issue type',
    '  getIssueTypes()                  \u2014 List all available issue types + fix classifications',
    '  highlightIssuesSequentially()    \u2014 Iterate each type with screenshot callbacks',
    '  annotateElement(sel, "label")    \u2014 Annotate element with highlight box + pill label',
    '  annotateGroup(sel, "label")      \u2014 Annotate group with shared pill label',
    '  clearAnnotations()               \u2014 Remove annotation pills only',
    '  clearA11yHighlights()            \u2014 Remove all highlights',
    '  quickHighlight("selector")       \u2014 Quick custom highlight'
  ].join('\n'));

})(typeof window !== 'undefined' ? window : global);
