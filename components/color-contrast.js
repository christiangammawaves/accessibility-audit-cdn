/**
 * Color Contrast Accessibility Audit
 * WCAG: 1.4.3, 1.4.6, 1.4.11
 */

function runColorContrastAudit() {
  'use strict';

  const startTime = performance.now();
  const passed = [];
  const manualChecks = [];
  let elementsScanned = 0;

  // ============================================================
  // Configuration
  // ============================================================

  const CONFIG = {
    // AA Level Requirements (1.4.3)
    normalTextMinContrast: 4.5,
    largeTextMinContrast: 3.0,
    
    // AAA Level Requirements (1.4.6)
    normalTextEnhancedContrast: 7.0,
    largeTextEnhancedContrast: 4.5,
    
    // AA Level Requirements (1.4.11)
    uiComponentMinContrast: 3.0,
    
    // Text size thresholds
    largeTextSizePx: 24,
    largeTextBoldSizePx: 18.67,
    boldFontWeight: 700,
    
    // Limits
    maxTextElements: 1000,
    maxUIElements: 300,
    minTextLength: 1,
    prioritizeViewport: true
  };

  // ============================================================
  // Color Utility Functions
  // ============================================================

  function parseColor(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return null;
    }
    
    const rgbaMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1], 10),
        g: parseInt(rgbaMatch[2], 10),
        b: parseInt(rgbaMatch[3], 10),
        a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
      };
    }
    
    const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i);
    if (hexMatch) {
      return {
        r: parseInt(hexMatch[1], 16),
        g: parseInt(hexMatch[2], 16),
        b: parseInt(hexMatch[3], 16),
        a: hexMatch[4] !== undefined ? parseInt(hexMatch[4], 16) / 255 : 1
      };
    }
    
    const shortHexMatch = color.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
    if (shortHexMatch) {
      return {
        r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
        g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
        b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16),
        a: 1
      };
    }
    
    return null;
  }

  function blendColors(fg, bg) {
    // M4 fix: Warn when both colors are missing instead of silently defaulting to white
    if (!fg && !bg) {
      if (typeof console !== 'undefined') console.warn('[color-contrast] blendColors: both fg and bg are null/undefined, defaulting to white');
      return { r: 255, g: 255, b: 255 };
    }
    if (!fg || !bg) return bg || fg || { r: 255, g: 255, b: 255 };
    
    const alpha = fg.a !== undefined ? fg.a : 1;
    if (alpha >= 1) return { r: fg.r, g: fg.g, b: fg.b };
    if (alpha <= 0) return { r: bg.r, g: bg.g, b: bg.b };
    
    return {
      r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
      g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
      b: Math.round(fg.b * alpha + bg.b * (1 - alpha))
    };
  }

  function sRGBtoLinear(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function getLuminance(color) {
    if (!color) return 0;
    return 0.2126 * sRGBtoLinear(color.r) + 0.7152 * sRGBtoLinear(color.g) + 0.0722 * sRGBtoLinear(color.b);
  }

  function getContrastRatio(color1, color2) {
    if (!color1 || !color2) return null;
    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // H4 fix: Calculate effective opacity including all ancestor opacities
  function getEffectiveOpacity(element) {
    var opacity = 1;
    var current = element;
    var maxDepth = 20;
    while (current && current !== document.documentElement && maxDepth-- > 0) {
      var style = window.getComputedStyle(current);
      var currentOpacity = parseFloat(style.opacity);
      if (!isNaN(currentOpacity)) {
        opacity *= currentOpacity;
      }
      current = current.parentElement;
    }
    return opacity;
  }

  function colorToHex(color) {
    if (!color) return 'unknown';
    const toHex = (n) => {
      const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  }

  // ============================================================
  // Element Analysis Functions
  // ============================================================

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('color-contrast', 'Text elements, UI components, and graphical objects');
  const { isVisible, getSelector } = h;

  function getTextContent(element) {
    const text = (element.textContent || '').trim();
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }

  function getEffectiveBackground(element) {
    let current = element;
    let backgrounds = [];
    let ancestorChain = []; // Track ancestors for manual review context
    let hasTransparentAncestor = false;
    // M5 fix: Cap ancestor depth to prevent memory bloat on deeply nested DOMs
    const MAX_ANCESTOR_DEPTH = 20;
    let depth = 0;

    while (current && current !== document.documentElement && depth < MAX_ANCESTOR_DEPTH) {
      depth++;
      const style = window.getComputedStyle(current);
      const bg = parseColor(style.backgroundColor);
      
      // Track if we encountered transparent backgrounds
      if (!bg || bg.a === 0) {
        hasTransparentAncestor = true;
        ancestorChain.push({
          element: current,
          backgroundColor: style.backgroundColor,
          isTransparent: true
        });
      } else if (bg && bg.a > 0) {
        backgrounds.push(bg);
        ancestorChain.push({
          element: current,
          backgroundColor: style.backgroundColor,
          isTransparent: false
        });
        if (bg.a >= 1) break; // Found fully opaque background
      }
      
      // Check for background images
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        if (style.backgroundImage.includes('gradient')) {
          return {
            color: null,
            hasImage: true,
            hasGradient: true,
            hasTransparentAncestor,
            ancestorChain
          };
        }
        return {
          color: null,
          hasImage: true,
          hasGradient: false,
          hasTransparentAncestor,
          ancestorChain
        };
      }
      
      current = current.parentElement;
    }
    
    // If we walked all the way up without finding opaque background
    if (backgrounds.length === 0) {
      return { 
        color: { r: 255, g: 255, b: 255 }, 
        hasImage: false,
        hasTransparentAncestor,
        ancestorChain,
        assumedWhite: true // Flag that we assumed white background
      };
    }
    
    // Blend backgrounds from bottom to top
    let result = { r: 255, g: 255, b: 255 };
    for (let i = backgrounds.length - 1; i >= 0; i--) {
      result = blendColors(backgrounds[i], result);
    }
    
    return { 
      color: result, 
      hasImage: false,
      hasTransparentAncestor,
      ancestorChain,
      assumedWhite: false
    };
  }

  /**
   * E3: Shared viewport-proximity sampler used by both contrast audit functions.
   * Sorts elements so in-viewport ones come first, then clips to maxCount.
   * @param {NodeList|Element[]} elements
   * @param {number} maxCount
   * @returns {Element[]}
   */
  function sampleByViewportProximity(elements, maxCount) {
    if (!CONFIG.prioritizeViewport) return Array.from(elements).slice(0, maxCount);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return Array.from(elements)
      .sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const inA = ra.top < vh && ra.bottom > 0 && ra.left < vw && ra.right > 0;
        const inB = rb.top < vh && rb.bottom > 0 && rb.left < vw && rb.right > 0;
        if (inA && !inB) return -1;
        if (!inA && inB) return 1;
        return ra.top - rb.top;
      })
      .slice(0, maxCount);
  }

  function isLargeText(element) {
    const style = window.getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize);
    const fontWeight = parseInt(style.fontWeight) || 400;
    
    if (fontSize >= CONFIG.largeTextSizePx) return true;
    if (fontSize >= CONFIG.largeTextBoldSizePx && fontWeight >= CONFIG.boldFontWeight) return true;
    return false;
  }

  // ============================================================
  // Audit Functions
  // ============================================================

  function auditMinimumTextContrast() {
    const issues = [];
    
    const textElements = document.querySelectorAll(
      'p, span, div, a, button, label, h1, h2, h3, h4, h5, h6, ' +
      'li, td, th, caption, figcaption, blockquote, cite, ' +
      'small, strong, em, mark, legend, dt, dd'
    );
    
    const checked = new Set();
    let count = 0;

    // E3: Use shared viewport-proximity sampler
    const sortedElements = sampleByViewportProximity(textElements, CONFIG.maxTextElements);

    for (const element of sortedElements) {
      if (count >= CONFIG.maxTextElements) {
        console.warn(`Color contrast audit: Reached ${CONFIG.maxTextElements} element limit.`);
        break;
      }
      if (!isVisible(element)) continue;
      
      const hasDirectText = Array.from(element.childNodes)
        .some(node => node.nodeType === 3 && node.textContent.trim().length >= CONFIG.minTextLength);
      
      if (!hasDirectText) continue;
      
      const selector = getSelector(element);
      if (checked.has(selector)) continue;
      checked.add(selector);
      count++;
      
      const style = window.getComputedStyle(element);
      let textColor = parseColor(style.color);

      if (!textColor) continue;

      // H4 fix: Factor in effective opacity (element + all ancestors), not just element opacity
      const effectiveOpacity = getEffectiveOpacity(element);
      if (effectiveOpacity < 0.95) {
        textColor = { r: textColor.r, g: textColor.g, b: textColor.b, a: (textColor.a || 1) * effectiveOpacity };
      }

      // A8: CSS filter may alter perceived contrast — flag for manual review
      if (style.filter && style.filter !== 'none' && /brightness|contrast|saturate|invert|opacity/.test(style.filter)) {
        manualChecks.push({
          wcag: '1.4.3',
          message: `CSS filter "${style.filter}" may affect perceived text contrast — verify manually.`,
          element: selector
        });
      }

      const bgResult = getEffectiveBackground(element);

      if (bgResult.hasGradient) {
        manualChecks.push({
          wcag: '1.4.3',
          message: 'Text over gradient background — verify contrast at both ends manually.',
          howToTest: 'Sample the lightest and darkest points of the gradient behind this text and check contrast ratio against the text color at both endpoints.',
          element: getSelector(element)
        });
        continue; // Skip automated ratio check
      }

      if (bgResult.hasImage) {
        issues.push({
          type: 'text-over-image',
          wcag: '1.4.3',
          criterion: 'Contrast (Minimum)',
          severity: 'moderate',
          element: selector,
          text: getTextContent(element),
          textColor: colorToHex(textColor),
          level: 'AA',
          needsManualReview: true,
          message: 'Text over background image - verify contrast manually',
          fix: 'Ensure text has 4.5:1 contrast against all parts of the background image'
        });
        continue;
      }

      const bgColor = bgResult.color;
      const effectiveTextColor = blendColors(textColor, bgColor);
      const ratio = getContrastRatio(effectiveTextColor, bgColor);
      
      if (!ratio) continue;
      
      const large = isLargeText(element);
      const required = large ? CONFIG.largeTextMinContrast : CONFIG.normalTextMinContrast;
      
      // Flag transparent backgrounds for manual review (even if calculated contrast passes)
      if (bgResult.hasTransparentAncestor && bgResult.assumedWhite) {
        issues.push({
          type: 'transparent-background',
          wcag: '1.4.3',
          criterion: 'Contrast (Minimum)',
          severity: 'minor',
          element: selector,
          text: getTextContent(element),
          textColor: colorToHex(effectiveTextColor),
          backgroundColor: colorToHex(bgColor),
          contrastRatio: Math.round(ratio * 100) / 100,
          requiredRatio: required,
          isLargeText: large,
          level: 'AA',
          needsManualReview: true,
          calculatedBackground: 'Assumed white (walked up DOM, no opaque background found)',
          message: `Element has transparent background ancestors - calculated contrast ${ratio.toFixed(2)}:1 assumes white background`,
          fix: 'Verify actual rendered background color matches assumption. Check if parent elements have dynamic backgrounds, gradients, or images loaded via JavaScript.'
        });
        // Continue to also report contrast issue if it fails
      }
      
      if (ratio < required) {
        const severity = ratio < (required * 0.5) ? 'critical' :
                        ratio < (required * 0.75) ? 'serious' : 'moderate';

        issues.push({
          type: 'text-contrast',
          wcag: '1.4.3',
          criterion: 'Contrast (Minimum)',
          severity,
          element: selector,
          text: getTextContent(element),
          textColor: colorToHex(effectiveTextColor),
          backgroundColor: colorToHex(bgColor),
          contrastRatio: Math.round(ratio * 100) / 100,
          requiredRatio: required,
          isLargeText: large,
          level: 'AA',
          backgroundNote: bgResult.hasTransparentAncestor ? 'Background calculated by walking up DOM through transparent ancestors' : undefined,
          message: `Text contrast ${ratio.toFixed(2)}:1 is below ${required}:1 minimum (WCAG AA)`,
          fix: `Increase contrast to at least ${required}:1`
        });
      }
    }

    elementsScanned += count;
    return issues;
  }

  function auditEnhancedTextContrast() {
    const issues = [];
    
    const textElements = document.querySelectorAll(
      'p, span, div, a, button, label, h1, h2, h3, h4, h5, h6, ' +
      'li, td, th, caption, figcaption, blockquote, cite, ' +
      'small, strong, em, mark, legend, dt, dd'
    );
    
    const checked = new Set();
    let count = 0;

    // E3: Use shared viewport-proximity sampler
    const sortedElements = sampleByViewportProximity(textElements, CONFIG.maxTextElements);

    for (const element of sortedElements) {
      if (count >= CONFIG.maxTextElements) break;
      if (!isVisible(element)) continue;
      
      const hasDirectText = Array.from(element.childNodes)
        .some(node => node.nodeType === 3 && node.textContent.trim().length >= CONFIG.minTextLength);
      
      if (!hasDirectText) continue;
      
      const selector = getSelector(element);
      if (checked.has(selector)) continue;
      checked.add(selector);
      count++;
      
      const style = window.getComputedStyle(element);
      const textColor = parseColor(style.color);
      
      if (!textColor) continue;
      
      const bgResult = getEffectiveBackground(element);
      
      if (bgResult.hasImage) {
        issues.push({
          type: 'text-over-image-enhanced',
          wcag: '1.4.6',
          criterion: 'Contrast (Enhanced)',
          level: 'AAA',
          severity: 'moderate',
          element: selector,
          text: getTextContent(element),
          textColor: colorToHex(textColor),
          needsManualReview: true,
          message: 'Text over background image - verify enhanced contrast (7:1) manually',
          fix: 'Ensure text has 7:1 contrast (4.5:1 for large text) against all parts of background'
        });
        continue;
      }
      
      const bgColor = bgResult.color;
      const effectiveTextColor = blendColors(textColor, bgColor);
      const ratio = getContrastRatio(effectiveTextColor, bgColor);
      
      if (!ratio) continue;
      
      const large = isLargeText(element);
      const required = large ? CONFIG.largeTextEnhancedContrast : CONFIG.normalTextEnhancedContrast;
      
      if (ratio < required) {
        const severity = ratio < (required * 0.5) ? 'serious' : 
                        ratio < (required * 0.75) ? 'moderate' : 'minor';
        
        issues.push({
          type: 'text-contrast-enhanced',
          wcag: '1.4.6',
          criterion: 'Contrast (Enhanced)',
          level: 'AAA',
          severity,
          element: selector,
          text: getTextContent(element),
          textColor: colorToHex(effectiveTextColor),
          backgroundColor: colorToHex(bgColor),
          contrastRatio: Math.round(ratio * 100) / 100,
          requiredRatio: required,
          isLargeText: large,
          message: `Enhanced contrast ${ratio.toFixed(2)}:1 is below AAA requirement of ${required}:1`,
          fix: `Increase contrast to ${required}:1 for AAA compliance`
        });
      }
    }

    elementsScanned += count;
    return issues;
  }

  function auditUIComponentContrast() {
    const issues = [];
    
    const uiComponents = document.querySelectorAll(
      'input:not([type="hidden"]), select, textarea, button, ' +
      '[role="button"], [role="checkbox"], [role="radio"], ' +
      '[role="switch"], [role="slider"], [role="tab"], ' +
      'a[href], summary, [tabindex]:not([tabindex="-1"])'
    );
    
    let count = 0;
    
    for (const element of uiComponents) {
      if (count >= CONFIG.maxUIElements) break;
      if (!isVisible(element)) continue;
      count++;
      
      const style = window.getComputedStyle(element);
      const selector = getSelector(element);
      
      const bgResult = getEffectiveBackground(element.parentElement || element);
      if (bgResult.hasImage) continue;
      
      const adjacentBg = bgResult.color;
      
      // Check border contrast
      const borderColor = parseColor(style.borderColor);
      const borderWidth = parseFloat(style.borderWidth);
      
      if (borderColor && borderWidth >= 1) {
        const effectiveBorder = blendColors(borderColor, adjacentBg);
        const borderRatio = getContrastRatio(effectiveBorder, adjacentBg);
        
        if (borderRatio && borderRatio < CONFIG.uiComponentMinContrast) {
          issues.push({
            type: 'ui-border-contrast',
            wcag: '1.4.11',
            criterion: 'Non-text Contrast',
            level: 'AA',
            severity: borderRatio < 2 ? 'serious' : 'moderate',
            element: selector,
            componentType: element.tagName.toLowerCase(),
            borderColor: colorToHex(effectiveBorder),
            backgroundColor: colorToHex(adjacentBg),
            contrastRatio: Math.round(borderRatio * 100) / 100,
            requiredRatio: CONFIG.uiComponentMinContrast,
            message: `UI component border contrast ${borderRatio.toFixed(2)}:1 is below 3:1 minimum`,
            fix: 'Increase border contrast to at least 3:1'
          });
        }
      }
      
      // Check background contrast for interactive elements
      if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button' || 
          element.tagName === 'A' || element.tagName === 'INPUT') {
        const bgColor = parseColor(style.backgroundColor);
        
        if (bgColor && bgColor.a > 0.1) {
          const effectiveBg = blendColors(bgColor, adjacentBg);
          const bgRatio = getContrastRatio(effectiveBg, adjacentBg);
          
          if (bgRatio && bgRatio < CONFIG.uiComponentMinContrast) {
            issues.push({
              type: 'ui-background-contrast',
              wcag: '1.4.11',
              criterion: 'Non-text Contrast',
              level: 'AA',
              severity: bgRatio < 2 ? 'serious' : 'moderate',
              element: selector,
              componentType: element.tagName.toLowerCase(),
              componentBackground: colorToHex(effectiveBg),
              adjacentBackground: colorToHex(adjacentBg),
              contrastRatio: Math.round(bgRatio * 100) / 100,
              requiredRatio: CONFIG.uiComponentMinContrast,
              message: `UI component background contrast ${bgRatio.toFixed(2)}:1 is below 3:1 minimum`,
              fix: 'Increase component background contrast to at least 3:1 against surrounding area'
            });
          }
        }
      }
      
      // Check focus indicator contrast
      const focusOutlineColor = parseColor(style.outlineColor);
      if (focusOutlineColor) {
        const effectiveFocus = blendColors(focusOutlineColor, adjacentBg);
        const focusRatio = getContrastRatio(effectiveFocus, adjacentBg);
        
        if (focusRatio && focusRatio < CONFIG.uiComponentMinContrast) {
          issues.push({
            type: 'focus-indicator-contrast',
            wcag: '1.4.11',
            criterion: 'Non-text Contrast',
            level: 'AA',
            severity: 'serious',
            element: selector,
            componentType: element.tagName.toLowerCase(),
            focusColor: colorToHex(effectiveFocus),
            backgroundColor: colorToHex(adjacentBg),
            contrastRatio: Math.round(focusRatio * 100) / 100,
            requiredRatio: CONFIG.uiComponentMinContrast,
            message: `Focus indicator contrast ${focusRatio.toFixed(2)}:1 is below 3:1 minimum`,
            fix: 'Increase focus indicator contrast to at least 3:1'
          });
        }
      }
    }

    elementsScanned += count;
    return issues;
  }

  // ============================================================
  // Main Audit Function
  // ============================================================

  function runAudit() {
    const issues = [];
    
    // 1.4.3 Minimum Contrast (AA)
    const minimumIssues = auditMinimumTextContrast();
    issues.push(...minimumIssues);
    
    // 1.4.6 Enhanced Contrast (AAA)
    const enhancedIssues = auditEnhancedTextContrast();
    issues.push(...enhancedIssues);
    
    // 1.4.11 Non-text Contrast (AA)
    const uiIssues = auditUIComponentContrast();
    issues.push(...uiIssues);
    
    return issues;
  }

  // ============================================================
  // Return Results
  // ============================================================

  const issues = runAudit();

  return {
    component: 'color-contrast',
    timestamp: new Date().toISOString(),
    url: window.location.href,
    scope: 'Text elements, UI components, and graphical objects',
    issues: issues,
    passed: passed,
    manualChecks: manualChecks,
    stats: {
      elementsScanned: elementsScanned,
      issuesFound: issues.length,
      passedChecks: passed.length,
      manualChecksNeeded: manualChecks.length,
      executionTimeMs: Math.round(performance.now() - startTime)
    }
  };
}

if (typeof window !== 'undefined') {
  window.runColorContrastAudit = runColorContrastAudit;
}
