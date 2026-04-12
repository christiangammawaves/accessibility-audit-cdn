/**
 * Footer Accessibility Audit
 * WCAG: 1.1.1, 1.3.1, 2.1.1, 2.4.4, 3.3.2, 4.1.2
 */

function runFooterAudit() {
  'use strict';

  const startTime = performance.now();

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  const CONFIG = {
    scope: [
      'footer',
      '[role="contentinfo"]',
      '.footer',
      '#footer',
      '#shopify-section-footer',
      '[class*="site-footer"]'
    ],
    accordionSelectors: [
      '[class*="accordion"]',
      '[class*="collapsible"]',
      'details',
      '[data-accordion]',
      '[aria-expanded]'
    ],
    socialLinkSelectors: [
      '[class*="social"]',
      'a[href*="facebook"]',
      'a[href*="twitter"]',
      'a[href*="instagram"]',
      'a[href*="youtube"]',
      'a[href*="pinterest"]',
      'a[href*="tiktok"]',
      'a[href*="linkedin"]',
      'a[href*="snapchat"]'
    ],
    newsletterSelectors: [
      '[class*="newsletter"]',
      '[class*="subscribe"]',
      'form[action*="subscribe"]',
      'form[action*="newsletter"]',
      '[class*="email-signup"]',
      '#email_signup'
    ],
    paymentIconSelectors: [
      '[class*="payment"]',
      '[class*="payment-icon"]',
      'img[alt*="visa" i]',
      'img[alt*="mastercard" i]',
      'img[alt*="amex" i]',
      'img[alt*="paypal" i]',
      'svg[class*="payment"]'
    ],
    legalLinkSelectors: [
      'a[href*="privacy"]',
      'a[href*="terms"]',
      'a[href*="policy"]',
      'a[href*="legal"]',
      'a[href*="accessibility"]',
      'a[href*="cookie"]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('footer', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  // ==========================================================================
  // FIND FOOTER
  // ==========================================================================

  function findFooter() {
    for (const selector of CONFIG.scope) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  const footerEl = findFooter();

  if (!footerEl) {
    results.manualChecks.push({
      wcag: '1.3.1',
      message: 'Footer element not found on page',
      howToTest: 'Verify if footer exists and is correctly marked up with <footer> or role="contentinfo"'
    });
    
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================
  
  /**
   * Test 1: Footer Landmark
   * WCAG: 1.3.1
   */
  function testFooterLandmark() {
    results.stats.elementsScanned++;
    
    const isFooterElement = footerEl.tagName.toLowerCase() === 'footer';
    const hasContentInfoRole = footerEl.getAttribute('role') === 'contentinfo';
    
    if (!isFooterElement && !hasContentInfoRole) {
      addIssue(
        'serious',
        '1.3.1',
        'Info and Relationships',
        'Footer not using semantic <footer> or role="contentinfo"',
        footerEl,
        'Use <footer> element or add role="contentinfo"',
        'Screen reader users cannot quickly navigate to footer'
      );
    } else {
      addPassed('1.3.1', 'Info and Relationships', 'Footer landmark present', getSelector(footerEl));
    }
    
    const allFooters = document.querySelectorAll('footer, [role="contentinfo"]');
    if (allFooters.length > 1) {
      let unlabeledCount = 0;
      allFooters.forEach(f => {
        if (!f.getAttribute('aria-label') && !f.getAttribute('aria-labelledby')) {
          unlabeledCount++;
        }
      });
      
      if (unlabeledCount > 1) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Multiple footer landmarks without unique labels',
          footerEl,
          'Add aria-label to distinguish footers, e.g., "Site footer", "Article footer"',
          'Screen reader users cannot distinguish between footers'
        );
      }
    }
  }

  /**
   * Test 2: Heading Hierarchy
   * WCAG: 1.3.1
   */
  function testHeadingHierarchy() {
    const headings = footerEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    if (headings.length === 0) {
      addManualCheck(
        '1.3.1',
        'Footer has no headings',
        'Consider if footer sections should have headings for better navigation',
        getSelector(footerEl)
      );
      return;
    }
    
    results.stats.elementsScanned += headings.length;
    
    let prevLevel = 0;
    let hasSkip = false;
    
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      
      if (prevLevel > 0 && level > prevLevel + 1) {
        hasSkip = true;
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Heading level skipped: h' + prevLevel + ' to h' + level,
          heading,
          'Use sequential heading levels (h2  h3  h4)',
          'Screen reader users may be confused by heading hierarchy'
        );
      }
      
      prevLevel = level;
    });
    
    if (!hasSkip && headings.length > 0) {
      addPassed('1.3.1', 'Info and Relationships', 'Footer headings follow proper hierarchy', 'footer headings');
    }
    
    const h1InFooter = footerEl.querySelector('h1');
    if (h1InFooter) {
      addIssue(
        'minor',
        '1.3.1',
        'Info and Relationships',
        'H1 heading found in footer',
        h1InFooter,
        'Footer sections typically use h2-h4; H1 should be for main page heading',
        'May confuse document structure'
      );
    }
  }

  /**
   * Test 3: Footer Accordions (Mobile)
   * WCAG: 4.1.2, 2.1.1
   */
  function testFooterAccordions() {
    const accordions = [];
    
    CONFIG.accordionSelectors.forEach(selector => {
      footerEl.querySelectorAll(selector).forEach(el => {
        if (!accordions.includes(el)) accordions.push(el);
      });
    });
    
    accordions.forEach(accordion => {
      results.stats.elementsScanned++;
      
      if (accordion.tagName === 'DETAILS') {
        const summary = accordion.querySelector('summary');
        if (!summary) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            '<details> element missing <summary>',
            accordion,
            'Add <summary> with descriptive label',
            'Users cannot interact with this element'
          );
        } else {
          addPassed('4.1.2', 'Name, Role, Value', 'Native details/summary accordion', getSelector(accordion));
        }
        return;
      }
      
      const trigger = accordion.querySelector('button, [role="button"], [aria-expanded]');
      
      if (trigger) {
        const ariaExpanded = trigger.getAttribute('aria-expanded');
        const isButton = trigger.tagName === 'BUTTON' || trigger.getAttribute('role') === 'button';
        
        if (!ariaExpanded) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Footer accordion trigger missing aria-expanded',
            trigger,
            'Add aria-expanded="false" that toggles to "true" when open',
            'Screen reader users not informed of expanded/collapsed state'
          );
        } else {
          addPassed('4.1.2', 'Name, Role, Value', 'Accordion trigger has aria-expanded', getSelector(trigger));
        }
        
        if (!isButton) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Footer accordion trigger is not a button',
            trigger,
            'Use <button> element or add role="button"',
            'May not be announced as interactive'
          );
        }
        
        const name = getAccessibleName(trigger);
        if (!name) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Footer accordion trigger has no accessible name',
            trigger,
            'Add visible text or aria-label',
            'Screen reader users cannot identify section'
          );
        }
      }
    });
    
    if (accordions.length > 0) {
      addManualCheck(
        '2.1.1',
        'Verify footer accordions work with keyboard',
        'Tab to triggers, use Enter/Space to expand/collapse (test on mobile viewport)',
        null
      );
    }
  }

  /**
   * Test 4: Social Media Links
   * WCAG: 2.4.4, 1.1.1
   */
  function testSocialLinks() {
    const socialLinks = [];
    
    CONFIG.socialLinkSelectors.forEach(selector => {
      footerEl.querySelectorAll(selector).forEach(el => {
        if (el.tagName === 'A' && isVisible(el) && !socialLinks.includes(el)) {
          socialLinks.push(el);
        }
      });
    });
    
    footerEl.querySelectorAll('a').forEach(link => {
      const href = link.getAttribute('href') || '';
      const socialPlatforms = ['facebook', 'twitter', 'instagram', 'youtube', 'pinterest', 'tiktok', 'linkedin', 'snapchat', 'x.com'];
      
      if (socialPlatforms.some(platform => href.toLowerCase().includes(platform)) && !socialLinks.includes(link)) {
        socialLinks.push(link);
      }
    });
    
    socialLinks.forEach(link => {
      if (!isVisible(link)) return;
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(link);
      const text = link.textContent.trim();
      const hasIcon = link.querySelector('svg, i, [class*="icon"]');
      const href = link.getAttribute('href') || '';
      
      let platform = 'social media';
      const platforms = {
        'facebook': 'Facebook',
        'twitter': 'Twitter',
        'x.com': 'X (Twitter)',
        'instagram': 'Instagram',
        'youtube': 'YouTube',
        'pinterest': 'Pinterest',
        'tiktok': 'TikTok',
        'linkedin': 'LinkedIn',
        'snapchat': 'Snapchat'
      };
      
      Object.entries(platforms).forEach(([key, value]) => {
        if (href.toLowerCase().includes(key)) platform = value;
      });
      
      if (!name || name.length < 2) {
        addIssue(
          'serious',
          '2.4.4',
          'Link Purpose',
          'Social media link has no accessible name' + (hasIcon ? ' (icon only)' : ''),
          link,
          'Add aria-label="' + platform + '" or visually hidden text',
          'Screen reader users cannot identify social media destination'
        );
      } else if (hasIcon && !text) {
        if (!name.toLowerCase().includes('facebook') && 
            !name.toLowerCase().includes('twitter') && 
            !name.toLowerCase().includes('instagram') &&
            !name.toLowerCase().includes('youtube') &&
            !name.toLowerCase().includes('x ') &&
            !name.toLowerCase().includes('linkedin') &&
            !name.toLowerCase().includes('pinterest') &&
            !name.toLowerCase().includes('tiktok') &&
            !name.toLowerCase().includes('snapchat')) {
          addIssue(
            'moderate',
            '2.4.4',
            'Link Purpose',
            'Social link name may not indicate platform: "' + name.slice(0, 30) + '"',
            link,
            'Include platform name in aria-label, e.g., "Follow us on ' + platform + '"',
            'Screen reader users may not know which platform link leads to'
          );
        } else {
          addPassed('2.4.4', 'Link Purpose', 'Social link has platform name: "' + name.slice(0, 30) + '"', getSelector(link));
        }
      } else {
        addPassed('2.4.4', 'Link Purpose', 'Social link has accessible name', getSelector(link));
      }
      
      const target = link.getAttribute('target');
      const hasNewWindowIndicator = name.toLowerCase().includes('new window') || 
                                    name.toLowerCase().includes('new tab') ||
                                    link.querySelector('[class*="external"]');
      
      if (target === '_blank' && !hasNewWindowIndicator) {
        addIssue(
          'minor',
          '2.4.4',
          'Link Purpose',
          'Social link opens in new window without warning',
          link,
          'Add "(opens in new window)" to accessible name or use icon with sr-only text',
          'Users may be disoriented by unexpected new window'
        );
      }
    });
  }

  /**
   * Test 5: Newsletter Form
   * WCAG: 3.3.2, 4.1.2
   */
  function testNewsletterForm() {
    let newsletterForm = null;
    
    CONFIG.newsletterSelectors.forEach(selector => {
      const el = footerEl.querySelector(selector);
      if (el && isVisible(el)) newsletterForm = el.tagName === 'FORM' ? el : el.querySelector('form') || el;
    });
    
    if (!newsletterForm) {
      return;
    }
    
    results.stats.elementsScanned++;
    
    const emailInput = newsletterForm.querySelector('input[type="email"], input[name*="email"], input[placeholder*="email" i]');
    
    if (emailInput) {
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(emailInput);
      
      if (!name) {
        const placeholder = emailInput.getAttribute('placeholder');
        if (placeholder) {
          addIssue(
            'moderate',
            '3.3.2',
            'Labels or Instructions',
            'Newsletter email input uses placeholder as label',
            emailInput,
            'Add visible <label> or aria-label in addition to placeholder',
            'Placeholder disappears when typing, making it hard to remember field purpose'
          );
        } else {
          addIssue(
            'serious',
            '3.3.2',
            'Labels or Instructions',
            'Newsletter email input has no label',
            emailInput,
            'Add associated <label> or aria-label="Email address"',
            'Screen reader users cannot identify input purpose'
          );
        }
      } else {
        addPassed('3.3.2', 'Labels or Instructions', 'Newsletter email input has label', getSelector(emailInput));
      }
      
      const autocomplete = emailInput.getAttribute('autocomplete');
      if (autocomplete !== 'email') {
        addIssue(
          'minor',
          '1.3.5',
          'Identify Input Purpose',
          'Newsletter email input missing autocomplete="email"',
          emailInput,
          'Add autocomplete="email" for better autofill support',
          'Users may need to type email manually instead of autofill'
        );
      } else {
        addPassed('1.3.5', 'Identify Input Purpose', 'Email input has autocomplete="email"', getSelector(emailInput));
      }
    }
    
    const submitBtn = newsletterForm.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    
    if (submitBtn) {
      results.stats.elementsScanned++;
      
      const btnName = getAccessibleName(submitBtn);
      
      if (!btnName || btnName.length < 2) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Newsletter submit button has no accessible name',
          submitBtn,
          'Add visible text like "Subscribe" or aria-label',
          'Screen reader users cannot identify button purpose'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Newsletter submit button has name: "' + btnName.slice(0, 30) + '"', getSelector(submitBtn));
      }
    }
    
    addManualCheck(
      '3.3.1',
      'Verify newsletter form has error handling',
      'Submit empty or invalid email and verify error is announced to screen readers',
      getSelector(newsletterForm)
    );
  }

  /**
   * Test 6: Legal Links
   * WCAG: 2.4.4
   */
  function testLegalLinks() {
    const legalLinks = [];
    
    CONFIG.legalLinkSelectors.forEach(selector => {
      footerEl.querySelectorAll(selector).forEach(link => {
        if (isVisible(link) && !legalLinks.includes(link)) legalLinks.push(link);
      });
    });
    
    legalLinks.forEach(link => {
      results.stats.elementsScanned++;
      
      const name = getAccessibleName(link);
      
      if (!name || name.length < 3) {
        addIssue(
          'serious',
          '2.4.4',
          'Link Purpose',
          'Legal link has no accessible name',
          link,
          'Add visible text describing the link destination',
          'Screen reader users cannot identify legal page links'
        );
      } else {
        addPassed('2.4.4', 'Link Purpose', 'Legal link has name: "' + name.slice(0, 30) + '"', getSelector(link));
      }
    });
  }

  /**
   * Test 7: Payment Icons
   * WCAG: 1.1.1
   */
  function testPaymentIcons() {
    const paymentContainer = footerEl.querySelector('[class*="payment"]');
    
    if (!paymentContainer) return;
    
    results.stats.elementsScanned++;
    
    const paymentImages = paymentContainer.querySelectorAll('img');
    const paymentSvgs = paymentContainer.querySelectorAll('svg');
    
    const containerAriaHidden = paymentContainer.getAttribute('aria-hidden') === 'true';
    const containerRole = paymentContainer.getAttribute('role');
    
    if (containerAriaHidden || containerRole === 'presentation') {
      const srText = footerEl.querySelector('.sr-only, .visually-hidden');
      const hasSrPaymentText = srText && (srText.textContent.toLowerCase().includes('payment') || 
                                          srText.textContent.toLowerCase().includes('accept'));
      
      if (!hasSrPaymentText) {
        addManualCheck(
          '1.1.1',
          'Verify payment icons are intentionally decorative',
          'If users need to know accepted payment methods, add screen reader text listing them',
          getSelector(paymentContainer)
        );
      } else {
        addPassed('1.1.1', 'Non-text Content', 'Payment icons are decorative with SR alternative', getSelector(paymentContainer));
      }
      return;
    }
    
    paymentImages.forEach(img => {
      if (!isVisible(img)) return;
      results.stats.elementsScanned++;
      
      const alt = img.getAttribute('alt');
      const isDecorative = img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true';
      
      if (alt === null && !isDecorative) {
        addIssue(
          'moderate',
          '1.1.1',
          'Non-text Content',
          'Payment icon image missing alt attribute',
          img,
          'Add alt="Visa" or alt="" if decorative (with accessible alternative elsewhere)',
          'Screen reader users cannot identify accepted payment methods'
        );
      } else if (alt === '') {
        addManualCheck(
          '1.1.1',
          'Verify payment method is communicated elsewhere',
          'If icon has empty alt, ensure payment type is listed in accessible text',
          getSelector(img)
        );
      } else if (alt) {
        addPassed('1.1.1', 'Non-text Content', 'Payment icon has alt: "' + alt + '"', getSelector(img));
      }
    });
    
    paymentSvgs.forEach(svg => {
      if (!isVisible(svg)) return;
      results.stats.elementsScanned++;
      
      const title = svg.querySelector('title');
      const ariaLabel = svg.getAttribute('aria-label');
      const ariaHidden = svg.getAttribute('aria-hidden') === 'true';
      const role = svg.getAttribute('role');
      
      if (!title && !ariaLabel && !ariaHidden && role !== 'presentation') {
        addIssue(
          'moderate',
          '1.1.1',
          'Non-text Content',
          'Payment SVG icon has no accessible name',
          svg,
          'Add <title> inside SVG, aria-label, or mark as aria-hidden="true" if decorative',
          'Screen reader users cannot identify payment method'
        );
      } else if (title || ariaLabel) {
        addPassed('1.1.1', 'Non-text Content', 'Payment SVG has accessible name', getSelector(svg));
      }
    });
  }

  /**
   * Test 8: Footer Navigation Landmark
   * WCAG: 1.3.1
   */
  function testFooterNavigation() {
    const footerNav = footerEl.querySelector('nav, [role="navigation"]');
    
    if (footerNav) {
      results.stats.elementsScanned++;
      
      const navLabel = getAccessibleName(footerNav);
      const mainNav = document.querySelector('header nav, header [role="navigation"]');
      
      if (mainNav && !navLabel) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Footer navigation has no label to distinguish from main navigation',
          footerNav,
          'Add aria-label="Footer navigation" or similar',
          'Screen reader users cannot distinguish between navigations'
        );
      } else if (navLabel) {
        addPassed('1.3.1', 'Info and Relationships', 'Footer navigation has label: "' + navLabel.slice(0, 30) + '"', getSelector(footerNav));
      }
    }
    
    const footerLinks = footerEl.querySelectorAll('a[href]');
    let emptyLinkCount = 0;
    
    footerLinks.forEach(link => {
      if (!isVisible(link)) return;
      
      const name = getAccessibleName(link);
      if (!name || name.length < 2) emptyLinkCount++;
    });
    
    if (emptyLinkCount > 0) {
      addIssue(
        'serious',
        '2.4.4',
        'Link Purpose',
        emptyLinkCount + ' footer links have no accessible name',
        footerEl,
        'Ensure all links have descriptive text or aria-label',
        'Screen reader users cannot identify link destinations'
      );
    }
  }

  /**
   * Test 9: Keyboard Navigation
   * WCAG: 2.1.1, 2.4.3
   */
  function testKeyboardNavigation() {
    const focusable = getFocusableElements(footerEl);
    
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
      'Verify all footer interactions work with keyboard',
      'Tab through footer links, accordions, forms - all should be reachable and operable',
      getSelector(footerEl)
    );
  }

  /**
   * Test 10: Focus Indicators
   * WCAG: 2.4.7
   */
  function testFocusIndicators() {
    const focusable = getFocusableElements(footerEl);
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
        outlineNoneCount + ' footer elements have outline:none - verify alternative focus indicators',
        'Tab through footer and verify visible focus indicator on each interactive element',
        null
      );
    }
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================
  
  testFooterLandmark();
  testHeadingHierarchy();
  testFooterAccordions();
  testSocialLinks();
  testNewsletterForm();
  testLegalLinks();
  testPaymentIcons();
  testFooterNavigation();
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
  window.runFooterAudit = runFooterAudit;
}
