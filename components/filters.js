/**
 * Filters Accessibility Audit
 * WCAG: 1.3.1, 1.3.2, 2.4.4, 3.2.2, 4.1.2, 4.1.3
 */

function runFiltersAudit() {
  'use strict';

  const startTime = performance.now();

  // Configuration
  const CONFIG = {
    scope: [
      '.filters',
      '.facets',
      '[data-filters]',
      '[data-facets]',
      '.collection-filters',
      '.product-filters',
      '.filter-group',
      '[class*="filter-"]',
      '[class*="facet-"]',
      'aside[role="complementary"]',
      '.sidebar-filters'
    ],
    filterDrawerSelectors: [
      '.filter-drawer',
      '.filters-drawer',
      '[data-filter-drawer]',
      '.mobile-filters',
      '.filters-modal'
    ],
    clearFilterSelectors: [
      '[class*="clear-filter"]',
      '[class*="reset-filter"]',
      '[data-clear-filters]',
      '[data-reset-filters]',
      'a[href*="?"]', // Links that clear query params
      'button[data-action*="clear"]',
      'button[data-action*="reset"]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('filters', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet } = h;

  // Find filter container
  function getFilterContainer() {
    for (const selector of CONFIG.scope) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  const filterEl = getFilterContainer();

  if (!filterEl) {
    // Filters are optional - not finding them is not an issue
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  results.stats.elementsScanned++;

  // Test 1: Filter Group Structure (Fieldsets)
  function testFilterGroupStructure() {
    // Look for filter groups (Size, Color, Price, etc.)
    const groupSelectors = [
      'fieldset',
      '[role="group"]',
      '.filter-group',
      '.facet-group',
      '[class*="filter-group"]',
      '[class*="facet-"]',
      'details' // Collapsible filter groups
    ];

    let groups = [];
    groupSelectors.forEach(selector => {
      const els = filterEl.querySelectorAll(selector);
      els.forEach(el => {
        if (isVisible(el)) groups.push(el);
      });
    });

    // Deduplicate (nested groups)
    groups = groups.filter((g, i) => !groups.some((other, j) => j < i && other.contains(g)));

    if (groups.length === 0) {
      // Check if there are checkboxes/radios without grouping
      const inputs = filterEl.querySelectorAll('input[type="checkbox"], input[type="radio"]');
      if (inputs.length > 3) {
        addIssue('moderate', '1.3.1', 'Info and Relationships', 'Filter inputs found but not grouped with fieldset or role="group"', filterEl, 'Wrap related filter options in <fieldset> with <legend> describing the filter category', 'Screen reader users cannot understand filter option groupings');
      }
      return;
    }

    results.stats.elementsScanned += groups.length;

    let groupsWithoutLegend = 0;

    groups.forEach(group => {
      const isFieldset = group.tagName === 'FIELDSET';
      const isDetails = group.tagName === 'DETAILS';
      const hasRoleGroup = group.getAttribute('role') === 'group';

      // Check for legend/label
      let hasLabel = false;
      let labelText = '';

      if (isFieldset) {
        const legend = group.querySelector('legend');
        if (legend && isVisible(legend)) {
          hasLabel = true;
          labelText = legend.textContent.trim();
        }
      }

      if (isDetails) {
        const summary = group.querySelector('summary');
        if (summary) {
          hasLabel = true;
          labelText = summary.textContent.trim();
        }
      }

      if (hasRoleGroup) {
        const ariaLabel = group.getAttribute('aria-label');
        const ariaLabelledby = group.getAttribute('aria-labelledby');
        if (ariaLabel) {
          hasLabel = true;
          labelText = ariaLabel;
        } else if (ariaLabelledby) {
          const labelEl = document.getElementById(ariaLabelledby);
          if (labelEl) {
            hasLabel = true;
            labelText = labelEl.textContent.trim();
          }
        }
      }

      // Check for heading as implicit label
      if (!hasLabel) {
        const heading = group.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading && isVisible(heading)) {
          hasLabel = true;
          labelText = heading.textContent.trim();
          // But still flag as needing proper association
          addManualCheck('1.3.1', 'Filter group "' + labelText + '" has heading but may need aria-labelledby', 'Consider using fieldset/legend or role="group" with aria-labelledby pointing to the heading', getSelector(group));
        }
      }

      if (!hasLabel) {
        groupsWithoutLegend++;
      }
    });

    if (groupsWithoutLegend > 0) {
      addIssue('moderate', '1.3.1', 'Info and Relationships', groupsWithoutLegend + ' filter group(s) lack accessible labels', groups[0], 'Add <legend> to fieldsets or aria-label/aria-labelledby to role="group" elements', 'Screen reader users cannot understand what filter category the options belong to');
    } else {
      addPassed('1.3.1', 'Info and Relationships', 'All ' + groups.length + ' filter groups have accessible labels', 'filter groups');
    }
  }

  // Test 2: Checkbox and Radio Accessibility
  function testInputLabels() {
    const checkboxes = filterEl.querySelectorAll('input[type="checkbox"]');
    const radios = filterEl.querySelectorAll('input[type="radio"]');
    const allInputs = [...checkboxes, ...radios];

    if (allInputs.length === 0) return;

    results.stats.elementsScanned += allInputs.length;

    let unlabeledInputs = 0;
    let inputsWithoutValue = 0;

    allInputs.forEach(input => {
      if (!isVisible(input)) return;

      const name = getAccessibleName(input);
      if (!name) {
        unlabeledInputs++;
      }

      // Check for value attribute on radios
      if (input.type === 'radio' && !input.value) {
        inputsWithoutValue++;
      }
    });

    if (unlabeledInputs > 0) {
      addIssue('serious', '4.1.2', 'Name, Role, Value', unlabeledInputs + ' filter checkbox/radio inputs lack accessible labels', allInputs[0], 'Add associated <label for="id"> or wrap input in <label> element', 'Screen reader users cannot determine what filter option they are selecting');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'All ' + allInputs.length + ' filter inputs have accessible labels', 'filter inputs');
    }

    // Check for custom checkboxes/radios (divs styled as inputs)
    const customControls = filterEl.querySelectorAll('[role="checkbox"], [role="radio"]');
    customControls.forEach(control => {
      if (!isVisible(control)) return;
      results.stats.elementsScanned++;

      const hasAriaChecked = control.hasAttribute('aria-checked');
      const isKeyboardAccessible = control.getAttribute('tabindex') !== null || control.tagName === 'BUTTON';

      if (!hasAriaChecked) {
        addIssue('serious', '4.1.2', 'Name, Role, Value', 'Custom ' + control.getAttribute('role') + ' lacks aria-checked attribute', control, 'Add aria-checked="true" or aria-checked="false" to indicate state', 'Screen reader users cannot determine if option is selected');
      }

      if (!isKeyboardAccessible) {
        addIssue('serious', '2.1.1', 'Keyboard', 'Custom ' + control.getAttribute('role') + ' is not keyboard accessible', control, 'Add tabindex="0" and keyboard event handlers for Space key', 'Keyboard users cannot toggle this filter option');
      }
    });
  }

  // Test 3: Live Region for Results Count
  function testLiveRegion() {
    // Look for result count that should update when filters change
    const resultCountSelectors = [
      '[aria-live]',
      '[role="status"]',
      '[role="alert"]',
      '.results-count',
      '.product-count',
      '[class*="result-count"]',
      '[class*="product-count"]',
      '[data-product-count]'
    ];

    let liveRegion = null;
    let resultCount = null;

    for (const selector of resultCountSelectors) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) {
        if (el.getAttribute('aria-live') || el.getAttribute('role') === 'status') {
          liveRegion = el;
        } else {
          resultCount = el;
        }
      }
    }

    if (liveRegion) {
      const ariaLive = liveRegion.getAttribute('aria-live');
      const role = liveRegion.getAttribute('role');

      if (ariaLive === 'polite' || role === 'status') {
        addPassed('4.1.3', 'Status Messages', 'Filter results use aria-live="polite" or role="status"', getSelector(liveRegion));
      } else if (ariaLive === 'assertive' || role === 'alert') {
        addIssue('minor', '4.1.3', 'Status Messages', 'Filter results use assertive live region (may be disruptive)', liveRegion, 'Consider using aria-live="polite" or role="status" for filter result counts', 'Assertive announcements interrupt screen reader users');
      }
    } else if (resultCount) {
      addIssue('moderate', '4.1.3', 'Status Messages', 'Filter result count exists but is not a live region', resultCount, 'Add aria-live="polite" or role="status" to announce filter result changes', 'Screen reader users are not informed when filter results update');
    } else {
      addManualCheck('4.1.3', 'Verify filter results are announced to screen readers', 'Apply a filter and check if screen reader announces the updated result count', 'filter results');
    }
  }

  // Test 4: Clear/Reset Filters
  function testClearFilters() {
    const clearButtonSelectors = [
      '[class*="clear-filter"]',
      '[class*="clear-all"]',
      '[class*="reset-filter"]',
      '[data-clear-filters]',
      '[data-reset-filters]',
      'button[type="reset"]'
    ];

    let clearButton = null;
    for (const selector of clearButtonSelectors) {
      const el = filterEl.querySelector(selector) || document.querySelector(selector);
      if (el && isVisible(el)) {
        clearButton = el;
        break;
      }
    }

    // Also check for text-based clear links
    if (!clearButton) {
      const allButtons = filterEl.querySelectorAll('button, a');
      allButtons.forEach(btn => {
        const text = btn.textContent.toLowerCase();
        if (text.includes('clear') || text.includes('reset')) {
          clearButton = btn;
        }
      });
    }

    if (!clearButton) {
      addManualCheck('2.4.4', 'Consider adding a "Clear all filters" button', 'Allows users to easily reset filter state without manually unchecking each option', 'filters');
      return;
    }

    results.stats.elementsScanned++;

    const name = getAccessibleName(clearButton);
    if (!name) {
      addIssue('moderate', '2.4.4', 'Link Purpose', 'Clear filters button/link has no accessible name', clearButton, 'Add descriptive text like "Clear all filters"');
    } else {
      addPassed('2.4.4', 'Link Purpose', 'Clear filters button has accessible name: "' + name + '"', getSelector(clearButton));
    }
  }

  // Test 5: Applied Filters Display
  function testAppliedFilters() {
    // Look for "chips" or tags showing applied filters
    const appliedSelectors = [
      '.active-filters',
      '.applied-filters',
      '[class*="active-filter"]',
      '[class*="filter-tag"]',
      '[class*="filter-chip"]',
      '[data-active-filters]'
    ];

    let appliedContainer = null;
    for (const selector of appliedSelectors) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) {
        appliedContainer = el;
        break;
      }
    }

    if (!appliedContainer) {
      addManualCheck('1.3.1', 'Consider displaying applied filters as removable tags', 'Helps users understand current filter state and easily remove individual filters', 'filters');
      return;
    }

    results.stats.elementsScanned++;

    // Check remove buttons on filter tags
    const removeButtons = appliedContainer.querySelectorAll('button, [role="button"], a[href*="remove"], [class*="remove"]');

    removeButtons.forEach(btn => {
      if (!isVisible(btn)) return;
      results.stats.elementsScanned++;

      const name = getAccessibleName(btn);
      if (!name || name === '' || name === 'x' || name === 'X') {
        addIssue('moderate', '2.4.4', 'Link Purpose', 'Filter removal button lacks descriptive name', btn, 'Add aria-label like "Remove Size: Large filter" that includes the filter being removed', 'Screen reader users cannot determine which filter will be removed');
      }
    });

    if (removeButtons.length > 0) {
      addPassed('1.3.1', 'Info and Relationships', 'Applied filters are displayed with removal options', getSelector(appliedContainer));
    }
  }

  // Test 6: Mobile Filter Drawer
  function testFilterDrawer() {
    let drawer = null;
    for (const selector of CONFIG.filterDrawerSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        drawer = el;
        break;
      }
    }

    if (!drawer) return;

    results.stats.elementsScanned++;

    // Check if drawer has proper dialog role when visible
    const role = drawer.getAttribute('role');
    const ariaModal = drawer.getAttribute('aria-modal');

    if (isVisible(drawer)) {
      if (role !== 'dialog') {
        addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Filter drawer/modal lacks role="dialog"', drawer, 'Add role="dialog" to the filter drawer container', 'Screen reader users may not understand they are in a modal context');
      }

      if (ariaModal !== 'true') {
        addManualCheck('4.1.2', 'Consider adding aria-modal="true" to filter drawer', 'Prevents screen readers from accessing content behind the drawer', getSelector(drawer));
      }

      // Check for close button
      const closeButton = drawer.querySelector('[class*="close"], [aria-label*="close" i], button[type="button"]');
      if (!closeButton) {
        addIssue('moderate', '2.4.4', 'Link Purpose', 'Filter drawer has no visible close button', drawer, 'Add a close button with aria-label="Close filters"', 'Users may not know how to dismiss the filter drawer');
      }
    }

    // Check for trigger button
    const triggerSelectors = [
      '[data-filter-toggle]',
      '[class*="filter-toggle"]',
      '[aria-controls="' + drawer.id + '"]',
      'button[aria-expanded]'
    ];

    let triggerButton = null;
    for (const selector of triggerSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        triggerButton = el;
        break;
      }
    }

    if (triggerButton) {
      results.stats.elementsScanned++;
      const ariaExpanded = triggerButton.getAttribute('aria-expanded');

      if (!ariaExpanded) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Filter drawer toggle lacks aria-expanded', triggerButton, 'Add aria-expanded="false" (or "true" when open) to indicate drawer state', 'Screen reader users cannot determine if filter drawer is open or closed');
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Filter drawer toggle has aria-expanded', getSelector(triggerButton));
      }
    }
  }

  // Test 7: Color/Swatch Filters
  function testColorSwatches() {
    const swatchSelectors = [
      '[class*="swatch"]',
      '[class*="color-filter"]',
      '[data-color]',
      '[data-swatch]',
      'input[type="radio"] + span[style*="background"]'
    ];

    let swatches = [];
    swatchSelectors.forEach(selector => {
      const els = filterEl.querySelectorAll(selector);
      els.forEach(el => {
        if (isVisible(el)) swatches.push(el);
      });
    });

    if (swatches.length === 0) return;

    results.stats.elementsScanned += swatches.length;

    let swatchesWithoutLabels = 0;

    swatches.forEach(swatch => {
      // Check if swatch is or contains an input
      const input = swatch.tagName === 'INPUT' ? swatch : swatch.querySelector('input');
      const button = swatch.tagName === 'BUTTON' ? swatch : swatch.closest('button');
      const link = swatch.tagName === 'A' ? swatch : swatch.closest('a');

      const interactive = input || button || link || swatch;
      const name = getAccessibleName(interactive);

      if (!name) {
        swatchesWithoutLabels++;
      }
    });

    if (swatchesWithoutLabels > 0) {
      addIssue('serious', '1.4.1', 'Use of Color', swatchesWithoutLabels + ' color swatch filters rely only on color without text labels', swatches[0], 'Add aria-label or visible text indicating the color name (e.g., "Navy Blue")', 'Users who cannot perceive color cannot identify filter options');
    } else {
      addPassed('1.4.1', 'Use of Color', 'All ' + swatches.length + ' color swatches have accessible labels', 'color swatches');
    }
  }

  // Test 8: On Input Behavior
  function testOnInputBehavior() {
    // Check if filters auto-apply or require submit button
    const submitButton = filterEl.querySelector('button[type="submit"], input[type="submit"], [class*="apply-filter"]');

    if (submitButton) {
      addPassed('3.2.2', 'On Input', 'Filters require explicit submission via button', getSelector(submitButton));
    } else {
      addManualCheck('3.2.2', 'Verify auto-applying filters provide adequate feedback', 'If filters apply immediately on selection: (1) Ensure results update is announced via live region, (2) Focus is managed appropriately, (3) Users are not disoriented by page changes', 'filter inputs');
    }
  }

  // Run all tests
  testFilterGroupStructure();
  testInputLabels();
  testLiveRegion();
  testClearFilters();
  testAppliedFilters();
  testFilterDrawer();
  testColorSwatches();
  testOnInputBehavior();

  // Finalize results
  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runFiltersAudit = runFiltersAudit;
}
