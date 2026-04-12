/**
 * Accordions Accessibility Audit
 * WCAG: 1.3.1, 2.1.1, 2.4.6, 2.4.7, 4.1.2
 */

function runAccordionsAudit() {
  'use strict';

  const startTime = performance.now();

  // Configuration
  const CONFIG = {
    scope: [
      '.accordion',
      '[data-accordion]',
      '[class*="accordion"]',
      '.faq',
      '[class*="faq"]',
      '.collapsible',
      '[class*="collapsible"]',
      '.expandable',
      'details'
    ],
    triggerSelectors: [
      '.accordion-trigger',
      '.accordion-header',
      '.accordion-button',
      '[class*="accordion-trigger"]',
      '[class*="accordion-header"]',
      '[class*="accordion-btn"]',
      '[data-accordion-trigger]',
      '[aria-expanded]',
      'summary',
      '.faq-question',
      '[class*="faq-question"]',
      '.collapsible-trigger',
      '[class*="collapsible-header"]'
    ],
    panelSelectors: [
      '.accordion-panel',
      '.accordion-content',
      '.accordion-body',
      '[class*="accordion-panel"]',
      '[class*="accordion-content"]',
      '[class*="accordion-body"]',
      '[data-accordion-panel]',
      '.faq-answer',
      '[class*="faq-answer"]',
      '.collapsible-content',
      '[class*="collapsible-content"]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('accordions', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, isFocusable } = h;

  // ==========================================================================
  // FIND ACCORDION COMPONENTS
  // ==========================================================================

  function findAccordions() {
    const accordions = [];
    
    // Find native <details> elements
    const detailsElements = document.querySelectorAll('details');
    detailsElements.forEach(details => {
      if (isVisible(details)) {
        accordions.push({
          type: 'native',
          container: details,
          trigger: details.querySelector('summary'),
          panel: details // Content is everything except summary
        });
      }
    });
    
    // Find custom accordions
    for (const selector of CONFIG.scope) {
      if (selector === 'details') continue; // Already handled
      
      const containers = document.querySelectorAll(selector);
      containers.forEach(container => {
        if (!isVisible(container)) return;
        if (container.tagName === 'DETAILS') return; // Skip native details
        
        // Find triggers within this container
        let triggers = [];
        for (const triggerSel of CONFIG.triggerSelectors) {
          const found = container.querySelectorAll(triggerSel);
          if (found.length > 0) {
            triggers = Array.from(found);
            break;
          }
        }
        
        // If no triggers found by selector, look for elements with aria-expanded
        if (triggers.length === 0) {
          triggers = Array.from(container.querySelectorAll('[aria-expanded]'));
        }
        
        triggers.forEach(trigger => {
          if (!isVisible(trigger)) return;
          
          // Find associated panel
          let panel = null;
          
          // Check aria-controls
          const controlsId = trigger.getAttribute('aria-controls');
          if (controlsId) {
            panel = document.getElementById(controlsId);
          }
          
          // Check for adjacent sibling panel
          if (!panel) {
            const nextSibling = trigger.nextElementSibling;
            if (nextSibling) {
              for (const panelSel of CONFIG.panelSelectors) {
                if (nextSibling.matches(panelSel)) {
                  panel = nextSibling;
                  break;
                }
              }
            }
          }
          
          // Check for panel within same parent
          if (!panel) {
            const parent = trigger.parentElement;
            if (parent) {
              for (const panelSel of CONFIG.panelSelectors) {
                panel = parent.querySelector(panelSel);
                if (panel) break;
              }
            }
          }

          // Check data-attribute fallbacks (Bootstrap, custom implementations)
          if (!panel) {
            const dataTarget = trigger.getAttribute('data-controls') ||
                               trigger.getAttribute('data-target') ||
                               trigger.getAttribute('data-accordion-target') ||
                               trigger.getAttribute('data-bs-target');
            if (dataTarget) {
              try {
                panel = document.querySelector(dataTarget);
              } catch (e) {
                // Invalid selector, skip
              }
            }
          }

          accordions.push({
            type: 'custom',
            container: container,
            trigger: trigger,
            panel: panel
          });
        });
      });
    }
    
    return accordions;
  }

  const accordions = findAccordions();
  
  if (accordions.length === 0) {
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  // ==========================================================================
  // TEST 1: Button Role/Element (WCAG 4.1.2)
  // ==========================================================================

  function testButtonRole() {
    accordions.forEach((accordion, index) => {
      const trigger = accordion.trigger;
      if (!trigger) return;
      
      results.stats.elementsScanned++;
      
      // Native details/summary is fine
      if (accordion.type === 'native') {
        addPassed('4.1.2', 'Name, Role, Value', 'Native <details>/<summary> provides correct semantics', getSelector(trigger));
        return;
      }
      
      const tagName = trigger.tagName.toLowerCase();
      const role = trigger.getAttribute('role');
      
      // Check if it's a proper button
      const isButton = tagName === 'button' || role === 'button';
      
      if (!isButton) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Accordion trigger is not a button (found: <' + tagName + '>)',
          trigger,
          'Use a <button> element or add role="button" to the trigger',
          'Screen readers may not announce this as an interactive control'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Accordion trigger is a button', getSelector(trigger));
      }
    });
  }

  // ==========================================================================
  // TEST 2: aria-expanded State (WCAG 4.1.2)
  // ==========================================================================

  function testAriaExpanded() {
    accordions.forEach((accordion, index) => {
      const trigger = accordion.trigger;
      if (!trigger) return;
      
      results.stats.elementsScanned++;
      
      // Native details/summary uses open attribute, not aria-expanded
      if (accordion.type === 'native') {
        const details = accordion.container;
        const isOpen = details.hasAttribute('open');
        addPassed('4.1.2', 'Name, Role, Value', 'Native <details> uses open attribute for state (currently: ' + (isOpen ? 'open' : 'closed') + ')', getSelector(trigger));
        return;
      }
      
      const ariaExpanded = trigger.getAttribute('aria-expanded');
      
      if (ariaExpanded === null) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Accordion trigger missing aria-expanded attribute',
          trigger,
          'Add aria-expanded="false" (or "true" if expanded) to the trigger',
          'Screen reader users cannot determine if the accordion is expanded or collapsed'
        );
      } else if (ariaExpanded !== 'true' && ariaExpanded !== 'false') {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'aria-expanded has invalid value: "' + ariaExpanded + '"',
          trigger,
          'Set aria-expanded to "true" or "false" (as strings)',
          'Screen readers may not correctly interpret the expanded state'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Accordion has valid aria-expanded="' + ariaExpanded + '"', getSelector(trigger));
      }
    });
  }

  // ==========================================================================
  // TEST 3: aria-controls Relationship (WCAG 1.3.1)
  // ==========================================================================

  function testAriaControls() {
    accordions.forEach((accordion, index) => {
      const trigger = accordion.trigger;
      const panel = accordion.panel;
      if (!trigger) return;
      
      results.stats.elementsScanned++;
      
      // Native details/summary doesn't need aria-controls
      if (accordion.type === 'native') {
        return;
      }
      
      const ariaControls = trigger.getAttribute('aria-controls');
      
      if (!ariaControls) {
        // Not strictly required, but recommended
        addManualCheck(
          '1.3.1',
          'Accordion trigger has no aria-controls attribute',
          'Consider adding aria-controls pointing to the panel ID for better AT support',
          getSelector(trigger)
        );
        return;
      }
      
      const controlledElement = document.getElementById(ariaControls);
      
      if (!controlledElement) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'aria-controls references non-existent ID: "' + ariaControls + '"',
          trigger,
          'Ensure the panel has id="' + ariaControls + '" or update aria-controls to match the panel ID',
          'Programmatic relationship between trigger and panel is broken'
        );
      } else if (panel && controlledElement !== panel) {
        addIssue(
          'minor',
          '1.3.1',
          'Info and Relationships',
          'aria-controls points to a different element than the apparent panel',
          trigger,
          'Verify aria-controls points to the correct accordion panel',
          'AT users may be directed to the wrong content'
        );
      } else {
        addPassed('1.3.1', 'Info and Relationships', 'aria-controls correctly references panel', getSelector(trigger));
      }
    });
  }

  // ==========================================================================
  // TEST 4: Heading + Button Pattern (WCAG 1.3.1, 2.4.6)
  // ==========================================================================

  function testHeadingPattern() {
    accordions.forEach((accordion, index) => {
      const trigger = accordion.trigger;
      if (!trigger || accordion.type === 'native') return;
      
      results.stats.elementsScanned++;
      
      const tagName = trigger.tagName.toLowerCase();
      const parent = trigger.parentElement;
      
      // Check if trigger is inside a heading
      const headingParent = trigger.closest('h1, h2, h3, h4, h5, h6');
      
      // Check if trigger IS a heading (anti-pattern)
      const isHeading = /^h[1-6]$/.test(tagName);
      
      if (isHeading) {
        // Heading used as trigger directly - not ideal but not necessarily wrong
        // Check if it has button role
        const role = trigger.getAttribute('role');
        if (role !== 'button') {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Heading element used as accordion trigger without button role',
            trigger,
            'Either: (1) Add role="button" to the heading, or (2) Nest a <button> inside the heading',
            'Screen readers announce as heading but not as interactive control'
          );
        } else {
          addPassed('1.3.1', 'Info and Relationships', 'Heading with role="button" provides both structure and interaction', getSelector(trigger));
        }
      } else if (headingParent) {
        // Button is inside a heading - this is the correct pattern
        addPassed('1.3.1', 'Info and Relationships', 'Accordion follows heading + button pattern', getSelector(trigger));
      } else {
        // Neither a heading nor inside a heading
        // This is OK for simple accordions, but worth noting
        addManualCheck(
          '2.4.6',
          'Accordion trigger is not associated with a heading',
          'Consider wrapping the trigger in a heading for better document structure (e.g., <h3><button>...</button></h3>)',
          getSelector(trigger)
        );
      }
    });
  }

  // ==========================================================================
  // TEST 5: Accessible Name (WCAG 4.1.2)
  // ==========================================================================

  function testAccessibleName() {
    accordions.forEach((accordion, index) => {
      const trigger = accordion.trigger;
      if (!trigger) return;
      
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(trigger);
      
      if (!name) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Accordion trigger has no accessible name',
          trigger,
          'Add visible text content or aria-label to the trigger',
          'Screen reader users cannot identify the accordion section'
        );
      } else if (name.length < 2) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Accordion trigger has very short accessible name: "' + name + '"',
          trigger,
          'Use a more descriptive label for the accordion section',
          'Users may not understand what content the accordion contains'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Accordion has accessible name: "' + name.substring(0, 40) + (name.length > 40 ? '...' : '') + '"', getSelector(trigger));
      }
    });
  }

  // ==========================================================================
  // TEST 6: Keyboard Accessibility (WCAG 2.1.1)
  // ==========================================================================

  function testKeyboardAccessibility() {
    accordions.forEach((accordion, index) => {
      const trigger = accordion.trigger;
      if (!trigger) return;
      
      results.stats.elementsScanned++;
      
      // Native details/summary is keyboard accessible by default
      if (accordion.type === 'native') {
        addPassed('2.1.1', 'Keyboard', 'Native <details>/<summary> is keyboard accessible', getSelector(trigger));
        return;
      }
      
      const tagName = trigger.tagName.toLowerCase();
      const role = trigger.getAttribute('role');
      const tabindex = trigger.getAttribute('tabindex');
      
      // Check if element is focusable
      const isFocusable = 
        tagName === 'button' ||
        tagName === 'a' && trigger.hasAttribute('href') ||
        (tabindex !== null && tabindex !== '-1');
      
      if (!isFocusable) {
        addIssue(
          'critical',
          '2.1.1',
          'Keyboard',
          'Accordion trigger is not keyboard focusable',
          trigger,
          'Use a <button> element or add tabindex="0" to make it focusable',
          'Keyboard users cannot access this accordion'
        );
      } else {
        addPassed('2.1.1', 'Keyboard', 'Accordion trigger is keyboard focusable', getSelector(trigger));
      }
      
      // Check for positive tabindex (anti-pattern)
      if (tabindex && parseInt(tabindex) > 0) {
        addIssue(
          'moderate',
          '2.4.3',
          'Focus Order',
          'Accordion trigger has positive tabindex=' + tabindex,
          trigger,
          'Remove positive tabindex or set to 0',
          'Positive tabindex disrupts natural focus order'
        );
      }
    });
    
    // Add manual check for keyboard interaction
    if (accordions.length > 0) {
      addManualCheck(
        '2.1.1',
        'Verify keyboard interaction for accordions',
        'Tab to each accordion trigger, press Enter or Space to toggle. Verify: (1) Focus is visible, (2) Content expands/collapses, (3) Focus remains on trigger or moves appropriately',
        'accordion triggers'
      );
    }
  }

  // ==========================================================================
  // TEST 7: Focus Visibility (WCAG 2.4.7)
  // ==========================================================================

  function testFocusVisibility() {
    let outlineNoneCount = 0;
    
    accordions.forEach((accordion, index) => {
      const trigger = accordion.trigger;
      if (!trigger) return;
      
      const style = window.getComputedStyle(trigger);
      const outline = style.outline;
      const outlineStyle = style.outlineStyle;
      
      if (outline === 'none' || outline === '0' || outlineStyle === 'none') {
        outlineNoneCount++;
      }
    });
    
    if (outlineNoneCount > 0) {
      addManualCheck(
        '2.4.7',
        outlineNoneCount + ' accordion triggers have outline:none in default state',
        'Tab to each trigger and verify visible focus indicator appears (outline, box-shadow, or border change)',
        'accordion triggers'
      );
    }
  }

  // ==========================================================================
  // TEST 8: Panel Hidden State (WCAG 4.1.2)
  // ==========================================================================

  function testPanelHiddenState() {
    accordions.forEach((accordion, index) => {
      const trigger = accordion.trigger;
      const panel = accordion.panel;
      if (!trigger || !panel || accordion.type === 'native') return;
      
      results.stats.elementsScanned++;
      
      const ariaExpanded = trigger.getAttribute('aria-expanded');
      const isExpanded = ariaExpanded === 'true';
      
      // Check if panel visibility matches aria-expanded
      const panelStyle = window.getComputedStyle(panel);
      const panelHidden = panel.getAttribute('hidden') !== null;
      const panelAriaHidden = panel.getAttribute('aria-hidden') === 'true';
      const panelDisplayNone = panelStyle.display === 'none';
      const panelVisibilityHidden = panelStyle.visibility === 'hidden';
      
      const isPanelHidden = panelHidden || panelAriaHidden || panelDisplayNone || panelVisibilityHidden;
      
      if (isExpanded && isPanelHidden) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Accordion trigger says expanded but panel is hidden',
          trigger,
          'Sync aria-expanded state with panel visibility',
          'Screen readers announce expanded but content is not accessible'
        );
      } else if (!isExpanded && !isPanelHidden && isVisible(panel)) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Accordion trigger says collapsed but panel is visible',
          trigger,
          'Sync aria-expanded state with panel visibility',
          'Screen readers announce collapsed but content is visible'
        );
      }
      
      // Check for focusable elements in hidden panels
      if (isPanelHidden) {
        const focusableInHidden = panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        const visibleFocusable = Array.from(focusableInHidden).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.getAttribute('tabindex') !== '-1';
        });
        
        if (visibleFocusable.length > 0 && !panelDisplayNone && !panelHidden) {
          addIssue(
            'serious',
            '2.4.3',
            'Focus Order',
            'Hidden accordion panel contains ' + visibleFocusable.length + ' focusable elements still in tab order',
            panel,
            'Add hidden attribute to collapsed panels, or set tabindex="-1" on focusable children',
            'Keyboard users tab into content they cannot see'
          );
        }
      }
    });
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================

  testButtonRole();
  testAriaExpanded();
  testAriaControls();
  testHeadingPattern();
  testAccessibleName();
  testKeyboardAccessibility();
  testFocusVisibility();
  testPanelHiddenState();

  // ==========================================================================
  // FINALIZE RESULTS
  // ==========================================================================

  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  // Add summary
  results.accordionsSummary = {
    total: accordions.length,
    native: accordions.filter(a => a.type === 'native').length,
    custom: accordions.filter(a => a.type === 'custom').length
  };

  return results;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runAccordionsAudit = runAccordionsAudit;
}
