/**
 * Disclosure Widgets Accessibility Audit
 * WCAG: 1.3.1, 2.1.1, 4.1.2
 *
 * Audits disclosure widgets (show/hide toggles) that are NOT accordions.
 * Covers native <details>/<summary> and custom aria-expanded patterns.
 *
 * @module disclosure-widgets
 * @description Audit disclosure/show-hide widgets for accessibility compliance
 */

(function(global) {
  'use strict';

  function runDisclosureWidgetsAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        'details',
        '.disclosure',
        '.collapsible',
        '[data-toggle="collapse"]',
        '[class*="disclosure"]',
        '[class*="collapsible"]'
      ]
    };

    var ref = global.a11yAudit.initComponent('disclosure-widgets', scope || CONFIG.scope);
    var results = ref.results;
    var h = ref.h;
    var addIssue = ref.addIssue;
    var addPassed = ref.addPassed;
    var addManualCheck = ref.addManualCheck;

    var doc = global.document;
    if (!doc) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    var disclosures = [];

    // Find native <details> elements
    var detailsElements = Array.from(doc.querySelectorAll('details'));
    detailsElements.forEach(function(details) {
      // Exclude ones that are part of accordion patterns
      var isInAccordion = details.closest('[class*="accordion"]') ||
                          details.closest('[role="tablist"]');
      if (!isInAccordion) {
        disclosures.push({ type: 'native', element: details, trigger: details.querySelector('summary') });
      }
    });

    // Find custom disclosure widgets with aria-expanded
    // Exclude elements already covered by accordions, tabs, tree, combobox, menuitem
    var expandedElements = Array.from(doc.querySelectorAll(
      '[aria-expanded]:not([role="tab"]):not([role="treeitem"]):not([role="combobox"]):not([role="menuitem"])'
    ));

    expandedElements.forEach(function(trigger) {
      // Exclude if inside accordion or tablist
      var isInAccordion = trigger.closest('[class*="accordion"]') ||
                          trigger.closest('[role="tablist"]');
      if (isInAccordion) return;

      // Exclude if it's already captured as a native details
      if (trigger.tagName === 'SUMMARY') return;

      disclosures.push({ type: 'custom', element: trigger.parentElement || trigger, trigger: trigger });
    });

    // Find custom disclosures by class
    var isExposedToAT = (window.a11yHelpers && window.a11yHelpers.isExposedToAT) || null;
    ['.disclosure', '.collapsible', '[data-toggle="collapse"]', '[class*="disclosure"]', '[class*="collapsible"]'].forEach(function(selector) {
      try {
        Array.from(doc.querySelectorAll(selector)).forEach(function(el) {
          // Exclude if inside accordion
          var isInAccordion = el.closest('[class*="accordion"]') ||
                              el.closest('[role="tablist"]');
          if (isInAccordion) return;

          // Pattern C fix: Skip elements hidden from AT
          if (isExposedToAT && !isExposedToAT(el)) return;

          // Check if already captured
          var alreadyFound = disclosures.some(function(d) {
            return d.element === el || d.trigger === el;
          });
          if (alreadyFound) return;

          // Prevent double-audit: skip custom wrapper that contains native <details>
          if (el.querySelector('details')) return;

          // Find the trigger within
          var trigger = el.querySelector('[aria-expanded]') ||
                        el.querySelector('button') ||
                        el.querySelector('[role="button"]');

          if (trigger) {
            disclosures.push({ type: 'custom', element: el, trigger: trigger });
          }
        });
      } catch (e) {
        // Selector not supported
      }
    });

    if (disclosures.length === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: <details> elements have a <summary> child (WCAG 4.1.2)
    // ==========================================================================

    disclosures.forEach(function(disclosure) {
      if (disclosure.type !== 'native') return;

      results.stats.elementsScanned++;

      var summary = disclosure.element.querySelector('summary');
      if (summary) {
        addPassed('4.1.2', 'Name, Role, Value', 'Native <details> has a <summary> child', h.getSelector(disclosure.element));
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          '<details> element has no <summary> child',
          disclosure.element,
          'Add a <summary> element as the first child of <details>'
        );
      }
    });

    // ==========================================================================
    // TEST 2: Non-native disclosure triggers have aria-expanded (WCAG 4.1.2)
    // ==========================================================================

    disclosures.forEach(function(disclosure) {
      if (disclosure.type === 'native') return;

      var trigger = disclosure.trigger;
      if (!trigger) return;

      results.stats.elementsScanned++;

      var ariaExpanded = trigger.getAttribute('aria-expanded');

      if (ariaExpanded === 'true' || ariaExpanded === 'false') {
        addPassed('4.1.2', 'Name, Role, Value', 'Disclosure trigger has aria-expanded="' + ariaExpanded + '"', h.getSelector(trigger));
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Disclosure trigger missing aria-expanded attribute',
          trigger,
          'Add aria-expanded="true" or "false" to indicate the expanded/collapsed state'
        );
      }
    });

    // ==========================================================================
    // TEST 3: Trigger is a <button> or has role="button" (WCAG 4.1.2)
    // ==========================================================================

    disclosures.forEach(function(disclosure) {
      if (disclosure.type === 'native') return;

      var trigger = disclosure.trigger;
      if (!trigger) return;

      results.stats.elementsScanned++;

      var tagName = trigger.tagName.toLowerCase();
      var role = trigger.getAttribute('role');

      if (tagName === 'button' || role === 'button') {
        addPassed('4.1.2', 'Name, Role, Value', 'Disclosure trigger is a button', h.getSelector(trigger));
      } else {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Disclosure trigger is <' + tagName + '> without button role',
          trigger,
          'Use a <button> element or add role="button" to the trigger'
        );
      }
    });

    // ==========================================================================
    // TEST 4: aria-controls points to panel ID (WCAG 1.3.1)
    // ==========================================================================

    disclosures.forEach(function(disclosure) {
      if (disclosure.type === 'native') return;

      var trigger = disclosure.trigger;
      if (!trigger) return;

      results.stats.elementsScanned++;

      var ariaControls = trigger.getAttribute('aria-controls');

      if (ariaControls) {
        var panel = doc.getElementById(ariaControls);
        if (panel) {
          addPassed('1.3.1', 'Info and Relationships', 'Disclosure trigger aria-controls points to valid panel', h.getSelector(trigger));
        } else {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'aria-controls references non-existent ID: "' + ariaControls + '"',
            trigger,
            'Ensure the controlled panel has id="' + ariaControls + '"'
          );
        }
      } else {
        addIssue(
          'minor',
          '1.3.1',
          'Info and Relationships',
          'Disclosure trigger has no aria-controls pointing to the panel',
          trigger,
          'Add aria-controls="panelId" for a programmatic relationship with the panel'
        );
      }
    });

    // ==========================================================================
    // TEST 5: Keyboard activation (WCAG 2.1.1)
    // ==========================================================================

    disclosures.forEach(function(disclosure) {
      if (disclosure.type === 'native') {
        results.stats.elementsScanned++;
        addPassed('2.1.1', 'Keyboard', 'Native <details>/<summary> is keyboard accessible', h.getSelector(disclosure.element));
        return;
      }

      var trigger = disclosure.trigger;
      if (!trigger) return;

      results.stats.elementsScanned++;

      var tagName = trigger.tagName.toLowerCase();
      var tabindex = trigger.getAttribute('tabindex');

      var isFocusable = tagName === 'button' ||
                        (tagName === 'a' && trigger.hasAttribute('href')) ||
                        (tabindex !== null && tabindex !== '-1');

      if (isFocusable) {
        addPassed('2.1.1', 'Keyboard', 'Disclosure trigger is keyboard focusable', h.getSelector(trigger));
      } else {
        addIssue(
          'moderate',
          '2.1.1',
          'Keyboard',
          'Disclosure trigger is not keyboard focusable',
          trigger,
          'Use a <button> element or add tabindex="0"'
        );
      }
    });

    // ==========================================================================
    // TEST 6: Panel content not aria-hidden when expanded (WCAG 4.1.2)
    // ==========================================================================

    disclosures.forEach(function(disclosure) {
      if (disclosure.type === 'native') return;

      var trigger = disclosure.trigger;
      if (!trigger) return;

      results.stats.elementsScanned++;

      var ariaExpanded = trigger.getAttribute('aria-expanded');
      var ariaControls = trigger.getAttribute('aria-controls');

      if (ariaExpanded === 'true' && ariaControls) {
        var panel = doc.getElementById(ariaControls);
        if (panel) {
          var panelAriaHidden = panel.getAttribute('aria-hidden');
          if (panelAriaHidden === 'true') {
            addIssue(
              'moderate',
              '4.1.2',
              'Name, Role, Value',
              'Disclosure panel has aria-hidden="true" but trigger shows aria-expanded="true"',
              panel,
              'Remove aria-hidden="true" when the panel is expanded, or sync state with aria-expanded'
            );
          }
        }
      }
    });

    // ==========================================================================
    // TEST 7: Summary/trigger has meaningful accessible name (WCAG 4.1.2)
    // ==========================================================================

    disclosures.forEach(function(disclosure) {
      var trigger = disclosure.trigger;
      if (!trigger) return;

      results.stats.elementsScanned++;

      var name = h.getAccessibleName ? h.getAccessibleName(trigger) : (trigger.textContent || '').trim();

      if (!name) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Disclosure trigger has no accessible name',
          trigger,
          'Add descriptive text content or aria-label to the trigger'
        );
      } else if (name.length < 2) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Disclosure trigger has very short name: "' + name + '"',
          trigger,
          'Use a more descriptive label for the disclosure trigger'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Disclosure trigger has name: "' + name.substring(0, 30) + '"', h.getSelector(trigger));
      }
    });

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.disclosureSummary = {
      total: disclosures.length,
      native: disclosures.filter(function(d) { return d.type === 'native'; }).length,
      custom: disclosures.filter(function(d) { return d.type === 'custom'; }).length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runDisclosureWidgetsAudit = runDisclosureWidgetsAudit;

})(typeof window !== 'undefined' ? window : global);
