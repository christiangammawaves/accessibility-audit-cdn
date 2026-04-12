/**
 * Quick View Accessibility Audit
 * WCAG: 1.1.1, 2.1.1, 2.1.2, 2.4.3, 4.1.2
 */

function runQuickViewAudit() {
  'use strict';

  const startTime = performance.now();

  const CONFIG = {
    quickViewSelectors: [
      '[class*="quick-view"]',
      '[class*="quickview"]',
      '[class*="quick_view"]',
      '[class*="quickshop"]',
      '[class*="quick-shop"]',
      '[class*="quick-add"]',
      '[class*="product-preview"]',
      '[class*="product-modal"]',
      '[id*="quick-view"]',
      '[id*="quickview"]',
      '[data-quick-view]',
      '[data-quickview]'
    ],
    triggerSelectors: [
      '[class*="quick-view-trigger"]',
      '[class*="quick-view-btn"]',
      '[class*="quickview-button"]',
      'button[class*="quick"]',
      'a[class*="quick-view"]',
      '[data-quick-view-trigger]',
      '[aria-label*="quick view" i]',
      '[aria-label*="quick shop" i]',
      '[title*="quick view" i]'
    ],
    productCardSelectors: [
      '[class*="product-card"]',
      '[class*="product-item"]',
      '[class*="product-tile"]',
      '[class*="grid-item"]',
      '.product',
      'article[class*="product"]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('quick-view', 'Quick view modals, quick shop overlays');
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  // ==========================================================================
  // FIND QUICK VIEW ELEMENTS
  // ==========================================================================

  function findQuickViewModals() {
    const modals = new Set();
    CONFIG.quickViewSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => modals.add(el));
      } catch (e) { /* Invalid selector */ }
    });
    return Array.from(modals);
  }

  function findQuickViewTriggers() {
    const triggers = new Set();
    CONFIG.triggerSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => triggers.add(el));
      } catch (e) { /* Invalid selector */ }
    });
    
    // Also find triggers within product cards
    CONFIG.productCardSelectors.forEach(cardSelector => {
      try {
        document.querySelectorAll(cardSelector).forEach(card => {
          const trigger = card.querySelector('button, a');
          if (trigger) {
            const text = (trigger.textContent || '').toLowerCase();
            const label = (trigger.getAttribute('aria-label') || '').toLowerCase();
            if (text.includes('quick') || label.includes('quick')) {
              triggers.add(trigger);
            }
          }
        });
      } catch (e) { /* Invalid selector */ }
    });
    
    return Array.from(triggers).filter(isVisible);
  }

  const allModals = findQuickViewModals();
  const allTriggers = findQuickViewTriggers();
  const visibleModals = allModals.filter(isVisible);

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================

  function testQuickViewTrigger(trigger) {
    results.stats.elementsScanned++;
    
    const name = getAccessibleName(trigger);
    const tagName = trigger.tagName.toLowerCase();
    const ariaHaspopup = trigger.getAttribute('aria-haspopup');
    
    // Test 1: Accessible name
    if (!name) {
      addIssue('critical', '4.1.2', 'Name, Role, Value',
        'Quick view trigger has no accessible name',
        trigger,
        'Add aria-label="Quick view [product name]"',
        'Screen reader users cannot identify button purpose');
    } else if (!name.toLowerCase().includes('quick') && !name.toLowerCase().includes('preview')) {
      // Name exists but doesn't indicate quick view
      addIssue('moderate', '4.1.2', 'Name, Role, Value',
        `Quick view trigger name "${name.slice(0, 30)}" doesn't indicate function`,
        trigger,
        'Include "Quick view" or "Preview" in accessible name',
        'Screen reader users may not understand this opens a modal');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', `Trigger has name: "${name.slice(0, 40)}"`, getSelector(trigger));
    }
    
    // Test 2: aria-haspopup
    if (!ariaHaspopup) {
      addIssue('serious', '4.1.2', 'Name, Role, Value',
        'Quick view trigger missing aria-haspopup',
        trigger,
        'Add aria-haspopup="dialog" to indicate modal opens',
        'Screen reader users not informed this opens a dialog');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', `Trigger has aria-haspopup="${ariaHaspopup}"`, getSelector(trigger));
    }
    
    // Test 3: Button vs link
    if (tagName === 'a') {
      const href = trigger.getAttribute('href');
      if (!href || href === '#' || href.startsWith('javascript:')) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value',
          'Quick view trigger should be button, not empty link',
          trigger,
          'Use <button> element since this opens a modal, not navigates',
          'Incorrect semantic element');
      }
    }
    
    // Test 4: Keyboard accessible
    const tabindex = trigger.getAttribute('tabindex');
    if (tabindex === '-1') {
      addIssue('critical', '2.1.1', 'Keyboard',
        'Quick view trigger not keyboard accessible',
        trigger,
        'Remove tabindex="-1"',
        'Keyboard users cannot activate quick view');
    }
    
    // Test 5: Check if in product card context
    const productCard = trigger.closest('[class*="product"]');
    if (productCard) {
      // Verify trigger name includes product name for context
      const productName = productCard.querySelector('[class*="title"], [class*="name"], h2, h3');
      if (productName && !name.includes(productName.textContent.trim().slice(0, 20))) {
        addManualCheck('4.1.2', 'Verify quick view trigger includes product context',
          `Trigger says "${name.slice(0, 30)}" - should include product name for clarity`,
          getSelector(trigger));
      }
    }
  }

  function testQuickViewModal(modal) {
    results.stats.elementsScanned++;
    
    const role = modal.getAttribute('role');
    const ariaModal = modal.getAttribute('aria-modal');
    const isNativeDialog = modal.tagName.toLowerCase() === 'dialog';
    const name = getAccessibleName(modal);
    const currentlyVisible = isVisible(modal);
    
    // Test 1: Dialog role
    if (!isNativeDialog && role !== 'dialog') {
      addIssue('critical', '4.1.2', 'Name, Role, Value',
        'Quick view modal missing role="dialog"',
        modal,
        'Add role="dialog" to quick view container',
        'Screen reader users not informed this is a modal');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Quick view has dialog role', getSelector(modal));
    }
    
    // Test 2: aria-modal
    if (!isNativeDialog && ariaModal !== 'true') {
      addIssue('serious', '4.1.2', 'Name, Role, Value',
        'Quick view missing aria-modal="true"',
        modal,
        'Add aria-modal="true" to trap focus',
        'Focus may escape modal to background');
    } else if (ariaModal === 'true' || isNativeDialog) {
      addPassed('4.1.2', 'Name, Role, Value', 'Quick view has aria-modal', getSelector(modal));
    }
    
    // Test 3: Accessible name
    if (!name) {
      addIssue('serious', '4.1.2', 'Name, Role, Value',
        'Quick view has no accessible name',
        modal,
        'Add aria-labelledby pointing to product title',
        'Screen reader users cannot identify modal content');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', `Quick view named: "${name.slice(0, 40)}"`, getSelector(modal));
    }
    
    // Test 4: Close button
    const closeBtn = modal.querySelector('button[aria-label*="close" i], [class*="close"], [data-close]');
    if (!closeBtn) {
      addIssue('critical', '2.1.1', 'Keyboard',
        'Quick view has no close button',
        modal,
        'Add accessible close button',
        'Users cannot dismiss quick view');
    } else {
      const closeName = getAccessibleName(closeBtn);
      if (!closeName || closeName.length < 3) {
        addIssue('serious', '4.1.2', 'Name, Role, Value',
          'Close button has no/insufficient accessible name',
          closeBtn,
          'Add aria-label="Close quick view"');
      }
    }
    
    // Test 5: Focus management (if visible)
    if (currentlyVisible) {
      const focusable = getFocusableElements(modal);
      if (focusable.length === 0) {
        addIssue('critical', '2.4.3', 'Focus Order',
          'Open quick view has no focusable elements',
          modal,
          'Ensure close button and form controls are focusable',
          'Keyboard users cannot interact with quick view');
      }
      
      // Check background
      const mainContent = document.querySelector('main, [role="main"], #MainContent');
      if (mainContent && !mainContent.contains(modal)) {
        const mainHidden = mainContent.getAttribute('aria-hidden') === 'true' || mainContent.hasAttribute('inert');
        if (!mainHidden) {
          addIssue('serious', '2.1.2', 'No Keyboard Trap',
            'Background not hidden while quick view is open',
            mainContent,
            'Add aria-hidden="true" or inert to main content');
        }
      }
    }
    
    // Test 6: Product image in quick view
    const productImage = modal.querySelector('img[class*="product"], img[class*="main"], .product-image img');
    if (productImage) {
      results.stats.elementsScanned++;
      const alt = productImage.getAttribute('alt');
      if (!alt) {
        addIssue('serious', '1.1.1', 'Non-text Content',
          'Quick view product image missing alt text',
          productImage,
          'Add descriptive alt text for product image',
          'Screen reader users cannot identify product');
      } else if (alt.match(/^(image|photo|picture|img|\d+)$/i)) {
        addIssue('moderate', '1.1.1', 'Non-text Content',
          `Product image has non-descriptive alt: "${alt}"`,
          productImage,
          'Use product name and variant in alt text');
      }
    }
    
    // Test 7: Add to cart in quick view
    const addToCartBtn = modal.querySelector('button[class*="add-to-cart"], [class*="add_to_cart"], [type="submit"]');
    if (addToCartBtn) {
      results.stats.elementsScanned++;
      const cartBtnName = getAccessibleName(addToCartBtn);
      if (!cartBtnName) {
        addIssue('serious', '4.1.2', 'Name, Role, Value',
          'Add to cart button has no accessible name',
          addToCartBtn,
          'Add clear button text or aria-label');
      }
    }
    
    // Test 8: Variant selectors
    const selects = modal.querySelectorAll('select, [role="listbox"]');
    selects.forEach(select => {
      results.stats.elementsScanned++;
      const selectName = getAccessibleName(select);
      if (!selectName) {
        addIssue('serious', '3.3.2', 'Labels or Instructions',
          'Variant selector has no label',
          select,
          'Add label for size/color/variant selector');
      }
    });
    
    // Manual checks
    addManualCheck('2.1.1', 'Verify Escape closes quick view',
      'Open quick view and press Escape - modal should close',
      getSelector(modal));
    
    addManualCheck('2.4.3', 'Verify focus returns to trigger after close',
      'Close quick view - focus should return to the quick view button that opened it',
      getSelector(modal));
    
    addManualCheck('2.1.2', 'Verify focus is trapped in quick view',
      'Tab through quick view - focus should cycle within modal only',
      getSelector(modal));
  }

  // ==========================================================================
  // RUN AUDIT
  // ==========================================================================

  if (allTriggers.length === 0 && allModals.length === 0) {
    results.manualChecks.push({
      wcag: '4.1.2',
      message: 'No quick view elements detected',
      howToTest: 'Check if product listing pages have quick view functionality'
    });
  } else {
    // Test triggers
    allTriggers.forEach(trigger => testQuickViewTrigger(trigger));
    
    // Test modals
    allModals.forEach(modal => testQuickViewModal(modal));
    
    // Summary
    if (allTriggers.length > 0) {
      addPassed('N/A', 'Detection', `Found ${allTriggers.length} quick view trigger(s)`, 'page');
    }
    
    if (allModals.length > 0 && visibleModals.length === 0) {
      addManualCheck('4.1.2', 'Quick view modal(s) found but not currently open',
        'Click a quick view button to test modal in open state',
        null);
    }
  }

  // ==========================================================================
  // FINALIZE
  // ==========================================================================

  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

if (typeof window !== 'undefined') {
  window.runQuickViewAudit = runQuickViewAudit;
}
