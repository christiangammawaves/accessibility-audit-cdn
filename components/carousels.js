/**
 * Carousels Accessibility Audit
 * WCAG: 1.3.1, 2.1.1, 2.2.2, 2.4.7, 4.1.2
 */

function runCarouselsAudit() {
  'use strict';

  const startTime = performance.now();

  const CONFIG = {
    carouselSelectors: [
      '[role="region"][aria-roledescription="carousel"]',
      '[class*="carousel"]',
      '[class*="slider"]',
      '[class*="slideshow"]',
      '[class*="swiper"]',
      '[class*="slick"]',
      '[class*="flickity"]',
      '[class*="splide"]',
      '[class*="glide"]',
      '[class*="owl-carousel"]',
      '[data-flickity]',
      '[data-slick]',
      '.embla'
    ],
    slideSelectors: [
      '[role="group"][aria-roledescription="slide"]',
      '[class*="slide"]',
      '[class*="swiper-slide"]',
      '[class*="slick-slide"]',
      '[class*="flickity-cell"]',
      '[class*="splide__slide"]',
      '[class*="glide__slide"]',
      '.owl-item',
      '.embla__slide'
    ],
    controlSelectors: {
      prev: '[class*="prev"], [aria-label*="previous" i], [aria-label*="prev" i], button[class*="left"], .slick-prev, .flickity-prev-next-button.previous',
      next: '[class*="next"], [aria-label*="next" i], button[class*="right"], .slick-next, .flickity-prev-next-button.next',
      dots: '[class*="dot"], [class*="indicator"], [class*="pager"], [role="tablist"], .slick-dots, .flickity-page-dots',
      pause: '[class*="pause"], [aria-label*="pause" i], [aria-label*="stop" i], [class*="autoplay"]'
    },
    autoplayIndicators: [
      '[data-autoplay]',
      '[data-auto-rotate]',
      '[data-interval]',
      '[data-cycle]',
      '[class*="autoplay"]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('carousels', 'All carousels, sliders, and slideshows');
  const { isVisible, getSelector, getAccessibleName, getElementSnippet } = h;

  function identifyCarouselType(carousel) {
    const classes = (carousel.className || '').toLowerCase();
    const text = carousel.textContent.toLowerCase().slice(0, 500);
    
    if (classes.includes('hero') || classes.includes('banner') || classes.includes('homepage')) return 'hero-slider';
    if (classes.includes('product') && (classes.includes('gallery') || classes.includes('image'))) return 'product-gallery';
    if (classes.includes('testimonial') || classes.includes('review') || text.includes('testimonial')) return 'testimonial-carousel';
    if (classes.includes('logo') || classes.includes('brand') || classes.includes('partner')) return 'logo-carousel';
    if (classes.includes('thumbnail')) return 'thumbnail-carousel';
    return 'generic-carousel';
  }

  function hasAutoplay(carousel) {
    // Check data attributes
    for (const attr of CONFIG.autoplayIndicators) {
      if (carousel.matches(attr)) return true;
    }
    // Check for autoplay in data attributes
    const dataAttrs = Array.from(carousel.attributes).filter(a => a.name.startsWith('data-'));
    for (const attr of dataAttrs) {
      const val = attr.value.toLowerCase();
      if (val.includes('autoplay') || val.includes('auto') || attr.name.includes('autoplay')) {
        if (!val.includes('false') && val !== '0') return true;
      }
    }
    // Check common library patterns
    if (carousel.classList.contains('slick-initialized')) {
      const track = carousel.querySelector('.slick-track');
      if (track && track.style.transition) return true;
    }
    return false;
  }

  // ==========================================================================
  // FIND CAROUSELS
  // ==========================================================================

  function findAllCarousels() {
    const carousels = new Set();
    CONFIG.carouselSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => carousels.add(el));
      } catch (e) { /* Invalid selector */ }
    });
    let result = Array.from(carousels);

    // Pattern A fix: Remove child elements matched by wildcard selectors
    // that are descendants of other matched carousels
    const { deduplicateElements, isExposedToAT } = window.a11yHelpers;
    if (deduplicateElements) {
      result = deduplicateElements(result);
    }

    // Filter to visible and AT-exposed elements
    return result.filter(el => {
      if (!isVisible(el)) return false;
      if (isExposedToAT && !isExposedToAT(el)) return false;
      return true;
    });
  }

  const allCarousels = findAllCarousels();

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================

  function testCarouselSemantics(carousel, carouselType) {
    results.stats.elementsScanned++;
    
    const role = carousel.getAttribute('role');
    const roledescription = carousel.getAttribute('aria-roledescription');
    
    // Test: region role with aria-roledescription="carousel"
    if (role !== 'region' && role !== 'group') {
      addIssue('serious', '4.1.2', 'Name, Role, Value',
        `Carousel (${carouselType}) missing role="region"`,
        carousel,
        'Add role="region" to carousel container',
        'Screen reader users not informed of carousel component');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Carousel has region role', getSelector(carousel));
    }
    
    if (!roledescription || !roledescription.toLowerCase().includes('carousel')) {
      addIssue('moderate', '4.1.2', 'Name, Role, Value',
        `Carousel missing aria-roledescription="carousel"`,
        carousel,
        'Add aria-roledescription="carousel" to identify component type',
        'Screen reader users may not understand this is a carousel');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Carousel has aria-roledescription', getSelector(carousel));
    }
    
    // Test: Accessible name
    const name = getAccessibleName(carousel);
    if (!name) {
      addIssue('serious', '4.1.2', 'Name, Role, Value',
        `Carousel (${carouselType}) has no accessible name`,
        carousel,
        'Add aria-label describing carousel content (e.g., aria-label="Featured products")',
        'Screen reader users cannot identify carousel purpose');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', `Carousel has accessible name: "${name.slice(0, 40)}"`, getSelector(carousel));
    }
  }

  function testSlideStructure(carousel, carouselType) {
    // Find slides
    let slides = [];
    for (const selector of CONFIG.slideSelectors) {
      try {
        const found = carousel.querySelectorAll(selector);
        if (found.length > 0) {
          slides = Array.from(found);
          break;
        }
      } catch (e) { /* Invalid selector */ }
    }
    
    if (slides.length === 0) {
      // Try generic children
      slides = Array.from(carousel.children).filter(el => isVisible(el) && el.tagName !== 'BUTTON');
    }
    
    results.stats.elementsScanned += slides.length;
    
    if (slides.length < 2) {
      addManualCheck('1.3.1', 'Could not identify slides in carousel', 'Verify carousel has multiple slides with proper structure', getSelector(carousel));
      return;
    }
    
    // Test each slide
    let slidesWithRole = 0;
    let slidesWithLabel = 0;
    
    slides.forEach((slide, index) => {
      const slideRole = slide.getAttribute('role');
      const slideRoledesc = slide.getAttribute('aria-roledescription');
      const slideLabel = slide.getAttribute('aria-label');
      
      if (slideRole === 'group' && slideRoledesc === 'slide') {
        slidesWithRole++;
      }
      
      if (slideLabel || slide.getAttribute('aria-labelledby')) {
        slidesWithLabel++;
      }
    });
    
    if (slidesWithRole < slides.length) {
      addIssue('moderate', '4.1.2', 'Name, Role, Value',
        `${slides.length - slidesWithRole} of ${slides.length} slides missing role="group" aria-roledescription="slide"`,
        slides[0],
        'Add role="group" and aria-roledescription="slide" to each slide',
        'Screen readers cannot identify individual slides');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', `All ${slides.length} slides have proper role`, getSelector(carousel));
    }
    
    if (slidesWithLabel < slides.length) {
      addIssue('moderate', '4.1.2', 'Name, Role, Value',
        `${slides.length - slidesWithLabel} of ${slides.length} slides missing aria-label`,
        slides[0],
        'Add aria-label="X of Y" to each slide (e.g., aria-label="1 of 5")',
        'Screen reader users cannot identify slide position');
    }
    
    // Test: Live region for slide changes (WCAG 4.1.3)
    // CRITICAL: Check WHERE aria-live is placed, not just IF it exists
    const liveRegionOnCarousel = carousel.getAttribute('aria-live');
    const liveRegionOnWrapper = carousel.querySelector('.swiper-wrapper[aria-live], .slick-list[aria-live], .flickity-viewport[aria-live], [class*="slides"][aria-live]');
    const dedicatedLiveRegion = carousel.querySelector('[aria-live]:not(.swiper-wrapper):not(.slick-list):not(.flickity-viewport):not([class*="slides"])');

    // Check if slides have position labels (e.g., aria-label="1 of 6")
    const slidesWithPositionLabels = slides.filter(slide => {
      const label = slide.getAttribute('aria-label');
      return label && /\d+\s*(?:of|\/)\s*\d+/.test(label);
    });

    // Pattern E fix: Check aria-live placement in priority order.
    // Report only ONE coherent issue instead of contradictory pairs.
    const slideWithLiveDescendant = slides.find(slide => slide.querySelector('[aria-live]'));

    if (slideWithLiveDescendant) {
      // Worst case: aria-live inside slide content re-announces everything
      addIssue('serious', '4.1.3', 'Status Messages',
        'aria-live found inside slide content — will re-announce entire slide on every navigation',
        slideWithLiveDescendant.querySelector('[aria-live]'),
        'Move aria-live region outside the slides to a dedicated status element: <div aria-live="polite" class="visually-hidden">…</div>',
        'Screen readers announce all slide content on every navigation instead of a concise position update');
    } else if (liveRegionOnWrapper) {
      // MISCONFIGURED: aria-live on main slide container will announce ALL content
      addIssue('moderate', '4.1.3', 'Status Messages',
        'Live region incorrectly placed on slide container - will announce entire slide content instead of just position',
        liveRegionOnWrapper,
        `Remove aria-live from slide container. Add separate element: <div aria-live="polite" class="visually-hidden">Slide <span class="current">1</span> of <span class="total">${slides.length}</span></div>`,
        'Screen readers announce excessive content on slide change instead of concise position update');
    } else if (!liveRegionOnCarousel && !dedicatedLiveRegion && slidesWithPositionLabels.length < slides.length) {
      // Missing live region AND missing position labels
      addManualCheck('4.1.3', 'Verify slide changes are announced to screen readers',
        'Use screen reader to navigate carousel - slide changes should be announced. Add dedicated live region for position updates.',
        getSelector(carousel));
    } else if (!liveRegionOnCarousel && !dedicatedLiveRegion && slidesWithPositionLabels.length === slides.length) {
      // Has position labels but no live region - lower priority
      addManualCheck('4.1.3', 'Consider adding live region for slide position announcements',
        `Slides have position labels (aria-label="${slidesWithPositionLabels[0]?.getAttribute('aria-label')}") but no live region. While not required, a dedicated live region improves UX.`,
        getSelector(carousel));
    }
  }

  function testNavigationControls(carousel, carouselType) {
    // Find prev/next buttons
    const prevBtn = carousel.querySelector(CONFIG.controlSelectors.prev);
    const nextBtn = carousel.querySelector(CONFIG.controlSelectors.next);
    
    if (!prevBtn && !nextBtn) {
      addIssue('serious', '2.1.1', 'Keyboard',
        `Carousel (${carouselType}) has no visible navigation controls`,
        carousel,
        'Add previous/next buttons for keyboard navigation',
        'Keyboard users cannot navigate between slides');
    } else {
      results.stats.elementsScanned += 2;
      
      // Check accessible names
      [{ btn: prevBtn, type: 'Previous' }, { btn: nextBtn, type: 'Next' }].forEach(({ btn, type }) => {
        if (!btn) return;
        
        const name = getAccessibleName(btn);
        if (!name) {
          addIssue('serious', '4.1.2', 'Name, Role, Value',
            `${type} button has no accessible name`,
            btn,
            `Add aria-label="${type} slide" to button`,
            'Screen reader users cannot identify button purpose');
        } else if (name.length < 3) {
          addIssue('moderate', '4.1.2', 'Name, Role, Value',
            `${type} button has insufficient accessible name: "${name}"`,
            btn,
            `Use descriptive aria-label="${type} slide"`,
            'Screen reader users may not understand button purpose');
        } else {
          addPassed('4.1.2', 'Name, Role, Value', `${type} button has name: "${name.slice(0, 30)}"`, getSelector(btn));
        }
        
        // Check if button is actually focusable
        const tabindex = btn.getAttribute('tabindex');
        if (tabindex === '-1') {
          addIssue('critical', '2.1.1', 'Keyboard',
            `${type} button is not keyboard accessible (tabindex="-1")`,
            btn,
            'Remove tabindex="-1" from navigation button',
            'Keyboard users cannot access carousel navigation');
        }
      });
    }
    
    // Find dot indicators
    const dotsContainer = carousel.querySelector(CONFIG.controlSelectors.dots);
    if (dotsContainer) {
      results.stats.elementsScanned++;
      
      const dots = dotsContainer.querySelectorAll('button, [role="tab"], li, span[class*="dot"]');
      const role = dotsContainer.getAttribute('role');
      
      if (role !== 'tablist' && dots.length > 0) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value',
          'Carousel dots should use tablist pattern',
          dotsContainer,
          'Add role="tablist" to dots container, role="tab" to each dot',
          'Screen reader users cannot navigate by slide');
      }
      
      dots.forEach((dot, idx) => {
        const dotName = getAccessibleName(dot);
        if (!dotName) {
          addIssue('moderate', '4.1.2', 'Name, Role, Value',
            `Slide indicator ${idx + 1} has no accessible name`,
            dot,
            `Add aria-label="Go to slide ${idx + 1}"`,
            'Screen reader users cannot identify slide indicators');
        }
      });
    }
    
    // Add manual check for arrow keys
    addManualCheck('2.1.1', `Verify arrow keys navigate ${carouselType}`,
      'Focus carousel and use Left/Right arrow keys to change slides',
      getSelector(carousel));
  }

  function testAutoplayControls(carousel, carouselType) {
    const hasAutoplayAttr = hasAutoplay(carousel);
    
    if (!hasAutoplayAttr) {
      // Still add manual check
      addManualCheck('2.2.2', 'Verify if carousel auto-rotates',
        'Watch carousel for 10 seconds to detect auto-rotation. If present, verify pause control exists.',
        getSelector(carousel));
      return;
    }
    
    results.stats.elementsScanned++;
    
    // Look for pause/stop control
    const pauseBtn = carousel.querySelector(CONFIG.controlSelectors.pause);
    
    if (!pauseBtn) {
      addIssue('critical', '2.2.2', 'Pause, Stop, Hide',
        `Auto-rotating carousel (${carouselType}) has no pause control`,
        carousel,
        'Add a pause/play button to stop auto-rotation',
        'Users with cognitive disabilities cannot stop distracting motion');
    } else {
      const pauseName = getAccessibleName(pauseBtn);
      if (!pauseName) {
        addIssue('serious', '4.1.2', 'Name, Role, Value',
          'Pause button has no accessible name',
          pauseBtn,
          'Add aria-label="Pause slideshow" or aria-label="Play slideshow"');
      } else {
        addPassed('2.2.2', 'Pause, Stop, Hide', 'Auto-play carousel has pause control', getSelector(pauseBtn));
      }
      
      // Check for aria-pressed state
      const ariaPressed = pauseBtn.getAttribute('aria-pressed');
      if (ariaPressed === null) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value',
          'Pause button missing aria-pressed state',
          pauseBtn,
          'Add aria-pressed="true" when paused, "false" when playing');
      }
    }
    
    // Check for hover pause
    addManualCheck('2.2.2', 'Verify carousel pauses on hover/focus',
      'Hover mouse over carousel or focus a slide - auto-rotation should pause',
      getSelector(carousel));
  }

  function testFocusManagement(carousel, carouselType) {
    // Check for focus indicators on controls
    const focusableEls = carousel.querySelectorAll('button, a, [tabindex="0"]');
    let outlineNoneCount = 0;
    
    focusableEls.forEach(el => {
      results.stats.elementsScanned++;
      const style = window.getComputedStyle(el);
      if (style.outlineStyle === 'none' && !style.boxShadow.includes('rgb')) {
        outlineNoneCount++;
      }
    });
    
    if (outlineNoneCount > 0) {
      addManualCheck('2.4.7', `${outlineNoneCount} carousel controls may lack focus indicators`,
        'Tab through carousel controls and verify each shows visible focus indicator',
        getSelector(carousel));
    }
    
    // Check for positive tabindex
    focusableEls.forEach(el => {
      const tabindex = el.getAttribute('tabindex');
      if (tabindex && parseInt(tabindex) > 0) {
        addIssue('moderate', '2.4.3', 'Focus Order',
          'Carousel element has positive tabindex disrupting focus order',
          el,
          'Remove positive tabindex or set to 0',
          'Keyboard navigation order is unpredictable');
      }
    });
    
    // Check if slides themselves are focusable (they shouldn't all be)
    const slides = carousel.querySelectorAll('[class*="slide"]');
    let focusableSlides = 0;
    slides.forEach(slide => {
      if (slide.getAttribute('tabindex') === '0') focusableSlides++;
    });
    
    if (focusableSlides > 1) {
      addManualCheck('2.1.1', 'Verify carousel uses roving tabindex',
        'Only the active slide (or none) should be in tab order. Use arrows to move between slides.',
        getSelector(carousel));
    }
  }

  function testCarousel(carousel) {
    const carouselType = identifyCarouselType(carousel);
    
    testCarouselSemantics(carousel, carouselType);
    testSlideStructure(carousel, carouselType);
    testNavigationControls(carousel, carouselType);
    testAutoplayControls(carousel, carouselType);
    testFocusManagement(carousel, carouselType);
  }

  // ==========================================================================
  // RUN AUDIT
  // ==========================================================================

  if (allCarousels.length === 0) {
    results.manualChecks.push({
      wcag: '2.2.2',
      message: 'No carousels detected on page',
      howToTest: 'Verify if page has any sliders/carousels that were not detected'
    });
  } else {
    allCarousels.forEach(carousel => testCarousel(carousel));
    
    // General manual checks
    addManualCheck('2.1.1', 'Verify all carousel content is keyboard accessible',
      'Tab through entire carousel - all interactive content in slides should be reachable');
    
    addManualCheck('1.4.13', 'Verify carousel content doesn\'t disappear on hover',
      'Hover over slide content - if additional content appears, it should be hoverable and dismissable');
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
  window.runCarouselsAudit = runCarouselsAudit;
}
