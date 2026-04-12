/**
 * Search Accessibility Audit
 * WCAG: 2.1.1, 2.1.2, 2.4.3, 3.3.2, 4.1.2, 4.1.3
 */

function runSearchAudit() {
  'use strict';

  const startTime = performance.now();

  // Configuration
  const CONFIG = {
    searchTriggerSelectors: [
      'button[aria-label*="search" i]',
      'a[aria-label*="search" i]',
      '[class*="search-icon"]',
      '[class*="search-trigger"]',
      '[data-action*="search"]',
      'button.search',
      '.search-toggle'
    ],
    searchModalSelectors: [
      '[role="dialog"][class*="search"]',
      '[role="dialog"][aria-label*="search" i]',
      '.search-modal',
      '.search-drawer',
      '[class*="search-modal"]',
      '[class*="search-drawer"]',
      '[class*="search-overlay"]',
      '#search-modal',
      '#SearchModal',
      '[id*="search"][id*="modal" i]'
    ],
    searchInputSelectors: [
      'input[type="search"]',
      'input[name="q"]',
      'input[name="query"]',
      'input[name="search"]',
      'input[aria-label*="search" i]',
      'input[placeholder*="search" i]',
      '.search-input',
      '[class*="search"] input[type="text"]'
    ],
    predictiveResultsSelectors: [
      '[role="listbox"]',
      '[role="list"]',
      '.predictive-search',
      '.search-results',
      '.autocomplete-results',
      '[class*="predictive"]',
      '[class*="suggestions"]',
      '[aria-live]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('search', 'search modal, search input, predictive results');
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  // Find search elements
  function findSearchModal() {
    for (const selector of CONFIG.searchModalSelectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findSearchInput(container) {
    const scope = container || document;
    for (const selector of CONFIG.searchInputSelectors) {
      const el = scope.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findSearchTrigger() {
    for (const selector of CONFIG.searchTriggerSelectors) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  function findPredictiveResults(container) {
    const scope = container || document;
    for (const selector of CONFIG.predictiveResultsSelectors) {
      const el = scope.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  const searchModal = findSearchModal();
  const searchInput = findSearchInput(searchModal);
  const searchTrigger = findSearchTrigger();
  const predictiveResults = findPredictiveResults(searchModal);

  // Test 1: Search Modal Dialog Role
  function testSearchModalRole() {
    if (!searchModal) {
      addManualCheck('4.1.2', 'Verify search modal has proper dialog role', 'Open search and inspect modal element for role="dialog" or <dialog> element');
      return;
    }

    results.stats.elementsScanned++;
    const role = searchModal.getAttribute('role');
    const isDialogElement = searchModal.tagName.toLowerCase() === 'dialog';
    const ariaModal = searchModal.getAttribute('aria-modal');

    if (!isDialogElement && role !== 'dialog' && role !== 'alertdialog') {
      addIssue('critical', '4.1.2', 'Name, Role, Value', 'Search modal missing role="dialog"', searchModal, 'Add role="dialog" to the search modal container', 'Screen reader users not informed this is a modal dialog');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Search modal has dialog role', getSelector(searchModal));
    }

    if (!isDialogElement && ariaModal !== 'true') {
      addIssue('serious', '4.1.2', 'Name, Role, Value', 'Search modal missing aria-modal="true"', searchModal, 'Add aria-modal="true" to indicate modal behavior', 'Screen readers may not properly handle focus within modal');
    }

    // Check for accessible name
    const name = getAccessibleName(searchModal);
    if (!name) {
      const hasTitle = searchModal.querySelector('h1, h2, h3, [class*="title"]');
      if (hasTitle) {
        addIssue('serious', '4.1.2', 'Name, Role, Value', 'Search modal has title but no aria-labelledby', searchModal, 'Add aria-labelledby pointing to the modal title element');
      } else {
        addIssue('serious', '4.1.2', 'Name, Role, Value', 'Search modal has no accessible name', searchModal, 'Add aria-label="Search" or aria-labelledby pointing to a heading');
      }
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Search modal has accessible name: "' + name.slice(0, 30) + '"', getSelector(searchModal));
    }
  }

  // Test 2: Focus Trap in Modal
  function testFocusTrap() {
    if (!searchModal) {
      addManualCheck('2.1.2', 'Test focus trap in search modal', 'Open search, tab through elements. Focus should stay within modal until closed.');
      return;
    }

    const isModalVisible = isVisible(searchModal);
    if (!isModalVisible) {
      addManualCheck('2.1.2', 'Test focus trap in search modal', 'Open search modal, then tab through. Verify focus stays within modal.');
      return;
    }

    results.stats.elementsScanned++;
    const focusableInModal = getFocusableElements(searchModal);

    if (focusableInModal.length === 0) {
      addIssue('critical', '2.4.3', 'Focus Order', 'Open search modal has no focusable elements', searchModal, 'Ensure modal has at least search input and close button', 'Keyboard users cannot interact with search modal');
      return;
    }

    // Check if background content is properly hidden
    const mainContent = document.querySelector('main, [role="main"], #main, #MainContent');
    if (mainContent) {
      const isHidden = mainContent.getAttribute('aria-hidden') === 'true' || mainContent.hasAttribute('inert');
      if (!isHidden) {
        addIssue('serious', '2.1.2', 'No Keyboard Trap', 'Background content not hidden when search modal is open', mainContent, 'Add aria-hidden="true" or inert attribute to main content when modal opens', 'Focus may escape modal to background content');
      }
    }

    // Check for close button
    const closeButton = searchModal.querySelector('button[aria-label*="close" i], [aria-label*="dismiss" i], .close, .close-button, [class*="close"]');
    if (!closeButton) {
      addIssue('serious', '2.1.1', 'Keyboard', 'Search modal has no visible close button', searchModal, 'Add a close button with aria-label="Close search"', 'Users may not know how to close the modal');
    } else {
      const closeName = getAccessibleName(closeButton);
      if (!closeName) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Close button has no accessible name', closeButton, 'Add aria-label="Close search"');
      }
    }

    addManualCheck('2.1.2', 'Verify focus trap implementation', 'Tab through search modal - focus should cycle within modal and not escape to background', getSelector(searchModal));
  }

  // Test 3: Escape Key Closes Modal
  function testEscapeKey() {
    if (!searchModal) {
      addManualCheck('2.1.1', 'Test Escape key closes search', 'Open search, press Escape key. Modal should close.');
      return;
    }

    // Check for indicators of escape key handling
    const hasKeydownAttr = searchModal.hasAttribute('onkeydown') || searchModal.hasAttribute('onkeyup');
    const hasDismissData = searchModal.hasAttribute('data-dismiss') || searchModal.hasAttribute('data-keyboard');

    if (!hasKeydownAttr && !hasDismissData) {
      addIssue('moderate', '2.1.1', 'Keyboard', 'Search modal may not close with Escape key', searchModal, 'Add keydown event listener to close modal on Escape', 'Keyboard users cannot easily close the modal');
    }

    addManualCheck('2.1.1', 'Verify Escape key closes search modal', 'Open search modal, press Escape. Modal should close and focus should return to search trigger.', getSelector(searchModal));
  }

  // Test 4: Focus Moves to Input on Open
  function testInitialFocus() {
    if (!searchModal || !searchInput) {
      addManualCheck('2.4.3', 'Verify focus moves to search input when modal opens', 'Click search icon - focus should immediately move to search input field');
      return;
    }

    // Check if input has autofocus
    const hasAutofocus = searchInput.hasAttribute('autofocus');

    if (!hasAutofocus) {
      addManualCheck('2.4.3', 'Verify initial focus placement', 'Open search modal - focus should move to search input automatically', getSelector(searchInput));
    } else {
      addPassed('2.4.3', 'Focus Order', 'Search input has autofocus attribute', getSelector(searchInput));
    }
  }

  // Test 5: Search Input Labeling
  function testSearchInputLabel() {
    if (!searchInput) {
      const anyInput = findSearchInput(document);
      if (anyInput) {
        results.stats.elementsScanned++;
        testInputLabeling(anyInput);
      } else {
        addManualCheck('3.3.2', 'Verify search input has proper label', 'Locate search input and verify it has associated label or aria-label');
      }
      return;
    }

    results.stats.elementsScanned++;
    testInputLabeling(searchInput);
  }

  function testInputLabeling(input) {
    const name = getAccessibleName(input);
    const type = input.getAttribute('type');
    const hasPlaceholder = input.hasAttribute('placeholder');

    if (!name) {
      addIssue('critical', '3.3.2', 'Labels or Instructions', 'Search input has no accessible label', input, 'Add aria-label="Search" or associated <label> element', 'Screen reader users cannot identify the input purpose');
      return;
    }

    // Check if only placeholder is used as label
    const hasLabel = input.id && document.querySelector('label[for="' + input.id + '"]');
    const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');

    if (hasPlaceholder && !hasLabel && !hasAriaLabel) {
      addIssue('moderate', '3.3.2', 'Labels or Instructions', 'Search input uses only placeholder as label', input, 'Add aria-label or visible/visually-hidden label element', 'Placeholder disappears when typing, leaving no label');
    } else {
      addPassed('3.3.2', 'Labels or Instructions', 'Search input has accessible label: "' + name.slice(0, 30) + '"', getSelector(input));
    }

    // Check for autocomplete
    const autocomplete = input.getAttribute('autocomplete');
    if (type === 'search' && autocomplete !== 'off') {
      addPassed('1.3.5', 'Identify Input Purpose', 'Search input type correctly identifies purpose', getSelector(input));
    }
  }

  // Test 6: Predictive Search / Autocomplete
  function testPredictiveSearch() {
    const resultsContainer = predictiveResults || findPredictiveResults(document);

    if (!resultsContainer) {
      addManualCheck('4.1.3', 'Test predictive search announcements', 'Type in search - if results appear, verify they are announced to screen readers via aria-live');
      return;
    }

    results.stats.elementsScanned++;

    // Check for live region
    const ariaLive = resultsContainer.getAttribute('aria-live');
    const role = resultsContainer.getAttribute('role');

    if (!ariaLive && role !== 'status' && role !== 'alert') {
      addIssue('serious', '4.1.3', 'Status Messages', 'Predictive search results not announced to screen readers', resultsContainer, 'Add aria-live="polite" or role="status" to results container', 'Screen reader users not informed when results appear');
    } else {
      addPassed('4.1.3', 'Status Messages', 'Predictive results container has live region', getSelector(resultsContainer));
    }

    // Check result items for accessibility
    const resultItems = resultsContainer.querySelectorAll('a, button, [role="option"], li');
    if (resultItems.length > 0) {
      // Check first few items for accessible names
      let itemsWithoutName = 0;
      Array.from(resultItems).slice(0, 5).forEach(item => {
        if (!getAccessibleName(item)) {
          itemsWithoutName++;
        }
      });

      if (itemsWithoutName > 0) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value', itemsWithoutName + ' search result items may lack accessible names', resultsContainer, 'Ensure all result items have text content or aria-label');
      }
    }

    // Check for combobox/listbox pattern
    if (searchInput) {
      const ariaExpanded = searchInput.getAttribute('aria-expanded');
      const ariaControls = searchInput.getAttribute('aria-controls');
      const inputRole = searchInput.getAttribute('role');

      if (inputRole === 'combobox') {
        if (!ariaExpanded) {
          addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Combobox search missing aria-expanded', searchInput, 'Add aria-expanded="true/false" to indicate dropdown state');
        }
        if (!ariaControls) {
          addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Combobox search missing aria-controls', searchInput, 'Add aria-controls pointing to results listbox ID');
        }
        addPassed('4.1.2', 'Name, Role, Value', 'Search uses combobox pattern', getSelector(searchInput));
      } else {
        addManualCheck('4.1.2', 'Verify search autocomplete pattern', 'If using autocomplete, consider implementing combobox pattern for better screen reader support');
      }
    }
  }

  // Test 7: Search Trigger Button
  function testSearchTrigger() {
    if (!searchTrigger) {
      addManualCheck('4.1.2', 'Verify search trigger has accessible name', 'Locate search icon/button and verify it has aria-label or text');
      return;
    }

    results.stats.elementsScanned++;
    const name = getAccessibleName(searchTrigger);

    if (!name) {
      addIssue('critical', '4.1.2', 'Name, Role, Value', 'Search trigger button has no accessible name', searchTrigger, 'Add aria-label="Open search" or "Search site"', 'Screen reader users cannot identify the search button');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Search trigger has accessible name: "' + name.slice(0, 30) + '"', getSelector(searchTrigger));
    }

    // Check for aria-expanded if it controls a modal
    if (searchModal) {
      const ariaExpanded = searchTrigger.getAttribute('aria-expanded');
      const ariaControls = searchTrigger.getAttribute('aria-controls');

      if (!ariaExpanded) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Search trigger missing aria-expanded', searchTrigger, 'Add aria-expanded="false" that toggles to "true" when search opens');
      }

      if (!ariaControls && searchModal.id) {
        addIssue('minor', '4.1.2', 'Name, Role, Value', 'Search trigger missing aria-controls', searchTrigger, 'Add aria-controls="' + searchModal.id + '" to associate with modal');
      }
    }
  }

  // Test 8: Focus Return on Close
  function testFocusReturn() {
    if (!searchModal || !searchTrigger) {
      addManualCheck('2.4.3', 'Verify focus returns to trigger on modal close', 'Open search, close it, verify focus returns to the element that opened it');
      return;
    }

    addManualCheck('2.4.3', 'Verify focus returns to search trigger on close', 'Open search modal, close it (click X or press Escape). Focus should return to the search icon/button that opened it.', getSelector(searchTrigger));
  }

  // Run all tests
  testSearchModalRole();
  testFocusTrap();
  testEscapeKey();
  testInitialFocus();
  testSearchInputLabel();
  testPredictiveSearch();
  testSearchTrigger();
  testFocusReturn();

  // Finalize results
  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runSearchAudit = runSearchAudit;
}
