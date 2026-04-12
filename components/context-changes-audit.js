/**
 * Context Changes Accessibility Audit Script
 * Part of modular accessibility-audit-unified system
 * 
 * WCAG Success Criteria Covered:
 * - 3.2.1 On Focus (Level A)
 * - 3.2.2 On Input (Level A)
 * - 3.2.6 Consistent Help (Level A)
 * - 4.1.2 Name, Role, Value - for iframes (Level A)
 * 
 * @updated 2026-02-04
 * @requires shared-helpers.js must be loaded first
 * 
 * Usage:
 *   const results = await runContextChangesAudit();
 *   console.log(results);
 */

(function() {
  'use strict';

  // Use centralized version if available
  const SCRIPT_VERSION = (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown';

  if (typeof window.a11yHelpers === 'undefined') {
    throw new Error('shared-helpers.js must be loaded before context-changes-audit.js');
  }

  const helpers = window.a11yHelpers;

  /**
   * Check iframes for accessibility (WCAG 4.1.2)
   */
  function checkIframes() {
    const issues = [];
    const iframes = Array.from(document.querySelectorAll('iframe'));

    for (const iframe of iframes) {
      if (!helpers.isVisible(iframe)) continue;

      const selector = helpers.getSelector(iframe);
      const title = iframe.getAttribute('title');
      const ariaLabel = iframe.getAttribute('aria-label');
      const ariaLabelledby = iframe.getAttribute('aria-labelledby');
      const name = iframe.getAttribute('name');

      // Check for accessible name
      if (!title && !ariaLabel && !ariaLabelledby) {
        issues.push({
          wcag: '4.1.2',
          level: 'A',
          category: 'context-changes',
          severity: 'critical',
          element: 'iframe',
          selector,
          message: 'Iframe has no accessible name',
          snippet: helpers.getElementSnippet(iframe),
          recommendation: 'Add title attribute describing iframe content'
        });
      } else if (title && title.trim().length < 3) {
        issues.push({
          wcag: '4.1.2',
          level: 'A',
          category: 'context-changes',
          severity: 'moderate',
          element: 'iframe',
          selector,
          message: `Iframe title too short: "${title}"`,
          snippet: helpers.getElementSnippet(iframe),
          recommendation: 'Provide descriptive title for iframe'
        });
      }

      // Check for generic titles
      if (title && /^(iframe|frame|untitled|content)$/i.test(title.trim())) {
        issues.push({
          wcag: '4.1.2',
          level: 'A',
          category: 'context-changes',
          severity: 'moderate',
          element: 'iframe',
          selector,
          message: `Generic iframe title: "${title}"`,
          snippet: helpers.getElementSnippet(iframe),
          recommendation: 'Use specific, descriptive title for iframe'
        });
      }
    }

    return issues;
  }

  /**
   * Check for elements that change context on focus
   */
  function checkOnFocus() {
    const issues = [];

    // Look for elements with onfocus handlers that might navigate
    const elementsWithFocus = Array.from(document.querySelectorAll('[onfocus]'));
    
    for (const element of elementsWithFocus) {
      if (!helpers.isVisible(element)) continue;

      const onfocus = element.getAttribute('onfocus');
      if (!onfocus) continue;

      // Check for navigation patterns
      const navigationPatterns = [
        /window\.location/i,
        /\.href\s*=/i,
        /\.submit\(\)/i,
        /\.open\(/i
      ];

      const hasNavigation = navigationPatterns.some(pattern => pattern.test(onfocus));
      
      if (hasNavigation) {
        const selector = helpers.getSelector(element);
        issues.push({
          wcag: '3.2.1',
          level: 'A',
          category: 'context-changes',
          severity: 'critical',
          element: element.tagName.toLowerCase(),
          selector,
          message: 'Element triggers navigation or context change on focus',
          snippet: helpers.getElementSnippet(element),
          recommendation: 'Context changes should only occur on explicit user activation (click, enter)'
        });
      }
    }

    // Check for select elements that auto-submit
    const selects = Array.from(document.querySelectorAll('select[onchange]'));
    
    for (const select of selects) {
      if (!helpers.isVisible(select)) continue;

      const onchange = select.getAttribute('onchange');
      if (!onchange) continue;

      // Check if onchange triggers form submission or navigation
      const triggersChange = /\.submit\(\)|window\.location|\.href\s*=/i.test(onchange);
      
      if (triggersChange) {
        const selector = helpers.getSelector(select);
        issues.push({
          wcag: '3.2.2',
          level: 'A',
          category: 'context-changes',
          severity: 'critical',
          element: 'select',
          selector,
          message: 'Select element triggers form submission or navigation on change',
          snippet: helpers.getElementSnippet(select),
          recommendation: 'Provide explicit submit button instead of auto-submitting on change'
        });
      }
    }

    return issues;
  }

  /**
   * Check for consistent help mechanisms (WCAG 3.2.6)
   */
  function checkConsistentHelp() {
    const issues = [];
    
    // Look for help-related elements
    const helpPatterns = [
      '[href*="help"]',
      '[href*="support"]',
      '[href*="contact"]',
      '[class*="help"]',
      '[class*="support"]',
      '[id*="help"]',
      '[aria-label*="help" i]',
      '[aria-label*="support" i]'
    ];

    const helpElements = Array.from(document.querySelectorAll(helpPatterns.join(', ')));
    
    if (helpElements.length > 0) {
      // This is a basic check - proper implementation would require multi-page analysis
      // Just flag if help exists but might not be consistent
      const visibleHelp = helpElements.filter(el => helpers.isVisible(el));
      
      if (visibleHelp.length > 0) {
        // Check if help elements are in consistent location (e.g., header, footer)
        const helpLocations = visibleHelp.map(el => {
          const header = el.closest('header, [role="banner"]');
          const footer = el.closest('footer, [role="contentinfo"]');
          const nav = el.closest('nav, [role="navigation"]');
          
          if (header) return 'header';
          if (footer) return 'footer';
          if (nav) return 'navigation';
          return 'other';
        });

        const uniqueLocations = [...new Set(helpLocations)];
        
        if (uniqueLocations.length > 2) {
          issues.push({
            wcag: '3.2.6',
            level: 'A',
            category: 'context-changes',
            severity: 'minor',
            element: 'document',
            selector: 'body',
            message: `Help/support links found in ${uniqueLocations.length} different locations`,
            recommendation: 'Place help mechanisms in consistent location across pages'
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for auto-refreshing pages
   */
  function checkAutoRefresh() {
    const issues = [];

    // Check meta refresh
    const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
    if (metaRefresh) {
      const content = metaRefresh.getAttribute('content');
      if (content) {
        // Parse refresh timing
        const match = content.match(/^\s*(\d+)/);
        if (match) {
          const seconds = parseInt(match[1]);
          
          issues.push({
            wcag: '2.2.1',
            level: 'A',
            category: 'context-changes',
            severity: seconds < 20 ? 'critical' : 'moderate',
            element: 'meta',
            selector: 'meta[http-equiv="refresh"]',
            message: `Page auto-refreshes every ${seconds} seconds`,
            recommendation: 'Remove auto-refresh or provide user control to stop it'
          });
        }
      }
    }

    // Check for JavaScript-based refresh
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const script of scripts) {
      const content = script.textContent || '';
      
      if (/location\.reload|window\.location\s*=|setTimeout.*location/i.test(content)) {
        issues.push({
          wcag: '2.2.1',
          level: 'A',
          category: 'context-changes',
          severity: 'moderate',
          element: 'script',
          selector: helpers.getSelector(script),
          message: 'Script may auto-refresh or redirect page',
          recommendation: 'Ensure automatic redirects have sufficient time limit and user control'
        });
        break; // Only report once
      }
    }

    return issues;
  }

  /**
   * Check for pop-ups or new windows
   */
  function checkPopups() {
    const issues = [];

    // Check for window.open in scripts
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const script of scripts) {
      const content = script.textContent || '';
      
      if (/window\.open\(|\.open\(.*,\s*['"]/i.test(content)) {
        issues.push({
          wcag: '3.2.1',
          level: 'A',
          category: 'context-changes',
          severity: 'moderate',
          element: 'script',
          selector: helpers.getSelector(script),
          message: 'Script may open pop-up windows',
          recommendation: 'Ensure pop-ups only open on explicit user action, not on focus'
        });
        break;
      }
    }

    return issues;
  }

  /**
   * Main audit function
   */
  async function runContextChangesAudit(options = {}) {
    console.log(' Starting Context Changes Audit...');
    const startTime = performance.now();

    const issues = [];
    const stats = {
      iframesChecked: 0,
      autoRefreshDetected: false,
      helpElementsFound: 0
    };

    // Run all checks
    const iframeIssues = checkIframes();
    stats.iframesChecked = document.querySelectorAll('iframe').length;
    issues.push(...iframeIssues);
    
    issues.push(...checkOnFocus());
    issues.push(...checkConsistentHelp());
    
    const refreshIssues = checkAutoRefresh();
    stats.autoRefreshDetected = refreshIssues.length > 0;
    issues.push(...refreshIssues);
    
    issues.push(...checkPopups());

    const duration = Math.round(performance.now() - startTime);
    const deduplicatedIssues = helpers.deduplicateIssues(issues);

    console.log(` Context Changes Audit complete in ${duration}ms`);
    console.log(`   Found ${deduplicatedIssues.length} issues`);

    return {
      summary: {
        category: 'Context Changes',
        duration,
        issueCount: deduplicatedIssues.length,
        criticalCount: deduplicatedIssues.filter(i => i.severity === 'critical').length,
        stats
      },
      issues: deduplicatedIssues
    };
  }

  window.runContextChangesAudit = runContextChangesAudit;

})();
