/**
 * Newsletter Popups Accessibility Audit
 * WCAG: 2.1.2, 2.2.1, 2.2.4, 2.4.3, 4.1.2
 */

function runNewsletterPopupsAudit() {
  'use strict';

  const startTime = performance.now();

  const CONFIG = {
    popupSelectors: [
      // Newsletter/email specific
      '[class*="newsletter-popup"]',
      '[class*="newsletter-modal"]',
      '[class*="email-popup"]',
      '[class*="signup-popup"]',
      '[class*="subscribe-popup"]',
      '[class*="subscribe-modal"]',
      '[id*="newsletter"]',
      '[id*="popup"]',
      // Klaviyo specific
      '[class*="klaviyo"]',
      '.klaviyo-form',
      '[data-klaviyo-form]',
      // Exit intent
      '[class*="exit-intent"]',
      '[class*="exit-popup"]',
      '[class*="leaving"]',
      // Promotional
      '[class*="promo-popup"]',
      '[class*="promotional"]',
      '[class*="offer-popup"]',
      '[class*="discount-popup"]',
      // Cookie consent (distinct from modals.js cookie testing)
      '[class*="cookie-popup"]',
      '#onetrust-banner-sdk',
      '.cc-window',
      '[class*="gdpr-popup"]',
      // Generic overlays that look like popups
      '[class*="overlay"][class*="popup"]',
      '[class*="lightbox"][class*="email"]'
    ],
    closeButtonSelectors: [
      'button[aria-label*="close" i]',
      'button[aria-label*="dismiss" i]',
      '[class*="close"]',
      '[class*="dismiss"]',
      '[data-dismiss]',
      '[data-close]',
      'button[class*="x"]',
      '.popup-close',
      '.modal-close'
    ],
    formSelectors: [
      'input[type="email"]',
      'input[name*="email"]',
      'input[placeholder*="email" i]',
      'form[class*="newsletter"]',
      'form[class*="signup"]',
      'form[class*="subscribe"]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('newsletter-popups', 'Newsletter popups, exit-intent modals, promotional overlays');
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  function identifyPopupType(popup) {
    const classes = (popup.className || '').toLowerCase();
    const id = (popup.id || '').toLowerCase();
    const text = popup.textContent.toLowerCase().slice(0, 500);
    
    if (classes.includes('cookie') || classes.includes('gdpr') || classes.includes('consent') || text.includes('cookie')) {
      return 'cookie-consent';
    }
    if (classes.includes('exit') || classes.includes('leaving')) {
      return 'exit-intent';
    }
    if (classes.includes('newsletter') || classes.includes('subscribe') || classes.includes('signup') || 
        text.includes('subscribe') || text.includes('newsletter') || text.includes('email list')) {
      return 'newsletter';
    }
    if (classes.includes('promo') || classes.includes('offer') || classes.includes('discount') ||
        text.includes('% off') || text.includes('discount') || text.includes('coupon')) {
      return 'promotional';
    }
    if (classes.includes('klaviyo')) {
      return 'klaviyo-form';
    }
    return 'generic-popup';
  }

  // ==========================================================================
  // FIND POPUPS
  // ==========================================================================

  function findAllPopups() {
    const popups = new Set();
    CONFIG.popupSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => popups.add(el));
      } catch (e) { /* Invalid selector */ }
    });
    return Array.from(popups);
  }

  const allPopups = findAllPopups();
  const visiblePopups = allPopups.filter(isVisible);

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================

  function testDialogSemantics(popup, popupType) {
    results.stats.elementsScanned++;
    
    const role = popup.getAttribute('role');
    const ariaModal = popup.getAttribute('aria-modal');
    const isNativeDialog = popup.tagName.toLowerCase() === 'dialog';
    
    // Test 1: Dialog role
    if (!isNativeDialog && role !== 'dialog' && role !== 'alertdialog') {
      addIssue('critical', '4.1.2', 'Name, Role, Value',
        `Popup (${popupType}) missing role="dialog"`,
        popup,
        'Add role="dialog" to popup container',
        'Screen reader users not informed this is a modal dialog');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Popup has dialog role', getSelector(popup));
    }
    
    // Test 2: aria-modal
    if (!isNativeDialog && ariaModal !== 'true') {
      addIssue('serious', '4.1.2', 'Name, Role, Value',
        `Popup (${popupType}) missing aria-modal="true"`,
        popup,
        'Add aria-modal="true" to trap focus',
        'Screen reader may allow focus to escape popup');
    } else if (ariaModal === 'true' || isNativeDialog) {
      addPassed('4.1.2', 'Name, Role, Value', 'Popup has aria-modal', getSelector(popup));
    }
    
    // Test 3: Accessible name
    const name = getAccessibleName(popup);
    if (!name) {
      addIssue('serious', '4.1.2', 'Name, Role, Value',
        `Popup (${popupType}) has no accessible name`,
        popup,
        'Add aria-label or aria-labelledby to describe popup purpose',
        'Screen reader users cannot identify popup content');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', `Popup has name: "${name.slice(0, 40)}"`, getSelector(popup));
    }
  }

  function testCloseButton(popup, popupType) {
    // Find close button
    let closeBtn = null;
    for (const selector of CONFIG.closeButtonSelectors) {
      closeBtn = popup.querySelector(selector);
      if (closeBtn) break;
    }
    
    if (!closeBtn) {
      addIssue('critical', '2.1.1', 'Keyboard',
        `Popup (${popupType}) has no close button`,
        popup,
        'Add a visible close button with accessible name',
        'Users cannot dismiss the popup');
    } else {
      results.stats.elementsScanned++;
      
      const closeName = getAccessibleName(closeBtn);
      if (!closeName) {
        addIssue('serious', '4.1.2', 'Name, Role, Value',
          'Close button has no accessible name',
          closeBtn,
          'Add aria-label="Close" or visible text',
          'Screen reader users cannot identify close button');
      } else if (closeName.toLowerCase() === 'x' || closeName.length < 3) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value',
          `Close button has insufficient name: "${closeName}"`,
          closeBtn,
          'Use descriptive label like "Close popup" or "Dismiss"',
          'Screen reader users may not understand button purpose');
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Close button has accessible name', getSelector(closeBtn));
      }
      
      // Check if button is actually focusable
      const tabindex = closeBtn.getAttribute('tabindex');
      if (tabindex === '-1') {
        addIssue('critical', '2.1.1', 'Keyboard',
          'Close button not keyboard accessible',
          closeBtn,
          'Remove tabindex="-1" from close button',
          'Keyboard users cannot close popup');
      }
    }
    
    // Manual check for Escape key
    addManualCheck('2.1.1', `Verify Escape key closes ${popupType}`,
      'With popup open, press Escape - popup should close',
      getSelector(popup));
  }

  function testFocusManagement(popup, popupType) {
    const focusable = getFocusableElements(popup);
    
    // Test: Has focusable elements
    if (focusable.length === 0) {
      addIssue('critical', '2.4.3', 'Focus Order',
        `Popup (${popupType}) has no focusable elements`,
        popup,
        'Ensure popup has at least close button and form inputs',
        'Keyboard users cannot interact with popup');
    }
    
    // Test: Background hidden
    if (isVisible(popup)) {
      const mainContent = document.querySelector('main, [role="main"], #main, #MainContent');
      if (mainContent && !mainContent.contains(popup)) {
        const mainHidden = mainContent.getAttribute('aria-hidden') === 'true' || mainContent.hasAttribute('inert');
        if (!mainHidden) {
          addIssue('serious', '2.1.2', 'No Keyboard Trap',
            'Background not hidden while popup is visible',
            mainContent,
            'Add aria-hidden="true" or inert to main content',
            'Focus may escape popup to background');
        }
      }
    }
    
    // Manual checks for focus
    addManualCheck('2.4.3', `Verify focus moves into ${popupType} on open`,
      'When popup appears, focus should move to first focusable element (usually close button or email input)',
      getSelector(popup));
    
    addManualCheck('2.1.2', `Verify focus is trapped in ${popupType}`,
      'Tab through popup - focus should cycle within popup only',
      getSelector(popup));
    
    addManualCheck('2.4.3', 'Verify focus returns to trigger after closing',
      'Close popup - focus should return to element that triggered it (or logical position if auto-popup)',
      getSelector(popup));
  }

  function testFormAccessibility(popup, popupType) {
    const emailInputs = popup.querySelectorAll('input[type="email"], input[name*="email"], input[placeholder*="email" i]');
    const forms = popup.querySelectorAll('form');
    
    emailInputs.forEach(input => {
      results.stats.elementsScanned++;
      
      // Test: Label
      const inputId = input.id;
      const label = inputId ? document.querySelector(`label[for="${inputId}"]`) : null;
      const ariaLabel = input.getAttribute('aria-label');
      const placeholder = input.getAttribute('placeholder');
      
      if (!label && !ariaLabel) {
        if (placeholder) {
          addIssue('serious', '3.3.2', 'Labels or Instructions',
            'Email input uses placeholder as only label',
            input,
            'Add visible <label> or aria-label - placeholder disappears on input',
            'Users lose context of what field is for');
        } else {
          addIssue('critical', '3.3.2', 'Labels or Instructions',
            'Email input has no label',
            input,
            'Add <label for="input-id"> or aria-label',
            'Screen reader users cannot identify input purpose');
        }
      } else {
        addPassed('3.3.2', 'Labels or Instructions', 'Email input has label', getSelector(input));
      }
      
      // Test: autocomplete
      const autocomplete = input.getAttribute('autocomplete');
      if (autocomplete !== 'email') {
        addIssue('moderate', '1.3.5', 'Identify Input Purpose',
          'Email input missing autocomplete="email"',
          input,
          'Add autocomplete="email" for autofill support',
          'Users cannot use browser autofill');
      }
    });
    
    forms.forEach(form => {
      results.stats.elementsScanned++;
      
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
      if (submitBtn) {
        const submitName = getAccessibleName(submitBtn);
        if (!submitName || submitName.toLowerCase() === 'submit') {
          addIssue('minor', '4.1.2', 'Name, Role, Value',
            'Submit button has generic or no label',
            submitBtn,
            'Use descriptive label like "Subscribe" or "Sign Up"',
            'Users may not understand button action');
        }
      }
    });
  }

  function testTimingAndInterruption(popup, popupType) {
    // Check for timing-related attributes
    const hasTimer = popup.querySelector('[class*="timer"]') || 
                     popup.querySelector('[class*="countdown"]') ||
                     popup.textContent.match(/\d+:\d+|expires|hurry|limited time/i);
    
    if (hasTimer) {
      addManualCheck('2.2.1', `Verify timed ${popupType} can be extended`,
        'If popup has countdown, check if user can extend or disable time limit',
        getSelector(popup));
    }
    
    // General interruption check
    if (popupType === 'exit-intent' || popupType === 'promotional') {
      addManualCheck('2.2.4', `Verify ${popupType} can be suppressed`,
        'Check if users can disable this popup from appearing (e.g., "Don\'t show again")',
        getSelector(popup));
    }
    
    // Check for auto-dismiss
    addManualCheck('2.2.1', `Verify ${popupType} doesn't auto-dismiss`,
      'Watch if popup closes automatically - if so, verify user has enough time',
      getSelector(popup));
  }

  function testThirdPartyWidget(popup, popupType) {
    // Detect Klaviyo or other third-party
    const isKlaviyo = popup.className.includes('klaviyo') || popup.querySelector('[class*="klaviyo"]');
    const isMailchimp = popup.className.includes('mailchimp') || popup.querySelector('[class*="mailchimp"]');
    const isOnetrust = popup.id.includes('onetrust') || popup.className.includes('onetrust');
    
    if (isKlaviyo || isMailchimp || isOnetrust) {
      const vendor = isKlaviyo ? 'Klaviyo' : isMailchimp ? 'Mailchimp' : 'OneTrust';
      
      addManualCheck('4.1.2', `Third-party popup (${vendor}) requires manual accessibility review`,
        `${vendor} forms have limited customization - verify keyboard access and screen reader compatibility`,
        getSelector(popup));
      
      // Still test what we can
      const formInputs = popup.querySelectorAll('input:not([type="hidden"])');
      formInputs.forEach(input => {
        if (!input.getAttribute('aria-label') && !input.id) {
          addIssue('serious', '3.3.2', 'Labels or Instructions',
            `${vendor} form input missing accessible label`,
            input,
            `Configure labels in ${vendor} dashboard or add aria-label via custom CSS/JS`,
            'Screen reader users cannot identify form fields');
        }
      });
    }
  }

  function testPopup(popup) {
    const popupType = identifyPopupType(popup);
    
    testDialogSemantics(popup, popupType);
    testCloseButton(popup, popupType);
    testFocusManagement(popup, popupType);
    testFormAccessibility(popup, popupType);
    testTimingAndInterruption(popup, popupType);
    testThirdPartyWidget(popup, popupType);
  }

  // ==========================================================================
  // RUN AUDIT
  // ==========================================================================

  if (allPopups.length === 0) {
    results.manualChecks.push({
      wcag: '4.1.2',
      message: 'No newsletter/promotional popups detected on page load',
      howToTest: 'Navigate the site to trigger exit-intent or timed popups, then re-run audit'
    });
  } else {
    // Test all found popups (visible and hidden)
    allPopups.forEach(popup => testPopup(popup));
    
    // Note how many are currently visible
    if (visiblePopups.length > 0) {
      results.passed.push({
        wcag: 'N/A',
        criterion: 'Detection',
        message: `${visiblePopups.length} popup(s) currently visible`,
        selector: visiblePopups.map(getSelector).join(', ')
      });
    }
    
    if (allPopups.length > visiblePopups.length) {
      results.manualChecks.push({
        wcag: '4.1.2',
        message: `${allPopups.length - visiblePopups.length} hidden popup(s) found - test when triggered`,
        howToTest: 'Trigger popups via scroll, exit-intent, or timer to test in visible state'
      });
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
  window.runNewsletterPopupsAudit = runNewsletterPopupsAudit;
}
