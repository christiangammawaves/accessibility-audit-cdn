/**
 * Hero Accessibility Audit
 * WCAG: 1.1.1, 1.4.2, 2.1.1, 2.2.2, 2.4.3, 4.1.2
 */

function runHeroAudit() {
  'use strict';

  const startTime = performance.now();

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  const CONFIG = {
    scope: [
      '[class*="hero"]',
      '[class*="banner"]',
      '[class*="carousel"]',
      '[class*="slider"]',
      '[class*="slideshow"]',
      '[role="banner"]',
      '.swiper',
      '.slick-slider',
      '.flickity',
      '.splide',
      'section:first-of-type',
      '#shopify-section-template--hero',
      '[data-section-type="slideshow"]'
    ],
    carouselSelectors: [
      '[class*="carousel"]',
      '[class*="slider"]',
      '[class*="slideshow"]',
      '[class*="swiper"]',
      '.slick-slider',
      '.flickity-slider',
      '[data-flickity]',
      '[data-slick]',
      '.splide'
    ],
    slideSelectors: [
      '[class*="slide"]',
      '.swiper-slide',
      '.slick-slide',
      '.flickity-cell',
      '.splide__slide',
      '[role="group"][aria-roledescription="slide"]',
      '[data-slide]'
    ],
    controlSelectors: {
      prev: ['[class*="prev"]', '[aria-label*="previous" i]', '[aria-label*="prev" i]', '.slick-prev', '.swiper-button-prev'],
      next: ['[class*="next"]', '[aria-label*="next" i]', '.slick-next', '.swiper-button-next'],
      pause: ['[class*="pause"]', '[aria-label*="pause" i]', '[aria-label*="stop" i]', '[class*="autoplay"]'],
      dots: ['[class*="dot"]', '[class*="pagination"]', '[class*="indicator"]', '.slick-dots', '.swiper-pagination', '[role="tablist"]']
    },
    videoSelectors: [
      'video',
      '[class*="video-background"]',
      '[class*="bg-video"]',
      'iframe[src*="youtube"]',
      'iframe[src*="vimeo"]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('hero', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  function isSlideHidden(slide) {
    if (!slide) return true;
    
    // Check common hidden slide indicators
    const ariaHidden = slide.getAttribute('aria-hidden') === 'true';
    const hasInert = slide.hasAttribute('inert');
    const isSlickHidden = slide.classList.contains('slick-cloned') || 
                          (slide.getAttribute('aria-hidden') === 'true' && slide.classList.contains('slick-slide'));
    const isSwiperHidden = !slide.classList.contains('swiper-slide-active') && 
                           !slide.classList.contains('swiper-slide-visible');
    const hasHiddenClass = slide.classList.contains('hidden') || 
                           slide.classList.contains('is-hidden') ||
                           slide.classList.contains('inactive');
    
    // Check computed style
    const style = window.getComputedStyle(slide);
    const isStyleHidden = style.display === 'none' || 
                          style.visibility === 'hidden' || 
                          style.opacity === '0';
    
    return ariaHidden || hasInert || isSlickHidden || isSwiperHidden || hasHiddenClass || isStyleHidden;
  }

  // ==========================================================================
  // FIND HERO/CAROUSEL COMPONENTS
  // ==========================================================================

  function findHeroSection() {
    for (const selector of CONFIG.scope) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  function findCarousels() {
    const carousels = new Set();
    CONFIG.carouselSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (isVisible(el)) carousels.add(el);
      });
    });
    return Array.from(carousels);
  }

  const heroSection = findHeroSection();
  const carousels = findCarousels();

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================
  
  /**
   * Test 1: Autoplay Pause Control
   * WCAG: 2.2.2
   */
  function testAutoplayControl() {
    carousels.forEach(carousel => {
      results.stats.elementsScanned++;
      
      // Detect if carousel auto-rotates
      const hasAutoplay = carousel.hasAttribute('data-autoplay') ||
                          carousel.hasAttribute('data-auto') ||
                          carousel.classList.contains('autoplay') ||
                          carousel.getAttribute('data-flickity')?.includes('autoPlay') ||
                          carousel.getAttribute('data-slick')?.includes('autoplay') ||
                          carousel.querySelector('[data-autoplay="true"]');
      
      // Look for pause/stop control
      let pauseButton = null;
      CONFIG.controlSelectors.pause.forEach(selector => {
        const btn = carousel.querySelector(selector) || carousel.parentElement?.querySelector(selector);
        if (btn) pauseButton = btn;
      });
      
      if (hasAutoplay && !pauseButton) {
        addIssue(
          'critical',
          '2.2.2',
          'Pause, Stop, Hide',
          'Auto-rotating carousel has no pause/stop control',
          carousel,
          'Add a visible pause button that stops automatic rotation',
          'Users with cognitive disabilities or motion sensitivity cannot stop distracting movement'
        );
      } else if (hasAutoplay && pauseButton) {
        results.stats.elementsScanned++;
        
        const name = getAccessibleName(pauseButton);
        if (!name) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Pause button has no accessible name',
            pauseButton,
            'Add aria-label="Pause slideshow" or visible text',
            'Screen reader users cannot identify pause control'
          );
        } else {
          addPassed('2.2.2', 'Pause, Stop, Hide', 'Carousel has pause control: "' + name.slice(0, 30) + '"', getSelector(pauseButton));
        }
        
        // Check if pause button is keyboard accessible
        const isButton = pauseButton.tagName === 'BUTTON' || pauseButton.getAttribute('role') === 'button';
        const tabindex = pauseButton.getAttribute('tabindex');
        
        if (!isButton && tabindex === '-1') {
          addIssue(
            'serious',
            '2.1.1',
            'Keyboard',
            'Pause control not keyboard accessible',
            pauseButton,
            'Use <button> element or ensure element is focusable',
            'Keyboard users cannot pause carousel'
          );
        }
      } else if (!hasAutoplay) {
        // Check manually - autoplay may be set via JS
        addManualCheck(
          '2.2.2',
          'Verify if carousel auto-rotates',
          'Watch carousel for 5+ seconds. If it rotates automatically, ensure pause control exists',
          getSelector(carousel)
        );
      }
    });
    
    if (carousels.length === 0 && heroSection) {
      addManualCheck(
        '2.2.2',
        'Check for auto-playing content in hero section',
        'Verify no auto-rotating content exists, or if it does, pause control is available',
        getSelector(heroSection)
      );
    }
  }

  /**
   * Test 2: Hidden Slide Focus Management
   * WCAG: 2.4.3
   */
  function testHiddenSlideFocus() {
    carousels.forEach(carousel => {
      const slides = [];
      CONFIG.slideSelectors.forEach(selector => {
        carousel.querySelectorAll(selector).forEach(slide => {
          if (!slides.includes(slide)) slides.push(slide);
        });
      });
      
      if (slides.length === 0) return;
      
      // Collect hidden slide data for consolidated reporting
      const hiddenSlideData = [];
      var passedSlideCount = 0;

      slides.forEach((slide, index) => {
        const hidden = isSlideHidden(slide);

        if (hidden) {
          results.stats.elementsScanned++;

          // Check for focusable elements in hidden slide
          const focusable = slide.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
          const activeFocusable = Array.from(focusable).filter(el => {
            const tabindex = el.getAttribute('tabindex');
            return tabindex !== '-1' && !el.hasAttribute('disabled') && !el.closest('[inert]');
          });

          if (activeFocusable.length > 0) {
            // Check if slide has aria-hidden or inert
            const hasAriaHidden = slide.getAttribute('aria-hidden') === 'true';
            const hasInert = slide.hasAttribute('inert');

            if (!hasAriaHidden && !hasInert) {
              hiddenSlideData.push({ index: index + 1, count: activeFocusable.length });
            } else if (hasAriaHidden || hasInert) {
              passedSlideCount++;
            }
          }
        }
      });

      // Single consolidated finding per carousel
      if (hiddenSlideData.length > 0) {
        const totalFocusable = hiddenSlideData.reduce((sum, s) => sum + s.count, 0);
        addIssue(
          'serious',
          '2.4.3',
          'Focus Order',
          hiddenSlideData.length + ' hidden slides contain ' + totalFocusable +
            ' total focusable elements without aria-hidden or inert' +
            ' (slides: ' + hiddenSlideData.map(s => '#' + s.index).join(', ') + ')',
          carousel,
          'Add aria-hidden="true" to hidden slides or inert attribute, or set tabindex="-1" on all focusable children',
          'Keyboard users may focus invisible elements, causing confusion'
        );
      }
      if (passedSlideCount > 0) {
        addPassed('2.4.3', 'Focus Order', passedSlideCount + ' hidden slides properly use aria-hidden or inert', getSelector(carousel));
      }
      
      // Add manual check for focus order
      addManualCheck(
        '2.4.3',
        'Verify Tab key only focuses visible slide content',
        'Tab through carousel - focus should only land on currently visible slide elements',
        getSelector(carousel)
      );
    });
  }

  /**
   * Test 3: Carousel Navigation Controls
   * WCAG: 4.1.2, 2.1.1
   */
  function testNavigationControls() {
    carousels.forEach(carousel => {
      // Test prev/next buttons
      ['prev', 'next'].forEach(direction => {
        let button = null;
        CONFIG.controlSelectors[direction].forEach(selector => {
          const btn = carousel.querySelector(selector);
          if (btn && isVisible(btn)) button = btn;
        });
        
        if (button) {
          results.stats.elementsScanned++;
          
          const name = getAccessibleName(button);
          const isButton = button.tagName === 'BUTTON' || button.getAttribute('role') === 'button';
          
          if (!name || name.length < 2) {
            addIssue(
              'serious',
              '4.1.2',
              'Name, Role, Value',
              direction.charAt(0).toUpperCase() + direction.slice(1) + ' button has no accessible name',
              button,
              'Add aria-label="' + (direction === 'prev' ? 'Previous slide' : 'Next slide') + '"',
              'Screen reader users cannot identify carousel controls'
            );
          } else {
            addPassed('4.1.2', 'Name, Role, Value', direction + ' button has name: "' + name.slice(0, 30) + '"', getSelector(button));
          }
          
          if (!isButton) {
            addIssue(
              'moderate',
              '4.1.2',
              'Name, Role, Value',
              direction + ' control is not a button element',
              button,
              'Use <button> element or add role="button"',
              'Assistive technology may not announce as interactive'
            );
          }
        }
      });
      
      // Test dot indicators/pagination
      let dotsContainer = null;
      CONFIG.controlSelectors.dots.forEach(selector => {
        const el = carousel.querySelector(selector);
        if (el && isVisible(el)) dotsContainer = el;
      });
      
      if (dotsContainer) {
        results.stats.elementsScanned++;
        
        const dots = dotsContainer.querySelectorAll('button, [role="tab"], li, span[tabindex], a');
        
        dots.forEach((dot, index) => {
          if (!isVisible(dot)) return;
          
          const isCurrent = dot.classList.contains('active') || 
                           dot.classList.contains('slick-active') ||
                           dot.classList.contains('swiper-pagination-bullet-active') ||
                           dot.getAttribute('aria-current') === 'true' ||
                           dot.getAttribute('aria-selected') === 'true';
          
          // Check if current slide is indicated
          if (isCurrent) {
            const hasAriaCurrent = dot.getAttribute('aria-current') === 'true';
            const hasAriaSelected = dot.getAttribute('aria-selected') === 'true';
            
            if (!hasAriaCurrent && !hasAriaSelected) {
              addIssue(
                'moderate',
                '4.1.2',
                'Name, Role, Value',
                'Active slide indicator lacks aria-current or aria-selected',
                dot,
                'Add aria-current="true" to current slide indicator',
                'Screen reader users not informed which slide is active'
              );
            } else {
              addPassed('4.1.2', 'Name, Role, Value', 'Current slide indicator has aria-current/selected', getSelector(dot));
            }
          }
          
          // Check accessible name
          const name = getAccessibleName(dot);
          if (!name || name.length < 2) {
            addIssue(
              'moderate',
              '4.1.2',
              'Name, Role, Value',
              'Slide indicator ' + (index + 1) + ' has no accessible name',
              dot,
              'Add aria-label="Go to slide ' + (index + 1) + '" or "Slide ' + (index + 1) + '"',
              'Screen reader users cannot identify slide indicators'
            );
          }
        });
        
        // Check if dots are keyboard accessible
        addManualCheck(
          '2.1.1',
          'Verify slide indicators are keyboard accessible',
          'Tab to dots and use Enter/Space to navigate to different slides',
          getSelector(dotsContainer)
        );
      }
    });
  }

  /**
   * Test 4: Slide Images Alt Text
   * WCAG: 1.1.1
   */
  function testSlideImages() {
    const container = heroSection || document;
    const images = container.querySelectorAll('img');
    
    images.forEach(img => {
      if (!isVisible(img)) return;
      results.stats.elementsScanned++;
      
      const alt = img.getAttribute('alt');
      const role = img.getAttribute('role');
      const ariaHidden = img.getAttribute('aria-hidden') === 'true';
      const isBackground = img.classList.contains('bg') || 
                           img.classList.contains('background') ||
                           img.closest('[class*="background"]');
      
      if (alt === null && !ariaHidden) {
        addIssue(
          'serious',
          '1.1.1',
          'Non-text Content',
          'Image missing alt attribute',
          img,
          'Add alt text describing the image content, or alt="" if decorative',
          'Screen reader users have no information about image'
        );
      } else if (alt === '' && !isBackground && !ariaHidden && role !== 'presentation') {
        // Empty alt on potentially meaningful image
        const hasOverlayText = img.parentElement?.querySelector('h1, h2, h3, p, [class*="title"], [class*="heading"]');
        if (!hasOverlayText) {
          addManualCheck(
            '1.1.1',
            'Verify image is decorative (has empty alt)',
            'If image conveys meaning, add descriptive alt text. If purely decorative, empty alt is correct.',
            getSelector(img)
          );
        }
      } else if (alt && alt.length > 0) {
        // Check for poor alt text patterns
        const poorPatterns = ['image', 'photo', 'picture', 'banner', 'hero', 'slide'];
        const altLower = alt.toLowerCase();
        
        if (poorPatterns.some(p => altLower === p || altLower === p + '.jpg' || altLower === p + '.png')) {
          addIssue(
            'moderate',
            '1.1.1',
            'Non-text Content',
            'Image has non-descriptive alt text: "' + alt + '"',
            img,
            'Provide meaningful description of image content',
            'Alt text does not convey useful information'
          );
        } else {
          addPassed('1.1.1', 'Non-text Content', 'Image has alt text: "' + alt.slice(0, 40) + '"', getSelector(img));
        }
      }
    });
  }

  /**
   * Test 5: Video Background Controls
   * WCAG: 1.4.2, 2.2.2
   */
  function testVideoBackgrounds() {
    const container = heroSection || document;
    
    CONFIG.videoSelectors.forEach(selector => {
      const videos = container.querySelectorAll(selector);
      
      videos.forEach(video => {
        if (!isVisible(video)) return;
        results.stats.elementsScanned++;
        
        const isAutoplay = video.hasAttribute('autoplay') || 
                          video.autoplay === true ||
                          video.getAttribute('data-autoplay') === 'true';
        const isMuted = video.hasAttribute('muted') || video.muted === true;
        const isLoop = video.hasAttribute('loop') || video.loop === true;
        const isBackground = video.classList.contains('background') ||
                            video.closest('[class*="background"]') ||
                            video.closest('[class*="hero"]');
        
        // Check for pause control
        const parent = video.closest('section, div, [class*="hero"], [class*="banner"]');
        const pauseButton = parent?.querySelector('[class*="pause"], [aria-label*="pause" i], [class*="play"]');
        
        if ((isAutoplay || isLoop) && !pauseButton && isBackground) {
          addIssue(
            'critical',
            '2.2.2',
            'Pause, Stop, Hide',
            'Background video has no pause control',
            video,
            'Add visible pause/play button for video background',
            'Users with vestibular disorders or attention issues cannot stop video'
          );
        }
        
        // Check audio
        if (isAutoplay && !isMuted) {
          addIssue(
            'critical',
            '1.4.2',
            'Audio Control',
            'Video may autoplay with audio',
            video,
            'Ensure video is muted on autoplay or provide audio control',
            'Unexpected audio is jarring and problematic for screen reader users'
          );
        } else if (isAutoplay && isMuted) {
          addPassed('1.4.2', 'Audio Control', 'Autoplaying video is muted', getSelector(video));
        }
        
        // Check for iframes (YouTube/Vimeo)
        if (video.tagName === 'IFRAME') {
          addManualCheck(
            '2.2.2',
            'Verify embedded video has pause control',
            'If video autoplays, ensure user can pause it',
            getSelector(video)
          );
        }
      });
    });
  }

  /**
   * Test 6: CTA Button Accessibility
   * WCAG: 2.4.4
   */
  function testCTAButtons() {
    const container = heroSection || document;
    const links = container.querySelectorAll('a, button');
    
    const genericTexts = ['learn more', 'read more', 'click here', 'more', 'see more', 'view more', 'shop now', 'discover', 'explore'];
    
    links.forEach(link => {
      if (!isVisible(link)) return;
      
      const text = getAccessibleName(link).toLowerCase();
      
      if (genericTexts.includes(text)) {
        results.stats.elementsScanned++;
        
        // Check if there's additional context
        const ariaDescribedBy = link.getAttribute('aria-describedby');
        const hasContext = ariaDescribedBy && document.getElementById(ariaDescribedBy);
        
        if (!hasContext) {
          addIssue(
            'moderate',
            '2.4.4',
            'Link Purpose',
            'Link has generic text: "' + text + '"',
            link,
            'Use descriptive text like "Shop women\'s collection" or add aria-describedby for context',
            'Screen reader users navigating by links cannot determine destination'
          );
        }
      }
    });
  }

  /**
   * Test 7: Carousel ARIA Pattern
   * WCAG: 4.1.2
   */
  function testCarouselAriaPattern() {
    carousels.forEach(carousel => {
      results.stats.elementsScanned++;
      
      const role = carousel.getAttribute('role');
      const ariaLabel = carousel.getAttribute('aria-label');
      const ariaLabelledBy = carousel.getAttribute('aria-labelledby');
      const ariaRoledescription = carousel.getAttribute('aria-roledescription');
      
      // Check for carousel labeling
      if (!ariaLabel && !ariaLabelledBy) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Carousel has no accessible name',
          carousel,
          'Add aria-label="Featured products" or similar descriptive label',
          'Screen reader users not informed of carousel purpose'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Carousel has accessible name', getSelector(carousel));
      }
      
      // Check slides have proper structure
      const slides = carousel.querySelectorAll('[role="group"][aria-roledescription="slide"], [role="tabpanel"]');
      if (slides.length === 0) {
        addManualCheck(
          '4.1.2',
          'Consider adding role="group" and aria-roledescription="slide" to slides',
          'This helps screen reader users understand carousel structure',
          getSelector(carousel)
        );
      }
      
      // Check for aria-live on slide content (for auto-advancing)
      const liveRegion = carousel.querySelector('[aria-live]');
      if (!liveRegion) {
        addManualCheck(
          '4.1.3',
          'Verify slide changes are announced (if auto-rotating)',
          'For auto-advancing carousels, consider aria-live="polite" on slide content area',
          getSelector(carousel)
        );
      }
    });
  }

  /**
   * Test 8: Keyboard Navigation
   * WCAG: 2.1.1
   */
  function testKeyboardNavigation() {
    carousels.forEach(carousel => {
      addManualCheck(
        '2.1.1',
        'Test carousel keyboard navigation',
        'Tab to carousel controls. Use Enter/Space for buttons. Arrow keys may navigate slides.',
        getSelector(carousel)
      );
    });
    
    if (heroSection && carousels.length === 0) {
      addManualCheck(
        '2.1.1',
        'Verify all hero section interactions work with keyboard',
        'Tab through hero section and verify all CTAs and interactive elements are reachable',
        getSelector(heroSection)
      );
    }
  }

  /**
   * Test 9: Focus Indicators
   * WCAG: 2.4.7
   */
  function testFocusIndicators() {
    const container = heroSection || document;
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
        outlineNoneCount + ' hero elements have outline:none - verify alternative focus indicators',
        'Tab to each interactive element and confirm visible focus indicator appears',
        null
      );
    }
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================
  
  if (!heroSection && carousels.length === 0) {
    addManualCheck(
      '1.3.1',
      'No hero section or carousel detected',
      'If page has hero/banner/slideshow, verify it is properly marked up',
      null
    );
  } else {
    testAutoplayControl();
    testHiddenSlideFocus();
    testNavigationControls();
    testSlideImages();
    testVideoBackgrounds();
    testCTAButtons();
    testCarouselAriaPattern();
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
  window.runHeroAudit = runHeroAudit;
}
