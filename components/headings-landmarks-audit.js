/**
 * Headings and Landmarks Accessibility Audit Script
 * Part of modular accessibility-audit-unified system
 * 
 * WCAG Success Criteria Covered:
 * - 1.3.1 Info and Relationships (Level A)
 * - 2.4.1 Bypass Blocks (Level A)
 * - 2.4.6 Headings and Labels (Level AA)
 * 
 * @updated 2026-02-04
 * @requires shared-helpers.js must be loaded first
 * 
 * Usage:
 *   const results = await runHeadingsLandmarksAudit();
 *   console.log(results);
 */

(function() {
  'use strict';

  // Use centralized version if available
  const SCRIPT_VERSION = (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown';

  // Ensure shared helpers are loaded
  if (typeof window.a11yHelpers === 'undefined') {
    throw new Error('shared-helpers.js must be loaded before headings-landmarks-audit.js');
  }

  const helpers = window.a11yHelpers;

  /**
   * Audit heading hierarchy
   */
  function auditHeadings() {
    const issues = [];
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    
    let previousLevel = 0;
    const stats = {
      h1Count: 0,
      totalHeadings: headings.length,
      emptyHeadings: 0,
      skippedLevels: 0
    };

    for (const heading of headings) {
      if (!helpers.isVisible(heading)) continue;

      const level = parseInt(heading.tagName.substring(1));
      const text = helpers.getVisibleText(heading).trim();
      const selector = helpers.getSelector(heading);

      // Count H1s
      if (level === 1) stats.h1Count++;

      // Check for empty headings
      if (!text) {
        stats.emptyHeadings++;
        issues.push({
          wcag: '2.4.6',
          level: 'AA',
          category: 'headings',
          severity: 'critical',
          element: heading.tagName.toLowerCase(),
          selector,
          message: 'Heading is empty',
          snippet: helpers.getElementSnippet(heading),
          recommendation: 'Provide descriptive heading text or remove empty heading'
        });
        continue;
      }

      // Check for skipped levels
      if (previousLevel > 0 && level > previousLevel + 1) {
        stats.skippedLevels++;
        issues.push({
          wcag: '1.3.1',
          level: 'A',
          category: 'headings',
          severity: 'moderate',
          element: heading.tagName.toLowerCase(),
          selector,
          message: `Heading level skipped from H${previousLevel} to H${level}`,
          snippet: helpers.getElementSnippet(heading),
          recommendation: `Use H${previousLevel + 1} instead of H${level} to maintain hierarchy`
        });
      }

      previousLevel = level;
    }

    // Check for no H1 or multiple H1s
    if (stats.h1Count === 0) {
      issues.push({
        wcag: '1.3.1',
        level: 'A',
        category: 'headings',
        severity: 'serious',
        element: 'document',
        selector: 'body',
        message: 'Page has no H1 heading',
        recommendation: 'Add a single H1 heading that describes the page main content'
      });
    } else if (stats.h1Count > 1) {
      issues.push({
        wcag: '1.3.1',
        level: 'A',
        category: 'headings',
        severity: 'moderate',
        element: 'document',
        selector: 'body',
        message: `Page has ${stats.h1Count} H1 headings (typically should have one)`,
        recommendation: 'Consider using only one H1 for the main page heading'
      });
    }

    return { issues, stats };
  }

  /**
   * Audit landmarks
   */
  function auditLandmarks() {
    const issues = [];
    const stats = {
      totalLandmarks: 0,
      hasMain: false,
      mainCount: 0,
      hasNav: false,
      hasHeader: false,
      hasFooter: false,
      unlabeledLandmarks: 0
    };

    // Check for main landmark
    const mains = Array.from(document.querySelectorAll('main, [role="main"]'));
    stats.mainCount = mains.filter(m => helpers.isVisible(m)).length;
    stats.hasMain = stats.mainCount > 0;

    if (!stats.hasMain) {
      issues.push({
        wcag: '2.4.1',
        level: 'A',
        category: 'landmarks',
        severity: 'serious',
        element: 'document',
        selector: 'body',
        message: 'Page missing main landmark',
        recommendation: 'Add <main> element or role="main" to identify main content'
      });
    } else if (stats.mainCount > 1) {
      issues.push({
        wcag: '1.3.1',
        level: 'A',
        category: 'landmarks',
        severity: 'moderate',
        element: 'main',
        selector: 'body',
        message: `Page has ${stats.mainCount} main landmarks (should have exactly one)`,
        recommendation: 'Use only one main landmark per page'
      });
    }

    // Check for navigation
    const navs = Array.from(document.querySelectorAll('nav, [role="navigation"]'));
    stats.hasNav = navs.some(n => helpers.isVisible(n));
    stats.totalLandmarks += navs.filter(n => helpers.isVisible(n)).length;

    // Check for header
    const headers = Array.from(document.querySelectorAll('header, [role="banner"]'));
    stats.hasHeader = headers.some(h => helpers.isVisible(h));
    stats.totalLandmarks += headers.filter(h => helpers.isVisible(h)).length;

    // Check for footer
    const footers = Array.from(document.querySelectorAll('footer, [role="contentinfo"]'));
    stats.hasFooter = footers.some(f => helpers.isVisible(f));
    stats.totalLandmarks += footers.filter(f => helpers.isVisible(f)).length;

    // Check all landmark regions
    const landmarks = Array.from(document.querySelectorAll(`
      [role="banner"], [role="navigation"], [role="main"], [role="complementary"],
      [role="contentinfo"], [role="search"], [role="form"], [role="region"],
      header, nav, main, aside, footer, section, form
    `));

    for (const landmark of landmarks) {
      if (!helpers.isVisible(landmark)) continue;

      const role = landmark.getAttribute('role') || landmark.tagName.toLowerCase();
      const selector = helpers.getSelector(landmark);

      // Check for multiple instances that need labels
      const sameRoleLandmarks = landmarks.filter(l => {
        const lRole = l.getAttribute('role') || l.tagName.toLowerCase();
        return lRole === role && helpers.isVisible(l);
      });

      if (sameRoleLandmarks.length > 1) {
        const accessibleName = helpers.getAccessibleName(landmark);
        
        if (!accessibleName) {
          stats.unlabeledLandmarks++;
          issues.push({
            wcag: '2.4.1',
            level: 'A',
            category: 'landmarks',
            severity: 'serious',
            element: landmark.tagName.toLowerCase(),
            selector,
            message: `Multiple ${role} landmarks exist but this one is not labeled`,
            snippet: helpers.getElementSnippet(landmark),
            recommendation: 'Add aria-label or aria-labelledby to distinguish between similar landmarks'
          });
        }
      }
    }

    // Check for skip links
    const skipLinks = Array.from(document.querySelectorAll('a[href^="#"]')).filter(link => {
      const text = helpers.getVisibleText(link).toLowerCase();
      return /skip|jump/.test(text) && /content|navigation|main/.test(text);
    });

    if (skipLinks.length === 0) {
      issues.push({
        wcag: '2.4.1',
        level: 'A',
        category: 'landmarks',
        severity: 'serious',
        element: 'document',
        selector: 'body',
        message: 'Page missing skip link',
        recommendation: 'Add skip link at beginning of page to bypass navigation'
      });
    } else {
      // Verify skip link targets exist
      for (const link of skipLinks) {
        const href = link.getAttribute('href');
        if (href && href.length > 1) {
          const targetId = href.substring(1);
          const target = document.getElementById(targetId);
          
          if (!target) {
            const selector = helpers.getSelector(link);
            issues.push({
              wcag: '2.4.1',
              level: 'A',
              category: 'landmarks',
              severity: 'critical',
              element: 'a',
              selector,
              message: `Skip link target #${targetId} does not exist`,
              snippet: helpers.getElementSnippet(link),
              recommendation: 'Ensure skip link target element exists in the page'
            });
          }
        }
      }
    }

    return { issues, stats };
  }

  /**
   * Run complete headings and landmarks audit
   */
  async function runHeadingsLandmarksAudit(options = {}) {
    console.warn('[DEPRECATED] runHeadingsLandmarksAudit() is legacy. Use runPageStructureAudit() from components/ instead.');
    console.log('  Starting Headings and Landmarks Audit...');
    const startTime = performance.now();

    const headingsResult = auditHeadings();
    const landmarksResult = auditLandmarks();

    const allIssues = [
      ...headingsResult.issues,
      ...landmarksResult.issues
    ];

    const duration = Math.round(performance.now() - startTime);

    const deduplicatedIssues = helpers.deduplicateIssues(allIssues);

    console.log(` Headings and Landmarks Audit complete in ${duration}ms`);
    console.log(`   Found ${deduplicatedIssues.length} issues`);

    return {
      summary: {
        category: 'Headings and Landmarks',
        duration,
        issueCount: deduplicatedIssues.length,
        criticalCount: deduplicatedIssues.filter(i => i.severity === 'critical').length,
        stats: {
          headings: headingsResult.stats,
          landmarks: landmarksResult.stats
        }
      },
      issues: deduplicatedIssues
    };
  }

  // Expose to global scope
  window.runHeadingsLandmarksAudit = runHeadingsLandmarksAudit;

})();
