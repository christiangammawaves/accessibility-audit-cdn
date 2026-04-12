/**
 * Tooltips Accessibility Audit
 * WCAG: 1.3.1, 1.4.13, 2.1.1, 4.1.2
 */

function runTooltipsAudit() {
  'use strict';

  const startTime = performance.now();

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  const CONFIG = {
    scope: [
      // Tooltip triggers
      '[data-tooltip]',
      '[data-tippy]',
      '[data-tip]',
      '[aria-describedby]',
      '[aria-labelledby]',
      '[title]:not(svg):not(iframe)',
      // Info/help icons
      '[class*="tooltip"]',
      '[class*="info-icon"]',
      '[class*="help-icon"]',
      '[class*="hint"]',
      '.info',
      '.help',
      'abbr[title]',
      // Common tooltip trigger patterns
      'button[aria-haspopup="true"]',
      '[role="tooltip"]',
      // Question mark icons
      '[class*="question"]',
      '[class*="info-circle"]',
      'i.fa-info',
      'i.fa-question',
      'svg[class*="info"]',
      'svg[class*="help"]'
    ],
    tooltipContentSelectors: [
      '[role="tooltip"]',
      '.tooltip',
      '.tippy-content',
      '.tippy-box',
      '[class*="tooltip-content"]',
      '[class*="tooltip-text"]',
      '[class*="popover"]',
      '[id][aria-hidden]' // Hidden content that might be tooltip
    ],
    hoverCardSelectors: [
      '[class*="hover-card"]',
      '[class*="hovercard"]',
      '[class*="preview-card"]',
      '[class*="popover"]',
      '[data-popover]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('tooltips', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, isFocusable } = h;

  // ==========================================================================
  // FIND TOOLTIP ELEMENTS
  // ==========================================================================

  function findTooltipTriggers() {
    const triggers = new Set();
    
    CONFIG.scope.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (isVisible(el)) {
            triggers.add(el);
          }
        });
      } catch (e) {
        // Invalid selector
      }
    });
    
    // Filter out containers that aren't actual triggers
    return Array.from(triggers).filter(el => {
      // Skip if it's a large container (likely not a trigger)
      const rect = el.getBoundingClientRect();
      if (rect.width > 500 || rect.height > 200) return false;
      
      // Skip if it's the tooltip content itself
      if (el.getAttribute('role') === 'tooltip') return false;
      
      return true;
    });
  }

  function findTooltipContent() {
    const tooltips = new Set();
    
    CONFIG.tooltipContentSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          tooltips.add(el);
        });
      } catch (e) {
        // Invalid selector
      }
    });
    
    return Array.from(tooltips);
  }

  const triggers = findTooltipTriggers();
  const tooltipContent = findTooltipContent();
  
  if (triggers.length === 0 && tooltipContent.length === 0) {
    results.manualChecks.push({
      wcag: '1.4.13',
      message: 'No tooltip triggers found on page',
      howToTest: 'If tooltips exist, verify they meet WCAG 1.4.13 requirements'
    });
    
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================
  
  /**
   * Test 1: Tooltip Association (aria-describedby)
   * WCAG: 1.3.1, 4.1.2
   */
  function testTooltipAssociation() {
    triggers.forEach(trigger => {
      results.stats.elementsScanned++;
      
      const describedBy = trigger.getAttribute('aria-describedby');
      const labelledBy = trigger.getAttribute('aria-labelledby');
      const hasTitle = trigger.hasAttribute('title');
      const dataTooltip = trigger.getAttribute('data-tooltip') || trigger.getAttribute('data-tip');
      
      // Check if tooltip content is properly associated
      if (describedBy) {
        const tooltipEl = document.getElementById(describedBy);
        if (tooltipEl) {
          addPassed('1.3.1', 'Info and Relationships', 'Tooltip properly associated via aria-describedby', getSelector(trigger));
        } else {
          addIssue(
            'serious',
            '1.3.1',
            'Info and Relationships',
            'aria-describedby references non-existent element ID: ' + describedBy,
            trigger,
            'Ensure the tooltip element has id="' + describedBy + '"',
            'Screen readers cannot read the tooltip content'
          );
        }
      } else if (hasTitle) {
        // Title attribute is accessible but has limitations
        const titleValue = trigger.getAttribute('title');
        if (titleValue && titleValue.length > 80) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Long tooltip text in title attribute (' + titleValue.length + ' chars) - consider using aria-describedby',
            trigger,
            'For longer tooltip content, use aria-describedby pointing to visible tooltip element',
            'Title attribute may be truncated or difficult to access'
          );
        } else if (titleValue) {
          addPassed('1.3.1', 'Info and Relationships', 'Tooltip uses title attribute: "' + titleValue.slice(0, 40) + '"', getSelector(trigger));
        }
      } else if (dataTooltip) {
        // Custom tooltip - check if it has proper association
        addManualCheck(
          '1.3.1',
          'Verify custom tooltip is accessible to screen readers',
          'Check if tooltip content is exposed via aria-describedby when shown, or if tooltip has role="tooltip" and is properly associated',
          getSelector(trigger)
        );
      }
    });
  }

  /**
   * Test 2: Keyboard Accessibility
   * WCAG: 2.1.1
   */
  function testKeyboardAccess() {
    triggers.forEach(trigger => {
      results.stats.elementsScanned++;
      
      const canFocus = isFocusable(trigger);
      const tabindex = trigger.getAttribute('tabindex');
      
      if (!canFocus && tabindex !== '0') {
        addIssue(
          'serious',
          '2.1.1',
          'Keyboard',
          'Tooltip trigger is not keyboard focusable',
          trigger,
          'Add tabindex="0" to make the element focusable, or use a <button> element',
          'Keyboard users cannot access tooltip content'
        );
      } else if (tabindex === '-1') {
        addIssue(
          'serious',
          '2.1.1',
          'Keyboard',
          'Tooltip trigger has tabindex="-1" preventing keyboard focus',
          trigger,
          'Change tabindex to "0" or remove it if element is natively focusable',
          'Keyboard users cannot access tooltip content'
        );
      } else {
        addPassed('2.1.1', 'Keyboard', 'Tooltip trigger is keyboard focusable', getSelector(trigger));
      }
      
      // Check if tooltip shows on focus (not just hover)
      addManualCheck(
        '2.1.1',
        'Verify tooltip appears on keyboard focus',
        'Tab to tooltip trigger and verify tooltip content appears (not just on mouse hover)',
        getSelector(trigger)
      );
    });
  }

  /**
   * Test 3: WCAG 1.4.13 - Content on Hover or Focus
   * Three requirements: Dismissible, Hoverable, Persistent
   */
  function testHoverFocusContent() {
    // This is the key WCAG 2.1 criterion for tooltips
    
    triggers.forEach(trigger => {
      results.stats.elementsScanned++;
      
      const hasTitle = trigger.hasAttribute('title');
      const hasCustomTooltip = trigger.hasAttribute('data-tooltip') || 
                                trigger.hasAttribute('data-tippy') ||
                                trigger.classList.contains('tooltip') ||
                                trigger.getAttribute('aria-describedby');
      
      if (hasTitle) {
        // Title tooltips have inherent accessibility issues with 1.4.13
        addIssue(
          'moderate',
          '1.4.13',
          'Content on Hover or Focus',
          'Title attribute tooltip cannot be hovered over (fails hoverable requirement)',
          trigger,
          'Replace title with custom tooltip using aria-describedby that can be hovered',
          'Users cannot move pointer over tooltip to read it without it disappearing'
        );
      }
      
      if (hasCustomTooltip) {
        // Custom tooltips need manual verification for 1.4.13
        addManualCheck(
          '1.4.13',
          'Verify tooltip is DISMISSIBLE: Can be dismissed without moving pointer/focus',
          'Press Escape key while tooltip is showing - tooltip should close without moving pointer or focus away from trigger',
          getSelector(trigger)
        );
        
        addManualCheck(
          '1.4.13',
          'Verify tooltip is HOVERABLE: Pointer can move over tooltip content',
          'Hover to show tooltip, then move pointer from trigger onto tooltip content - tooltip should remain visible',
          getSelector(trigger)
        );
        
        addManualCheck(
          '1.4.13',
          'Verify tooltip is PERSISTENT: Stays visible until user dismisses',
          'Trigger tooltip and verify it stays visible until: (1) user presses Escape, (2) user moves pointer/focus away, or (3) content becomes invalid. Should NOT auto-dismiss on timeout.',
          getSelector(trigger)
        );
      }
    });
    
    // Check visible tooltips for role
    tooltipContent.forEach(tooltip => {
      if (!isVisible(tooltip)) return;
      results.stats.elementsScanned++;
      
      const role = tooltip.getAttribute('role');
      
      if (role !== 'tooltip') {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Visible tooltip content lacks role="tooltip"',
          tooltip,
          'Add role="tooltip" to the tooltip content element',
          'Screen readers may not announce this as tooltip content'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Tooltip has role="tooltip"', getSelector(tooltip));
      }
    });
  }

  /**
   * Test 4: Info/Help Icon Accessibility
   * WCAG: 4.1.2
   */
  function testInfoIcons() {
    const infoIconSelectors = [
      '[class*="info-icon"]',
      '[class*="help-icon"]',
      '[class*="question"]',
      'i.fa-info',
      'i.fa-question',
      'i.fa-info-circle',
      'i.fa-question-circle',
      'svg[class*="info"]',
      'svg[class*="help"]',
      '.info-icon',
      '.help-icon'
    ];
    
    infoIconSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(icon => {
          if (!isVisible(icon)) return;
          results.stats.elementsScanned++;
          
          // Check if icon has accessible name
          const name = getAccessibleName(icon);
          const parent = icon.parentElement;
          const parentName = parent ? getAccessibleName(parent) : '';
          
          // Check if it's wrapped in a button or has tooltip
          const isInteractive = icon.closest('button, a, [role="button"], [tabindex]');
          
          if (!name && !parentName) {
            if (isInteractive) {
              addIssue(
                'serious',
                '4.1.2',
                'Name, Role, Value',
                'Info/help icon button has no accessible name',
                isInteractive,
                'Add aria-label describing the help topic (e.g., aria-label="Learn more about shipping")',
                'Screen reader users cannot determine what help is available'
              );
            } else {
              addIssue(
                'moderate',
                '4.1.2',
                'Name, Role, Value',
                'Info/help icon is not interactive and has no accessible name',
                icon,
                'Wrap in <button> with aria-label, or add aria-hidden="true" if decorative',
                'Users may not be able to access the help information'
              );
            }
          } else {
            addPassed('4.1.2', 'Name, Role, Value', 'Info icon has accessible name: "' + (name || parentName).slice(0, 30) + '"', getSelector(icon));
          }
          
          // Check if icon is focusable
          if (!isInteractive) {
            const tabindex = icon.getAttribute('tabindex');
            if (tabindex !== '0') {
              addIssue(
                'serious',
                '2.1.1',
                'Keyboard',
                'Info/help icon is not keyboard accessible',
                icon,
                'Wrap in <button> or add tabindex="0" and keyboard event handlers',
                'Keyboard users cannot access the tooltip'
              );
            }
          }
        });
      } catch (e) {
        // Invalid selector
      }
    });
  }

  /**
   * Test 5: Abbreviation Tooltips
   * WCAG: 2.1.1 (keyboard accessibility for abbreviation tooltip triggers)
   * Note: WCAG 3.1.4 (Abbreviations) is Level AAA and not required for Level AA compliance.
   */
  function testAbbreviations() {
    const abbreviations = document.querySelectorAll('abbr[title]');

    abbreviations.forEach(abbr => {
      if (!isVisible(abbr)) return;
      results.stats.elementsScanned++;

      const title = abbr.getAttribute('title');
      const text = abbr.textContent.trim();

      if (title) {
        addPassed('2.1.1', 'Keyboard', 'Abbreviation "' + text + '" has visible expansion for tooltip access', getSelector(abbr));
      }
      
      // Check if abbreviation is focusable for keyboard users
      const tabindex = abbr.getAttribute('tabindex');
      if (tabindex !== '0') {
        addIssue(
          'moderate',
          '2.1.1',
          'Keyboard',
          'Abbreviation with tooltip is not keyboard focusable',
          abbr,
          'Add tabindex="0" so keyboard users can access the expansion',
          'Keyboard users cannot hover to see abbreviation expansion'
        );
      }
    });
  }

  /**
   * Test 6: Popover/Hover Card Accessibility
   * WCAG: 1.4.13, 4.1.2
   */
  function testPopovers() {
    CONFIG.hoverCardSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(popover => {
          results.stats.elementsScanned++;
          
          const role = popover.getAttribute('role');
          const ariaLabel = popover.getAttribute('aria-label');
          const ariaLabelledBy = popover.getAttribute('aria-labelledby');
          
          // Check role
          if (!role) {
            addIssue(
              'moderate',
              '4.1.2',
              'Name, Role, Value',
              'Popover/hover card lacks semantic role',
              popover,
              'Add role="dialog" if interactive, role="tooltip" if informational',
              'Screen readers may not properly convey the popover context'
            );
          }
          
          // If it's visible, check content accessibility
          if (isVisible(popover)) {
            // Check for close mechanism
            const closeButton = popover.querySelector('[class*="close"], [aria-label*="close" i], button');
            
            if (!closeButton) {
              addManualCheck(
                '1.4.13',
                'Verify hover card can be dismissed via Escape key',
                'Press Escape while hover card is visible - it should close',
                getSelector(popover)
              );
            }
            
            // Check for interactive content
            const hasInteractive = popover.querySelector('a, button, input, select, textarea');
            
            if (hasInteractive && role !== 'dialog') {
              addIssue(
                'moderate',
                '4.1.2',
                'Name, Role, Value',
                'Popover with interactive content should use role="dialog"',
                popover,
                'Add role="dialog" and aria-label describing the popover',
                'Screen reader users may not understand the popover context'
              );
            }
          }
        });
      } catch (e) {
        // Invalid selector
      }
    });
  }

  /**
   * Test 7: Timing and Auto-dismiss
   * WCAG: 1.4.13, 2.2.1
   */
  function testTiming() {
    // This is primarily a manual check as we can't detect timing behavior
    
    if (triggers.length > 0) {
      addManualCheck(
        '1.4.13',
        'Verify tooltips do NOT auto-dismiss on a timeout',
        'Show a tooltip and leave it - verify it does NOT disappear on its own after a set time. Users need time to read content.'
      );
      
      addManualCheck(
        '2.2.1',
        'If any content has timing, verify users can extend or disable',
        'If tooltip has timing behavior, ensure users can: (1) turn off timing, (2) adjust timing, or (3) extend before timeout'
      );
    }
  }

  /**
   * Test 8: Touch Device Accessibility
   */
  function testTouchAccessibility() {
    if (triggers.length > 0) {
      addManualCheck(
        '2.5.1',
        'Verify tooltips work on touch devices',
        'On mobile/tablet: (1) Tap trigger to show tooltip, (2) Tap elsewhere to dismiss. Hover-only tooltips fail on touch devices.',
        'tooltip triggers'
      );
    }
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================
  
  testTooltipAssociation();
  testKeyboardAccess();
  testHoverFocusContent();
  testInfoIcons();
  testAbbreviations();
  testPopovers();
  testTiming();
  testTouchAccessibility();

  // ==========================================================================
  // FINALIZE RESULTS
  // ==========================================================================
  
  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runTooltipsAudit = runTooltipsAudit;
}
