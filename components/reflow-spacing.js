/**
 * Reflow & Spacing Accessibility Audit
 * WCAG: 1.4.10, 1.4.12
 */

function runReflowSpacingAudit() {
  'use strict';

  const startTime = performance.now();

  // ============================================================
  // Configuration
  // ============================================================

  const CONFIG = {
    reflowTestWidth: 320,        // WCAG 2.2 reflow width
    maxElementsToCheck: 500,
    maxIssuesPerRule: 25,         // Cap per sub-check to reduce noise
    checkFixedWidths: true,
    checkOverflow: true,

    // Text spacing multipliers (WCAG 1.4.12)
    textSpacing: {
      lineHeight: 1.5,           // 1.5x font size
      paragraphSpacing: 2.0,     // 2x font size
      letterSpacing: 0.12,       // 0.12x font size
      wordSpacing: 0.16          // 0.16x font size
    }
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('reflow-spacing', 'Page reflow at 400% zoom and text spacing overrides');
  const { isVisible, getSelector } = h;

  // ============================================================
  // Helper Functions
  // ============================================================

  /**
   * Skip known carousel/slider patterns and elements inside scrollable containers.
   */
  function isExcludedPattern(el) {
    try {
      if (el.matches('.slick-slide, .swiper-slide, [class*="carousel"], [class*="slider"], .nosto-card')) return true;
      if (el.matches('[role="group"]') && el.closest('[role="region"]')) return true;
      const parent = el.parentElement;
      if (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.overflowX === 'auto' || parentStyle.overflowX === 'scroll') return true;
      }
    } catch (e) { /* matches/closest can throw on disconnected nodes */ }
    return false;
  }

  /**
   * Deduplicate issues by parent container. Groups siblings with the same violation
   * into a single issue with a count.
   */
  function deduplicateByParent(issues) {
    const groups = new Map();
    issues.forEach(issue => {
      // Use wcag + fix as the grouping key (same violation type)
      const key = issue._parentSelector ? `${issue._parentSelector}|${issue.wcag}|${issue.fix}` : null;
      if (!key) {
        groups.set(Symbol(), [issue]);
        return;
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(issue);
    });

    const deduped = [];
    for (const [, group] of groups) {
      if (group.length <= 1) {
        deduped.push(group[0]);
      } else {
        const representative = { ...group[0] };
        const parentDesc = representative._parentSelector || 'same container';
        representative.message = `${group.length} elements: ${representative.message} (inside ${parentDesc})`;
        deduped.push(representative);
      }
    }
    // Clean internal tracking property
    deduped.forEach(issue => delete issue._parentSelector);
    return deduped;
  }

  /**
   * Cap issues at maxIssuesPerRule, appending a summary if truncated.
   */
  function capIssues(issues, wcag, criterion) {
    if (issues.length <= CONFIG.maxIssuesPerRule) return issues;
    const truncated = issues.slice(0, CONFIG.maxIssuesPerRule);
    const remaining = issues.length - CONFIG.maxIssuesPerRule;
    truncated.push({
      severity: 'minor',
      wcag: wcag,
      criterion: criterion,
      message: `... and ${remaining} more similar elements (capped at ${CONFIG.maxIssuesPerRule})`,
      selector: 'body',
      element: '<body>...</body>',
      fix: truncated[0].fix,
      impact: 'minor'
    });
    return truncated;
  }

  // ============================================================
  // Audit Functions
  // ============================================================

  function auditReflow() {
    const issues = [];
    
    // Check for horizontal scrolling at current width
    const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
    
    if (hasHorizontalScroll && window.innerWidth <= CONFIG.reflowTestWidth) {
      issues.push({
        severity: 'serious',
        wcag: '1.4.10',
        criterion: '1.4.10 Reflow',
        message: `Horizontal scrolling detected at ${window.innerWidth}px width`,
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Ensure content reflows to fit 320px width without horizontal scrolling',
        impact: 'serious'
      });
    }
    
    // Find elements with fixed widths wider than viewport
    if (CONFIG.checkFixedWidths) {
      const fixedWidthStart = performance.now();
      const allElements = Array.from(document.querySelectorAll('[style*="width"], [style*="min-width"]'))
        .filter((el, i) => {
          if (i % 500 === 0 && performance.now() - fixedWidthStart > 2000) return false; // 2s timeout
          if (!isVisible(el)) return false;
          if (isExcludedPattern(el)) return false;
          return true;
        })
        .slice(0, CONFIG.maxElementsToCheck);
      
      const fixedWidthIssues = [];
      allElements.forEach(element => {
        results.stats.elementsScanned++;
        const style = h.getStyle(element);

        const parentSel = element.parentElement ? getSelector(element.parentElement) : null;

        // Check for fixed width that's too wide
        if (style.width && style.width.endsWith('px')) {
          const fixedWidth = parseFloat(style.width);
          if (fixedWidth > CONFIG.reflowTestWidth) {
            fixedWidthIssues.push({
              severity: 'moderate',
              wcag: '1.4.10',
              criterion: '1.4.10 Reflow',
              message: `Element has fixed width ${Math.round(fixedWidth)}px, wider than 320px`,
              selector: getSelector(element),
              element: element.outerHTML.slice(0, 200),
              fix: 'Use flexible widths (%, max-width) instead of fixed pixel widths',
              impact: 'moderate',
              _parentSelector: parentSel
            });
          }
        }

        // Check for min-width that might prevent reflow
        if (style.minWidth && style.minWidth.endsWith('px')) {
          const minWidth = parseFloat(style.minWidth);
          if (minWidth > CONFIG.reflowTestWidth) {
            fixedWidthIssues.push({
              severity: 'moderate',
              wcag: '1.4.10',
              criterion: '1.4.10 Reflow',
              message: `Element has min-width ${Math.round(minWidth)}px, prevents reflow below this`,
              selector: getSelector(element),
              element: element.outerHTML.slice(0, 200),
              fix: 'Remove or reduce min-width to allow content to reflow',
              impact: 'moderate',
              _parentSelector: parentSel
            });
          }
        }
      });
      issues.push(...capIssues(deduplicateByParent(fixedWidthIssues), '1.4.10', '1.4.10 Reflow'));
    }
    
    // Check for overflow:hidden that might clip content
    if (CONFIG.checkOverflow) {
      const overflowStart = performance.now();
      const elementsWithOverflow = Array.from(document.querySelectorAll('[style*="overflow"]'))
        .filter((el, i) => {
          if (i % 500 === 0 && performance.now() - overflowStart > 2000) return false; // 2s timeout
          if (!isVisible(el)) return false;
          if (isExcludedPattern(el)) return false;
          const style = h.getStyle(el);
          return style.overflow === 'hidden' || style.overflowX === 'hidden';
        })
        .slice(0, 100);

      const overflowIssues = [];
      elementsWithOverflow.forEach(element => {
        results.stats.elementsScanned++;
        const hasScrollableContent = element.scrollWidth > element.clientWidth;

        if (hasScrollableContent) {
          overflowIssues.push({
            severity: 'moderate',
            wcag: '1.4.10',
            criterion: '1.4.10 Reflow',
            message: 'Element has overflow:hidden and content extends beyond bounds',
            selector: getSelector(element),
            element: element.outerHTML.slice(0, 200),
            fix: 'Change to overflow:auto or overflow:visible to show all content',
            impact: 'moderate',
            _parentSelector: element.parentElement ? getSelector(element.parentElement) : null
          });
        }
      });
      issues.push(...capIssues(deduplicateByParent(overflowIssues), '1.4.10', '1.4.10 Reflow'));
    }
    
    // Add manual check reminder — not an automated issue, requires human verification
    if (window.innerWidth > CONFIG.reflowTestWidth) {
      addManualCheck('1.4.10', 'Test page reflow at 320px width or 400% zoom', 'Resize browser to 320px viewport width or zoom to 400% and verify all content is accessible without horizontal scrolling', 'body');
    }
    
    return issues;
  }

  function auditTextSpacing() {
    // WCAG 1.4.12 requires that no content or functionality is lost when users apply
    // ALL of: line-height 1.5x font-size, letter-spacing 0.12em, word-spacing 0.16em,
    // paragraph spacing 2x font-size. Authors need not set these values themselves —
    // only ensure content survives user overrides without clipping or truncation.

    const issues = [];

    // Check 1: Block containers with overflow:hidden that already clip content,
    // or have an explicit fixed height — most likely to clip text when line-height
    // increases under user override.
    const blockContainers = Array.from(document.querySelectorAll(
      'div, section, article, main, aside, header, footer, nav, p, blockquote, figcaption'
    ))
      .filter(el => {
        if (!isVisible(el)) return false;
        if (isExcludedPattern(el)) return false;
        const style = h.getStyle(el);
        if (style.overflow !== 'hidden' && style.overflowY !== 'hidden') return false;
        // Must contain text to be a 1.4.12 concern
        const hasTextDescendants = el.querySelector(
          'p, span, li, a, button, h1, h2, h3, h4, h5, h6, label'
        );
        if (!hasTextDescendants && !Array.from(el.childNodes)
          .some(n => n.nodeType === 3 && n.textContent.trim().length > 0)) return false;
        // Flag if content is already overflowing (clipped now) OR if an explicit
        // inline pixel height is set (tight author constraint)
        const alreadyClipping = el.scrollHeight > el.clientHeight + 2;
        const hasInlineFixedHeight = el.style.height && el.style.height.endsWith('px');
        return alreadyClipping || hasInlineFixedHeight;
      })
      .slice(0, CONFIG.maxElementsToCheck);

    const blockIssues = [];
    blockContainers.forEach(element => {
      results.stats.elementsScanned++;
      const alreadyClipping = element.scrollHeight > element.clientHeight + 2;
      const detail = alreadyClipping
        ? 'Content is already clipped at current spacing; will worsen with 1.4.12 overrides'
        : 'Fixed height (' + element.style.height + ') with overflow:hidden will clip text when line-height is increased to 1.5x';
      blockIssues.push({
        severity: 'moderate',
        wcag: '1.4.12',
        criterion: '1.4.12 Text Spacing',
        message: detail,
        selector: getSelector(element),
        element: element.outerHTML.slice(0, 200),
        fix: 'Use min-height instead of height, or overflow:auto/visible, so content can expand when users increase spacing',
        impact: 'moderate',
        _parentSelector: element.parentElement ? getSelector(element.parentElement) : null
      });
    });
    issues.push(...capIssues(deduplicateByParent(blockIssues), '1.4.12', '1.4.12 Text Spacing'));

    // Check 2: white-space:nowrap with overflow:hidden or text-overflow:ellipsis on
    // elements with direct text content — truncates text when letter/word spacing increases
    const truncatedElements = Array.from(document.querySelectorAll(
      'div, p, span, a, button, label, h1, h2, h3, h4, h5, h6'
    ))
      .filter(el => {
        if (!isVisible(el)) return false;
        if (isExcludedPattern(el)) return false;
        const hasDirectText = Array.from(el.childNodes)
          .some(node => node.nodeType === 3 && node.textContent.trim().length > 0);
        if (!hasDirectText) return false;
        const style = h.getStyle(el);
        return style.whiteSpace === 'nowrap' &&
               (style.overflow === 'hidden' || style.textOverflow === 'ellipsis');
      })
      .slice(0, 100);

    const truncIssues = [];
    truncatedElements.forEach(element => {
      results.stats.elementsScanned++;
      truncIssues.push({
        severity: 'minor',
        wcag: '1.4.12',
        criterion: '1.4.12 Text Spacing',
        message: 'white-space:nowrap with text truncation will hide text when letter/word spacing is increased',
        selector: getSelector(element),
        element: element.outerHTML.slice(0, 200),
        fix: 'Verify element shows all text when spacing overrides are applied; consider allowing text to wrap',
        impact: 'minor',
        _parentSelector: element.parentElement ? getSelector(element.parentElement) : null
      });
    });
    issues.push(...capIssues(deduplicateByParent(truncIssues), '1.4.12', '1.4.12 Text Spacing'));

    // Manual check: 1.4.12 cannot be fully verified without runtime CSS injection
    issues.push({
      severity: 'minor',
      wcag: '1.4.12',
      criterion: '1.4.12 Text Spacing',
      message: 'Manual check needed: Apply text spacing overrides and verify no content is lost',
      selector: 'body',
      element: '<body>...</body>',
      fix: 'Inject: * { line-height: 1.5 !important; letter-spacing: 0.12em !important; ' +
           'word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; } ' +
           'Verify all text is visible and no content is clipped or truncated.',
      impact: 'minor'
    });

    return issues;
  }

  // ============================================================
  // Main Audit Function
  // ============================================================

  function runAudit() {
    const issues = [];
    
    // 1.4.10 Reflow
    const reflowIssues = auditReflow();
    issues.push(...reflowIssues);
    
    // 1.4.12 Text Spacing
    const spacingIssues = auditTextSpacing();
    issues.push(...spacingIssues);
    
    return issues;
  }

  // ============================================================
  // Return Results
  // ============================================================

  const issues = runAudit();
  results.issues.push(...issues);

  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

if (typeof window !== 'undefined') {
  window.runReflowSpacingAudit = runReflowSpacingAudit;
}
