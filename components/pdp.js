/**
 * Product Detail Page (PDP) Accessibility Audit
 * WCAG: 1.1.1, 1.4.1, 2.1.1, 2.1.2, 3.3.2, 4.1.2, 4.1.3
 */

function runPdpAudit() {
  'use strict';

  const startTime = performance.now();

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  const CONFIG = {
    scope: [
      '[class*="product-detail"]',
      '[class*="product-page"]',
      '[class*="pdp"]',
      '#product',
      '#ProductSection',
      '.product-single',
      '[data-product-page]',
      'main[class*="product"]'
    ],
    variantSelectors: [
      '[class*="variant"]',
      '[class*="option"]',
      '[data-variant]',
      '[data-option]',
      'input[name*="Size"]',
      'input[name*="Color"]',
      'select[name*="option"]',
      '.swatch',
      '[class*="swatch"]'
    ],
    gallerySelectors: [
      '[class*="gallery"]',
      '[class*="product-image"]',
      '[class*="product-photos"]',
      '[class*="media-gallery"]',
      '[data-gallery]',
      '.product__media'
    ],
    thumbnailSelectors: [
      '[class*="thumbnail"]',
      '[class*="thumb"]',
      '[class*="gallery-nav"]',
      '[data-thumbnail]'
    ],
    // NEW: Carousel/slider selectors
    carouselSelectors: [
      '[class*="carousel"]',
      '[class*="slider"]',
      '[class*="slideshow"]',
      '[role="region"][aria-roledescription*="carousel" i]',
      '.slick-slider',
      '.swiper-container',
      '.swiper',
      '.flickity-slider',
      '[data-carousel]',
      '[data-slider]'
    ],
    // NEW: Lightbox/modal trigger selectors
    lightboxSelectors: [
      '[data-pswp]',
      '[data-photoswipe]',
      '[data-lightbox]',
      '[data-fancybox]',
      '[data-magnify]',
      '[class*="lightbox"]',
      '[class*="modal-trigger"]'
    ],
    accordionSelectors: [
      '[class*="accordion"]',
      '[class*="collapsible"]',
      '[class*="expandable"]',
      'details',
      '[data-accordion]'
    ],
    addToCartSelectors: [
      '[class*="add-to-cart"]',
      '[class*="addtocart"]',
      'button[name="add"]',
      '[data-add-to-cart]',
      '#AddToCart',
      '.add-to-cart'
    ],
    quantitySelectors: [
      '[class*="quantity"]',
      '[class*="qty"]',
      'input[name="quantity"]',
      '[data-quantity]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('pdp', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  // ==========================================================================
  // FIND PDP COMPONENTS
  // ==========================================================================

  function findPdpSection() {
    for (const selector of CONFIG.scope) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  const pdpSection = findPdpSection();

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================
  
  /**
   * Test 1: Variant Selectors
   * WCAG: 4.1.2, 3.3.2, 1.4.1
   */
  function testVariantSelectors() {
    const container = pdpSection || document;
    const variantContainers = [];
    
    CONFIG.variantSelectors.forEach(selector => {
      container.querySelectorAll(selector).forEach(el => {
        if (isVisible(el) && !variantContainers.includes(el)) variantContainers.push(el);
      });
    });
    
    // Group variants by type
    const radioGroups = container.querySelectorAll('input[type="radio"]');
    const selectDropdowns = container.querySelectorAll('select[name*="option"], select[class*="variant"]');
    const swatches = container.querySelectorAll('.swatch, [class*="swatch"], [class*="color-option"]');
    
    // Test radio button groups (size, color options)
    const groupedRadios = {};
    radioGroups.forEach(radio => {
      const name = radio.getAttribute('name');
      if (name) {
        if (!groupedRadios[name]) groupedRadios[name] = [];
        groupedRadios[name].push(radio);
      }
    });
    
    Object.entries(groupedRadios).forEach(([name, radios]) => {
      results.stats.elementsScanned += radios.length;
      
      // Check if group has a label
      const fieldset = radios[0].closest('fieldset');
      const legend = fieldset?.querySelector('legend');
      const groupLabel = container.querySelector('label[class*="' + name + '"], [class*="option-name"]');
      
      if (!fieldset || !legend) {
        addIssue(
          'serious',
          '3.3.2',
          'Labels or Instructions',
          'Variant radio group "' + name + '" not in labeled fieldset',
          radios[0],
          'Wrap radio buttons in <fieldset> with <legend> describing the option type',
          'Screen reader users may not understand what option they are selecting'
        );
      } else {
        addPassed('3.3.2', 'Labels or Instructions', 'Variant group "' + name + '" has fieldset/legend', getSelector(fieldset));
      }
      
      // Check each radio has a label
      radios.forEach((radio, index) => {
        const radioLabel = getAccessibleName(radio);
        if (!radioLabel) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Variant option ' + (index + 1) + ' has no accessible label',
            radio,
            'Add associated <label> or aria-label with option value',
            'Screen reader users cannot identify option values'
          );
        }
      });
      
      // Check for selected state
      const selectedRadio = radios.find(r => r.checked);
      if (selectedRadio) {
        addPassed('4.1.2', 'Name, Role, Value', 'Selected variant communicated via checked state', getSelector(selectedRadio));
      }
    });
    
    // Test select dropdowns
    selectDropdowns.forEach(select => {
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(select);
      if (!name) {
        addIssue(
          'serious',
          '3.3.2',
          'Labels or Instructions',
          'Variant dropdown has no label',
          select,
          'Add associated <label> or aria-label',
          'Screen reader users cannot identify what variant they are selecting'
        );
      } else {
        addPassed('3.3.2', 'Labels or Instructions', 'Variant dropdown has label: "' + name.slice(0, 30) + '"', getSelector(select));
      }
    });
    
    // Test color swatches (1.4.1 - not color-only)
    swatches.forEach(swatch => {
      if (!isVisible(swatch)) return;
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(swatch);
      const hasVisibleLabel = swatch.textContent.trim().length > 0;
      const hasTooltip = swatch.getAttribute('title') || swatch.querySelector('[class*="tooltip"]');
      const isInput = swatch.tagName === 'INPUT' || swatch.querySelector('input');
      
      // Check if color name is accessible (not just background-color)
      if (!name && !hasVisibleLabel && !hasTooltip) {
        addIssue(
          'critical',
          '1.4.1',
          'Use of Color',
          'Color swatch has no accessible name - relies on color alone',
          swatch,
          'Add aria-label with color name, e.g., aria-label="Black"',
          'Users who cannot perceive color cannot identify the option'
        );
      } else if (name || hasVisibleLabel || hasTooltip) {
        addPassed('1.4.1', 'Use of Color', 'Color swatch has accessible name', getSelector(swatch));
      }
      
      // Check if selected swatch has visual indicator beyond color
      const isSelected = swatch.classList.contains('selected') || 
                        swatch.classList.contains('active') ||
                        swatch.getAttribute('aria-checked') === 'true' ||
                        (isInput && swatch.querySelector('input:checked'));
      
      if (isSelected) {
        const hasBorder = window.getComputedStyle(swatch).borderWidth !== '0px';
        const hasCheckmark = swatch.querySelector('svg, [class*="check"], [class*="tick"]');
        const hasAriaChecked = swatch.getAttribute('aria-checked') === 'true';
        
        if (!hasBorder && !hasCheckmark && !hasAriaChecked) {
          addIssue(
            'moderate',
            '1.4.1',
            'Use of Color',
            'Selected color swatch may lack non-color indicator',
            swatch,
            'Add visible border, checkmark, or other non-color indicator for selected state',
            'Users may not know which color is selected'
          );
        }
      }
    });
    
    // Manual check for variant selection announcement
    addManualCheck(
      '4.1.3',
      'Verify variant selection is announced',
      'Select different sizes/colors and verify screen reader announces the change',
      null
    );
  }

  /**
   * Test 2: Add to Cart Button
   * WCAG: 4.1.2, 4.1.3
   */
  function testAddToCart() {
    const container = pdpSection || document;
    let addToCartBtn = null;
    
    CONFIG.addToCartSelectors.forEach(selector => {
      const btn = container.querySelector(selector);
      if (btn && isVisible(btn)) addToCartBtn = btn;
    });
    
    if (!addToCartBtn) {
      addManualCheck('4.1.2', 'Add to cart button not found', 'Verify add to cart button exists and is accessible', null);
      return;
    }
    
    results.stats.elementsScanned++;
    
    const name = getAccessibleName(addToCartBtn);
    const isButton = addToCartBtn.tagName === 'BUTTON' || addToCartBtn.getAttribute('role') === 'button';
    const isDisabled = addToCartBtn.hasAttribute('disabled') || addToCartBtn.getAttribute('aria-disabled') === 'true';
    
    if (!name) {
      addIssue(
        'critical',
        '4.1.2',
        'Name, Role, Value',
        'Add to cart button has no accessible name',
        addToCartBtn,
        'Add visible text or aria-label',
        'Screen reader users cannot identify the primary action'
      );
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Add to cart has accessible name: "' + name.slice(0, 30) + '"', getSelector(addToCartBtn));
    }
    
    if (!isButton) {
      addIssue(
        'serious',
        '4.1.2',
        'Name, Role, Value',
        'Add to cart is not a button element',
        addToCartBtn,
        'Use <button> element or add role="button"',
        'May not be announced correctly to screen readers'
      );
    }
    
    // Check for disabled state when out of stock
    if (isDisabled) {
      const hasAriaDisabled = addToCartBtn.getAttribute('aria-disabled') === 'true';
      if (!hasAriaDisabled && !addToCartBtn.hasAttribute('disabled')) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Disabled add to cart missing disabled attribute',
          addToCartBtn,
          'Add disabled attribute or aria-disabled="true"',
          'Screen reader users may not know button is unavailable'
        );
      }
    }
    
    // Check for cart feedback
    addManualCheck(
      '4.1.3',
      'Verify add to cart provides feedback',
      'Click add to cart and verify screen reader announces success/failure',
      getSelector(addToCartBtn)
    );
  }

  /**
   * Test 3: Quantity Selector
   * WCAG: 3.3.2, 4.1.2
   */
  function testQuantitySelector() {
    const container = pdpSection || document;
    let quantityContainer = null;
    let quantityInput = null;
    
    CONFIG.quantitySelectors.forEach(selector => {
      const el = container.querySelector(selector);
      if (el && isVisible(el)) {
        if (el.tagName === 'INPUT') {
          quantityInput = el;
          quantityContainer = el.parentElement;
        } else {
          quantityContainer = el;
          quantityInput = el.querySelector('input');
        }
      }
    });
    
    if (!quantityInput && !quantityContainer) {
      return; // Quantity selector not found - may not be present
    }
    
    if (quantityInput) {
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(quantityInput);
      if (!name) {
        addIssue(
          'serious',
          '3.3.2',
          'Labels or Instructions',
          'Quantity input has no label',
          quantityInput,
          'Add associated <label> or aria-label="Quantity"',
          'Screen reader users cannot identify the input purpose'
        );
      } else {
        addPassed('3.3.2', 'Labels or Instructions', 'Quantity input has label', getSelector(quantityInput));
      }
    }
    
    // Test increment/decrement buttons
    if (quantityContainer) {
      const buttons = quantityContainer.querySelectorAll('button');
      
      buttons.forEach(btn => {
        results.stats.elementsScanned++;
        
        const btnName = getAccessibleName(btn);
        const btnText = btn.textContent.trim();
        
        if (btnText === '+' || btnText === '-' || btnText === '') {
          if (!btnName || btnName === '+' || btnName === '-') {
            addIssue(
              'serious',
              '4.1.2',
              'Name, Role, Value',
              'Quantity button has non-descriptive name: "' + (btnName || btnText || 'empty') + '"',
              btn,
              'Add aria-label="Increase quantity" or "Decrease quantity"',
              'Screen reader users only hear +/- without context'
            );
          } else {
            addPassed('4.1.2', 'Name, Role, Value', 'Quantity button has name: "' + btnName.slice(0, 30) + '"', getSelector(btn));
          }
        }
      });
    }
  }

  /**
   * Test 4: Image Gallery
   * WCAG: 1.1.1, 2.1.1, 4.1.2, 4.1.3
   * 
   * Enhanced checks include:
   * - Gallery trigger buttons have unique accessible names
   * - Image position indicators (e.g., "image X of Y")
   * - Carousel navigation buttons (prev/next) have aria-labels
   * - Gallery containers have proper aria-live regions
   * - PhotoSwipe/lightbox triggers have aria-haspopup="dialog"
   */
  function testImageGallery() {
    const container = pdpSection || document;
    let gallery = null;
    
    CONFIG.gallerySelectors.forEach(selector => {
      const el = container.querySelector(selector);
      if (el && isVisible(el)) gallery = el;
    });
    
    if (!gallery) {
      addManualCheck('1.1.1', 'Product gallery not found', 'Verify product images have appropriate alt text', null);
      return;
    }
    
    results.stats.elementsScanned++;
    
    // Test main images
    const images = gallery.querySelectorAll('img');
    const productTitle = container.querySelector('h1, [class*="product-title"], [class*="product-name"]')?.textContent.trim();
    const totalImages = images.length;
    
    images.forEach((img, index) => {
      if (!isVisible(img)) return;
      results.stats.elementsScanned++;
      
      const alt = img.getAttribute('alt');
      
      if (alt === null) {
        addIssue(
          'serious',
          '1.1.1',
          'Non-text Content',
          'Product image ' + (index + 1) + ' missing alt attribute',
          img,
          productTitle ? 'Add alt="' + productTitle + '"' : 'Add descriptive alt text',
          'Screen reader users cannot access product imagery'
        );
      } else if (alt === '') {
        // Check if this is a decorative duplicate
        const prevImg = images[index - 1];
        if (prevImg && prevImg.getAttribute('src') === img.getAttribute('src')) {
          addPassed('1.1.1', 'Non-text Content', 'Duplicate image marked as decorative', getSelector(img));
        } else {
          addManualCheck(
            '1.1.1',
            'Verify product image ' + (index + 1) + ' is decorative (has empty alt)',
            'If image shows product details, add descriptive alt text',
            getSelector(img)
          );
        }
      } else {
        addPassed('1.1.1', 'Non-text Content', 'Product image has alt text', getSelector(img));
      }
    });
    
    // ==========================================================================
    // NEW: Gallery/Carousel Trigger Button Checks
    // ==========================================================================
    
    testGalleryTriggerButtons(gallery, container, totalImages);
    testCarouselNavigation(gallery, container);
    testGalleryLiveRegions(gallery, container);
    testLightboxTriggers(gallery, container);
    
    // Test thumbnails
    let thumbnails = null;
    CONFIG.thumbnailSelectors.forEach(selector => {
      const el = gallery.querySelector(selector) || container.querySelector(selector);
      if (el && isVisible(el)) thumbnails = el;
    });
    
    if (thumbnails) {
      const thumbImages = thumbnails.querySelectorAll('img');
      const thumbButtons = thumbnails.querySelectorAll('button, [role="button"], a');
      
      thumbImages.forEach((img, index) => {
        if (!isVisible(img)) return;
        results.stats.elementsScanned++;
        
        const alt = img.getAttribute('alt');
        if (alt === null) {
          addIssue(
            'moderate',
            '1.1.1',
            'Non-text Content',
            'Thumbnail image ' + (index + 1) + ' missing alt',
            img,
            'Add alt text like "View image ' + (index + 1) + '" or product description',
            'Screen reader users cannot identify thumbnails'
          );
        }
      });
      
      thumbButtons.forEach((btn, index) => {
        results.stats.elementsScanned++;
        
        const name = getAccessibleName(btn);
        if (!name || name.length < 2) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Thumbnail button ' + (index + 1) + ' has no accessible name',
            btn,
            'Add aria-label="View image ' + (index + 1) + '" or similar',
            'Screen reader users cannot identify thumbnail purpose'
          );
        }
      });
    }
    
    // Check for zoom functionality
    const zoomTrigger = gallery.querySelector('[class*="zoom"], [data-zoom], [aria-label*="zoom" i]');
    if (zoomTrigger) {
      results.stats.elementsScanned++;
      
      const isKeyboardAccessible = zoomTrigger.tagName === 'BUTTON' || 
                                   zoomTrigger.tagName === 'A' ||
                                   zoomTrigger.getAttribute('tabindex') !== '-1';
      
      if (!isKeyboardAccessible) {
        addIssue(
          'serious',
          '2.1.1',
          'Keyboard',
          'Image zoom not keyboard accessible',
          zoomTrigger,
          'Use <button> element or ensure element is focusable',
          'Keyboard users cannot access zoom functionality'
        );
      }
    }
    
    // Manual check for gallery navigation
    addManualCheck(
      '2.1.1',
      'Verify gallery is keyboard navigable',
      'Use keyboard to navigate between images, activate thumbnails, and access zoom',
      getSelector(gallery)
    );
  }

  /**
   * Test 4a: Gallery Trigger Buttons - Unique Accessible Names
   * WCAG: 4.1.2 Name, Role, Value
   * 
   * Checks that gallery trigger buttons (those that open modals/lightboxes)
   * have unique accessible names indicating image position (e.g., "image 1 of 7")
   */
  function testGalleryTriggerButtons(gallery, container, totalImages) {
    // Find gallery trigger buttons - these open media modals/lightboxes
    const triggerSelectors = [
      '[class*="media"] button',
      '[class*="gallery"] button',
      'button[class*="modal"]',
      'button[class*="lightbox"]',
      'button[class*="zoom"]',
      '[data-media-id] button',
      '[data-gallery-item] button',
      '[class*="product-image"] button',
      '[class*="product__media"] button',
      'button[aria-label*="modal" i]',
      'button[aria-label*="open" i]',
      // PhotoSwipe specific
      '.pswp__button',
      '[class*="photoswipe"] button',
      // Common gallery patterns
      '[class*="slide"] button',
      '[class*="carousel"] button:not([class*="prev"]):not([class*="next"]):not([class*="arrow"])'
    ];
    
    const triggerButtons = [];
    triggerSelectors.forEach(selector => {
      try {
        const elements = (gallery || container).querySelectorAll(selector);
        elements.forEach(el => {
          if (isVisible(el) && !triggerButtons.includes(el)) {
            triggerButtons.push(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    if (triggerButtons.length === 0) {
      return; // No trigger buttons found
    }
    
    // Track accessible names to detect duplicates
    const accessibleNames = {};
    const genericNames = [
      'open product media modal',
      'open media modal',
      'open modal',
      'view image',
      'zoom',
      'expand',
      'open',
      'click to zoom',
      'view larger',
      'enlarge'
    ];
    
    triggerButtons.forEach((btn, index) => {
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(btn).toLowerCase().trim();
      const position = index + 1;
      
      // Check if name is empty
      if (!name) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Gallery trigger button ' + position + ' has no accessible name',
          btn,
          'Add aria-label="View image ' + position + ' of ' + totalImages + '"',
          'Screen reader users cannot identify which image this button controls'
        );
        return;
      }
      
      // Check for generic/non-unique names
      const isGeneric = genericNames.some(generic => name === generic || name.includes(generic));
      
      // Track duplicate names
      if (!accessibleNames[name]) {
        accessibleNames[name] = [];
      }
      accessibleNames[name].push({ btn, position });
      
      // Check if name includes position indicator
      const hasPositionIndicator = /\d+\s*(of|\/)\s*\d+/i.test(name) || 
                                   /image\s*\d+/i.test(name) ||
                                   /photo\s*\d+/i.test(name) ||
                                   /slide\s*\d+/i.test(name);
      
      if (isGeneric && !hasPositionIndicator) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Gallery trigger button ' + position + ' has generic name: "' + name + '"',
          btn,
          'Add position context, e.g., aria-label="View image ' + position + ' of ' + totalImages + '"',
          'Screen reader users cannot distinguish between gallery images'
        );
      } else if (hasPositionIndicator) {
        addPassed(
          '4.1.2',
          'Name, Role, Value',
          'Gallery trigger button ' + position + ' has position indicator',
          getSelector(btn)
        );
      }
    });
    
    // Check for duplicate accessible names
    Object.entries(accessibleNames).forEach(([name, buttons]) => {
      if (buttons.length > 1 && totalImages > 1) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          buttons.length + ' gallery trigger buttons share identical name: "' + name + '"',
          buttons[0].btn,
          'Each button needs unique label with position, e.g., "image 1 of ' + totalImages + '", "image 2 of ' + totalImages + '"',
          'Screen reader users cannot distinguish between ' + buttons.length + ' identically-named buttons'
        );
      }
    });
    
    // Summary for multiple buttons with unique names
    const uniqueNames = Object.keys(accessibleNames).length;
    if (uniqueNames === triggerButtons.length && triggerButtons.length > 1) {
      addPassed(
        '4.1.2',
        'Name, Role, Value',
        'All ' + triggerButtons.length + ' gallery trigger buttons have unique accessible names',
        null
      );
    }
  }

  /**
   * Test 4b: Carousel Navigation Buttons (Prev/Next)
   * WCAG: 4.1.2 Name, Role, Value
   * 
   * Checks that prev/next navigation buttons have proper aria-labels
   */
  function testCarouselNavigation(gallery, container) {
    const navSelectors = [
      // Previous buttons
      'button[class*="prev"]',
      'button[class*="previous"]',
      '[class*="prev"] button',
      'button[aria-label*="previous" i]',
      'button[aria-label*="prev" i]',
      '[class*="arrow-left"]',
      '[class*="arrow--left"]',
      '.slick-prev',
      '.swiper-button-prev',
      '.flickity-prev-next-button.previous',
      // Next buttons
      'button[class*="next"]',
      '[class*="next"] button',
      'button[aria-label*="next" i]',
      '[class*="arrow-right"]',
      '[class*="arrow--right"]',
      '.slick-next',
      '.swiper-button-next',
      '.flickity-prev-next-button.next'
    ];
    
    const navButtons = [];
    navSelectors.forEach(selector => {
      try {
        const elements = (gallery || container).querySelectorAll(selector);
        elements.forEach(el => {
          if (isVisible(el) && !navButtons.includes(el)) {
            navButtons.push(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    if (navButtons.length === 0) {
      return; // No carousel navigation found
    }
    
    let prevFound = false;
    let nextFound = false;
    
    navButtons.forEach(btn => {
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(btn).toLowerCase().trim();
      const ariaLabel = btn.getAttribute('aria-label');
      const className = btn.className?.toLowerCase() || '';
      
      // Determine if this is prev or next
      const isPrev = className.includes('prev') || name.includes('prev');
      const isNext = className.includes('next') || name.includes('next');
      
      if (isPrev) prevFound = true;
      if (isNext) nextFound = true;
      
      // Check for accessible name
      if (!name) {
        const direction = isPrev ? 'Previous' : isNext ? 'Next' : 'Navigation';
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Carousel ' + direction.toLowerCase() + ' button has no accessible name',
          btn,
          'Add aria-label="' + direction + ' image" or "' + direction + ' slide"',
          'Screen reader users cannot identify carousel navigation purpose'
        );
      } else if (!ariaLabel && (name === 'prev' || name === 'next' || name === 'previous')) {
        // Name exists but may be icon-only
        addIssue(
          'minor',
          '4.1.2',
          'Name, Role, Value',
          'Carousel button has minimal name: "' + name + '"',
          btn,
          'Consider more descriptive label like "Previous image" or "Next slide"',
          'More context helps screen reader users understand the control'
        );
      } else {
        addPassed(
          '4.1.2',
          'Name, Role, Value',
          'Carousel navigation button has accessible name: "' + name.slice(0, 30) + '"',
          getSelector(btn)
        );
      }
      
      // Check keyboard accessibility
      const tabindex = btn.getAttribute('tabindex');
      if (tabindex === '-1') {
        addIssue(
          'serious',
          '2.1.1',
          'Keyboard',
          'Carousel navigation button removed from tab order',
          btn,
          'Remove tabindex="-1" to allow keyboard access',
          'Keyboard users cannot navigate carousel'
        );
      }
    });
    
    // Check if both prev and next exist for complete navigation
    if ((prevFound || nextFound) && !(prevFound && nextFound)) {
      addManualCheck(
        '2.1.1',
        'Only one direction carousel button found',
        'Verify users can navigate both directions (prev and next)',
        null
      );
    }
  }

  /**
   * Test 4c: Gallery Live Regions
   * WCAG: 4.1.3 Status Messages
   * 
   * Checks that gallery containers have proper aria-live regions
   * for announcing image changes to screen reader users
   */
  function testGalleryLiveRegions(gallery, container) {
    const carouselSelectors = [
      '[class*="carousel"]',
      '[class*="slider"]',
      '[class*="slideshow"]',
      '[role="region"][aria-roledescription*="carousel" i]',
      '.slick-slider',
      '.swiper-container',
      '.swiper',
      '.flickity-slider',
      '[data-carousel]',
      '[data-slider]'
    ];
    
    let carousel = null;
    carouselSelectors.forEach(selector => {
      try {
        const el = (gallery || container).querySelector(selector);
        if (el && isVisible(el)) carousel = el;
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    if (!carousel) {
      return; // No carousel found
    }
    
    results.stats.elementsScanned++;
    
    // Check for aria-live region
    const ariaLive = carousel.getAttribute('aria-live') || 
                     carousel.querySelector('[aria-live]');
    const ariaAtomic = carousel.getAttribute('aria-atomic');
    const role = carousel.getAttribute('role');
    const roleDescription = carousel.getAttribute('aria-roledescription');
    
    // Check for live region
    if (!ariaLive) {
      addIssue(
        'moderate',
        '4.1.3',
        'Status Messages',
        'Gallery/carousel container lacks aria-live region',
        carousel,
        'Add aria-live="polite" to announce slide changes, or use aria-live="off" with manual announcements',
        'Screen reader users may not be informed when images change'
      );
    } else {
      const liveValue = typeof ariaLive === 'string' ? ariaLive : ariaLive.getAttribute('aria-live');
      addPassed(
        '4.1.3',
        'Status Messages',
        'Gallery has aria-live="' + liveValue + '" for announcements',
        getSelector(carousel)
      );
    }
    
    // Check for proper carousel semantics
    if (role === 'region' && roleDescription) {
      addPassed(
        '4.1.2',
        'Name, Role, Value',
        'Carousel has proper role and roledescription',
        getSelector(carousel)
      );
    } else {
      addManualCheck(
        '4.1.2',
        'Consider adding carousel semantics',
        'For complex carousels, add role="region" aria-roledescription="carousel" aria-label="Product images"',
        getSelector(carousel)
      );
    }
    
    // Check for slide indicators (dots/pagination)
    const paginationSelectors = [
      '[class*="dot"]',
      '[class*="pagination"]',
      '[class*="indicator"]',
      '.slick-dots',
      '.swiper-pagination',
      '[role="tablist"]'
    ];
    
    let pagination = null;
    paginationSelectors.forEach(selector => {
      try {
        const el = (carousel || gallery || container).querySelector(selector);
        if (el && isVisible(el)) pagination = el;
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    if (pagination) {
      results.stats.elementsScanned++;
      
      const dots = pagination.querySelectorAll('button, [role="tab"], li, span[tabindex]');
      let hasUniqueLabels = true;
      const labels = [];
      
      dots.forEach((dot, index) => {
        const name = getAccessibleName(dot);
        if (!name || labels.includes(name)) {
          hasUniqueLabels = false;
        }
        labels.push(name);
      });
      
      if (!hasUniqueLabels && dots.length > 1) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Carousel pagination dots lack unique labels',
          pagination,
          'Add aria-label="Go to slide 1", "Go to slide 2", etc.',
          'Screen reader users cannot identify which slide each dot represents'
        );
      } else if (dots.length > 0) {
        addPassed(
          '4.1.2',
          'Name, Role, Value',
          'Carousel pagination has accessible controls',
          getSelector(pagination)
        );
      }
    }
  }

  /**
   * Test 4d: Lightbox/Modal Triggers
   * WCAG: 4.1.2 Name, Role, Value
   * 
   * Checks that PhotoSwipe/lightbox triggers have aria-haspopup="dialog"
   */
  function testLightboxTriggers(gallery, container) {
    // Find elements that trigger lightboxes/modals
    const lightboxSelectors = [
      '[data-pswp]',
      '[data-photoswipe]',
      '[data-lightbox]',
      '[data-fancybox]',
      '[data-magnify]',
      '[class*="lightbox-trigger"]',
      '[class*="modal-trigger"]',
      'a[href*="photoswipe"]',
      // Common click-to-zoom patterns that open dialogs
      '[class*="product-image"][onclick]',
      '[class*="gallery-item"][onclick]',
      'button[class*="media"][data-modal]',
      'button[data-media-id]',
      // Elements that control dialogs/modals
      '[aria-controls][class*="gallery"]',
      '[aria-controls][class*="media"]'
    ];
    
    const triggers = [];
    lightboxSelectors.forEach(selector => {
      try {
        const elements = (gallery || container).querySelectorAll(selector);
        elements.forEach(el => {
          if (isVisible(el) && !triggers.includes(el)) {
            triggers.push(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    // Also find buttons that appear to open modals based on aria-controls
    const modalButtons = (gallery || container).querySelectorAll('button[aria-controls]');
    modalButtons.forEach(btn => {
      const controlsId = btn.getAttribute('aria-controls');
      if (controlsId) {
        const target = document.getElementById(controlsId);
        if (target && (target.getAttribute('role') === 'dialog' || 
                       target.classList.toString().toLowerCase().includes('modal') ||
                       target.classList.toString().toLowerCase().includes('lightbox'))) {
          if (!triggers.includes(btn)) {
            triggers.push(btn);
          }
        }
      }
    });
    
    if (triggers.length === 0) {
      return; // No lightbox triggers found
    }
    
    triggers.forEach((trigger, index) => {
      results.stats.elementsScanned++;
      
      const hasPopup = trigger.getAttribute('aria-haspopup');
      const isButton = trigger.tagName === 'BUTTON' || trigger.getAttribute('role') === 'button';
      const name = getAccessibleName(trigger);
      
      // Check for aria-haspopup
      if (!hasPopup) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Lightbox trigger ' + (index + 1) + ' missing aria-haspopup="dialog"',
          trigger,
          'Add aria-haspopup="dialog" to indicate this opens a modal/lightbox',
          'Screen reader users not informed that this control opens a dialog'
        );
      } else if (hasPopup === 'dialog' || hasPopup === 'true') {
        addPassed(
          '4.1.2',
          'Name, Role, Value',
          'Lightbox trigger has aria-haspopup="' + hasPopup + '"',
          getSelector(trigger)
        );
      } else {
        addIssue(
          'minor',
          '4.1.2',
          'Name, Role, Value',
          'Lightbox trigger has aria-haspopup="' + hasPopup + '" instead of "dialog"',
          trigger,
          'Use aria-haspopup="dialog" for lightbox/modal triggers',
          'Screen reader may announce incorrect popup type'
        );
      }
      
      // Check for keyboard accessibility
      if (!isButton && trigger.tagName !== 'A') {
        const tabindex = trigger.getAttribute('tabindex');
        if (tabindex === null || tabindex === '-1') {
          addIssue(
            'serious',
            '2.1.1',
            'Keyboard',
            'Lightbox trigger not keyboard accessible',
            trigger,
            'Use <button> element or add tabindex="0" and keyboard event handlers',
            'Keyboard users cannot open the lightbox'
          );
        }
      }
      
      // Check for accessible name
      if (!name) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Lightbox trigger has no accessible name',
          trigger,
          'Add aria-label describing the action, e.g., "View image in fullscreen"',
          'Screen reader users cannot identify the trigger purpose'
        );
      }
    });
    
    // Manual check for lightbox accessibility
    if (triggers.length > 0) {
      addManualCheck(
        '2.1.2',
        'Verify lightbox/modal can be closed with keyboard',
        'Open lightbox and verify Escape key closes it, focus returns to trigger',
        null
      );
    }
  }

  /**
   * Test 5: Accordion Panels
   * WCAG: 4.1.2, 2.1.1
   */
  function testAccordions() {
    const container = pdpSection || document;
    const accordions = [];
    
    CONFIG.accordionSelectors.forEach(selector => {
      container.querySelectorAll(selector).forEach(el => {
        if (isVisible(el) && !accordions.includes(el)) accordions.push(el);
      });
    });
    
    // Also check for native <details> elements
    const detailsElements = container.querySelectorAll('details');
    
    accordions.forEach(accordion => {
      results.stats.elementsScanned++;
      
      // Find trigger and panel
      const trigger = accordion.querySelector('button, [role="button"], h2 > button, h3 > button, summary');
      const panel = accordion.querySelector('[class*="content"], [class*="panel"], [role="region"]') || accordion;
      
      if (trigger && trigger.tagName !== 'SUMMARY') {
        const ariaExpanded = trigger.getAttribute('aria-expanded');
        const ariaControls = trigger.getAttribute('aria-controls');
        
        if (!ariaExpanded) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Accordion trigger missing aria-expanded',
            trigger,
            'Add aria-expanded="false" that toggles to "true" when open',
            'Screen reader users not informed of expanded/collapsed state'
          );
        } else {
          addPassed('4.1.2', 'Name, Role, Value', 'Accordion trigger has aria-expanded', getSelector(trigger));
        }
        
        if (!ariaControls) {
          addIssue(
            'minor',
            '4.1.2',
            'Name, Role, Value',
            'Accordion trigger missing aria-controls',
            trigger,
            'Add aria-controls pointing to panel ID',
            'Screen readers cannot announce relationship between trigger and panel'
          );
        }
        
        const isButton = trigger.tagName === 'BUTTON' || trigger.getAttribute('role') === 'button';
        if (!isButton) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Accordion trigger is not a button',
            trigger,
            'Use <button> element inside heading, e.g., <h3><button>Title</button></h3>',
            'May not be interactive for screen reader users'
          );
        }
        
        const name = getAccessibleName(trigger);
        if (!name) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Accordion trigger has no accessible name',
            trigger,
            'Add visible text or aria-label',
            'Screen reader users cannot identify accordion section'
          );
        }
      }
    });
    
    // Test native details elements
    detailsElements.forEach(details => {
      results.stats.elementsScanned++;
      
      const summary = details.querySelector('summary');
      if (!summary) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          '<details> element missing <summary>',
          details,
          'Add <summary> element with descriptive label',
          'Users may not understand how to interact with this element'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Native details/summary accordion', getSelector(details));
      }
    });
    
    if (accordions.length > 0 || detailsElements.length > 0) {
      addManualCheck(
        '2.1.1',
        'Verify accordion keyboard interaction',
        'Tab to accordion triggers, use Enter/Space to expand/collapse',
        null
      );
    }
  }

  /**
   * Test 6: Stock Status
   * WCAG: 4.1.3, 1.4.1
   */
  function testStockStatus() {
    const container = pdpSection || document;
    
    const stockIndicators = container.querySelectorAll(
      '[class*="stock"], [class*="inventory"], [class*="availability"], ' +
      '[data-stock], [data-availability], [class*="sold-out"], [class*="out-of-stock"]'
    );
    
    stockIndicators.forEach(indicator => {
      if (!isVisible(indicator)) return;
      results.stats.elementsScanned++;
      
      const text = indicator.textContent.trim();
      const ariaLive = indicator.getAttribute('aria-live') || indicator.closest('[aria-live]');
      const role = indicator.getAttribute('role');
      
      // Check if out of stock is conveyed not just by color
      const isOutOfStock = text.toLowerCase().includes('out of stock') ||
                          text.toLowerCase().includes('sold out') ||
                          text.toLowerCase().includes('unavailable') ||
                          indicator.classList.contains('out-of-stock') ||
                          indicator.classList.contains('sold-out');
      
      if (isOutOfStock) {
        if (!text) {
          addIssue(
            'critical',
            '1.4.1',
            'Use of Color',
            'Out of stock status conveyed only visually',
            indicator,
            'Add visible text indicating item is out of stock',
            'Users who cannot see color will not know item is unavailable'
          );
        } else {
          addPassed('1.4.1', 'Use of Color', 'Stock status has text indication', getSelector(indicator));
        }
      }
      
      // Check for live region for dynamic stock updates
      if (!ariaLive && !role) {
        addManualCheck(
          '4.1.3',
          'Verify stock status changes are announced',
          'If stock status updates dynamically (e.g., after variant change), verify screen reader announces it',
          getSelector(indicator)
        );
      }
    });
  }

  /**
   * Test 7: Keyboard Navigation
   * WCAG: 2.1.1, 2.4.3
   */
  function testKeyboardNavigation() {
    const container = pdpSection || document;
    const focusable = getFocusableElements(container);
    
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
      'Verify all PDP interactions work with keyboard',
      'Tab through variants, quantity, add to cart, gallery, accordions - all should work without mouse',
      null
    );
  }

  /**
   * Test 8: Focus Indicators
   * WCAG: 2.4.7
   */
  function testFocusIndicators() {
    const container = pdpSection || document;
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
        outlineNoneCount + ' PDP elements have outline:none - verify alternative focus indicators',
        'Tab through all interactive elements and verify visible focus indicator appears',
        null
      );
    }
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================
  
  if (!pdpSection) {
    addManualCheck(
      '1.3.1',
      'No product detail section detected',
      'If this is a product page, verify PDP is properly marked up',
      null
    );
  }
  
  testVariantSelectors();
  testAddToCart();
  testQuantitySelector();
  testImageGallery();
  testAccordions();
  testStockStatus();
  testKeyboardNavigation();
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
  window.runPdpAudit = runPdpAudit;
}
