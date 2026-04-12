/**
 * Cart Accessibility Audit
 * WCAG: 1.3.1, 2.1.1, 2.1.2, 2.4.3, 4.1.2, 4.1.3
 */

function runCartAudit() {
  'use strict';

  const startTime = performance.now();

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  const CONFIG = {
    scope: [
      '[role="dialog"][class*="cart"]',
      '[class*="cart-drawer"]',
      '[class*="cart-modal"]',
      '[class*="mini-cart"]',
      '[class*="side-cart"]',
      '#cart-drawer',
      '#CartDrawer',
      '.cart-drawer',
      '.drawer[class*="cart"]',
      '[data-cart-drawer]',
      'aside[class*="cart"]'
    ],
    cartTriggerSelectors: [
      '[class*="cart-icon"]',
      '[class*="cart-toggle"]',
      '[class*="cart-button"]',
      'a[href*="/cart"]',
      '[data-cart-toggle]',
      '#cart-icon-bubble',
      '.header__icon--cart'
    ],
    quantitySelectors: [
      'input[type="number"]',
      '[class*="quantity"] input',
      '[class*="qty"] input',
      'input[name*="quantity"]',
      'input[name*="qty"]'
    ],
    removeButtonSelectors: [
      '[class*="remove"]',
      '[class*="delete"]',
      '[aria-label*="remove" i]',
      '[aria-label*="delete" i]',
      'button[class*="trash"]',
      'a[href*="change?quantity=0"]'
    ],
    cartItemSelectors: [
      '[class*="cart-item"]',
      '[class*="line-item"]',
      'li[class*="cart"]',
      '[data-cart-item]',
      'tr[class*="cart"]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('cart', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  // ==========================================================================
  // FIND CART COMPONENT
  // ==========================================================================

  function findCartDrawer() {
    for (const selector of CONFIG.scope) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function findCartTrigger() {
    for (const selector of CONFIG.cartTriggerSelectors) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  const cartDrawer = findCartDrawer();
  const cartTrigger = findCartTrigger();
  const isCartOpen = cartDrawer && isVisible(cartDrawer);

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================
  
  /**
   * Test 1: Cart Drawer Dialog Role
   * WCAG: 4.1.2
   */
  function testDialogRole() {
    if (!cartDrawer) {
      addManualCheck('4.1.2', 'Cart drawer not found - verify cart drawer exists', 'Open cart drawer and re-run audit to test dialog accessibility', null);
      return;
    }
    
    results.stats.elementsScanned++;
    
    const role = cartDrawer.getAttribute('role');
    const ariaModal = cartDrawer.getAttribute('aria-modal');
    const isNativeDialog = cartDrawer.tagName.toLowerCase() === 'dialog';
    
    if (!isNativeDialog && role !== 'dialog') {
      addIssue(
        'critical',
        '4.1.2',
        'Name, Role, Value',
        'Cart drawer missing role="dialog"',
        cartDrawer,
        'Add role="dialog" to cart drawer element',
        'Screen reader users not informed this is a dialog'
      );
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Cart drawer has dialog role', getSelector(cartDrawer));
    }
    
    if (!isNativeDialog && ariaModal !== 'true') {
      addIssue(
        'serious',
        '4.1.2',
        'Name, Role, Value',
        'Cart drawer missing aria-modal="true"',
        cartDrawer,
        'Add aria-modal="true" to indicate modal behavior',
        'Screen readers may allow focus to escape drawer'
      );
    } else if (ariaModal === 'true' || isNativeDialog) {
      addPassed('4.1.2', 'Name, Role, Value', 'Cart drawer has aria-modal="true"', getSelector(cartDrawer));
    }
    
    // Check accessible name
    const name = getAccessibleName(cartDrawer);
    if (!name) {
      const heading = cartDrawer.querySelector('h1, h2, h3, h4');
      if (heading) {
        if (heading.id) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Cart drawer has heading but no aria-labelledby',
            cartDrawer,
            'Add aria-labelledby="' + heading.id + '" to cart drawer',
            'Screen reader users not given drawer title'
          );
        } else {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Cart drawer has no accessible name',
            cartDrawer,
            'Add id to heading and aria-labelledby to drawer, or add aria-label="Shopping cart"',
            'Screen reader users not given drawer title'
          );
        }
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Cart drawer has no accessible name',
          cartDrawer,
          'Add aria-label="Shopping cart" or aria-labelledby pointing to heading',
          'Screen reader users not given drawer title'
        );
      }
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Cart drawer has accessible name: "' + name.slice(0, 40) + '"', getSelector(cartDrawer));
    }
  }

  /**
   * Test 2: Cart Trigger Accessibility
   * WCAG: 4.1.2
   */
  function testCartTrigger() {
    if (!cartTrigger) {
      addManualCheck('4.1.2', 'Cart trigger button not found', 'Verify cart icon/button has accessible name like "Cart" or "View cart"', null);
      return;
    }
    
    results.stats.elementsScanned++;
    
    const name = getAccessibleName(cartTrigger);
    if (!name || name.length < 2) {
      addIssue(
        'critical',
        '4.1.2',
        'Name, Role, Value',
        'Cart button/icon has no accessible name',
        cartTrigger,
        'Add aria-label="Cart" or aria-label="View cart (X items)"',
        'Screen reader users cannot identify cart button'
      );
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Cart trigger has accessible name: "' + name.slice(0, 30) + '"', getSelector(cartTrigger));
    }
    
    // Check for aria-expanded if trigger controls drawer
    if (cartDrawer) {
      const ariaExpanded = cartTrigger.getAttribute('aria-expanded');
      if (ariaExpanded === null) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Cart trigger missing aria-expanded',
          cartTrigger,
          'Add aria-expanded="false" that toggles to "true" when drawer opens',
          'Screen reader users not informed of drawer state'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Cart trigger has aria-expanded', getSelector(cartTrigger));
      }
    }
  }

  /**
   * Test 3: Quantity Input Labels
   * WCAG: 3.3.2, 4.1.2
   */
  function testQuantityInputs() {
    const container = cartDrawer || document;
    const quantityInputs = [];
    const { isExposedToAT } = window.a11yHelpers;

    CONFIG.quantitySelectors.forEach(selector => {
      container.querySelectorAll(selector).forEach(input => {
        if (!quantityInputs.includes(input)) {
          // Pattern C fix: Skip elements hidden from AT
          if (isExposedToAT && !isExposedToAT(input)) return;
          quantityInputs.push(input);
        }
      });
    });
    
    if (quantityInputs.length === 0) {
      // Look for +/- buttons without associated input
      const plusMinusButtons = container.querySelectorAll('[class*="plus"], [class*="minus"], [class*="increment"], [class*="decrement"]');
      if (plusMinusButtons.length > 0) {
        plusMinusButtons.forEach(btn => {
          results.stats.elementsScanned++;
          const name = getAccessibleName(btn);
          if (!name || name.length < 2) {
            addIssue(
              'serious',
              '4.1.2',
              'Name, Role, Value',
              'Quantity +/- button has no accessible name',
              btn,
              'Add aria-label like "Increase quantity" or "Decrease quantity"',
              'Screen reader users cannot identify button purpose'
            );
          }
        });
      }
      return;
    }
    
    quantityInputs.forEach(input => {
      if (!isVisible(input) && !isCartOpen) return;
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(input);
      const ariaLabel = input.getAttribute('aria-label');
      const labelledBy = input.getAttribute('aria-labelledby');
      const id = input.id;
      const hasVisibleLabel = id && document.querySelector('label[for="' + id + '"]');
      
      if (!name && !ariaLabel && !labelledBy && !hasVisibleLabel) {
        // Try to find context from parent cart item
        const cartItem = input.closest('[class*="cart-item"], [class*="line-item"], li');
        const productName = cartItem ? cartItem.querySelector('[class*="product-name"], [class*="title"], h2, h3, a')?.textContent.trim() : null;
        
        addIssue(
          'serious',
          '3.3.2',
          'Labels or Instructions',
          'Quantity input has no label' + (productName ? ' for ' + productName.slice(0, 30) : ''),
          input,
          'Add aria-label="Quantity for [product name]" or associate with visible label',
          'Screen reader users cannot identify which product quantity they are changing'
        );
      } else {
        addPassed('3.3.2', 'Labels or Instructions', 'Quantity input has label', getSelector(input));
      }
      
      // Check for +/- buttons
      const parent = input.closest('[class*="quantity"], [class*="qty"]') || input.parentElement;
      if (parent) {
        const buttons = parent.querySelectorAll('button');
        buttons.forEach(btn => {
          results.stats.elementsScanned++;
          const btnName = getAccessibleName(btn);
          const btnText = btn.textContent.trim();
          
          if (btnText === '+' || btnText === '-' || btnText === '') {
            if (!btnName || btnName === '+' || btnName === '-') {
              addIssue(
                'moderate',
                '4.1.2',
                'Name, Role, Value',
                'Quantity button has non-descriptive name: "' + (btnName || btnText || 'empty') + '"',
                btn,
                'Add aria-label="Increase quantity" or "Decrease quantity"',
                'Screen reader users only hear +/- without context'
              );
            }
          }
        });
      }
    });
  }

  /**
   * Test 4: Remove Button Accessibility
   * WCAG: 4.1.2, 2.4.4
   */
  function testRemoveButtons() {
    const container = cartDrawer || document;
    const removeButtons = [];
    
    CONFIG.removeButtonSelectors.forEach(selector => {
      container.querySelectorAll(selector).forEach(btn => {
        if (!removeButtons.includes(btn)) removeButtons.push(btn);
      });
    });
    
    removeButtons.forEach(btn => {
      if (!isVisible(btn) && !isCartOpen) return;
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(btn);
      const text = btn.textContent.trim();
      
      // Check if name is just "X" or "Remove" without product context
      if (!name || name === 'X' || name === '' || name === 'x') {
        const cartItem = btn.closest('[class*="cart-item"], [class*="line-item"], li, tr');
        const productName = cartItem ? cartItem.querySelector('[class*="product-name"], [class*="title"], h2, h3, a')?.textContent.trim() : null;
        
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Remove button has no descriptive accessible name',
          btn,
          productName ? 
            'Add aria-label="Remove ' + productName.slice(0, 30) + ' from cart"' :
            'Add aria-label="Remove [product name] from cart"',
          'Screen reader users cannot identify which item will be removed'
        );
      } else if (name.toLowerCase().includes('remove') && !name.toLowerCase().includes('from')) {
        // "Remove" without product name
        const cartItem = btn.closest('[class*="cart-item"], [class*="line-item"], li, tr');
        const productName = cartItem ? cartItem.querySelector('[class*="product-name"], [class*="title"], h2, h3, a')?.textContent.trim() : null;
        
        if (productName) {
          addIssue(
            'moderate',
            '2.4.4',
            'Link Purpose',
            'Remove button lacks product context',
            btn,
            'Update aria-label to "Remove ' + productName.slice(0, 30) + ' from cart"',
            'Multiple "Remove" buttons are ambiguous for screen reader users'
          );
        }
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Remove button has descriptive name: "' + name.slice(0, 40) + '"', getSelector(btn));
      }
    });
  }

  /**
   * Test 5: Cart Item Structure
   * WCAG: 1.3.1
   */
  function testCartItemStructure() {
    const container = cartDrawer || document;
    const cartItems = [];
    
    CONFIG.cartItemSelectors.forEach(selector => {
      container.querySelectorAll(selector).forEach(item => {
        if (!cartItems.includes(item)) cartItems.push(item);
      });
    });
    
    if (cartItems.length === 0 && isCartOpen) {
      // Check for empty cart state
      const emptyMessage = container.querySelector('[class*="empty"], [class*="no-items"]');
      if (emptyMessage) {
        results.stats.elementsScanned++;
        addPassed('1.3.1', 'Info and Relationships', 'Empty cart state message present', getSelector(emptyMessage));
      } else {
        addManualCheck('1.3.1', 'Verify empty cart state is announced', 'With empty cart open, verify screen reader announces cart is empty', getSelector(container));
      }
      return;
    }
    
    // Check if cart items are in a list
    const itemsInList = cartItems.filter(item => {
      const parent = item.parentElement;
      return parent && (parent.tagName === 'UL' || parent.tagName === 'OL' || parent.getAttribute('role') === 'list');
    });
    
    if (cartItems.length > 0 && itemsInList.length === 0) {
      addIssue(
        'moderate',
        '1.3.1',
        'Info and Relationships',
        'Cart items not in a list structure',
        cartItems[0],
        'Wrap cart items in <ul> with <li> elements',
        'Screen reader users not informed of item count'
      );
    } else if (itemsInList.length > 0) {
      addPassed('1.3.1', 'Info and Relationships', 'Cart items use list structure', getSelector(itemsInList[0].parentElement));
    }
    
    // Check each cart item has key information accessible
    cartItems.slice(0, 5).forEach(item => {
      results.stats.elementsScanned++;
      
      const hasProductName = item.querySelector('[class*="product-name"], [class*="title"], h2, h3, h4, a');
      const hasPrice = item.querySelector('[class*="price"]');
      const hasImage = item.querySelector('img');
      
      if (hasImage) {
        const alt = hasImage.getAttribute('alt');
        if (!alt) {
          addIssue(
            'serious',
            '1.1.1',
            'Non-text Content',
            'Cart item image missing alt text',
            hasImage,
            'Add alt text with product name',
            'Screen reader users cannot identify product visually'
          );
        }
      }
    });
  }

  /**
   * Test 6: Live Region for Cart Updates
   * WCAG: 4.1.3
   */
  function testLiveRegions() {
    const container = cartDrawer || document;
    
    // Look for live regions
    const liveRegions = container.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
    const cartCount = document.querySelector('[class*="cart-count"], [class*="cart-badge"], [data-cart-count]');
    
    if (liveRegions.length === 0 && !cartCount) {
      addManualCheck(
        '4.1.3',
        'Verify cart updates are announced',
        'Add/remove items and verify screen reader announces changes (e.g., "Item added to cart")',
        getSelector(container)
      );
    } else {
      addPassed('4.1.3', 'Status Messages', 'Live region found for cart updates', liveRegions.length > 0 ? getSelector(liveRegions[0]) : getSelector(cartCount));
    }
    
    // Check cart total visibility
    const cartTotal = container.querySelector('[class*="total"], [class*="subtotal"]');
    if (cartTotal && isCartOpen) {
      results.stats.elementsScanned++;
      
      // Ensure total is not aria-hidden
      if (cartTotal.getAttribute('aria-hidden') === 'true') {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Cart total hidden from screen readers',
          cartTotal,
          'Remove aria-hidden="true" from cart total',
          'Screen reader users cannot access order total'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Cart total is accessible', getSelector(cartTotal));
      }
    }
  }

  /**
   * Test 7: Close Button
   * WCAG: 2.1.1
   */
  function testCloseButton() {
    if (!cartDrawer) return;
    
    const closeButton = cartDrawer.querySelector(
      'button[aria-label*="close" i], button[aria-label*="dismiss" i], ' +
      '.close, .close-button, [class*="close"], button.dismiss, [data-dismiss], ' +
      '[class*="drawer-close"], [class*="cart-close"]'
    );
    
    if (!closeButton) {
      addIssue(
        'serious',
        '2.1.1',
        'Keyboard',
        'Cart drawer has no visible close button',
        cartDrawer,
        'Add close button with aria-label="Close cart"',
        'Users may not know how to close the cart drawer'
      );
    } else {
      results.stats.elementsScanned++;
      const name = getAccessibleName(closeButton);
      
      if (!name || name.length < 2) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Close button has no accessible name',
          closeButton,
          'Add aria-label="Close cart" or visible text',
          'Screen reader users cannot identify close button'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Close button has accessible name: "' + name + '"', getSelector(closeButton));
      }
    }
  }

  /**
   * Test 8: Focus Management
   * WCAG: 2.1.2, 2.4.3
   */
  function testFocusManagement() {
    if (!cartDrawer) return;
    
    if (isCartOpen) {
      const focusable = getFocusableElements(cartDrawer);
      results.stats.elementsScanned += focusable.length;
      
      if (focusable.length === 0) {
        addIssue(
          'critical',
          '2.4.3',
          'Focus Order',
          'Open cart drawer has no focusable elements',
          cartDrawer,
          'Ensure cart has at least one focusable element (close button, continue shopping link)',
          'Keyboard users cannot interact with cart'
        );
      }
      
      // Check if background content is properly hidden
      const mainContent = document.querySelector('main, [role="main"], #main, #MainContent');
      if (mainContent && !mainContent.contains(cartDrawer)) {
        const mainHidden = mainContent.getAttribute('aria-hidden') === 'true' || mainContent.hasAttribute('inert');
        if (!mainHidden) {
          addIssue(
            'serious',
            '2.1.2',
            'No Keyboard Trap',
            'Background content not hidden while cart drawer is open',
            mainContent,
            'Add aria-hidden="true" or inert to main content when cart opens',
            'Focus may escape cart drawer to background'
          );
        }
      }
    }
    
    // Manual checks for focus behavior
    addManualCheck(
      '2.1.2',
      'Verify focus is trapped within cart drawer',
      'Open cart drawer and Tab through all elements - focus should cycle within drawer only',
      getSelector(cartDrawer)
    );
    
    addManualCheck(
      '2.4.3',
      'Verify focus moves to cart drawer on open',
      'Click cart icon and verify focus moves to drawer (close button or first element)',
      getSelector(cartDrawer)
    );
    
    addManualCheck(
      '2.4.3',
      'Verify focus returns to cart trigger on close',
      'Close cart drawer and verify focus returns to the cart icon/button',
      getSelector(cartTrigger)
    );
  }

  /**
   * Test 9: Escape Key
   * WCAG: 2.1.1
   */
  function testEscapeKey() {
    if (!cartDrawer) return;
    
    addManualCheck(
      '2.1.1',
      'Verify Escape key closes cart drawer',
      'Open cart drawer and press Escape - drawer should close',
      getSelector(cartDrawer)
    );
  }

  /**
   * Test 10: Focus Indicators
   * WCAG: 2.4.7
   */
  function testFocusIndicators() {
    const container = cartDrawer || document;
    const focusable = getFocusableElements(container);
    let outlineNoneCount = 0;
    
    focusable.slice(0, 20).forEach(el => {
      const style = window.getComputedStyle(el);
      const outline = style.outline;
      const outlineStyle = style.outlineStyle;
      
      if (outline === 'none' || outline === '0' || outlineStyle === 'none') {
        outlineNoneCount++;
      }
    });
    
    if (outlineNoneCount > 0) {
      addManualCheck(
        '2.4.7',
        outlineNoneCount + ' cart elements have outline:none - verify alternative focus indicators',
        'Tab to each element in cart and confirm visible focus indicator appears',
        null
      );
    }
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================
  
  testDialogRole();
  testCartTrigger();
  testQuantityInputs();
  testRemoveButtons();
  testCartItemStructure();
  testLiveRegions();
  testCloseButton();
  testFocusManagement();
  testEscapeKey();
  testFocusIndicators();

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
  window.runCartAudit = runCartAudit;
}
