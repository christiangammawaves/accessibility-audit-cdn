/**
 * Modals Accessibility Audit
 * WCAG: 1.3.1, 1.3.2, 2.1.1, 2.1.2, 2.4.3, 4.1.2
 */

function runModalsAudit() {
  'use strict';

  const startTime = performance.now();

  const CONFIG = {
    modalSelectors: [
      '[role="dialog"]',
      '[role="alertdialog"]',
      'dialog',
      '[aria-modal="true"]',
      '.modal',
      '.popup',
      '.overlay',
      '[class*="modal"]',
      '[class*="popup"]',
      '[class*="dialog"]',
      '[class*="drawer"]',
      '[class*="lightbox"]'
    ],
    cookieConsentSelectors: [
      '[class*="cookie"]',
      '[class*="consent"]',
      '[class*="gdpr"]',
      '[class*="privacy-banner"]',
      '#onetrust',
      '#cookieconsent',
      '.cc-banner'
    ],
    ageGateSelectors: [
      '[class*="age-gate"]',
      '[class*="age-verification"]',
      '[class*="age-check"]'
    ],
    newsletterSelectors: [
      '[class*="newsletter-popup"]',
      '[class*="subscribe-modal"]',
      '[class*="email-popup"]'
    ],
    sizeGuideSelectors: [
      '[class*="size-guide"]',
      '[class*="size-chart"]',
      '[class*="sizing-guide"]',
      '[class*="sizing-chart"]',
      '[class*="fit-guide"]',
      '[class*="measurement"]',
      '[data-size-guide]',
      '[data-size-chart]',
      '#size-guide',
      '#size-chart',
      '#sizing-guide'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('modals', 'All modal dialogs, popups, overlays');
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements } = h;

  function identifyModalType(modal) {
    const classes = (String(modal.className) || '').toLowerCase();
    const id = (String(modal.id) || '').toLowerCase();
    const text = (modal.textContent || '').toLowerCase();
    
    if (classes.includes('cookie') || classes.includes('consent') || classes.includes('gdpr') || id.includes('cookie') || text.includes('cookie')) {
      return 'cookie-consent';
    }
    if (classes.includes('age') || text.includes('age verification') || text.includes('21') || text.includes('18+')) {
      return 'age-gate';
    }
    if (classes.includes('newsletter') || classes.includes('subscribe') || classes.includes('email') || text.includes('subscribe')) {
      return 'newsletter';
    }
    if ((classes.includes('cart') || classes.includes('drawer')) && text.includes('cart')) {
      return 'cart-drawer';
    }
    if (classes.includes('search')) {
      return 'search-modal';
    }
    return 'generic-modal';
  }

  // Find all modals — deduplicates nested children from wildcard selectors
  function findAllModals() {
    const modals = new Set();
    CONFIG.modalSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => modals.add(el));
    });
    let result = Array.from(modals);

    // Pattern A fix: Remove child elements that are inside a parent already
    // matched as a modal. E.g., .cart-drawer__discount-bar inside .cart-drawer.
    const { deduplicateElements, isExposedToAT, isInsideModal } = window.a11yHelpers;
    if (deduplicateElements) {
      result = deduplicateElements(result);
    }

    // Skip elements that are already inside a proper dialog/modal container
    // (they are children, not separate modals)
    result = result.filter(el => {
      const parent = el.parentElement;
      if (!parent) return true;
      if (isInsideModal && isInsideModal(parent)) return false;
      return true;
    });

    return result;
  }

  const allModals = findAllModals();

  // Test each modal
  function testModal(modal) {
    results.stats.elementsScanned++;

    // Pattern C fix: Skip elements not exposed to assistive technology
    const { isExposedToAT } = window.a11yHelpers;
    if (isExposedToAT && !isExposedToAT(modal)) return;

    const modalType = identifyModalType(modal);
    const isOpen = isVisible(modal);
    const role = modal.getAttribute('role');
    const ariaModal = modal.getAttribute('aria-modal');
    const isNativeDialog = modal.tagName.toLowerCase() === 'dialog';
    
    // Test 1: Dialog Role
    if (!isNativeDialog && role !== 'dialog' && role !== 'alertdialog') {
      addIssue('critical', '4.1.2', 'Name, Role, Value', 'Modal (' + modalType + ') missing role="dialog"', modal, 'Add role="dialog" or role="alertdialog" for urgent messages', 'Screen reader users not informed this is a modal dialog');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Modal has dialog role', getSelector(modal));
    }
    
    // Test 2: aria-modal
    if (!isNativeDialog && ariaModal !== 'true') {
      addIssue('serious', '4.1.2', 'Name, Role, Value', 'Modal (' + modalType + ') missing aria-modal="true"', modal, 'Add aria-modal="true" to indicate focus should be trapped', 'Screen readers may allow focus to escape modal');
    } else if (ariaModal === 'true' || isNativeDialog) {
      addPassed('4.1.2', 'Name, Role, Value', 'Modal has aria-modal="true"', getSelector(modal));
      // M6 fix: aria-modal alone doesn't guarantee focus trap — flag for manual verification
      addManualCheck('2.4.3', 'Focus Order', 'Verify modal focus trap is implemented — Tab should cycle within modal only and Escape should close it', getSelector(modal));
    }
    
    // Test 3: Accessible Name
    const name = getAccessibleName(modal);
    if (!name) {
      const heading = modal.querySelector('h1, h2, h3, h4');
      if (heading && heading.id) {
        addIssue('serious', '4.1.2', 'Name, Role, Value', 'Modal has heading but no aria-labelledby', modal, 'Add aria-labelledby="' + heading.id + '" to modal', 'Screen reader users not given modal title');
      } else if (heading) {
        addIssue('serious', '4.1.2', 'Name, Role, Value', 'Modal (' + modalType + ') has no accessible name', modal, 'Add id to heading and aria-labelledby to modal, or add aria-label', 'Screen reader users not given modal title');
      } else {
        addIssue('serious', '4.1.2', 'Name, Role, Value', 'Modal (' + modalType + ') has no accessible name', modal, 'Add aria-label describing the modal purpose', 'Screen reader users not given modal title');
      }
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Modal has accessible name: "' + name.slice(0, 40) + '"', getSelector(modal));
    }
    
    // Test 4: Close Button
    // Find all potential close buttons - can't use case-insensitive attribute selectors in querySelector
    const potentialCloseButtons = modal.querySelectorAll('button, [role="button"]');
    let closeButton = null;
    let closeButtonSearchMethod = '';
    
    // First, look for buttons with aria-label containing "close" or "dismiss" (case-insensitive)
    for (const btn of potentialCloseButtons) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes('close') || ariaLabel.includes('dismiss')) {
        closeButton = btn;
        closeButtonSearchMethod = 'aria-label';
        break;
      }
    }
    
    // If not found, look for visible text content containing "close" or "dismiss"
    if (!closeButton) {
      for (const btn of potentialCloseButtons) {
        const text = (btn.textContent || '').toLowerCase().trim();
        if (text === 'close' || text === 'dismiss' || text === 'x' || text === '') {
          closeButton = btn;
          closeButtonSearchMethod = 'text-content';
          break;
        }
      }
    }
    
    // If not found, fall back to class/attribute selectors (buttons only)
    if (!closeButton) {
      closeButton = modal.querySelector('button.close, button.close-button, button[class*="close"], button.dismiss, button[data-dismiss]');
      if (closeButton) closeButtonSearchMethod = 'class-attribute';
    }
    
    if (!closeButton) {
      // Some modals like cookie consent might use "Accept" instead of close
      const acceptButton = modal.querySelector('button[class*="accept"], button[class*="agree"], [class*="accept"]');
      if (!acceptButton) {
        addIssue('serious', '2.1.1', 'Keyboard', 'Modal (' + modalType + ') at ' + getSelector(modal) + ' has no close/dismiss button', modal, 'Add a close button with accessible label', 'Users cannot easily close the modal');
      }
    } else {
      // Check if close button has accessible name
      const closeName = getAccessibleName(closeButton);
      if (!closeName) {
        // Double-check: button might have visible text that we should accept
        const visibleText = (closeButton.textContent || '').trim();
        if (visibleText && visibleText.length > 0 && visibleText.length < 30) {
          // Has visible text, that's acceptable
          addPassed('4.1.2', 'Name, Role, Value', 'Close button has visible text: "' + visibleText.slice(0, 30) + '"', getSelector(closeButton));
        } else {
          addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Close button in ' + modalType + ' (' + getSelector(modal) + ') has no accessible name', closeButton, 'Add aria-label="Close" or visible text', 'Screen reader users may not know button purpose');
        }
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Close button has accessible name: "' + closeName.slice(0, 30) + '"', getSelector(closeButton));
      }
    }
    
    // Test 5: Focusable Elements (if modal is open)
    if (isOpen) {
      const focusable = getFocusableElements(modal);
      if (focusable.length === 0) {
        addIssue('critical', '2.4.3', 'Focus Order', 'Open modal has no focusable elements', modal, 'Ensure modal has at least one focusable element (close button, form input, etc.)', 'Keyboard users cannot interact with modal');
      }
      
      // Check if background is properly hidden
      const mainContent = document.querySelector('main, [role="main"], #main, #MainContent, .main-content');
      if (mainContent && mainContent !== modal && !mainContent.contains(modal)) {
        const mainHidden = mainContent.getAttribute('aria-hidden') === 'true' || mainContent.hasAttribute('inert');
        if (!mainHidden) {
          addIssue('serious', '2.1.2', 'No Keyboard Trap', 'Background content not hidden while modal is open', mainContent, 'Add aria-hidden="true" or inert to main content when modal opens', 'Focus may escape modal to background');
        }
      }
    }
    
    // Test 6: Escape Key (static analysis)
    const hasKeyHandler = modal.hasAttribute('onkeydown') || modal.hasAttribute('onkeyup') || modal.hasAttribute('data-dismiss') || modal.hasAttribute('data-keyboard');
    if (!hasKeyHandler) {
      addManualCheck('2.1.1', 'Verify Escape key closes ' + modalType, 'Open modal and press Escape. Modal should close.', getSelector(modal));
    }
    
    // Test 7: Focus Return (add manual check)
    addManualCheck('2.4.3', 'Verify focus returns to trigger after closing ' + modalType, 'Close modal and verify focus returns to the element that opened it', getSelector(modal));
    
    // Specific tests by modal type
    if (modalType === 'cookie-consent') {
      testCookieConsent(modal);
    } else if (modalType === 'age-gate') {
      testAgeGate(modal);
    }
  }

  function testCookieConsent(modal) {
    // Cookie consent specific checks
    const acceptButton = modal.querySelector('button[class*="accept"], [class*="accept"], button[class*="agree"]');
    const rejectButton = modal.querySelector('button[class*="reject"], [class*="decline"], button[class*="deny"]');
    const manageButton = modal.querySelector('button[class*="manage"], [class*="preferences"], button[class*="settings"]');
    
    if (acceptButton && !rejectButton) {
      addIssue('moderate', '3.2.2', 'On Input', 'Cookie consent has Accept but no Reject option visible', modal, 'Provide equally prominent Accept and Reject buttons', 'Users may feel forced to accept cookies');
    }
    
    // Check if consent banner blocks interaction
    const style = window.getComputedStyle(modal);
    const isFixed = style.position === 'fixed';
    const coversScreen = modal.getBoundingClientRect().width > window.innerWidth * 0.8;
    
    if (isFixed && coversScreen) {
      addManualCheck('2.1.2', 'Verify cookie banner does not trap focus', 'Ensure users can still navigate page behind banner if desired', getSelector(modal));
    }
  }

  function testAgeGate(modal) {
    // Age gate specific checks
    const inputs = modal.querySelectorAll('input');
    
    inputs.forEach(input => {
      const name = getAccessibleName(input);
      if (!name) {
        addIssue('critical', '3.3.2', 'Labels or Instructions', 'Age verification input has no label', input, 'Add label for date/age input fields');
      }
    });
    
    // Check if age gate is properly modal (should block all interaction)
    const ariaModal = modal.getAttribute('aria-modal');
    if (ariaModal !== 'true') {
      addIssue('serious', '4.1.2', 'Name, Role, Value', 'Age gate should have aria-modal="true"', modal, 'Add aria-modal="true" since age gate must block all content', 'Users might bypass age verification via keyboard');
    }
  }

  // Run tests on all found modals
  if (allModals.length === 0) {
    addManualCheck('4.1.2', 'No modals currently visible on page', 'Trigger any popups, drawers, or overlays and re-run audit');
  } else {
    allModals.forEach(modal => testModal(modal));
  }

  // General modal manual checks
  addManualCheck('2.4.3', 'Verify focus moves into modal on open', 'When any modal opens, focus should move to first focusable element or modal container');
  
  addManualCheck('2.1.2', 'Verify focus trap in all modals', 'Tab through each open modal - focus should cycle within modal only');

  // Finalize
  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

if (typeof window !== 'undefined') {
  window.runModalsAudit = runModalsAudit;
}
