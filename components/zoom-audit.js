/**
 * Zoom/Resize Text Accessibility Audit Script
 * 
 * Tests WCAG 1.4.4 Resize Text (Level AA) - Text can be resized up to 200%
 * without loss of content or functionality.
 * 
 * This script provides both:
 * 1. In-browser heuristic checks for zoom-blocking patterns
 * 2. Integration helpers for Playwriter-based 200% zoom testing
 *
 * WCAG Criteria:
 * - 1.4.4 Resize Text (Level AA) - Text resizable to 200% without AT
 * - 1.4.10 Reflow (Level AA) - Content reflows at 320px (see reflow-audit.js)
 *
 * Usage:
 *   // In-browser heuristics (no Playwriter required):
 *   const results = auditZoomHeuristics();
 *
 *   // With Playwriter (recommended for full testing):
 *   // See PLAYWRITER_INTEGRATION section at bottom of file
 *
 * @updated 2026-03-03
 */

(function(global) {
  'use strict';

  // ============================================================================
  // IN-BROWSER ZOOM HEURISTICS
  // Tests that can run without Playwriter
  // ============================================================================

  function auditZoomHeuristics(options = {}) {
    const config = {
      checkViewportMeta: options.checkViewportMeta ?? true,
      checkFixedSizes: options.checkFixedSizes ?? true,
      checkTextOverflow: options.checkTextOverflow ?? true,
      maxElementsToCheck: options.maxElementsToCheck ?? 200,
      ...options
    };

    const startTime = performance.now();

    const results = {
      meta: {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        auditType: 'zoom-resize-text',
        auditVersion: (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown',
        wcagVersion: '2.2',
        level: 'AA',
        testType: 'heuristics'
      },
      summary: {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        total: 0,
        passed: 0,
        needsManualReview: 0
      },
      tests: {
        viewportMeta: { passed: false, details: null },
        fixedFontSizes: { passed: false, issues: [] },
        textContainers: { passed: false, issues: [] },
        overflowHandling: { passed: false, issues: [] }
      },
      issues: [],
      manualChecks: [],
      playwriterRecommended: false
    };

    // Use shared helpers (shared-helpers.js always loads first per injection order)
    const helpers = global.a11yHelpers;

    function addIssue(severity, wcag, message, element, fix, category = 'zoom') {
      results.issues.push({
        severity,
        wcag,
        message,
        selector: element ? helpers.getSelector(element) : null,
        tagName: element?.tagName?.toLowerCase() || null,
        fix,
        category,
        source: 'zoom-audit'
      });
      results.summary[severity]++;
      results.summary.total++;
    }

    function addManualCheck(wcag, description, priority = 'medium') {
      results.manualChecks.push({
        wcag,
        description,
        priority,
        source: 'zoom-audit'
      });
      results.summary.needsManualReview++;
    }

    // ========================================================================
    // TEST 1: Viewport Meta Restrictions
    // ========================================================================

    function testViewportMeta() {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      
      if (!viewportMeta) {
        results.tests.viewportMeta.passed = true;
        results.tests.viewportMeta.details = 'No viewport meta tag found (zoom allowed by default)';
        results.summary.passed++;
        return;
      }

      const content = viewportMeta.getAttribute('content') || '';
      const contentLower = content.toLowerCase();
      const issues = [];

      // Check user-scalable=no
      if (contentLower.includes('user-scalable=no') || contentLower.includes('user-scalable=0')) {
        issues.push('user-scalable=no');
        addIssue('critical', '1.4.4',
          'Viewport meta prevents user zoom (user-scalable=no)',
          viewportMeta,
          'Remove user-scalable=no to allow text resize up to 200%');
      }

      // Check maximum-scale < 2
      const maxScaleMatch = contentLower.match(/maximum-scale\s*=\s*([\d.]+)/);
      if (maxScaleMatch) {
        const maxScale = parseFloat(maxScaleMatch[1]);
        
        if (maxScale < 2) {
          issues.push(`maximum-scale=${maxScale}`);
          addIssue('serious', '1.4.4',
            `Viewport maximum-scale=${maxScale} restricts zoom below 200%`,
            viewportMeta,
            'Set maximum-scale to at least 2.0 or remove the restriction');
        } else if (maxScale < 5) {
          issues.push(`maximum-scale=${maxScale} (warning)`);
          addIssue('minor', '1.4.4',
            `Viewport maximum-scale=${maxScale} may restrict some users`,
            viewportMeta,
            'Consider removing maximum-scale or setting to 5.0+');
        }
      }

      results.tests.viewportMeta.passed = issues.length === 0;
      results.tests.viewportMeta.details = issues.length === 0 
        ? 'Viewport allows zoom' 
        : `Restrictions found: ${issues.join(', ')}`;
      
      if (issues.length === 0) {
        results.summary.passed++;
      }
    }

    // ========================================================================
    // TEST 2: Fixed Font Sizes (px instead of relative units)
    // ========================================================================

    function testFixedFontSizes() {
      const textElements = document.querySelectorAll('p, span, li, td, th, label, a, button, h1, h2, h3, h4, h5, h6');
      let fixedSizeCount = 0;
      const fixedSizeExamples = [];
      const maxExamples = 5;

      const checked = Math.min(textElements.length, config.maxElementsToCheck);
      
      for (let i = 0; i < checked; i++) {
        const element = textElements[i];
        if (!helpers.isVisible(element)) continue;
        
        const style = window.getComputedStyle(element);
        const fontSize = style.fontSize;
        
        // Check inline styles for px font-size (more reliable indicator of intentional px use)
        const inlineStyle = element.getAttribute('style') || '';
        if (inlineStyle.includes('font-size') && inlineStyle.match(/font-size\s*:\s*\d+px/i)) {
          fixedSizeCount++;
          if (fixedSizeExamples.length < maxExamples) {
            fixedSizeExamples.push({
              selector: helpers.getSelector(element),
              fontSize: fontSize,
              inline: true
            });
          }
        }
      }

      // Fixed px font sizes are not strictly a violation (browser zoom works)
      // but relative units are better practice
      if (fixedSizeCount > 10) {
        addIssue('minor', '1.4.4',
          `${fixedSizeCount} elements have inline px font-sizes`,
          document.body,
          'Consider using relative units (em, rem, %) for better scalability');
      }

      results.tests.fixedFontSizes.passed = fixedSizeCount <= 10;
      results.tests.fixedFontSizes.issues = fixedSizeExamples;
      
      if (fixedSizeCount <= 10) {
        results.summary.passed++;
      }
    }

    // ========================================================================
    // TEST 3: Text Container Overflow Handling
    // ========================================================================

    function testTextContainerOverflow() {
      const containers = document.querySelectorAll('div, section, article, main, aside, nav');
      const overflowIssues = [];
      const maxExamples = 5;

      const checked = Math.min(containers.length, config.maxElementsToCheck);

      for (let i = 0; i < checked; i++) {
        const container = containers[i];
        if (!helpers.isVisible(container)) continue;

        const style = window.getComputedStyle(container);
        const hasFixedHeight = style.height && !style.height.includes('auto') && !style.height.includes('%');
        const overflowY = style.overflowY;
        const hasText = container.textContent.trim().length > 50;

        // Check for containers with fixed height + overflow:hidden that contain text
        if (hasFixedHeight && overflowY === 'hidden' && hasText) {
          const heightVal = parseFloat(style.height);
          if (heightVal > 0 && heightVal < 500) { // Reasonable content container
            if (overflowIssues.length < maxExamples) {
              overflowIssues.push({
                selector: helpers.getSelector(container),
                height: style.height,
                overflow: overflowY
              });
            }
          }
        }
      }

      if (overflowIssues.length > 0) {
        addIssue('moderate', '1.4.4',
          `${overflowIssues.length} text containers have fixed height with overflow:hidden`,
          document.body,
          'Use min-height instead of height, or overflow:auto to allow text expansion when zoomed');
        
        results.playwriterRecommended = true;
      }

      results.tests.overflowHandling.passed = overflowIssues.length === 0;
      results.tests.overflowHandling.issues = overflowIssues;
      
      if (overflowIssues.length === 0) {
        results.summary.passed++;
      }
    }

    // ========================================================================
    // TEST 4: Text Truncation Patterns
    // ========================================================================

    function testTextTruncation() {
      const truncationIssues = [];
      const maxExamples = 5;

      // Check for elements with text-overflow: ellipsis
      const truncationStart = performance.now();
      const truncationEls = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, label, li, td, th, figcaption, blockquote, dt, dd, [class*="truncat"], [class*="ellips"], [class*="clamp"]');
      for (let i = 0; i < truncationEls.length && i <= config.maxElementsToCheck; i++) {
        if (i % 500 === 0 && performance.now() - truncationStart > 2000) break; // 2s timeout guard
        const element = truncationEls[i];
        if (!helpers.isVisible(element)) continue;

        const style = helpers.getStyle(element);

        // Single line truncation
        if (style.textOverflow === 'ellipsis' && style.overflow === 'hidden' && style.whiteSpace === 'nowrap') {
          const hasSignificantText = element.textContent.trim().length > 20;
          if (hasSignificantText && truncationIssues.length < maxExamples) {
            truncationIssues.push({
              selector: helpers.getSelector(element),
              type: 'single-line-ellipsis',
              textLength: element.textContent.trim().length
            });
          }
        }

        // Multi-line truncation (-webkit-line-clamp)
        const lineClamp = style.webkitLineClamp || style.lineClamp;
        if (lineClamp && lineClamp !== 'none') {
          if (truncationIssues.length < maxExamples) {
            truncationIssues.push({
              selector: helpers.getSelector(element),
              type: 'line-clamp',
              lines: lineClamp
            });
          }
        }
      }

      if (truncationIssues.length > 0) {
        addManualCheck('1.4.4',
          `${truncationIssues.length} elements use text truncation - verify full content is accessible when zoomed`,
          'medium');
        
        results.playwriterRecommended = true;
      }

      results.tests.textContainers.passed = truncationIssues.length === 0;
      results.tests.textContainers.issues = truncationIssues;
    }

    // ========================================================================
    // RUN ALL TESTS
    // ========================================================================

    if (config.checkViewportMeta) testViewportMeta();
    if (config.checkFixedSizes) testFixedFontSizes();
    if (config.checkTextOverflow) {
      testTextContainerOverflow();
      testTextTruncation();
    }

    // Add recommendation for Playwriter testing
    if (results.playwriterRecommended || results.summary.total > 0) {
      addManualCheck('1.4.4',
        'Run Playwriter-based 200% zoom test for comprehensive verification. See zoom-audit.js PLAYWRITER_INTEGRATION section.',
        'high');
    }

    results.meta.executionTimeMs = Math.round(performance.now() - startTime);

    return results;
  }

  // ============================================================================
  // PLAYWRITER INTEGRATION
  // ============================================================================

  /**
   * Playwriter-based 200% zoom test
   *
   * Run this via Playwriter's mcp__playwriter__execute. The test uses
   * page from the Playwriter session.
   *
   * Example Playwriter usage:
   *
   * ```javascript
   * async function testZoom200Percent(page, url) {
   *   // Navigate to page
   *   await page.goto(url);
   *   await waitForPageLoad({ page });
   *
   *   // Get original measurements
   *   const originalMetrics = await page.evaluate(() => ({
   *     scrollWidth: document.documentElement.scrollWidth,
   *     scrollHeight: document.documentElement.scrollHeight,
   *     hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth
   *   }));
   *
   *   // Apply 200% zoom via CSS transform (simulates browser zoom)
   *   await page.evaluate(() => {
   *     document.body.style.transform = 'scale(2)';
   *     document.body.style.transformOrigin = 'top left';
   *     document.body.style.width = '50%';
   *   });
   *
   *   // Wait for reflow
   *   await page.waitForTimeout(500);
   *
   *   // Check for issues
   *   const zoomedMetrics = await page.evaluate(() => {
   *     const issues = [];
   *
   *     // Check for horizontal scroll
   *     if (document.documentElement.scrollWidth > window.innerWidth * 2) {
   *       issues.push({ type: 'horizontal-scroll', severity: 'serious' });
   *     }
   *
   *     // Check for text overflow/clipping
   *     document.querySelectorAll('p, span, li, td, h1, h2, h3, h4, h5, h6').forEach(el => {
   *       const style = window.getComputedStyle(el);
   *       if (style.overflow === 'hidden' && el.scrollHeight > el.clientHeight) {
   *         issues.push({
   *           type: 'text-clipped',
   *           severity: 'moderate',
   *           selector: el.id ? `#${el.id}` : el.tagName.toLowerCase()
   *         });
   *       }
   *     });
   *
   *     return { issues, scrollWidth: document.documentElement.scrollWidth };
   *   });
   *
   *   // Reset zoom
   *   await page.evaluate(() => {
   *     document.body.style.transform = '';
   *     document.body.style.transformOrigin = '';
   *     document.body.style.width = '';
   *   });
   *
   *   return {
   *     passed: zoomedMetrics.issues.length === 0,
   *     originalMetrics,
   *     zoomedMetrics,
   *     wcag: '1.4.4',
   *     testType: 'playwriter-zoom-200'
   *   };
   * }
   * ```
   *
   * Alternative: Use viewport scaling via setViewportSize:
   *
   * ```javascript
   * async function testZoomViaViewport(page, url) {
   *   // Test at normal size
   *   await page.setViewportSize({ width: 1280, height: 720 });
   *   await page.goto(url);
   *
   *   // Take baseline screenshot
   *   const baseline = await page.screenshot();
   *
   *   // Simulate 200% zoom by halving viewport (content stays same, viewport shrinks)
   *   await page.setViewportSize({ width: 640, height: 360 });
   *   await page.waitForTimeout(500);
   *
   *   // Check for horizontal scrollbar
   *   const hasHorizontalScroll = await page.evaluate(() =>
   *     document.documentElement.scrollWidth > window.innerWidth
   *   );
   *
   *   // Check for text overflow
   *   const overflowIssues = await page.evaluate(() => {
   *     const issues = [];
   *     document.querySelectorAll('[style*="overflow: hidden"], [style*="overflow:hidden"]').forEach(el => {
   *       if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
   *         issues.push({ selector: el.tagName, overflow: true });
   *       }
   *     });
   *     return issues;
   *   });
   *
   *   return {
   *     passed: !hasHorizontalScroll && overflowIssues.length === 0,
   *     hasHorizontalScroll,
   *     overflowIssues
   *   };
   * }
   * ```
   */

  // Export the helper that can generate Playwriter test code
  function getPlaywriterTestCode() {
    return `
// Playwriter Test for WCAG 1.4.4 Resize Text (200% Zoom)
// Generated by zoom-audit.js
// Run via mcp__playwriter__execute

async function testZoom(page, url) {
  await page.goto(url);
  await waitForPageLoad({ page });

  // Store original viewport
  const originalViewport = page.viewportSize();

  // Simulate 200% zoom by applying CSS transform
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  await page.waitForTimeout(500);

  // Check for content issues
  const issues = await page.evaluate(() => {
    const problems = [];

    // Check for horizontal scrollbar (excluding intentional scroll areas)
    const hasUnintendedHScroll = document.documentElement.scrollWidth > window.innerWidth + 20;
    if (hasUnintendedHScroll) {
      problems.push({ type: 'horizontal-scroll', severity: 'serious' });
    }

    // Check for clipped text in containers
    document.querySelectorAll('p, li, span, div, td').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.overflow === 'hidden' && el.scrollHeight > el.clientHeight + 5) {
        problems.push({
          type: 'text-clipped',
          element: el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : ''),
          severity: 'moderate'
        });
      }
    });

    return problems;
  });

  // Reset font size
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });

  return {
    passed: issues.filter(i => i.severity === 'serious').length === 0,
    issues,
    wcag: '1.4.4',
    testType: 'playwriter-zoom-200'
  };
}

// Usage: const result = await testZoom(page, 'https://example.com');
`;
  }

  // ============================================================================
  // EXPORTS
  // ============================================================================

  global.auditZoomHeuristics = auditZoomHeuristics;
  global.getPlaywriterZoomTestCode = getPlaywriterTestCode;

  console.log(' Zoom/Resize Text Audit Script loaded');
  console.log('  WCAG: 1.4.4 Resize Text (Level AA)');
  console.log('  Run: auditZoomHeuristics()');
  console.log('  For Playwriter test code: getPlaywriterZoomTestCode()');

})(typeof window !== 'undefined' ? window : global);
