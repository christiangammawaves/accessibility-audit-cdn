/**
 * WCAG 2.2 Mobile Accessibility Audit
 * WCAG: 2.5.2, 2.5.4, 2.5.7, 2.5.8
 */

function runWcag22MobileAudit() {
  'use strict';

  const startTime = performance.now();

  // ============================================================
  // Configuration
  // ============================================================

  const CONFIG = {
    targetSizeMinimum: 24, // 24x24px for WCAG 2.2 Level AA
    maxTargets: 500,
    checkDragging: true,
    checkMotion: true
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('wcag22-mobile', 'Touch targets, pointer gestures, motion actuation, and dragging movements');
  const { isVisible, getSelector } = h;

  // ============================================================
  // Audit Functions
  // ============================================================

  function auditPointerCancellation() {
    const issues = [];
    
    // Find elements with mousedown/touchstart handlers
    const interactiveElements = document.querySelectorAll(
      'button, a[href], [role="button"], [role="link"], [onclick], [tabindex="0"], ' +
      '[onmousedown], [ontouchstart], [onpointerdown]'
    );
    
    interactiveElements.forEach(element => {
      results.stats.elementsScanned++;
      if (!isVisible(element)) return;

      const hasMousedown = element.hasAttribute('onmousedown');
      const hasTouchstart = element.hasAttribute('ontouchstart');
      const hasPointerdown = element.hasAttribute('onpointerdown');
      const hasClick = element.hasAttribute('onclick') || element.hasAttribute('href');
      
      // mousedown without click may prevent cancellation
      if (hasMousedown && !hasClick) {
        issues.push({
          severity: 'moderate',
          wcag: '2.5.2',
          criterion: '2.5.2 Pointer Cancellation',
          message: 'Element uses mousedown event which may not allow cancellation',
          selector: getSelector(element),
          element: element.outerHTML.slice(0, 200),
          fix: 'Use click/mouseup event instead to allow pointer cancellation by moving away',
          impact: 'moderate'
        });
      }

      // touchstart without touchend may prevent cancellation
      if (hasTouchstart) {
        issues.push({
          severity: 'moderate',
          wcag: '2.5.2',
          criterion: '2.5.2 Pointer Cancellation',
          message: 'Element uses touchstart event which may not allow cancellation',
          selector: getSelector(element),
          element: element.outerHTML.slice(0, 200),
          fix: 'Use touchend/click event to allow users to cancel by moving finger away',
          impact: 'moderate'
        });
      }

      // pointerdown without pointerup may prevent cancellation
      if (hasPointerdown && !element.hasAttribute('onpointerup')) {
        issues.push({
          severity: 'moderate',
          wcag: '2.5.2',
          criterion: '2.5.2 Pointer Cancellation',
          message: 'Element uses pointerdown event without pointerup',
          selector: getSelector(element),
          element: element.outerHTML.slice(0, 200),
          fix: 'Use pointerup/click event or add proper pointer cancellation handling',
          impact: 'moderate'
        });
      }
    });
    
    return issues;
  }

  function auditMotionActuation() {
    const issues = [];

    if (!CONFIG.checkMotion) return issues;

    // Check for devicemotion/deviceorientation handlers
    const motionElements = document.querySelectorAll(
      '[ondevicemotion], [ondeviceorientation], ' +
      '[data-shake], [data-tilt], [data-motion], ' +
      '[class*="shake"], [class*="tilt-to"], [class*="motion-control"]'
    );

    motionElements.forEach(element => {
      results.stats.elementsScanned++;
      issues.push({
        severity: 'serious',
        wcag: '2.5.4',
        criterion: '2.5.4 Motion Actuation',
        message: 'Element appears to use device motion for functionality',
        selector: getSelector(element),
        element: element.outerHTML.slice(0, 200),
        fix: 'Provide UI control alternative to motion-activated features (shake, tilt, etc.)',
        impact: 'serious'
      });
    });
    
    // Check for gyroscope/accelerometer indicators
    const gyroElements = document.querySelectorAll(
      '[class*="gyro"], [class*="accelerometer"], [class*="parallax-tilt"]'
    );
    
    if (gyroElements.length > 0) {
      issues.push({
        severity: 'moderate',
        wcag: '2.5.4',
        criterion: '2.5.4 Motion Actuation',
        message: `${gyroElements.length} elements with gyroscope/accelerometer indicators detected`,
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Verify UI controls exist as alternatives to motion-based interactions',
        impact: 'moderate'
      });
    }
    
    // Check for device orientation API usage in scripts
    const scripts = document.querySelectorAll('script:not([src])');
    let hasMotionAPI = false;
    
    scripts.forEach(script => {
      const content = script.textContent || '';
      if (/addEventListener\s*\(\s*['"]devicemotion['"]|addEventListener\s*\(\s*['"]deviceorientation['"]/i.test(content)) {
        hasMotionAPI = true;
      }
    });
    
    if (hasMotionAPI) {
      issues.push({
        severity: 'moderate',
        wcag: '2.5.4',
        criterion: '2.5.4 Motion Actuation',
        message: 'Device motion/orientation API usage detected in scripts',
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Ensure all motion-triggered functions have UI button alternatives',
        impact: 'moderate'
      });
    }
    
    return issues;
  }

  function auditDraggingMovements() {
    const issues = [];
    
    if (!CONFIG.checkDragging) return issues;
    
    // Find draggable elements
    const draggableElements = document.querySelectorAll(
      '[draggable="true"], [data-draggable], [class*="draggable"], ' +
      '[class*="sortable"], [class*="drag-handle"]'
    );
    
    draggableElements.forEach(element => {
      results.stats.elementsScanned++;
      if (!isVisible(element)) return;

      // Check if there's a keyboard alternative or single-pointer alternative
      const hasKeyboardAlternative = element.hasAttribute('tabindex') && 
                                     (element.hasAttribute('onkeydown') || element.hasAttribute('onkeypress'));
      
      // Look for adjacent buttons that might provide single-pointer alternative
      const parent = element.parentElement;
      const hasMoveButtons = parent && (
        parent.querySelector('[aria-label*="move"], [title*="move"], [class*="move-up"], [class*="move-down"]') ||
        parent.querySelector('button[aria-label*="reorder"], button[title*="reorder"]')
      );
      
      if (!hasKeyboardAlternative && !hasMoveButtons) {
        issues.push({
          severity: 'serious',
          wcag: '2.5.7',
          criterion: '2.5.7 Dragging Movements',
          message: 'Draggable element lacks single-pointer alternative',
          selector: getSelector(element),
          element: element.outerHTML.slice(0, 200),
          fix: 'Provide buttons or keyboard controls as an alternative to drag-and-drop',
          impact: 'serious'
        });
      }
    });
    
    // Check for drag-and-drop libraries
    if (typeof Sortable !== 'undefined' || typeof dragula !== 'undefined') {
      issues.push({
        severity: 'moderate',
        wcag: '2.5.7',
        criterion: '2.5.7 Dragging Movements',
        message: 'Drag-and-drop library detected',
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Verify all draggable items have single-pointer alternatives (buttons, keyboard)',
        impact: 'moderate'
      });
    }
    
    return issues;
  }

  function auditTargetSize() {
    const issues = [];
    
    const minSize = CONFIG.targetSizeMinimum;
    
    // Interactive targets to check
    const targets = document.querySelectorAll(
      'a[href], button, input[type="button"], input[type="submit"], input[type="checkbox"], ' +
      'input[type="radio"], input[type="file"], select, ' +
      '[role="button"], [role="link"], [role="checkbox"], [role="radio"], ' +
      '[role="menuitem"], [role="tab"], [role="switch"], ' +
      '[onclick], [tabindex="0"]'
    );
    
    const targetRects = [];
    let count = 0;
    
    // Collect visible targets with their rects
    targets.forEach(target => {
      if (count >= CONFIG.maxTargets) return;
      if (!isVisible(target)) return;
      
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        targetRects.push({ element: target, rect });
        count++;
      }
    });
    
    // Check spacing exemption
    function checkSpacingExemption(rect, index) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const circleRadius = minSize / 2;
      
      for (let i = 0; i < targetRects.length; i++) {
        if (i === index) continue;
        
        const otherRect = targetRects[i].rect;
        const otherCenterX = otherRect.left + otherRect.width / 2;
        const otherCenterY = otherRect.top + otherRect.height / 2;
        
        const dx = centerX - otherCenterX;
        const dy = centerY - otherCenterY;
        const distanceBetweenCenters = Math.sqrt(dx * dx + dy * dy);
        
        const otherIsUndersized = otherRect.width < minSize || otherRect.height < minSize;
        
        if (otherIsUndersized) {
          if (distanceBetweenCenters < minSize) {
            return { passes: false, reason: 'circles-intersect' };
          }
        } else {
          const closestX = Math.max(otherRect.left, Math.min(centerX, otherRect.right));
          const closestY = Math.max(otherRect.top, Math.min(centerY, otherRect.bottom));
          
          const distToClosest = Math.sqrt(
            Math.pow(centerX - closestX, 2) + Math.pow(centerY - closestY, 2)
          );
          
          if (distToClosest < circleRadius) {
            return { passes: false, reason: 'circle-overlaps-target' };
          }
        }
      }
      
      return { passes: true };
    }
    
    targetRects.forEach((item, index) => {
      results.stats.elementsScanned++;
      const { element: target, rect } = item;

      // Exemptions per WCAG 2.5.8
      const isInlineLink = target.tagName === 'A' && 
        target.closest('p, li, td, span, label') &&
        !target.closest('nav, header, footer, [role="navigation"]');
      
      const isUserAgentControlled = (target.tagName === 'INPUT' && 
        ['checkbox', 'radio'].includes(target.type)) &&
        !target.classList.length &&
        !target.getAttribute('style');
      
      const isEssential = target.hasAttribute('data-essential-size');
      
      if (isInlineLink || isUserAgentControlled || isEssential) {
        return; // Exempt
      }
      
      const width = rect.width;
      const height = rect.height;
      
      if (width >= minSize && height >= minSize) {
        return; // Passes size requirement
      }
      
      // Check spacing exemption
      const spacingCheck = checkSpacingExemption(rect, index);
      
      if (spacingCheck.passes) {
        return; // Passes via spacing
      }
      
      // Fails both size AND spacing — all 2.5.8 failures are serious regardless of how small
      const severity = 'serious';

      issues.push({
        severity: severity,
        wcag: '2.5.8',
        criterion: '2.5.8 Target Size (Minimum)',
        message: `Target too small (${Math.round(width)}x${Math.round(height)}px, minimum ${minSize}px)`,
        selector: getSelector(target),
        element: target.outerHTML.slice(0, 200),
        fix: `Increase clickable area to at least ${minSize}x${minSize}px using padding/min-width/min-height, OR add ${minSize}px spacing from other interactive elements`,
        impact: severity
      });
    });
    
    return issues;
  }

  // ============================================================
  // Main Audit Function
  // ============================================================

  function runAudit() {
    const issues = [];
    
    // 2.5.2 Pointer Cancellation
    const pointerIssues = auditPointerCancellation();
    issues.push(...pointerIssues);
    
    // 2.5.4 Motion Actuation
    const motionIssues = auditMotionActuation();
    issues.push(...motionIssues);
    
    // 2.5.7 Dragging Movements
    const dragIssues = auditDraggingMovements();
    issues.push(...dragIssues);
    
    // 2.5.8 Target Size
    const targetIssues = auditTargetSize();
    issues.push(...targetIssues);
    
    return issues;
  }

  // ============================================================
  // Return Results
  // ============================================================

  const issues = runAudit();
  issues.forEach(issue => results.issues.push(issue));

  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

if (typeof window !== 'undefined') {
  window.runWcag22MobileAudit = runWcag22MobileAudit;
}
