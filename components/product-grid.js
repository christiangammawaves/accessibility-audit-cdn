/**
 * Product Grid Accessibility Audit
 * WCAG: 1.1.1, 1.3.1, 1.4.1, 2.4.4, 4.1.2, 4.1.3
 */

function runProductGridAudit() {
  'use strict';

  const startTime = performance.now();

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  const CONFIG = {
    scope: [
      '[class*="product-grid"]',
      '[class*="collection-grid"]',
      '[class*="product-list"]',
      '[class*="products"]',
      '.collection',
      '#product-grid',
      '[data-product-grid]',
      'ul[class*="product"]',
      '[role="list"][class*="product"]'
    ],
    productCardSelectors: [
      '[class*="product-card"]',
      '[class*="product-item"]',
      '[class*="grid-item"]',
      '.product',
      '[data-product]',
      'li[class*="product"]',
      'article[class*="product"]'
    ],
    quickViewSelectors: [
      '[class*="quick-view"]',
      '[class*="quickview"]',
      '[class*="quick-add"]',
      '[class*="quickshop"]',
      '[data-quick-view]',
      '[aria-label*="quick" i]'
    ],
    filterSelectors: [
      '[class*="filter"]',
      '[class*="facet"]',
      '[data-filter]',
      '.filters',
      '#filters'
    ],
    sortSelectors: [
      '[class*="sort"]',
      'select[name*="sort"]',
      '[data-sort]',
      '.sort-by'
    ],
    loadingSelectors: [
      '[class*="loading"]',
      '[class*="spinner"]',
      '[aria-busy="true"]',
      '.loader'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('product-grid', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  // ==========================================================================
  // FIND PRODUCT GRID COMPONENTS
  // ==========================================================================

  function findProductGrid() {
    for (const selector of CONFIG.scope) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  function findProductCards() {
    const cards = [];
    CONFIG.productCardSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(card => {
        if (isVisible(card) && !cards.includes(card)) cards.push(card);
      });
    });
    return cards;
  }

  const productGrid = findProductGrid();
  const productCards = findProductCards();

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================
  
  /**
   * Test 1: Grid Structure
   * WCAG: 1.3.1
   */
  function testGridStructure() {
    if (!productGrid) {
      addManualCheck('1.3.1', 'No product grid detected', 'Verify product listing is properly structured if present', null);
      return;
    }
    
    results.stats.elementsScanned++;
    
    const isList = productGrid.tagName === 'UL' || productGrid.tagName === 'OL';
    const hasListRole = productGrid.getAttribute('role') === 'list';
    const hasGridRole = productGrid.getAttribute('role') === 'grid';
    
    if (!isList && !hasListRole && !hasGridRole) {
      addIssue(
        'moderate',
        '1.3.1',
        'Info and Relationships',
        'Product grid not using semantic list or grid structure',
        productGrid,
        'Use <ul> with <li> elements, or add role="list" / role="grid"',
        'Screen reader users not informed of item count or structure'
      );
    } else {
      addPassed('1.3.1', 'Info and Relationships', 'Product grid uses proper list/grid structure', getSelector(productGrid));
    }
    
    // Check if products are list items
    if (isList || hasListRole) {
      const items = productGrid.querySelectorAll('li, [role="listitem"]');
      if (items.length !== productCards.length && productCards.length > 0) {
        addIssue(
          'minor',
          '1.3.1',
          'Info and Relationships',
          'Product cards not all wrapped in list items',
          productGrid,
          'Ensure each product card is a <li> or has role="listitem"',
          'Inconsistent structure for assistive technology'
        );
      }
    }
  }

  /**
   * Test 2: Product Card Links
   * WCAG: 2.4.4
   */
  function testProductLinks() {
    const seenLinkTexts = new Map();
    
    productCards.forEach((card, index) => {
      results.stats.elementsScanned++;
      
      const links = card.querySelectorAll('a[href]');
      const productName = card.querySelector('[class*="title"], [class*="name"], h2, h3, h4')?.textContent.trim();
      
      links.forEach(link => {
        const linkText = getAccessibleName(link).toLowerCase().trim();
        const href = link.getAttribute('href');
        
        // Check for generic link text
        const genericTexts = ['view', 'view product', 'shop', 'shop now', 'buy', 'buy now', 'details', 'more'];
        
        if (genericTexts.includes(linkText)) {
          addIssue(
            'moderate',
            '2.4.4',
            'Link Purpose',
            'Product link has generic text: "' + linkText + '"',
            link,
            productName ? 
              'Update link text to include product name or add aria-label="View ' + productName.slice(0, 30) + '"' :
              'Use descriptive link text including product name',
            'Screen reader users navigating by links cannot distinguish products'
          );
        } else if (linkText && linkText.length > 0) {
          // Track duplicate link texts
          if (seenLinkTexts.has(linkText)) {
            const prevCard = seenLinkTexts.get(linkText);
            if (prevCard !== index) {
              seenLinkTexts.set(linkText, index);
            }
          } else {
            seenLinkTexts.set(linkText, index);
          }
        }
      });
      
      // Check for multiple redundant links to same product
      const productLinks = Array.from(links).filter(l => l.getAttribute('href')?.includes('/product'));
      if (productLinks.length > 2) {
        addIssue(
          'minor',
          '2.4.4',
          'Link Purpose',
          'Product card has ' + productLinks.length + ' links to same product',
          card,
          'Consider combining links or using one primary link with aria-describedby for context',
          'Redundant links create extra tab stops for keyboard users'
        );
      }
    });
  }

  /**
   * Test 3: Product Images
   * WCAG: 1.1.1
   */
  function testProductImages() {
    productCards.forEach(card => {
      const images = card.querySelectorAll('img');
      const productName = card.querySelector('[class*="title"], [class*="name"], h2, h3, h4')?.textContent.trim();
      
      images.forEach(img => {
        if (!isVisible(img)) return;
        results.stats.elementsScanned++;
        
        const alt = img.getAttribute('alt');
        const isDecorative = img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true';
        
        if (alt === null && !isDecorative) {
          addIssue(
            'serious',
            '1.1.1',
            'Non-text Content',
            'Product image missing alt attribute' + (productName ? ' for ' + productName.slice(0, 30) : ''),
            img,
            productName ? 'Add alt="' + productName + '"' : 'Add descriptive alt text with product name',
            'Screen reader users cannot identify product visually'
          );
        } else if (alt === '') {
          // Empty alt - check if product name is nearby
          if (productName) {
            addPassed('1.1.1', 'Non-text Content', 'Product image has empty alt (name visible nearby)', getSelector(img));
          } else {
            addIssue(
              'serious',
              '1.1.1',
              'Non-text Content',
              'Product image has empty alt with no nearby product name',
              img,
              'Add descriptive alt text or ensure product name is accessible',
              'Screen reader users have no way to identify this product'
            );
          }
        } else if (alt) {
          // Check for filename-style alt text
          const filenamePattern = /^[a-z0-9_-]+\.(jpg|jpeg|png|gif|webp)$/i;
          const genericPattern = /^(product|image|photo|img|picture)[_-]?\d*$/i;
          
          if (filenamePattern.test(alt) || genericPattern.test(alt)) {
            addIssue(
              'serious',
              '1.1.1',
              'Non-text Content',
              'Product image has filename/generic alt: "' + alt + '"',
              img,
              'Replace with descriptive alt text including product name',
              'Alt text provides no meaningful information'
            );
          } else {
            addPassed('1.1.1', 'Non-text Content', 'Product image has descriptive alt', getSelector(img));
          }
        }
      });
    });
  }

  /**
   * Test 4: Price Information
   * WCAG: 1.3.1, 1.4.1
   */
  function testPriceInformation() {
    productCards.forEach(card => {
      const priceElements = card.querySelectorAll('[class*="price"], [data-price]');
      
      priceElements.forEach(priceEl => {
        if (!isVisible(priceEl)) return;
        results.stats.elementsScanned++;
        
        // Check if price is hidden from screen readers
        if (priceEl.getAttribute('aria-hidden') === 'true') {
          // Look for accessible alternative
          const srOnly = card.querySelector('.sr-only, .visually-hidden, [class*="screen-reader"]');
          if (!srOnly || !srOnly.textContent.includes('$')) {
            addIssue(
              'serious',
              '1.3.1',
              'Info and Relationships',
              'Price hidden from screen readers with no alternative',
              priceEl,
              'Remove aria-hidden or provide screen reader text',
              'Screen reader users cannot access pricing information'
            );
          }
        }
        
        // Check for sale/compare prices
        const salePrice = priceEl.querySelector('[class*="sale"], [class*="special"], [class*="discounted"]');
        const comparePrice = priceEl.querySelector('[class*="compare"], [class*="was"], [class*="regular"], [class*="original"], s, del');
        
        if (salePrice || comparePrice) {
          // Check if sale status is conveyed beyond color
          const hasSrText = priceEl.querySelector('.sr-only, .visually-hidden, [class*="screen-reader"]');
          const hasTextIndicator = priceEl.textContent.toLowerCase().includes('sale') || 
                                   priceEl.textContent.toLowerCase().includes('was') ||
                                   priceEl.textContent.toLowerCase().includes('now');
          
          if (!hasSrText && !hasTextIndicator) {
            addIssue(
              'moderate',
              '1.4.1',
              'Use of Color',
              'Sale price may only be indicated by color',
              priceEl,
              'Add screen reader text like "Sale price" and "Regular price" or use <del> for original price',
              'Users who cannot see color may not know item is on sale'
            );
          } else {
            addPassed('1.4.1', 'Use of Color', 'Sale price has text indicator', getSelector(priceEl));
          }
        }
      });
    });
  }

  /**
   * Test 5: Sale/Discount Badges
   * WCAG: 1.3.1, 1.4.1
   */
  function testBadges() {
    productCards.forEach(card => {
      const badges = card.querySelectorAll('[class*="badge"], [class*="tag"], [class*="label"], [class*="sale"], [class*="discount"], [class*="new"]');
      
      badges.forEach(badge => {
        if (!isVisible(badge)) return;
        results.stats.elementsScanned++;
        
        const text = badge.textContent.trim();
        const ariaLabel = badge.getAttribute('aria-label');
        const ariaHidden = badge.getAttribute('aria-hidden') === 'true';
        
        if (ariaHidden && !text) {
          return;
        }
        
        if (!text && !ariaLabel && !ariaHidden) {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'Badge has no accessible text',
            badge,
            'Add visible text, aria-label, or aria-hidden="true" if decorative',
            'Screen reader users cannot understand badge meaning'
          );
        } else if (text || ariaLabel) {
          const hasIcon = badge.querySelector('svg, i, [class*="icon"]');
          if (hasIcon && !text && ariaLabel) {
            addPassed('1.3.1', 'Info and Relationships', 'Icon badge has aria-label', getSelector(badge));
          }
        }
      });
    });
  }

  /**
   * Test 6: Quick View Modal
   * WCAG: 4.1.2, 2.1.2
   */
  function testQuickView() {
    const quickViewTriggers = [];
    CONFIG.quickViewSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (isVisible(el) && !quickViewTriggers.includes(el)) quickViewTriggers.push(el);
      });
    });
    
    quickViewTriggers.forEach(trigger => {
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(trigger);
      const isButton = trigger.tagName === 'BUTTON' || trigger.getAttribute('role') === 'button';
      const productCard = trigger.closest('[class*="product-card"], [class*="product-item"], .product');
      const productName = productCard?.querySelector('[class*="title"], [class*="name"], h2, h3, h4')?.textContent.trim();
      
      if (!name || name.length < 3) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Quick view button has no accessible name',
          trigger,
          productName ? 
            'Add aria-label="Quick view ' + productName.slice(0, 30) + '"' :
            'Add aria-label describing the action',
          'Screen reader users cannot identify button purpose'
        );
      } else if (!name.toLowerCase().includes('quick') && !productName) {
        addIssue(
          'moderate',
          '2.4.4',
          'Link Purpose',
          'Quick view button name lacks product context',
          trigger,
          'Include product name in aria-label',
          'Multiple "Quick view" buttons are ambiguous'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Quick view has accessible name: "' + name.slice(0, 40) + '"', getSelector(trigger));
      }
      
      if (!isButton) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Quick view trigger is not a button',
          trigger,
          'Use <button> element or add role="button"',
          'May not be announced as interactive to screen readers'
        );
      }
    });
    
    const quickViewModal = document.querySelector('[class*="quick-view"][role="dialog"], [class*="quickview"][role="dialog"]');
    if (quickViewModal && isVisible(quickViewModal)) {
      testQuickViewModal(quickViewModal);
    }
    
    if (quickViewTriggers.length > 0) {
      addManualCheck(
        '2.1.2',
        'Verify quick view modal follows dialog pattern',
        'Click quick view: verify focus trap, escape closes, focus returns to trigger',
        null
      );
    }
  }

  function testQuickViewModal(modal) {
    results.stats.elementsScanned++;
    
    const role = modal.getAttribute('role');
    const ariaModal = modal.getAttribute('aria-modal');
    
    if (role !== 'dialog') {
      addIssue('critical', '4.1.2', 'Name, Role, Value', 'Quick view modal missing role="dialog"', modal, 'Add role="dialog"', 'Assistive technology cannot identify the modal boundary');
    }
    
    if (ariaModal !== 'true') {
      addIssue('serious', '4.1.2', 'Name, Role, Value', 'Quick view modal missing aria-modal="true"', modal, 'Add aria-modal="true"', 'Screen readers may browse content behind the modal');
    }
  }

  /**
   * Test 7: Sort/Filter Controls
   * WCAG: 3.3.2, 4.1.2
   */
  function testSortFilter() {
    CONFIG.sortSelectors.forEach(selector => {
      const sortEl = document.querySelector(selector);
      if (!sortEl || !isVisible(sortEl)) return;
      
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(sortEl);
      
      if (sortEl.tagName === 'SELECT' && !name) {
        addIssue(
          'serious',
          '3.3.2',
          'Labels or Instructions',
          'Sort dropdown has no label',
          sortEl,
          'Add associated <label> or aria-label="Sort by"',
          'Screen reader users cannot identify sort control'
        );
      } else if (name) {
        addPassed('3.3.2', 'Labels or Instructions', 'Sort control has label', getSelector(sortEl));
      }
    });
    
    CONFIG.filterSelectors.forEach(selector => {
      const filterContainer = document.querySelector(selector);
      if (!filterContainer || !isVisible(filterContainer)) return;
      
      results.stats.elementsScanned++;
      
      const inputs = filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"], select');
      let unlabeledCount = 0;
      
      inputs.forEach(input => {
        const name = getAccessibleName(input);
        if (!name) unlabeledCount++;
      });
      
      if (unlabeledCount > 0) {
        addIssue(
          'serious',
          '3.3.2',
          'Labels or Instructions',
          unlabeledCount + ' filter inputs missing labels',
          filterContainer,
          'Add associated labels or aria-label to all filter controls',
          'Screen reader users cannot identify filter options'
        );
      } else if (inputs.length > 0) {
        addPassed('3.3.2', 'Labels or Instructions', 'Filter inputs have labels', getSelector(filterContainer));
      }
      
      const expandTriggers = filterContainer.querySelectorAll('[aria-expanded], button[class*="toggle"], [class*="accordion"]');
      expandTriggers.forEach(trigger => {
        const ariaExpanded = trigger.getAttribute('aria-expanded');
        if (ariaExpanded === null) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Filter section toggle missing aria-expanded',
            trigger,
            'Add aria-expanded="false" that toggles with section state',
            'Screen reader users not informed of collapsed/expanded state'
          );
        }
      });
    });
  }

  /**
   * Test 8: Loading States
   * WCAG: 4.1.3
   */
  function testLoadingStates() {
    const loadingIndicators = [];
    CONFIG.loadingSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (!loadingIndicators.includes(el)) loadingIndicators.push(el);
      });
    });
    
    if (loadingIndicators.length > 0) {
      loadingIndicators.forEach(loader => {
        results.stats.elementsScanned++;
        
        const hasAriaLive = loader.closest('[aria-live]') || loader.getAttribute('aria-live');
        const hasAriaBusy = loader.getAttribute('aria-busy') === 'true' || loader.closest('[aria-busy="true"]');
        const hasRole = loader.getAttribute('role') === 'status' || loader.getAttribute('role') === 'alert';
        
        if (!hasAriaLive && !hasAriaBusy && !hasRole) {
          addIssue(
            'moderate',
            '4.1.3',
            'Status Messages',
            'Loading indicator not announced to screen readers',
            loader,
            'Add aria-live="polite", role="status", or aria-busy="true" to container',
            'Screen reader users not informed when content is loading'
          );
        } else {
          addPassed('4.1.3', 'Status Messages', 'Loading state uses ARIA for announcement', getSelector(loader));
        }
      });
    }
    
    const emptyState = document.querySelector('[class*="empty"], [class*="no-results"], [class*="no-products"]');
    if (emptyState && isVisible(emptyState)) {
      results.stats.elementsScanned++;
      
      const isInLiveRegion = emptyState.closest('[aria-live]');
      if (!isInLiveRegion) {
        addManualCheck(
          '4.1.3',
          'Verify "no results" message is announced',
          'After filtering to no results, verify screen reader announces empty state',
          getSelector(emptyState)
        );
      }
    }
    
    addManualCheck(
      '4.1.3',
      'Test filter/sort result announcements',
      'Apply filter or sort, verify result count or change is announced',
      null
    );
  }

  /**
   * Test 9: Keyboard Navigation
   * WCAG: 2.1.1, 2.4.3
   */
  function testKeyboardNavigation() {
    if (productGrid) {
      const focusable = getFocusableElements(productGrid);
      
      focusable.forEach(el => {
        const tabindex = el.getAttribute('tabindex');
        if (tabindex && parseInt(tabindex) > 0) {
          addIssue(
            'moderate',
            '2.4.3',
            'Focus Order',
            'Element has positive tabindex: ' + tabindex,
            el,
            'Remove positive tabindex or set to 0',
            'Disrupts natural focus order'
          );
        }
      });
      
      addManualCheck(
        '2.1.1',
        'Verify all product grid interactions work with keyboard',
        'Tab through products, activate quick view, apply filters - all should work without mouse',
        getSelector(productGrid)
      );
    }
  }

  /**
   * Test 10: Focus Indicators
   * WCAG: 2.4.7
   */
  function testFocusIndicators() {
    const container = productGrid || document;
    const focusable = getFocusableElements(container);
    let outlineNoneCount = 0;
    
    focusable.slice(0, 30).forEach(el => {
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
        outlineNoneCount + ' product grid elements have outline:none - verify alternative focus indicators',
        'Tab through product cards and verify visible focus indicator on each interactive element',
        null
      );
    }
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================
  
  if (productCards.length === 0 && !productGrid) {
    addManualCheck(
      '1.3.1',
      'No product grid detected on page',
      'If this is a collection page, verify product listing is properly marked up',
      null
    );
  } else {
    testGridStructure();
    testProductLinks();
    testProductImages();
    testPriceInformation();
    testBadges();
    testQuickView();
    testSortFilter();
    testLoadingStates();
    testKeyboardNavigation();
    testFocusIndicators();
  }

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
  window.runProductGridAudit = runProductGridAudit;
}
