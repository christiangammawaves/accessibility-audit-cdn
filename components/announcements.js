/**
 * Announcements Accessibility Audit
 * WCAG: 1.3.1, 1.4.1, 2.1.1, 2.2.1, 2.2.2, 4.1.2, 4.1.3
 */

function runAnnouncementsAudit() {
  'use strict';

  const startTime = performance.now();

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  const CONFIG = {
    scope: [
      // Announcement bar selectors
      '.announcement-bar',
      '.announcement-banner',
      '[class*="announcement"]',
      '.promo-bar',
      '.promo-banner',
      '[class*="promo-bar"]',
      '.top-bar',
      '.site-header__announcement',
      '.header-announcement',
      '[data-announcement]',
      '[data-announcement-bar]',
      // Shopify specific
      '.announcement',
      '#shopify-section-announcement-bar',
      '[id*="announcement"]',
      // Flash sale / urgency
      '[class*="flash-sale"]',
      '[class*="countdown"]',
      '.urgency-bar',
      '[class*="urgency"]',
      // Shipping banners
      '[class*="shipping-banner"]',
      '[class*="free-shipping"]',
      // Generic notification banners
      '.site-notice',
      '.site-banner',
      '[role="banner"]:not(header)',
      '[role="alert"]',
      '[role="status"]'
    ],
    dismissSelectors: [
      '[class*="close"]',
      '[class*="dismiss"]',
      '[aria-label*="close" i]',
      '[aria-label*="dismiss" i]',
      'button[class*="announcement"]',
      '.announcement-bar__close',
      '[data-close]',
      '[data-dismiss]'
    ],
    rotatingSelectors: [
      '.swiper',
      '.slick',
      '.flickity',
      '[class*="carousel"]',
      '[class*="slider"]',
      '[class*="rotating"]',
      '[data-autoplay]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('announcements', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  // ==========================================================================
  // FIND ANNOUNCEMENTS
  // ==========================================================================

  function findAnnouncements() {
    const announcements = new Set();

    function processElement(el) {
      if (isVisible(el)) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isRendered = style.display !== 'none' &&
                           style.visibility !== 'hidden' &&
                           style.opacity !== '0' &&
                           rect.width > 0 && rect.height > 0;
        if (isRendered) {
          announcements.add(el);
        }
      }
    }

    // Combine all selectors into one query for performance (27 → 1 DOM traversal)
    try {
      const combinedSelector = CONFIG.scope.join(', ');
      document.querySelectorAll(combinedSelector).forEach(processElement);
    } catch (e) {
      // If combined selector fails, fall back to individual queries
      CONFIG.scope.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(processElement);
        } catch (e2) {
          // Invalid selector, skip
        }
      });
    }
    
    // Pattern A fix: Remove nested elements (keep only top-level)
    const { deduplicateElements, isExposedToAT } = window.a11yHelpers;
    let arr = Array.from(announcements);
    if (deduplicateElements) {
      arr = deduplicateElements(arr);
    } else {
      arr = arr.filter(el => !arr.some(other => other !== el && other.contains(el)));
    }
    // Filter out page-level containers that aren't actual announcement bars
    arr = arr.filter(el => {
      const tag = el.tagName;
      // Never treat body, html, or main as an announcement
      if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN') return false;
      // Skip elements with too many direct children (likely a page wrapper, not a banner)
      if (el.children.length > 20) return false;
      return true;
    });
    // Pattern C fix: Skip elements hidden from assistive technology
    if (isExposedToAT) {
      arr = arr.filter(el => isExposedToAT(el));
    }
    return arr;
  }

  const announcements = findAnnouncements();
  
  if (announcements.length === 0) {
    results.manualChecks.push({
      wcag: '4.1.3',
      message: 'No announcement bars found on page',
      howToTest: 'If announcement bars exist, verify they are properly identified and accessible'
    });
    
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================
  
  /**
   * Test 1: Semantic Structure
   * WCAG: 1.3.1
   */
  function testSemanticStructure() {
    announcements.forEach(announcement => {
      results.stats.elementsScanned++;
      
      const role = announcement.getAttribute('role');
      const tagName = announcement.tagName.toLowerCase();
      
      // Check for appropriate role or landmark
      const hasAppropriateRole = ['region', 'complementary', 'alert', 'status', 'banner'].includes(role);
      const hasAriaLabel = announcement.getAttribute('aria-label') || announcement.getAttribute('aria-labelledby');
      
      // If using role="region", needs accessible name
      if (role === 'region' && !hasAriaLabel) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Announcement bar uses role="region" but lacks accessible name',
          announcement,
          'Add aria-label="Announcement" or aria-labelledby pointing to heading',
          'Screen reader users cannot identify the region purpose'
        );
      } else if (hasAppropriateRole && hasAriaLabel) {
        addPassed('1.3.1', 'Info and Relationships', 'Announcement has appropriate role and accessible name', getSelector(announcement));
      }
      
      // Check if important announcements use appropriate roles
      const text = announcement.textContent.toLowerCase();
      const isUrgent = text.includes('urgent') || text.includes('important') || text.includes('alert') || text.includes('warning');
      
      if (isUrgent && role !== 'alert' && role !== 'status') {
        addIssue(
          'moderate',
          '4.1.3',
          'Status Messages',
          'Urgent announcement should use role="alert" or aria-live',
          announcement,
          'Add role="alert" for urgent messages or role="status" with aria-live="polite" for less urgent updates',
          'Screen reader users may miss important announcements'
        );
      }
    });
  }

  /**
   * Test 2: Live Region for Dynamic Content
   * WCAG: 4.1.3
   */
  function testLiveRegion() {
    announcements.forEach(announcement => {
      results.stats.elementsScanned++;
      
      const role = announcement.getAttribute('role');
      const ariaLive = announcement.getAttribute('aria-live');
      const ariaAtomic = announcement.getAttribute('aria-atomic');
      
      // Check if this is a rotating/dynamic announcement
      let isRotating = false;
      CONFIG.rotatingSelectors.forEach(selector => {
        if (announcement.querySelector(selector) || announcement.matches(selector)) {
          isRotating = true;
        }
      });
      
      // Check for multiple slides/items
      const slides = announcement.querySelectorAll('[class*="slide"], [class*="item"], [data-slide]');
      if (slides.length > 1) {
        isRotating = true;
      }
      
      if (isRotating) {
        // Rotating announcements need live region
        const hasLiveRegion = role === 'alert' || role === 'status' || ariaLive;
        
        if (!hasLiveRegion) {
          addIssue(
            'serious',
            '4.1.3',
            'Status Messages',
            'Rotating announcement bar lacks live region',
            announcement,
            'Add aria-live="polite" to announce content changes to screen readers',
            'Screen reader users will not hear when announcement content changes'
          );
        } else {
          addPassed('4.1.3', 'Status Messages', 'Rotating announcement has live region', getSelector(announcement));
        }
        
        // Check atomic for partial updates
        if (ariaLive && !ariaAtomic) {
          addManualCheck(
            '4.1.3',
            'Consider adding aria-atomic="true" if entire announcement should be read',
            'If the full announcement should be read on each change, add aria-atomic="true"',
            getSelector(announcement)
          );
        }
      }
    });
  }

  /**
   * Test 3: Dismiss Button Accessibility
   * WCAG: 2.1.1, 4.1.2
   */
  function testDismissButton() {
    announcements.forEach(announcement => {
      results.stats.elementsScanned++;
      
      let dismissButton = null;
      
      // Find dismiss/close button
      for (const selector of CONFIG.dismissSelectors) {
        const btn = announcement.querySelector(selector);
        if (btn && isVisible(btn)) {
          dismissButton = btn;
          break;
        }
      }
      
      if (!dismissButton) {
        // Check for any button that might be a close button
        const buttons = announcement.querySelectorAll('button, [role="button"]');
        buttons.forEach(btn => {
          const text = btn.textContent.toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          if (text.includes('close') || text.includes('dismiss') ||
              ariaLabel.includes('close') || ariaLabel.includes('dismiss')) {
            dismissButton = btn;
          }
        });
      }
      
      if (dismissButton) {
        results.stats.elementsScanned++;
        
        const name = getAccessibleName(dismissButton);
        const isIconOnly = !dismissButton.textContent.trim() || dismissButton.textContent.trim() === '' || dismissButton.textContent.trim() === 'X';
        
        if (isIconOnly && !dismissButton.getAttribute('aria-label')) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Announcement dismiss button lacks accessible name',
            dismissButton,
            'Add aria-label="Dismiss announcement" or aria-label="Close"',
            'Screen reader users cannot determine button purpose'
          );
        } else if (name) {
          addPassed('4.1.2', 'Name, Role, Value', 'Dismiss button has accessible name: "' + name.slice(0, 30) + '"', getSelector(dismissButton));
        }
        
        // Check if button is keyboard accessible
        const tabindex = dismissButton.getAttribute('tabindex');
        if (tabindex === '-1') {
          addIssue(
            'critical',
            '2.1.1',
            'Keyboard',
            'Dismiss button has tabindex="-1" and is not keyboard accessible',
            dismissButton,
            'Remove tabindex="-1" or set to "0"',
            'Keyboard users cannot dismiss the announcement'
          );
        }
      }
      
      // Manual check for dismiss persistence
      if (dismissButton) {
        addManualCheck(
          '3.2.5',
          'Verify announcement dismissal persists appropriately',
          'Close the announcement, refresh the page, and verify it stays dismissed (typically via localStorage or cookie)',
          getSelector(announcement)
        );
      }
    });
  }

  /**
   * Test 4: Auto-Rotating Content Controls
   * WCAG: 2.2.1, 2.2.2
   */
  function testAutoRotation() {
    announcements.forEach(announcement => {
      // Check if this is a rotating announcement
      let isRotating = false;
      let carouselContainer = null;
      
      CONFIG.rotatingSelectors.forEach(selector => {
        const el = announcement.querySelector(selector);
        if (el) {
          isRotating = true;
          carouselContainer = el;
        }
        if (announcement.matches(selector)) {
          isRotating = true;
          carouselContainer = announcement;
        }
      });
      
      // Check for multiple slides
      const slides = announcement.querySelectorAll('[class*="slide"], [class*="item"], [data-slide]');
      if (slides.length > 1) {
        isRotating = true;
      }
      
      if (!isRotating) return;
      
      results.stats.elementsScanned++;
      
      // Look for pause/play controls
      const pauseButton = announcement.querySelector('[class*="pause"], [aria-label*="pause" i], [class*="play"], [aria-label*="play" i]');
      const navigationDots = announcement.querySelectorAll('[class*="dot"], [class*="pagination"], [class*="indicator"]');
      const prevNextButtons = announcement.querySelectorAll('[class*="prev"], [class*="next"], [class*="arrow"]');
      
      // Check for autoplay attribute
      const hasAutoplay = carouselContainer && (
        carouselContainer.getAttribute('data-autoplay') === 'true' ||
        carouselContainer.getAttribute('data-auto') === 'true' ||
        carouselContainer.classList.contains('autoplay')
      );
      
      if (hasAutoplay || slides.length > 1) {
        if (!pauseButton) {
          addIssue(
            'serious',
            '2.2.2',
            'Pause, Stop, Hide',
            'Auto-rotating announcement lacks pause control',
            announcement,
            'Add a pause/play button to allow users to stop automatic rotation',
            'Users with cognitive disabilities or who need more time cannot stop the movement'
          );
        } else {
          const pauseName = getAccessibleName(pauseButton);
          if (!pauseName) {
            addIssue(
              'moderate',
              '4.1.2',
              'Name, Role, Value',
              'Pause button lacks accessible name',
              pauseButton,
              'Add aria-label="Pause announcement rotation" or similar',
              'Screen reader users cannot identify the pause control'
            );
          } else {
            addPassed('2.2.2', 'Pause, Stop, Hide', 'Rotating announcement has pause control', getSelector(pauseButton));
          }
        }
        
        // Check navigation controls accessibility
        if (navigationDots.length > 0) {
          navigationDots.forEach((dot, index) => {
            const name = getAccessibleName(dot);
            if (!name) {
              addIssue(
                'moderate',
                '4.1.2',
                'Name, Role, Value',
                'Announcement slide indicator ' + (index + 1) + ' lacks accessible name',
                dot,
                'Add aria-label="Go to announcement ' + (index + 1) + '" or similar',
                'Screen reader users cannot navigate between announcements'
              );
            }
          });
        }
        
        // Manual check for timing
        addManualCheck(
          '2.2.1',
          'Verify auto-rotation timing is appropriate',
          'Confirm announcement rotates slowly enough to read (recommended: 5+ seconds). Check if rotation pauses on hover/focus.',
          getSelector(announcement)
        );
      }
    });
  }

  /**
   * Test 5: Color Contrast and Use of Color
   * WCAG: 1.4.1, 1.4.3
   */
  function testColorUsage() {
    announcements.forEach(announcement => {
      results.stats.elementsScanned++;
      
      // Check if announcement uses color alone to convey information
      const style = window.getComputedStyle(announcement);
      const bgColor = style.backgroundColor;
      const textColor = style.color;
      
      // Look for urgency indicators that might be color-only
      const text = announcement.textContent.toLowerCase();
      const isUrgent = text.includes('urgent') || text.includes('sale') || text.includes('limited') || text.includes('hurry');
      
      // Check for status/urgency styling without text
      const hasUrgentStyling = announcement.classList.contains('urgent') || 
                               announcement.classList.contains('alert') ||
                               announcement.classList.contains('warning');
      
      if (hasUrgentStyling && !isUrgent) {
        addIssue(
          'moderate',
          '1.4.1',
          'Use of Color',
          'Announcement may use color alone to indicate urgency',
          announcement,
          'Add text or icon with text alternative to convey urgency alongside color',
          'Users who cannot perceive color may miss important context'
        );
      }
      
      // Check links within announcement
      const links = announcement.querySelectorAll('a');
      links.forEach(link => {
        if (!isVisible(link)) return;
        
        const linkStyle = window.getComputedStyle(link);
        const isUnderlined = linkStyle.textDecoration.includes('underline');
        const hasDistinctStyle = link.querySelector('svg, img') || linkStyle.fontWeight >= 600;
        
        if (!isUnderlined && !hasDistinctStyle) {
          addIssue(
            'moderate',
            '1.4.1',
            'Use of Color',
            'Link in announcement may only be distinguished by color',
            link,
            'Add underline or other non-color visual indicator for links',
            'Users who cannot perceive color may not identify links'
          );
        }
      });
      
      // Manual check for contrast
      addManualCheck(
        '1.4.3',
        'Verify announcement text has 4.5:1 contrast ratio',
        'Check text color against background color meets WCAG AA contrast requirements',
        getSelector(announcement)
      );
    });
  }

  /**
   * Test 6: Link Accessibility
   * WCAG: 2.4.4
   */
  function testLinks() {
    announcements.forEach(announcement => {
      const links = announcement.querySelectorAll('a[href]');
      
      links.forEach(link => {
        if (!isVisible(link)) return;
        results.stats.elementsScanned++;
        
        const name = getAccessibleName(link);
        const href = link.getAttribute('href');
        
        if (!name) {
          addIssue(
            'serious',
            '2.4.4',
            'Link Purpose',
            'Announcement link has no accessible name',
            link,
            'Add descriptive link text or aria-label',
            'Screen reader users cannot determine link destination'
          );
        } else if (name.toLowerCase() === 'click here' || name.toLowerCase() === 'learn more' || name.toLowerCase() === 'shop now') {
          // Generic link text - check if context makes it clear
          addManualCheck(
            '2.4.4',
            'Verify link purpose is clear from context: "' + name + '"',
            'Ensure surrounding text or aria-label makes the link destination clear',
            getSelector(link)
          );
        } else {
          addPassed('2.4.4', 'Link Purpose', 'Link has descriptive name: "' + name.slice(0, 40) + '"', getSelector(link));
        }
        
        // Check for new window
        const target = link.getAttribute('target');
        if (target === '_blank') {
          const warnsNewWindow = name.toLowerCase().includes('new window') || 
                                  name.toLowerCase().includes('new tab') ||
                                  link.querySelector('[class*="external"]') ||
                                  link.getAttribute('aria-label')?.toLowerCase().includes('new');
          
          if (!warnsNewWindow) {
            addIssue(
              'minor',
              '3.2.5',
              'Change on Request',
              'Link opens in new window without warning',
              link,
              'Add "(opens in new window)" to link text or aria-label',
              'Users may be disoriented by unexpected new window'
            );
          }
        }
      });
    });
  }

  /**
   * Test 7: Keyboard Navigation
   * WCAG: 2.1.1, 2.4.3
   */
  function testKeyboardNavigation() {
    announcements.forEach(announcement => {
      const focusable = getFocusableElements(announcement);
      results.stats.elementsScanned += focusable.length;
      
      // Check for positive tabindex (anti-pattern)
      focusable.forEach(el => {
        const tabindex = el.getAttribute('tabindex');
        if (tabindex && parseInt(tabindex) > 0) {
          addIssue(
            'moderate',
            '2.4.3',
            'Focus Order',
            'Element has positive tabindex which disrupts natural focus order',
            el,
            'Remove positive tabindex or set to 0',
            'Keyboard users may experience unexpected focus order'
          );
        }
      });
      
      // Check focus indicators
      focusable.forEach(el => {
        const style = window.getComputedStyle(el);
        const outline = style.outline;
        const outlineStyle = style.outlineStyle;
        
        if (outline === 'none' || outline === '0' || outlineStyle === 'none') {
          addManualCheck(
            '2.4.7',
            'Verify focus indicator on: ' + getSelector(el),
            'Tab to this element and confirm a visible focus indicator appears',
            getSelector(el)
          );
        }
      });
    });
    
    // General keyboard testing
    addManualCheck(
      '2.1.1',
      'Verify all announcement interactive elements work with keyboard',
      'Tab through announcements, use Enter/Space to activate links/buttons, verify dismiss works with keyboard'
    );
  }

  /**
   * Test 8: Countdown Timer Accessibility (if present)
   * WCAG: 1.3.1, 4.1.3
   */
  function testCountdownTimers() {
    announcements.forEach(announcement => {
      const countdownSelectors = [
        '[class*="countdown"]',
        '[class*="timer"]',
        '[data-countdown]',
        '[data-timer]'
      ];
      
      let countdown = null;
      for (const selector of countdownSelectors) {
        const el = announcement.querySelector(selector);
        if (el && isVisible(el)) {
          countdown = el;
          break;
        }
      }
      
      if (!countdown) return;
      
      results.stats.elementsScanned++;
      
      // Check for accessible time format
      const ariaLabel = countdown.getAttribute('aria-label');
      const ariaLive = countdown.getAttribute('aria-live');
      const role = countdown.getAttribute('role');
      
      // Look for time segments
      const segments = countdown.querySelectorAll('[class*="hour"], [class*="minute"], [class*="second"], [class*="day"]');
      
      if (segments.length > 0) {
        // Has visual segments - check for screen reader text
        const srText = countdown.querySelector('.sr-only, .visually-hidden, [class*="screen-reader"]');
        
        if (!srText && !ariaLabel) {
          addIssue(
            'serious',
            '1.3.1',
            'Info and Relationships',
            'Countdown timer lacks accessible time format',
            countdown,
            'Add aria-label with full time description (e.g., "Sale ends in 2 days, 5 hours, 30 minutes") or hidden text for screen readers',
            'Screen reader users may hear fragmented numbers without context'
          );
        }
      }
      
      // Check for live updates
      if (!ariaLive && role !== 'timer') {
        addManualCheck(
          '4.1.3',
          'Consider if countdown updates should be announced',
          'For important countdowns, consider using aria-live="polite" with aria-atomic="true" to announce periodic updates (not every second)',
          getSelector(countdown)
        );
      }
      
      // Check for role="timer"
      if (role === 'timer') {
        addPassed('1.3.1', 'Info and Relationships', 'Countdown uses role="timer"', getSelector(countdown));
      }
    });
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================
  
  testSemanticStructure();
  testLiveRegion();
  testDismissButton();
  testAutoRotation();
  testColorUsage();
  testLinks();
  testKeyboardNavigation();
  testCountdownTimers();

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
  window.runAnnouncementsAudit = runAnnouncementsAudit;
}
