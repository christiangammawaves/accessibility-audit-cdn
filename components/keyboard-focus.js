/**
 * Keyboard Focus Accessibility Audit
 * WCAG: 2.1.1, 2.1.4, 2.4.7, 2.4.11, 2.4.12, 2.4.13
 */

function runKeyboardFocusAudit() {
  'use strict';

  const startTime = performance.now();

  // ============================================================
  // Configuration
  // ============================================================

  const CONFIG = {
    maxElements: 300,
    focusMinThickness: 2,     // 2.4.13 minimum focus indicator thickness
    focusMinContrast: 3.0,    // 2.4.13 minimum contrast ratio
    checkObscured: true
  };

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([type="hidden"]):not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'details',
    'summary',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="slider"]',
    '[role="switch"]',
    '[role="tab"]'
  ].join(', ');

  // ============================================================
  // Helper Functions
  // ============================================================

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('keyboard-focus', 'Interactive elements, focus indicators, and keyboard shortcuts');
  const { isVisible: isElementVisible, getSelector } = h;

  /**
   * Check if site uses :focus-visible CSS pattern
   * This is critical because getComputedStyle() cannot capture :focus-visible styles
   * when elements are programmatically focused with .focus()
   * 
   * @returns {Object} { found: boolean, count: number, samples: string[] }
   */
  function checkForFocusVisibleCSS() {
    const focusVisibleRules = [];
    
    try {
      for (const sheet of document.styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule.cssText && rule.cssText.includes(':focus-visible')) {
              // Check if rule has actual visible styles (outline, box-shadow, border)
              if (rule.cssText.includes('outline') || 
                  rule.cssText.includes('box-shadow') ||
                  rule.cssText.includes('border')) {
                focusVisibleRules.push(rule.cssText.slice(0, 150));
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheets will throw - skip silently
        }
      }
    } catch (e) {
      // Stylesheet access failed
    }
    
    return {
      found: focusVisibleRules.length > 0,
      count: focusVisibleRules.length,
      samples: focusVisibleRules.slice(0, 5)
    };
  }

  // H1 fix: Delegate to shared-helpers instead of duplicating color utilities
  const parseColor = (global.a11yHelpers && global.a11yHelpers.parseColor) || function(c) { return null; };
  const getContrastRatio = (global.a11yHelpers && global.a11yHelpers.getContrastRatio) || function(c1, c2) { return null; };
  const getBackgroundColor = (global.a11yHelpers && global.a11yHelpers.getBackgroundColor) || function() { return { r: 255, g: 255, b: 255 }; };

  // ============================================================
  // Audit Functions
  // ============================================================

  function auditCharacterKeyShortcuts() {
    const issues = [];
    
    // Check for single-character key event listeners
    const elementsWithListeners = document.querySelectorAll('[onkeydown], [onkeypress], [onkeyup]');
    
    elementsWithListeners.forEach(element => {
      const onkeydown = element.getAttribute('onkeydown') || '';
      const onkeypress = element.getAttribute('onkeypress') || '';
      const onkeyup = element.getAttribute('onkeyup') || '';
      
      // Look for single character key detection patterns
      const singleCharPattern = /event\.key\s*==\s*['"]\w['"]|keyCode\s*==\s*\d{2}(?!\d)/i;
      
      if (singleCharPattern.test(onkeydown + onkeypress + onkeyup)) {
        issues.push({
          severity: 'moderate',
          wcag: '2.1.4',
          criterion: '2.1.4 Character Key Shortcuts',
          message: 'Single-character keyboard shortcut detected',
          selector: getSelector(element),
          element: element.outerHTML.slice(0, 200),
          fix: 'Ensure shortcuts can be turned off, remapped, or only active when component has focus',
          impact: 'moderate'
        });
      }
    });
    
    // Check for global key handlers (harder to detect - flag for manual review)
    const scripts = document.querySelectorAll('script:not([src])');
    let hasGlobalKeyHandlers = false;
    
    scripts.forEach(script => {
      const content = script.textContent || '';
      if (/addEventListener\s*\(\s*['"]keydown['"]|addEventListener\s*\(\s*['"]keypress['"]/i.test(content)) {
        hasGlobalKeyHandlers = true;
      }
    });
    
    if (hasGlobalKeyHandlers) {
      issues.push({
        severity: 'minor',
        wcag: '2.1.4',
        criterion: '2.1.4 Character Key Shortcuts',
        message: 'Global keyboard event listeners detected',
        selector: 'body',
        element: '<body>...</body>',
        fix: 'If using single-character shortcuts, ensure they can be turned off or remapped',
        impact: 'minor'
      });
    }

    results.stats.elementsScanned += elementsWithListeners.length + scripts.length;
    return issues;
  }

  function auditFocusAppearance() {
    const issues = [];
    
    // FIRST: Check if site uses :focus-visible CSS pattern
    // This is critical because getComputedStyle() won't capture :focus-visible styles
    // when elements are programmatically focused
    const hasFocusVisibleRules = checkForFocusVisibleCSS();
    
    if (hasFocusVisibleRules.found) {
      // Site uses :focus-visible - flag for manual verification instead of false positives
      issues.push({
        severity: 'minor',
        wcag: '2.4.7',
        criterion: '2.4.7 Focus Visible',
        message: `Site uses :focus-visible CSS pattern (${hasFocusVisibleRules.count} rules found)`,
        selector: 'body',
        element: '<body>...</body>',
        fix: 'MANUAL VERIFICATION REQUIRED: Tab through page with keyboard to verify focus indicators are visible. getComputedStyle() cannot detect :focus-visible styles.',
        impact: 'minor'
      });
      
      // Skip the element-by-element focus check since it will produce false positives
      results.stats.elementsScanned += document.querySelectorAll(FOCUSABLE_SELECTOR).length;
      return issues;
    }
    
    const focusableElements = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(el => isElementVisible(el))
      .slice(0, CONFIG.maxElements);
    
    const activeElement = document.activeElement;
    
    focusableElements.forEach(element => {
      try {
        // Temporarily focus to check :focus styles
        const originalFocus = document.activeElement;
        element.focus();
        
        const focusedStyle = window.getComputedStyle(element);
        
        // Check outline
        const outlineWidth = parseFloat(focusedStyle.outlineWidth);
        const outlineStyle = focusedStyle.outlineStyle;
        const outlineColor = parseColor(focusedStyle.outlineColor);
        
        // Check box-shadow (alternative focus indicator)
        const boxShadow = focusedStyle.boxShadow;
        
        // Check border changes
        const borderWidth = parseFloat(focusedStyle.borderWidth);
        const borderColor = parseColor(focusedStyle.borderColor);
        
        const hasOutline = outlineStyle !== 'none' && outlineWidth > 0;
        const hasBoxShadow = boxShadow && boxShadow !== 'none';
        const hasBorder = borderWidth > 0;
        
        // 2.4.13: Check if ANY focus indicator exists
        if (!hasOutline && !hasBoxShadow && !hasBorder) {
          issues.push({
            severity: 'serious',
            wcag: '2.4.13',
            criterion: '2.4.13 Focus Appearance',
            message: 'No visible focus indicator detected',
            selector: getSelector(element),
            element: element.outerHTML.slice(0, 200),
            fix: 'Add a visible focus indicator (outline, box-shadow, or border change)',
            impact: 'serious'
          });
        }
        
        // 2.4.13: Check focus indicator thickness (minimum 2px)
        if (hasOutline && outlineWidth < CONFIG.focusMinThickness) {
          issues.push({
            severity: 'moderate',
            wcag: '2.4.13',
            criterion: '2.4.13 Focus Appearance',
            message: `Focus indicator is ${outlineWidth}px thick, below 2px minimum`,
            selector: getSelector(element),
            element: element.outerHTML.slice(0, 200),
            fix: 'Increase focus indicator thickness to at least 2px',
            impact: 'moderate'
          });
        }
        
        // 2.4.13: Check focus indicator contrast
        if (hasOutline && outlineColor) {
          const bgColor = getBackgroundColor(element);
          const contrast = getContrastRatio(outlineColor, bgColor);
          
          if (contrast && contrast < CONFIG.focusMinContrast) {
            issues.push({
              severity: 'serious',
              wcag: '2.4.13',
              criterion: '2.4.13 Focus Appearance',
              message: `Focus indicator contrast ${contrast.toFixed(2)}:1 is below 3:1 minimum`,
              selector: getSelector(element),
              element: element.outerHTML.slice(0, 200),
              fix: 'Increase contrast between focus indicator and background',
              impact: 'serious'
            });
          }
        }
        
        // Restore original focus
        if (originalFocus && originalFocus !== element) {
          originalFocus.focus();
        } else {
          element.blur();
        }
        
      } catch (e) {
        // Element may not be focusable or focus call failed
      }
    });
    
    // Restore original focus state
    if (activeElement && activeElement !== document.body) {
      try {
        activeElement.focus();
      } catch (e) {}
    }

    results.stats.elementsScanned += focusableElements.length;
    return issues;
  }

  function auditFocusNotObscured() {
    const issues = [];
    
    if (!CONFIG.checkObscured) return issues;
    
    const focusableElements = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(el => isElementVisible(el))
      .slice(0, CONFIG.maxElements);
    
    // Find sticky/fixed elements that might obscure focus
    const fixedCheckStart = performance.now();
    const fixedElements = [];
    const fixedAllEls = document.querySelectorAll('[style*="position"], header, nav, footer, [class*="sticky"], [class*="fixed"]');
    for (let i = 0; i < fixedAllEls.length; i++) {
      if (i % 500 === 0 && performance.now() - fixedCheckStart > 2000) break; // 2s timeout guard
      const style = h.getStyle(fixedAllEls[i]);
      if ((style.position === 'fixed' || style.position === 'sticky') && isElementVisible(fixedAllEls[i])) {
        fixedElements.push(fixedAllEls[i]);
      }
    }
    
    if (fixedElements.length === 0) return issues;
    
    focusableElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      
      fixedElements.forEach(fixedEl => {
        const fixedRect = fixedEl.getBoundingClientRect();
        
        // Check if fixed element overlaps with focusable element
        const overlaps = !(
          rect.right < fixedRect.left ||
          rect.left > fixedRect.right ||
          rect.bottom < fixedRect.top ||
          rect.top > fixedRect.bottom
        );
        
        if (overlaps) {
          // Calculate overlap percentage
          const overlapLeft = Math.max(rect.left, fixedRect.left);
          const overlapRight = Math.min(rect.right, fixedRect.right);
          const overlapTop = Math.max(rect.top, fixedRect.top);
          const overlapBottom = Math.min(rect.bottom, fixedRect.bottom);
          
          const overlapWidth = overlapRight - overlapLeft;
          const overlapHeight = overlapBottom - overlapTop;
          const overlapArea = overlapWidth * overlapHeight;
          
          const elementArea = rect.width * rect.height;
          const overlapPercent = (overlapArea / elementArea) * 100;
          
          // 2.4.11 (AA): At least partially visible
          if (overlapPercent > 80) {
            issues.push({
              severity: 'serious',
              wcag: '2.4.11',
              criterion: '2.4.11 Focus Not Obscured',
              message: `Element is ${Math.round(overlapPercent)}% obscured by fixed/sticky element`,
              selector: getSelector(element),
              element: element.outerHTML.slice(0, 200),
              fix: 'Ensure focused elements are not mostly hidden by fixed headers/footers',
              impact: 'serious'
            });
          }
          
          // 2.4.12 (AAA): Fully visible
          if (overlapPercent > 0) {
            issues.push({
              severity: 'moderate',
              wcag: '2.4.12',
              criterion: '2.4.12 Focus Not Obscured (Enhanced)',
              message: `Element is partially obscured by fixed/sticky element`,
              selector: getSelector(element),
              element: element.outerHTML.slice(0, 200),
              fix: 'Ensure focused elements are fully visible (AAA requirement)',
              impact: 'moderate'
            });
          }
        }
      });
    });

    results.stats.elementsScanned += focusableElements.length;
    return issues;
  }

  // ============================================================
  // Accesskey Validation (WCAG 2.1.4)
  // Migrated from comprehensive-audit.js auditAccesskeys()
  // ============================================================

  function auditAccesskeys() {
    const issues = [];
    const accesskeyElements = document.querySelectorAll('[accesskey]');
    const usedKeys = new Map();

    accesskeyElements.forEach(el => {
      if (!isElementVisible(el)) return;
      results.stats.elementsScanned++;

      const key = (el.getAttribute('accesskey') || '').toLowerCase();

      // Duplicate accesskey detection
      if (usedKeys.has(key)) {
        issues.push({
          severity: 'serious',
          wcag: '2.1.4',
          criterion: 'Character Key Shortcuts',
          message: 'Duplicate accesskey "' + key + '" found',
          selector: getSelector(el),
          element: h.getElementSnippet(el),
          fix: 'Use unique accesskey values or remove conflicting duplicates',
          impact: getDefaultImpact('serious')
        });
      }
      usedKeys.set(key, el);

      // Reserved key conflict with browser/AT shortcuts
      var reservedKeys = 'abcdefghijklmnopqrstuvwxyz';
      if (key.length === 1 && reservedKeys.indexOf(key) !== -1) {
        issues.push({
          severity: 'minor',
          wcag: '2.1.4',
          criterion: 'Character Key Shortcuts',
          message: 'Accesskey "' + key + '" may conflict with assistive technology shortcuts',
          selector: getSelector(el),
          element: h.getElementSnippet(el),
          fix: 'Consider using less common keys or provide way to remap/disable shortcuts',
          impact: getDefaultImpact('minor')
        });
      }

      // Missing accessible name on accesskey element
      var text = (el.textContent || '').trim();
      var ariaLabel = el.getAttribute('aria-label');
      var title = el.getAttribute('title');

      if (!text && !ariaLabel && !title) {
        issues.push({
          severity: 'moderate',
          wcag: '2.1.4',
          criterion: 'Character Key Shortcuts',
          message: 'Element with accesskey has no accessible name',
          selector: getSelector(el),
          element: h.getElementSnippet(el),
          fix: 'Add text content, aria-label, or title to describe accesskey function',
          impact: getDefaultImpact('moderate')
        });
      }
    });

    if (accesskeyElements.length > 0 && issues.length === 0) {
      addPassed('2.1.4', 'Character Key Shortcuts',
        accesskeyElements.length + ' accesskey element(s) use unique, non-conflicting keys with accessible names');
    }

    return issues;
  }

  // ============================================================
  // Keyboard Access Checks (WCAG 2.1.1)
  // Migrated from comprehensive-audit.js auditKeyboard()
  // ============================================================

  function auditKeyboardAccess() {
    var issues = [];

    // onclick without keyboard handler detection
    var onclickElements = document.querySelectorAll(
      '[onclick]:not(a):not(button):not(input):not(select):not(textarea):not(summary):not([role="button"])'
    );
    onclickElements.forEach(function(el) {
      if (!isElementVisible(el)) return;
      results.stats.elementsScanned++;

      var hasKeyHandler = el.hasAttribute('onkeydown') || el.hasAttribute('onkeyup') || el.hasAttribute('onkeypress');
      var hasTabindex = el.getAttribute('tabindex') !== null;
      var hasRole = el.getAttribute('role');

      if (!hasKeyHandler) {
        issues.push({
          severity: 'serious',
          wcag: '2.1.1',
          criterion: 'Keyboard',
          message: 'Element with onclick has no keyboard event handler',
          selector: getSelector(el),
          element: el.outerHTML.slice(0, 200),
          fix: 'Add onkeydown handler that responds to Enter/Space, or use a <button> element instead',
          impact: 'serious'
        });
      }

      if (!hasTabindex && !hasRole) {
        issues.push({
          severity: 'serious',
          wcag: '2.1.1',
          criterion: 'Keyboard',
          message: 'Clickable element is not keyboard focusable',
          selector: getSelector(el),
          element: el.outerHTML.slice(0, 200),
          fix: 'Add tabindex="0" and appropriate role (e.g., role="button")',
          impact: 'serious'
        });
      }
    });

    // Custom interactive elements without tabindex
    var customInteractive = document.querySelectorAll(
      '[role="button"]:not(button):not(a):not(input), [role="switch"], [role="menuitem"], ' +
      '[role="tab"]:not(button), [role="slider"], [role="spinbutton"]'
    );
    customInteractive.forEach(function(el) {
      if (!isElementVisible(el)) return;
      results.stats.elementsScanned++;

      var tabindex = el.getAttribute('tabindex');
      if (tabindex === null) {
        issues.push({
          severity: 'serious',
          wcag: '2.1.1',
          criterion: 'Keyboard',
          message: 'Custom interactive element (' + el.getAttribute('role') + ') missing tabindex',
          selector: getSelector(el),
          element: el.outerHTML.slice(0, 200),
          fix: 'Add tabindex="0" to make element keyboard focusable',
          impact: 'serious'
        });
      }
    });

    return issues;
  }

  // ============================================================
  // Focus Style Checks (WCAG 2.4.7)
  // Migrated from comprehensive-audit.js auditFocus()
  // ============================================================

  function auditFocusStyles() {
    var issues = [];

    // CSS stylesheet scan for outline: none on :focus without alternatives
    try {
      for (var s = 0; s < document.styleSheets.length; s++) {
        try {
          var rules = document.styleSheets[s].cssRules || [];
          for (var r = 0; r < rules.length; r++) {
            var rule = rules[r];
            if (!rule.selectorText || !rule.style) continue;
            var selector = rule.selectorText;

            if (/:focus/.test(selector) && !/:focus-visible/.test(selector)) {
              var outlineValue = rule.style.outline || rule.style.outlineStyle || '';
              var outlineWidth = rule.style.outlineWidth || '';
              var hasOutlineNone = /^none$/i.test(outlineValue) || /^0(px)?$/i.test(outlineWidth) || outlineValue === '0';

              if (hasOutlineNone) {
                // Check for alternative focus indicators
                var hasBoxShadow = rule.style.boxShadow && rule.style.boxShadow !== 'none';
                var hasBorderChange = rule.style.border || rule.style.borderColor || rule.style.borderWidth;
                var hasBackgroundChange = rule.style.backgroundColor || rule.style.background;

                if (!hasBoxShadow && !hasBorderChange && !hasBackgroundChange) {
                  issues.push({
                    severity: 'serious',
                    wcag: '2.4.7',
                    criterion: '2.4.7 Focus Visible',
                    message: 'CSS rule removes focus outline without alternative: ' + selector.substring(0, 80),
                    selector: 'stylesheet',
                    element: rule.cssText.slice(0, 200),
                    fix: 'Replace outline:none with a visible focus indicator (box-shadow, border, or background change)',
                    impact: 'serious'
                  });
                }
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheet, skip
        }
      }
    } catch (e) {}

    // Fixed/sticky element detection for WCAG 2.4.11 focus-not-obscured
    var fixedStickyElements = [];
    var allPotential = document.querySelectorAll('header, nav, footer, [class*="sticky"], [class*="fixed"], [style*="position"]');
    allPotential.forEach(function(el) {
      if (!isElementVisible(el)) return;
      try {
        var style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          fixedStickyElements.push(el);
        }
      } catch (e) {}
    });

    if (fixedStickyElements.length > 0) {
      addManualCheck('2.4.11', 'Fixed/sticky elements may obscure focused content',
        fixedStickyElements.length + ' fixed/sticky element(s) found. Verify that when keyboard focus moves to elements near these areas, the focused element is not fully obscured.');
    }

    return issues;
  }

  // ============================================================
  // Main Audit Function
  // ============================================================

  function runAudit() {
    const issues = [];

    // 2.1.1 Keyboard Access
    const keyboardAccessIssues = auditKeyboardAccess();
    issues.push(...keyboardAccessIssues);

    // 2.1.4 Character Key Shortcuts
    const shortcutIssues = auditCharacterKeyShortcuts();
    issues.push(...shortcutIssues);

    // 2.1.4 Accesskey Validation
    const accesskeyIssues = auditAccesskeys();
    issues.push(...accesskeyIssues);

    // 2.4.7 Focus Styles
    const focusStyleIssues = auditFocusStyles();
    issues.push(...focusStyleIssues);

    // 2.4.13 Focus Appearance
    const appearanceIssues = auditFocusAppearance();
    issues.push(...appearanceIssues);

    // 2.4.11 & 2.4.12 Focus Not Obscured
    const obscuredIssues = auditFocusNotObscured();
    issues.push(...obscuredIssues);

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
  window.runKeyboardFocusAudit = runKeyboardFocusAudit;
}
