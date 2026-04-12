/**
 * Keyboard Navigation Audit Script
 *
 * Tests tab order, accessible names, and keyboard operability.
 * Complements focus-trap-audit.js with detailed tab sequence analysis.
 *
 * WCAG Criteria:
 * - 2.1.1 Keyboard - All functionality available from keyboard
 * - 2.1.2 No Keyboard Trap - User can navigate away from any element
 * - 2.4.3 Focus Order - Focus moves in meaningful sequence
 * - 2.4.7 Focus Visible - Focus indicator is visible
 * - 4.1.2 Name, Role, Value - Focusable elements have accessible names
 *
 * Coverage:
 * - Complete tab order mapping
 * - Accessible name verification
 * - Interactive element keyboard accessibility
 * - Focus style detection with active verification
 * - Potential keyboard trap detection
 *
 * Usage:
 *   const results = auditKeyboardNavigation();
 *   console.log(results);
 *
 * @updated 2026-02-05
 */

(function(global) {
  'use strict';

  // ============================================================
  // Configuration
  // ============================================================

  const CONFIG = {
    maxElements: 500,
    checkStyles: true
  };

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([type="hidden"]):not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'details:not([disabled])',
    'summary',
    '[contenteditable="true"]',
    'audio[controls]',
    'video[controls]',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="slider"]',
    '[role="switch"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    '[role="treeitem"]'
  ].join(', ');

  if (!window.a11yHelpers) throw new Error('[keyboard-audit] shared-helpers.js must be loaded first — check injection order');

  // ============================================================
  // Helper Functions (delegate to a11yHelpers)
  // ============================================================

  const getSelector       = (el) => window.a11yHelpers.getSelector(el);
  const isVisible         = (el) => window.a11yHelpers.isVisible(el);
  const getAccessibleName = (el) => window.a11yHelpers.getAccessibleName(el);

  // ============================================================
  // Focusable Elements Gathering
  // ============================================================

  function gatherFocusableElements() {
    const allFocusable = document.querySelectorAll(FOCUSABLE_SELECTOR);
    const focusableInOrder = [];

    allFocusable.forEach(element => {
      if (!isVisible(element)) return;
      if (element.disabled) return;
      
      const tabindex = element.getAttribute('tabindex');
      const tabindexNum = tabindex !== null ? parseInt(tabindex) : 0;
      
      // Skip elements with tabindex="-1" (programmatically focusable only)
      if (tabindexNum === -1) return;

      focusableInOrder.push({
        element,
        tabindex: tabindexNum,
        order: focusableInOrder.length
      });
    });

    // Sort by tabindex (positive first, then 0 in DOM order)
    focusableInOrder.sort((a, b) => {
      if (a.tabindex > 0 && b.tabindex > 0) return a.tabindex - b.tabindex;
      if (a.tabindex > 0) return -1;
      if (b.tabindex > 0) return 1;
      return a.order - b.order;
    });

    return focusableInOrder;
  }

  // ============================================================
  // Main Audit Function
  // ============================================================

  function auditKeyboardNavigation(options = {}) {
    const config = { ...CONFIG, ...options };
    const startTime = performance.now();

    const results = {
      meta: {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        auditType: 'keyboard-navigation',
        auditVersion: (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown',
        wcagCriteria: ['2.1.1', '2.1.2', '2.4.3', '2.4.7', '4.1.2']
      },
      summary: {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        total: 0,
        totalFocusable: 0,
        withAccessibleName: 0,
        withoutAccessibleName: 0,
        positiveTabindex: 0,
        potentialTraps: 0,
        focusStyleIssues: 0,
        interactiveNotFocusable: 0
      },
      tabOrder: [],
      issues: [],
      recommendations: []
    };

    function addIssue(severity, wcag, message, element, fix, needsManualReview) {
      results.issues.push({
        severity,
        wcag,
        message,
        selector: getSelector(element),
        tagName: element?.tagName?.toLowerCase(),
        fix,
        needsManualReview: needsManualReview === true,
        category: 'keyboard',
        source: 'keyboard-audit'
      });
      results.summary[severity]++;
      results.summary.total++;
    }

    // ============================================================
    // 1. Analyze Tab Order
    // ============================================================

    const focusableElements = gatherFocusableElements();
    let previousRect = null;
    const flowBreaks = [];

    focusableElements.forEach((item, index) => {
      const element = item.element;
      const rect = element.getBoundingClientRect();
      const accessibleName = getAccessibleName(element);

      const entry = {
        index,
        selector: getSelector(element),
        tagName: element.tagName.toLowerCase(),
        role: element.getAttribute('role'),
        tabindex: item.tabindex,
        accessibleName: accessibleName ? accessibleName.slice(0, 100) : null,
        position: {
          top: Math.round(rect.top),
          left: Math.round(rect.left)
        }
      };

      results.tabOrder.push(entry);
      results.summary.totalFocusable++;

      // Check for accessible name
      if (accessibleName) {
        results.summary.withAccessibleName++;
      } else {
        results.summary.withoutAccessibleName++;
        addIssue('critical', '4.1.2', 'Focusable element has no accessible name', element,
          'Add aria-label, aria-labelledby, text content, or associated label');
      }

      // Check for positive tabindex
      if (item.tabindex > 0) {
        results.summary.positiveTabindex++;
        addIssue('serious', '2.4.3', `Element has positive tabindex (${item.tabindex})`, element,
          'Remove positive tabindex; use DOM order for focus sequence');
      }

      // Check for visual flow issues
      if (previousRect) {
        const isBackwardJump = rect.top < previousRect.top - 100 && 
                               Math.abs(rect.left - previousRect.left) < 500;
        if (isBackwardJump) {
          flowBreaks.push({
            from: index - 1,
            to: index,
            issue: 'Tab jumps backward significantly'
          });
        }
      }

      previousRect = rect;
    });

    if (flowBreaks.length > 0) {
      results.flowBreaks = flowBreaks;
    }

    // ============================================================
    // 2. Check Interactive Elements Not Focusable
    // ============================================================

    // Elements with click handlers
    const clickable = document.querySelectorAll('[onclick], [class*="click"], [class*="btn"]:not(button)');
    
    clickable.forEach(element => {
      if (!isVisible(element)) return;
      
      const tagName = element.tagName;
      const role = element.getAttribute('role');
      const tabindex = element.getAttribute('tabindex');
      
      // Skip if already a focusable element
      if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tagName)) return;
      if (tabindex !== null && tabindex !== '-1') return;
      if (['button', 'link', 'checkbox', 'radio', 'textbox', 'combobox'].includes(role)) return;

      // Check if truly interactive (has click handler)
      if (element.onclick || element.getAttribute('onclick')) {
        results.summary.interactiveNotFocusable++;
        addIssue('serious', '2.1.1', 'Interactive element not keyboard accessible', element,
          'Add tabindex="0" and keyboard event handlers, or use a button element');
      }
    });

    // Custom role elements without tabindex
    const customInteractive = document.querySelectorAll(
      '[role="button"]:not([tabindex]):not(button), ' +
      '[role="link"]:not([tabindex]):not(a), ' +
      '[role="checkbox"]:not([tabindex]):not(input), ' +
      '[role="switch"]:not([tabindex])'
    );
    
    customInteractive.forEach(element => {
      if (!isVisible(element)) return;
      if (['A', 'BUTTON', 'INPUT'].includes(element.tagName)) return;
      
      results.summary.interactiveNotFocusable++;
      addIssue('critical', '2.1.1', `Custom ${element.getAttribute('role')} not focusable`, element,
        'Add tabindex="0" to custom interactive elements');
    });

    // ============================================================
    // 3. Check Focus Styles
    // ============================================================

    if (config.checkStyles) {
      let outlineRemoved = false;
      let focusStyleProvided = false;

      try {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules || []) {
              if (rule.selectorText && rule.selectorText.includes(':focus')) {
                const style = rule.style;
                
                if (style.outline === 'none' || style.outline === '0' || style.outlineWidth === '0') {
                  outlineRemoved = true;
                }
                
                if (style.boxShadow || style.border || style.backgroundColor || 
                    (style.outline && style.outline !== 'none')) {
                  focusStyleProvided = true;
                }
              }
            }
          } catch (e) {
            // Cross-origin stylesheet
          }
        }
      } catch (e) {
        // Unable to access stylesheets
      }

      if (outlineRemoved && !focusStyleProvided) {
        results.summary.focusStyleIssues++;
        addIssue('serious', '2.4.7', 'CSS removes focus outline without providing alternative', document.body,
          'Ensure visible focus indicator exists when removing default outline');
      }
    }

    // ============================================================
    // 3b. Focus Indicator Contrast & Active Verification (WCAG 2.4.7)
    // ============================================================

    function testFocusIndicatorContrast() {
      // Sample a few focusable elements to test focus indicator visibility
      const sampleSize = Math.min(15, focusableElements.length);
      const sampled = focusableElements.slice(0, sampleSize);
      
      let focusContrastIssues = 0;
      let noFocusIndicatorCount = 0;
      let focusVisibleSupport = false;
      
      // Track focus styles found for reporting
      const focusStylesFound = {
        outline: 0,
        boxShadow: 0,
        border: 0,
        background: 0,
        none: 0
      };
      
      /**
       * Programmatically focus elements to capture actual focus styles
       */
      function captureActiveFocusStyles(element) {
        // H6 fix: Store active element and use try-finally to guarantee focus restoration
        const previousActiveElement = document.activeElement;

        try {
          // Capture styles BEFORE focus
          const beforeStyle = window.getComputedStyle(element);
          const beforeStyles = {
            outline: beforeStyle.outline,
            outlineColor: beforeStyle.outlineColor,
            outlineWidth: beforeStyle.outlineWidth,
            outlineStyle: beforeStyle.outlineStyle,
            outlineOffset: beforeStyle.outlineOffset,
            boxShadow: beforeStyle.boxShadow,
            border: beforeStyle.border,
            borderColor: beforeStyle.borderColor,
            backgroundColor: beforeStyle.backgroundColor
          };

          // H6 fix: Wrap .focus() in try-catch — some elements may throw
          try {
            element.focus({ preventScroll: true });
          } catch (focusErr) {
            return null; // Element can't be focused — skip it
          }
          
          // Capture styles AFTER focus
          const afterStyle = window.getComputedStyle(element);
          const afterStyles = {
            outline: afterStyle.outline,
            outlineColor: afterStyle.outlineColor,
            outlineWidth: afterStyle.outlineWidth,
            outlineStyle: afterStyle.outlineStyle,
            outlineOffset: afterStyle.outlineOffset,
            boxShadow: afterStyle.boxShadow,
            border: afterStyle.border,
            borderColor: afterStyle.borderColor,
            backgroundColor: afterStyle.backgroundColor
          };
          
          // Focus restoration is handled in the finally block

          // Analyze focus indicator type
          const focusIndicator = {
            hasOutline: false,
            hasBoxShadow: false,
            hasBorder: false,
            hasBackground: false,
            outlineWidth: 0,
            outlineColor: null,
            focusStyleType: 'none'
          };
          
          // Check outline change
          const outlineWidthAfter = parseFloat(afterStyles.outlineWidth) || 0;
          const outlineWidthBefore = parseFloat(beforeStyles.outlineWidth) || 0;
          if (outlineWidthAfter > outlineWidthBefore || 
              (afterStyles.outlineStyle !== 'none' && beforeStyles.outlineStyle === 'none') ||
              afterStyles.outlineColor !== beforeStyles.outlineColor) {
            focusIndicator.hasOutline = true;
            focusIndicator.outlineWidth = outlineWidthAfter;
            focusIndicator.outlineColor = afterStyles.outlineColor;
            focusIndicator.focusStyleType = 'outline';
          }
          
          // Check box-shadow change
          if (afterStyles.boxShadow !== beforeStyles.boxShadow && 
              afterStyles.boxShadow !== 'none') {
            focusIndicator.hasBoxShadow = true;
            if (focusIndicator.focusStyleType === 'none') {
              focusIndicator.focusStyleType = 'boxShadow';
            }
          }
          
          // Check border change
          if (afterStyles.border !== beforeStyles.border ||
              afterStyles.borderColor !== beforeStyles.borderColor) {
            focusIndicator.hasBorder = true;
            if (focusIndicator.focusStyleType === 'none') {
              focusIndicator.focusStyleType = 'border';
            }
          }
          
          // Check background change
          if (afterStyles.backgroundColor !== beforeStyles.backgroundColor) {
            focusIndicator.hasBackground = true;
            if (focusIndicator.focusStyleType === 'none') {
              focusIndicator.focusStyleType = 'background';
            }
          }
          
          return {
            before: beforeStyles,
            after: afterStyles,
            indicator: focusIndicator
          };

        } catch (e) {
          return null;
        } finally {
          // H6 fix: Always restore focus, even if an exception occurred
          try {
            if (previousActiveElement && previousActiveElement !== element && typeof previousActiveElement.focus === 'function') {
              previousActiveElement.focus({ preventScroll: true });
            } else if (element && typeof element.blur === 'function') {
              element.blur();
            }
          } catch (restoreErr) { /* best-effort focus restore */ }
        }
      }
      
      // H1 fix: Delegate to shared-helpers instead of duplicating color utilities
      const getContrastRatio = h.getContrastRatio || function(c1, c2) { return 1; };
      const parseColor = h.parseColor || function(s) { return null; };
      const getBackgroundColor = h.getBackgroundColor || function() { return { r: 255, g: 255, b: 255 }; };
      
      // Check for :focus-visible support in stylesheets
      try {
        for (const sheet of document.styleSheets) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (!rules) continue;
            for (const rule of rules) {
              if (rule.selectorText && rule.selectorText.includes(':focus-visible')) {
                focusVisibleSupport = true;
                break;
              }
            }
            if (focusVisibleSupport) break;
          } catch (e) {
            // Cross-origin stylesheet
          }
        }
      } catch (e) {
        // Stylesheet access error
      }
      
      sampled.forEach(item => {
        const element = item.element;
        
        try {
          const focusCapture = captureActiveFocusStyles(element);
          
          if (!focusCapture) {
            return;
          }
          
          const { indicator, after: afterStyles } = focusCapture;
          
          // Track focus style types
          focusStylesFound[indicator.focusStyleType]++;
          
          // Check if there's ANY visible focus indicator
          const hasAnyIndicator = indicator.hasOutline || indicator.hasBoxShadow || 
                                  indicator.hasBorder || indicator.hasBackground;
          
          if (!hasAnyIndicator) {
            noFocusIndicatorCount++;
            addIssue('serious', '2.4.7',
              'Element has no visible focus indicator',
              element,
              'Add a visible focus style using outline, box-shadow, or border that changes on :focus');
            return;
          }
          
          // Check outline contrast if outline is the indicator
          if (indicator.hasOutline && indicator.outlineColor) {
            const bgColor = getBackgroundColor(element);
            const outlineColor = parseColor(indicator.outlineColor);
            
            if (outlineColor) {
              const contrast = getContrastRatio(outlineColor, bgColor);
              
              if (contrast < 3) {
                focusContrastIssues++;
                addIssue('serious', '2.4.7',
                  `Focus indicator contrast ${contrast.toFixed(2)}:1 is below 3:1 minimum`,
                  element,
                  'Ensure focus indicator has at least 3:1 contrast ratio against adjacent colors');
              }
            }
          }
          
          // Check outline width
          if (indicator.hasOutline && indicator.outlineWidth < 2) {
            addIssue('minor', '2.4.7',
              `Focus outline is thin (${indicator.outlineWidth}px) - may be difficult to see`,
              element,
              'Consider using at least 2px outline width for better visibility');
          }
          
        } catch (e) {
          // Element may have been removed or style access failed
        }
      });
      
      // Record results
      if (focusContrastIssues > 0) {
        results.summary.focusStyleIssues += focusContrastIssues;
      }
      
      if (noFocusIndicatorCount > 0) {
        results.summary.focusStyleIssues += noFocusIndicatorCount;
      }
      
      // Add focus verification metadata
      results.focusVerification = {
        elementsTested: sampled.length,
        focusVisibleSupport,
        focusStylesFound,
        noIndicatorCount: noFocusIndicatorCount,
        contrastIssues: focusContrastIssues
      };
    }

    testFocusIndicatorContrast();

    // ============================================================
    // 3c. NEW: WCAG 1.4.4 Resize Text - Viewport Zoom Restrictions
    // Tests for viewport meta restrictions that prevent zooming
    // ============================================================

    function testViewportZoomRestrictions() {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      
      if (!viewportMeta) {
        // No viewport meta is actually fine for desktop accessibility
        return;
      }
      
      const content = viewportMeta.getAttribute('content') || '';
      const contentLower = content.toLowerCase();
      
      // Check for user-scalable=no
      if (contentLower.includes('user-scalable=no') || contentLower.includes('user-scalable=0')) {
        addIssue('critical', '1.4.4',
          'Viewport meta prevents user from zooming (user-scalable=no)',
          viewportMeta,
          'Remove user-scalable=no to allow users to zoom for readability');
      }
      
      // Check for maximum-scale < 2 (or < 5 for stricter compliance)
      const maxScaleMatch = contentLower.match(/maximum-scale\s*=\s*([\d.]+)/);
      if (maxScaleMatch) {
        const maxScale = parseFloat(maxScaleMatch[1]);
        
        if (maxScale < 2) {
          addIssue('serious', '1.4.4',
            `Viewport maximum-scale=${maxScale} restricts zoom below 200%`,
            viewportMeta,
            'Set maximum-scale to at least 2.0 or remove the restriction entirely');
        } else if (maxScale < 5) {
          addIssue('moderate', '1.4.4',
            `Viewport maximum-scale=${maxScale} may restrict users who need higher zoom`,
            viewportMeta,
            'Consider removing maximum-scale or setting it to 5.0 or higher');
        }
      }
      
      // Check for minimum-scale > 1 (prevents zooming out)
      const minScaleMatch = contentLower.match(/minimum-scale\s*=\s*([\d.]+)/);
      if (minScaleMatch) {
        const minScale = parseFloat(minScaleMatch[1]);
        if (minScale > 1) {
          addIssue('moderate', '1.4.4',
            `Viewport minimum-scale=${minScale} may cause issues on smaller screens`,
            viewportMeta,
            'Set minimum-scale to 1.0 or lower');
        }
      }
    }

    testViewportZoomRestrictions();

    // ============================================================
    // 4. Focus Order Analysis (WCAG 2.4.3)
    // Enhanced: Flag for manual review with detailed context
    // ============================================================

    function testFocusOrderMatchesVisualOrder() {
      const focusable = focusableElements.map(item => {
        const rect = item.element.getBoundingClientRect();
        const style = window.getComputedStyle(item.element);
        const parent = item.element.parentElement;
        const parentStyle = parent ? window.getComputedStyle(parent) : null;
        
        return {
          element: item.element,
          selector: getSelector(item.element),
          tabOrder: item.order,
          tabindex: item.tabindex,
          // Visual position
          visualTop: Math.round(rect.top),
          visualLeft: Math.round(rect.left),
          visualOrder: 0, // Will be calculated
          rect,
          // CSS properties that affect order
          cssOrder: style.order,
          position: style.position,
          parentDisplay: parentStyle ? parentStyle.display : null
        };
      });

      // Sort by visual reading order (top-to-bottom, left-to-right)
      const rowThreshold = 50;

      const sortedByPosition = [...focusable].sort((a, b) => {
        if (Math.abs(a.visualTop - b.visualTop) <= rowThreshold) {
          return a.visualLeft - b.visualLeft;
        }
        return a.visualTop - b.visualTop;
      });

      sortedByPosition.forEach((item, index) => {
        item.visualOrder = index;
      });

      const manualReviewItems = [];

      // ============================================================
      // Check 1: Flag any tabindex > 0 (high confidence issue)
      // ============================================================
      focusable.forEach(item => {
        if (item.tabindex > 0) {
          manualReviewItems.push({
            type: 'positive-tabindex',
            severity: 'serious',
            selector: item.selector,
            tabindex: item.tabindex,
            domPosition: item.tabOrder,
            visualPosition: { x: item.visualLeft, y: item.visualTop },
            message: `Element has tabindex="${item.tabindex}" which overrides natural DOM order`,
            recommendation: 'Remove positive tabindex values; use DOM order for focus sequence'
          });
        }
      });

      // ============================================================
      // Check 2: Visual vs DOM order mismatch
      // ============================================================
      const significantThreshold = 3;

      focusable.forEach(item => {
        const tabPos = item.tabOrder;
        const visualPos = item.visualOrder;
        const diff = Math.abs(tabPos - visualPos);

        if (diff > significantThreshold) {
          // Skip elements in fixed/sticky containers (header/footer expected to be out of flow)
          const isInFixedContainer = item.element.closest(
            'header, footer, [role="banner"], [role="contentinfo"]'
          );

          if (!isInFixedContainer) {
            const usesFlexOrder = item.cssOrder !== '0';
            const usesAbsolutePosition = item.position === 'absolute' || item.position === 'fixed';
            const parentIsFlexGrid = item.parentDisplay === 'flex' || item.parentDisplay === 'grid';

            manualReviewItems.push({
              type: 'visual-dom-mismatch',
              severity: diff > 10 ? 'serious' : 'moderate',
              selector: item.selector,
              domPosition: tabPos,
              visualOrder: visualPos,
              difference: diff,
              visualPosition: { x: item.visualLeft, y: item.visualTop },
              cssContext: {
                order: item.cssOrder,
                position: item.position,
                parentDisplay: item.parentDisplay
              },
              message: `Focus order (DOM: ${tabPos}) differs from visual order (${visualPos})`,
              possibleCause: usesFlexOrder ? 'CSS order property' : 
                            usesAbsolutePosition ? 'Absolute/fixed positioning' :
                            parentIsFlexGrid ? 'Flex/grid layout reordering' : 'DOM order differs from visual layout',
              recommendation: 'Verify focus order makes logical sense for the content flow'
            });
          }
        }
      });

      // ============================================================
      // Check 3: CSS order property on focusable elements
      // ============================================================
      focusable.forEach(item => {
        if (item.cssOrder !== '0' && item.cssOrder !== 'auto') {
          // Check if not already flagged
          const alreadyFlagged = manualReviewItems.some(
            i => i.selector === item.selector && i.type === 'visual-dom-mismatch'
          );
          
          if (!alreadyFlagged) {
            manualReviewItems.push({
              type: 'css-order-used',
              severity: 'moderate',
              selector: item.selector,
              cssOrder: item.cssOrder,
              domPosition: item.tabOrder,
              visualPosition: { x: item.visualLeft, y: item.visualTop },
              message: `CSS order: ${item.cssOrder} changes visual position without affecting tab order`,
              recommendation: 'Verify tab order matches expected reading flow'
            });
          }
        }
      });

      // Report issues for manual review
      if (manualReviewItems.length > 0) {
        // Deduplicate and sort by severity
        const severityOrder = { serious: 0, moderate: 1, minor: 2 };
        manualReviewItems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        // Report top issues (limit to 10 to avoid noise)
        const topIssues = manualReviewItems.slice(0, 10);
        
        topIssues.forEach(item => {
          const element = document.querySelector(item.selector) || document.body;
          
          addIssue(item.severity, '2.4.3',
            item.message,
            element,
            item.recommendation,
            true // needsManualReview flag
          );
        });

        // Store detailed analysis for manual review
        results.focusOrderAnalysis = {
          totalChecked: focusable.length,
          itemsFlaggedForReview: manualReviewItems.length,
          positiveTabindexCount: manualReviewItems.filter(i => i.type === 'positive-tabindex').length,
          visualMismatchCount: manualReviewItems.filter(i => i.type === 'visual-dom-mismatch').length,
          cssOrderCount: manualReviewItems.filter(i => i.type === 'css-order-used').length,
          details: manualReviewItems,
          status: 'manual-review-required'
        };

        if (manualReviewItems.length > 10) {
          results.recommendations.push({
            priority: 'high',
            issue: 'Multiple focus order issues flagged for manual review',
            count: manualReviewItems.length,
            action: 'Review focusOrderAnalysis.details for complete list of elements requiring verification'
          });
        }
      } else {
        results.focusOrderAnalysis = {
          totalChecked: focusable.length,
          itemsFlaggedForReview: 0,
          status: 'passed'
        };
      }
    }

    testFocusOrderMatchesVisualOrder();

    // ============================================================
    // 5. Detect Potential Keyboard Traps
    // ============================================================

    // Modals without visible close
    const modals = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    modals.forEach(modal => {
      if (!isVisible(modal)) return;
      
      const closeButton = modal.querySelector(
        '[aria-label*="close" i], [aria-label*="dismiss" i], button[class*="close"], .close-button'
      );
      const focusable = modal.querySelectorAll(FOCUSABLE_SELECTOR);
      
      if (focusable.length > 0 && !closeButton) {
        results.summary.potentialTraps++;
        addIssue('serious', '2.1.2', 'Modal dialog may trap keyboard focus (no close button found)', modal,
          'Add accessible close button and Escape key handler');
      }
    });

    // Multiple positive tabindex values
    const tabindexElements = document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])');
    if (tabindexElements.length > 3) {
      results.summary.potentialTraps++;
      addIssue('moderate', '2.1.2', 
        `Multiple positive tabindex values (${tabindexElements.length}) may create confusing navigation`, 
        document.body,
        'Remove positive tabindex values; use DOM order for focus sequence');
    }

    // ============================================================
    // 6. Generate Recommendations
    // ============================================================

    if (results.summary.positiveTabindex > 0) {
      results.recommendations.push({
        priority: 'high',
        issue: 'Positive tabindex values disrupt natural tab order',
        count: results.summary.positiveTabindex,
        action: 'Remove all positive tabindex values and reorder DOM if needed'
      });
    }

    if (results.summary.withoutAccessibleName > 0) {
      results.recommendations.push({
        priority: 'critical',
        issue: 'Focusable elements without accessible names',
        count: results.summary.withoutAccessibleName,
        action: 'Add aria-label or visible text to all interactive elements'
      });
    }

    if (results.summary.interactiveNotFocusable > 0) {
      results.recommendations.push({
        priority: 'high',
        issue: 'Interactive elements not keyboard accessible',
        count: results.summary.interactiveNotFocusable,
        action: 'Add tabindex="0" and keyboard handlers, or use semantic elements'
      });
    }

    if (results.summary.potentialTraps > 0) {
      results.recommendations.push({
        priority: 'critical',
        issue: 'Potential keyboard traps detected',
        count: results.summary.potentialTraps,
        action: 'Ensure all modal dialogs have Escape key support and visible close button'
      });
    }

    // ============================================================
    // Finalize
    // ============================================================

    results.meta.executionTimeMs = Math.round(performance.now() - startTime);

    // Sort issues by severity
    const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    results.issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return results;
  }

  // Export
  global.auditKeyboardNavigation = auditKeyboardNavigation;
  global.runKeyboardAudit = auditKeyboardNavigation; // Alias used by audit-init.js componentMap

  console.log(' Keyboard Navigation Audit Script loaded');
  console.log('  Run: auditKeyboardNavigation()');
  console.log('  Tests: WCAG 2.1.1, 2.1.2, 2.4.3, 2.4.7, 4.1.2');

})(typeof window !== 'undefined' ? window : global);
