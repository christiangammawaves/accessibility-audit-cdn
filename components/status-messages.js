/**
 * Status Messages Accessibility Audit
 * WCAG: 4.1.3
 */

function runStatusMessagesAudit() {
  'use strict';

  const startTime = performance.now();

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('status-messages', 'Status messages and ARIA live regions');
  const { isVisible, getSelector } = h;

  // ==========================================================================
  // TEST 1: Existing ARIA Live Regions
  // ==========================================================================

  function testExistingLiveRegions() {
    // Find all ARIA live regions
    const liveRegions = document.querySelectorAll(
      '[role="status"], ' +
      '[role="alert"], ' +
      '[role="log"], ' +
      '[aria-live="polite"], ' +
      '[aria-live="assertive"]'
    );

    liveRegions.forEach(region => {
      results.stats.elementsScanned++;

      const role = region.getAttribute('role');
      const ariaLive = region.getAttribute('aria-live');
      const ariaAtomic = region.getAttribute('aria-atomic');
      const ariaRelevant = region.getAttribute('aria-relevant');

      // Check if region has content or will have content
      const hasContent = region.textContent.trim().length > 0;
      const hasChildren = region.children.length > 0;

      if (!hasContent && !hasChildren) {
        // Empty live region is OK - it's likely a container waiting for dynamic content
        addPassed('4.1.3', 'Status Messages', 'Live region container ready for status messages', getSelector(region));
      } else {
        // Has content
        addPassed('4.1.3', 'Status Messages', 'Live region contains status message', getSelector(region));
      }

      // Check for proper aria-atomic usage
      if (role === 'alert' && !ariaAtomic) {
        // Alerts should typically be atomic
        addManualCheck(
          '4.1.3',
          'Verify alert region behavior',
          'Alert region should usually have aria-atomic="true" to announce the entire message. Verify the alert announces properly.',
          getSelector(region)
        );
      }
    });

    if (liveRegions.length > 0) {
      addManualCheck(
        '4.1.3',
        'Test live region announcements',
        liveRegions.length + ' live regions found. Use a screen reader to verify dynamic status messages are announced correctly when they appear.',
        'document'
      );
    }
  }

  // ==========================================================================
  // TEST 2: Common Status Message Patterns (Potential Issues)
  // ==========================================================================

  function testStatusMessagePatterns() {
    // Look for common status message patterns that might not have ARIA live regions

    // 1. Loading indicators
    const loadingIndicators = document.querySelectorAll(
      '[class*="loading"], ' +
      '[class*="spinner"], ' +
      '[class*="loader"], ' +
      '[aria-busy="true"]'
    );

    loadingIndicators.forEach(loader => {
      results.stats.elementsScanned++;

      if (!isVisible(loader)) return;

      const hasLiveRegion = loader.hasAttribute('aria-live') || 
                           loader.hasAttribute('role') ||
                           loader.closest('[aria-live], [role="status"], [role="alert"]');

      if (!hasLiveRegion) {
        addManualCheck(
          '4.1.3',
          'Verify loading state is announced',
          'Loading indicator found without ARIA live region. Verify that screen readers announce when content is loading.',
          getSelector(loader)
        );
      }
    });

    // 2. Success/error message containers
    const messageContainers = document.querySelectorAll(
      '[class*="success"], ' +
      '[class*="error"], ' +
      '[class*="warning"], ' +
      '[class*="notification"], ' +
      '[class*="toast"], ' +
      '[class*="alert"]:not([role="alert"]), ' +
      '[class*="message"]:not([role="status"])'
    );

    messageContainers.forEach(container => {
      results.stats.elementsScanned++;

      if (!isVisible(container)) return;

      const hasLiveRegion = container.hasAttribute('aria-live') || 
                           container.hasAttribute('role') ||
                           container.closest('[aria-live], [role="status"], [role="alert"]');

      const text = container.textContent.trim();

      // Only flag if it has actual message content
      if (text.length > 0 && !hasLiveRegion) {
        const className = container.className;
        let messageType = 'status message';
        
        if (/error/i.test(className)) messageType = 'error message';
        else if (/success/i.test(className)) messageType = 'success message';
        else if (/warning/i.test(className)) messageType = 'warning';

        addIssue(
          'moderate',
          '4.1.3',
          'Status Messages',
          'Potential ' + messageType + ' without ARIA live region',
          container,
          'Add role="status" (for non-urgent) or role="alert" (for urgent) so screen readers announce the message',
          'Screen reader users may miss important ' + messageType + 's'
        );
      }
    });

    // 3. Cart update indicators
    const cartElements = document.querySelectorAll(
      '[class*="cart-count"], ' +
      '[class*="cart-total"], ' +
      '[class*="item-count"]'
    );

    let foundCartWithoutLive = false;
    cartElements.forEach(cart => {
      results.stats.elementsScanned++;

      if (!isVisible(cart)) return;

      const hasLiveRegion = cart.hasAttribute('aria-live') || 
                           cart.closest('[aria-live], [role="status"]');

      if (!hasLiveRegion && !foundCartWithoutLive) {
        foundCartWithoutLive = true;
        addManualCheck(
          '4.1.3',
          'Verify cart updates are announced',
          'Cart count/total elements found without ARIA live regions. When items are added/removed, verify screen readers announce the update (e.g., "Cart updated: 3 items").',
          getSelector(cart)
        );
      }
    });

    // 4. Form validation messages
    const validationMessages = document.querySelectorAll(
      '[class*="validation"], ' +
      '[class*="error-message"], ' +
      '[class*="field-error"], ' +
      '[class*="help-text"][class*="error"]'
    );

    validationMessages.forEach(msg => {
      results.stats.elementsScanned++;

      if (!isVisible(msg)) return;

      const text = msg.textContent.trim();
      if (text.length === 0) return;

      const hasLiveRegion = msg.hasAttribute('aria-live') || 
                           msg.hasAttribute('role') ||
                           msg.closest('[aria-live], [role="alert"]');

      // Form validation errors should be associated with inputs via aria-describedby
      const associatedInput = msg.id && document.querySelector('[aria-describedby*="' + msg.id + '"]');

      if (!hasLiveRegion && !associatedInput) {
        addIssue(
          'moderate',
          '4.1.3',
          'Status Messages',
          'Form validation message may not be announced',
          msg,
          'Add role="alert" or aria-live="assertive" to announce validation errors, or link via aria-describedby from the input field',
          'Screen reader users may not know about validation errors'
        );
      }
    });

    // 5. Search results count
    const resultsIndicators = document.querySelectorAll(
      '[class*="results-count"], ' +
      '[class*="search-results"], ' +
      '[class*="showing-results"]'
    );

    let foundResultsWithoutLive = false;
    resultsIndicators.forEach(indicator => {
      results.stats.elementsScanned++;

      if (!isVisible(indicator)) return;

      const hasLiveRegion = indicator.hasAttribute('aria-live') || 
                           indicator.closest('[aria-live], [role="status"]');

      if (!hasLiveRegion && !foundResultsWithoutLive) {
        foundResultsWithoutLive = true;
        addManualCheck(
          '4.1.3',
          'Verify search results are announced',
          'Search results count found without ARIA live region. When filtering or searching, verify the results count is announced (e.g., "Showing 24 results").',
          getSelector(indicator)
        );
      }
    });
  }

  // ==========================================================================
  // TEST 3: Dynamic Content Areas
  // ==========================================================================

  function testDynamicContentAreas() {
    // Add general manual check for dynamic content
    addManualCheck(
      '4.1.3',
      'Test all dynamic content updates',
      'Use the site and verify status messages appear with screen reader announcements for: ' +
      '(1) Adding items to cart, ' +
      '(2) Form submissions (success/error), ' +
      '(3) Search/filter updates, ' +
      '(4) Loading states, ' +
      '(5) Any dynamic content changes',
      'document'
    );
  }

  // ==========================================================================
  // RUN TESTS
  // ==========================================================================

  testExistingLiveRegions();
  testStatusMessagePatterns();
  testDynamicContentAreas();

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
  window.runStatusMessagesAudit = runStatusMessagesAudit;
}
