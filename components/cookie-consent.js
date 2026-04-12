/**
 * Cookie Consent Accessibility Audit
 * WCAG: 1.3.1, 2.1.1, 2.4.3, 4.1.2
 *
 * Audits cookie consent banners and modals for keyboard accessibility,
 * focus management, and screen reader communication.
 *
 * @module cookie-consent
 * @description Audit cookie consent banners/modals for accessibility compliance
 */

(function(global) {
  'use strict';

  function runCookieConsentAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        '[class*="cookie"]',
        '[class*="consent"]',
        '[id*="cookie"]',
        '[id*="consent"]',
        '[aria-label*="cookie" i]',
        '[aria-label*="consent" i]',
        '[data-cookie-consent]',
        '[class*="gdpr"]',
        '[id*="gdpr"]'
      ]
    };

    var ref = global.a11yAudit.initComponent('cookie-consent', scope || CONFIG.scope);
    var results = ref.results;
    var h = ref.h;
    var addIssue = ref.addIssue;
    var addPassed = ref.addPassed;
    var addManualCheck = ref.addManualCheck;

    var doc = global.document;
    if (!doc) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // Find cookie consent elements
    var consentElements = [];
    CONFIG.scope.forEach(function(selector) {
      try {
        var elements = Array.from(doc.querySelectorAll(selector));
        elements.forEach(function(el) {
          if (consentElements.indexOf(el) === -1) {
            // Filter to top-level consent banners (not nested children)
            var isChild = consentElements.some(function(existing) {
              return existing.contains(el);
            });
            if (!isChild) {
              // Remove any existing elements that are children of this element
              consentElements = consentElements.filter(function(existing) {
                return !el.contains(existing);
              });
              consentElements.push(el);
            }
          }
        });
      } catch (e) {
        // Selector not supported (e.g., case-insensitive attribute selectors)
      }
    });

    if (consentElements.length === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: Banner/modal has accessible name (WCAG 4.1.2)
    // ==========================================================================

    consentElements.forEach(function(banner) {
      results.stats.elementsScanned++;

      var ariaLabel = banner.getAttribute('aria-label');
      var ariaLabelledby = banner.getAttribute('aria-labelledby');
      var role = banner.getAttribute('role');

      if (ariaLabel) {
        addPassed('4.1.2', 'Name, Role, Value', 'Cookie consent has aria-label', h.getSelector(banner));
      } else if (ariaLabelledby) {
        var labelEl = doc.getElementById(ariaLabelledby);
        if (labelEl && labelEl.textContent.trim()) {
          addPassed('4.1.2', 'Name, Role, Value', 'Cookie consent has aria-labelledby', h.getSelector(banner));
        } else {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Cookie consent aria-labelledby references missing or empty element',
            banner,
            'Ensure aria-labelledby points to an element with descriptive text'
          );
        }
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Cookie consent banner has no accessible name',
          banner,
          'Add aria-label="Cookie consent" or aria-labelledby to identify the banner'
        );
      }
    });

    // ==========================================================================
    // TEST 2: All buttons are keyboard accessible (WCAG 2.1.1)
    // ==========================================================================

    consentElements.forEach(function(banner) {
      results.stats.elementsScanned++;

      var buttons = Array.from(banner.querySelectorAll('button, [role="button"], a[href], input[type="button"], input[type="submit"]'));

      if (buttons.length === 0) {
        addIssue(
          'serious',
          '2.1.1',
          'Keyboard',
          'Cookie consent banner has no interactive buttons',
          banner,
          'Add Accept/Reject buttons using <button> elements'
        );
        return;
      }

      var inaccessibleButtons = buttons.filter(function(btn) {
        var tabindex = btn.getAttribute('tabindex');
        return tabindex === '-1';
      });

      if (inaccessibleButtons.length > 0) {
        addIssue(
          'serious',
          '2.1.1',
          'Keyboard',
          inaccessibleButtons.length + ' consent buttons have tabindex="-1" (not keyboard accessible)',
          inaccessibleButtons[0],
          'Remove tabindex="-1" from consent action buttons'
        );
      } else {
        addPassed('2.1.1', 'Keyboard', 'All consent buttons are keyboard accessible', h.getSelector(banner));
      }
    });

    // ==========================================================================
    // TEST 3: Modal focus trapping (WCAG 2.4.3)
    // ==========================================================================

    consentElements.forEach(function(banner) {
      results.stats.elementsScanned++;

      var role = banner.getAttribute('role');
      var isModal = role === 'dialog' || role === 'alertdialog' ||
                    banner.tagName === 'DIALOG';
      var ariaModal = banner.getAttribute('aria-modal');

      if (isModal) {
        if (ariaModal === 'true' || banner.tagName === 'DIALOG') {
          addPassed('2.4.3', 'Focus Order', 'Cookie consent modal has modal semantics for focus trapping', h.getSelector(banner));
        } else {
          addIssue(
            'serious',
            '2.4.3',
            'Focus Order',
            'Cookie consent dialog missing aria-modal="true"',
            banner,
            'Add aria-modal="true" to trap focus within the consent dialog'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 4: Focus moves to banner when it appears (WCAG 2.4.3)
    // ==========================================================================

    consentElements.forEach(function(banner) {
      results.stats.elementsScanned++;

      var role = banner.getAttribute('role');
      var isModal = role === 'dialog' || role === 'alertdialog' ||
                    banner.tagName === 'DIALOG';

      if (isModal) {
        addManualCheck(
          '2.4.3',
          'Verify focus moves to cookie consent dialog when it appears',
          'Reload the page and verify that focus moves into the consent dialog automatically',
          h.getSelector(banner)
        );
      }
    });

    // ==========================================================================
    // TEST 5: "Reject All" option exists (WCAG best practice)
    // ==========================================================================

    consentElements.forEach(function(banner) {
      results.stats.elementsScanned++;

      var buttons = Array.from(banner.querySelectorAll('button, [role="button"], a'));
      var buttonTexts = buttons.map(function(btn) {
        return (btn.textContent || '').toLowerCase().trim();
      });

      var hasAcceptAll = buttonTexts.some(function(text) {
        return text.indexOf('accept') >= 0 || text.indexOf('agree') >= 0 || text.indexOf('allow') >= 0;
      });

      var hasRejectAll = buttonTexts.some(function(text) {
        return text.indexOf('reject') >= 0 || text.indexOf('decline') >= 0 ||
               text.indexOf('deny') >= 0 || text.indexOf('refuse') >= 0;
      });

      if (hasAcceptAll && hasRejectAll) {
        addPassed('4.1.2', 'Name, Role, Value', 'Both Accept and Reject options are available', h.getSelector(banner));
      } else if (hasAcceptAll && !hasRejectAll) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Cookie consent has Accept but no Reject/Decline option',
          banner,
          'Provide a "Reject All" or "Decline" option alongside "Accept All"'
        );
      }
    });

    // ==========================================================================
    // TEST 6: Consent choices conveyed to screen readers (WCAG 1.3.1)
    // ==========================================================================

    consentElements.forEach(function(banner) {
      results.stats.elementsScanned++;

      var buttons = Array.from(banner.querySelectorAll('button, [role="button"], a'));
      var unlabeledButtons = buttons.filter(function(btn) {
        var name = h.getAccessibleName ? h.getAccessibleName(btn) : (btn.textContent || '').trim();
        return !name;
      });

      if (unlabeledButtons.length > 0) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          unlabeledButtons.length + ' consent buttons have no accessible name',
          unlabeledButtons[0],
          'Add visible text or aria-label to all consent action buttons'
        );
      } else if (buttons.length > 0) {
        addPassed('1.3.1', 'Info and Relationships', 'All consent buttons have accessible names', h.getSelector(banner));
      }
    });

    // ==========================================================================
    // TEST 7: Banner doesn't permanently obscure content (WCAG 1.3.1)
    // ==========================================================================

    consentElements.forEach(function(banner) {
      results.stats.elementsScanned++;

      if (typeof global.getComputedStyle === 'function') {
        var style = global.getComputedStyle(banner);
        var position = style.position;

        if (position === 'fixed' || position === 'sticky') {
          var hasDismiss = banner.querySelector('button, [role="button"]');
          if (!hasDismiss) {
            addIssue(
              'moderate',
              '1.3.1',
              'Info and Relationships',
              'Fixed/sticky cookie banner has no dismiss mechanism',
              banner,
              'Add a button to dismiss the cookie consent banner'
            );
          }
        }
      }
    });

    // ==========================================================================
    // TEST 8: After dismissal focus returns logically (WCAG 2.4.3)
    // ==========================================================================

    consentElements.forEach(function(banner) {
      var role = banner.getAttribute('role');
      var isModal = role === 'dialog' || role === 'alertdialog' ||
                    banner.tagName === 'DIALOG';

      if (isModal) {
        addManualCheck(
          '2.4.3',
          'Verify focus returns to logical place after consent dismissal',
          'Accept or reject cookies and verify focus moves to main content or the element that triggered the dialog',
          h.getSelector(banner)
        );
      }
    });

    // ==========================================================================
    // TEST 9: Cookie preference toggles use proper roles (WCAG 4.1.2)
    // ==========================================================================

    consentElements.forEach(function(banner) {
      var checkboxes = Array.from(banner.querySelectorAll('input[type="checkbox"]'));
      var switches = Array.from(banner.querySelectorAll('[role="switch"], [role="checkbox"]'));
      var customToggles = Array.from(banner.querySelectorAll('[class*="toggle"], [class*="switch"]')).filter(function(el) {
        return el.tagName !== 'INPUT' && !el.getAttribute('role');
      });

      if (customToggles.length > 0) {
        results.stats.elementsScanned++;
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          customToggles.length + ' cookie preference toggles lack proper checkbox/switch role',
          customToggles[0],
          'Use <input type="checkbox">, role="checkbox", or role="switch" for preference toggles'
        );
      } else if (checkboxes.length > 0 || switches.length > 0) {
        results.stats.elementsScanned++;
        addPassed('4.1.2', 'Name, Role, Value', 'Cookie preference controls use proper form roles', h.getSelector(banner));
      }
    });

    // ==========================================================================
    // TEST 10: Banner respects prefers-reduced-motion (minor)
    // ==========================================================================

    consentElements.forEach(function(banner) {
      results.stats.elementsScanned++;

      if (typeof global.getComputedStyle === 'function') {
        var style = global.getComputedStyle(banner);
        var animation = style.animation || style.animationName || '';
        var transition = style.transition || '';

        if ((animation && animation !== 'none') || (transition && transition !== 'none' && transition.indexOf('0s') < 0)) {
          addIssue(
            'minor',
            '2.3.3',
            'Animation from Interactions',
            'Cookie consent banner has animations — verify prefers-reduced-motion is respected',
            banner,
            'Wrap animations in @media (prefers-reduced-motion: no-preference) { ... }'
          );
        }
      }
    });

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.cookieConsentSummary = {
      total: consentElements.length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runCookieConsentAudit = runCookieConsentAudit;

})(typeof window !== 'undefined' ? window : global);
