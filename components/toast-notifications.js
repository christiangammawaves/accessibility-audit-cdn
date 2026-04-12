/**
 * Toast Notifications Accessibility Audit
 * WCAG: 1.3.1, 2.2.1, 4.1.3
 *
 * Audits toast/snackbar notifications for live region usage,
 * auto-dismiss timing, and keyboard accessibility.
 *
 * @module toast-notifications
 * @description Audit toast/snackbar notifications for accessibility compliance
 */

(function(global) {
  'use strict';

  function runToastNotificationsAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        '[role="alert"]',
        '[role="status"]',
        '[aria-live]',
        '.toast',
        '.snackbar',
        '.notification-toast',
        '[class*="toast"]',
        '[class*="snackbar"]',
        '[data-toast]'
      ]
    };

    var ref = global.a11yAudit.initComponent('toast-notifications', scope || CONFIG.scope);
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

    // Find toast elements
    var toasts = [];
    CONFIG.scope.forEach(function(selector) {
      try {
        var elements = Array.from(doc.querySelectorAll(selector));
        elements.forEach(function(el) {
          if (toasts.indexOf(el) === -1) toasts.push(el);
        });
      } catch (e) {
        // Selector not supported
      }
    });

    if (toasts.length === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: Toast uses appropriate role (WCAG 4.1.3)
    // ==========================================================================

    toasts.forEach(function(toast) {
      results.stats.elementsScanned++;

      var role = toast.getAttribute('role');
      var ariaLive = toast.getAttribute('aria-live');

      if (role === 'alert' || role === 'status') {
        addPassed('4.1.3', 'Status Messages', 'Toast has role="' + role + '"', h.getSelector(toast));
      } else if (ariaLive === 'assertive' || ariaLive === 'polite') {
        addPassed('4.1.3', 'Status Messages', 'Toast has aria-live="' + ariaLive + '"', h.getSelector(toast));
      } else {
        addIssue(
          'serious',
          '4.1.3',
          'Status Messages',
          'Toast notification missing role="alert" or role="status"',
          toast,
          'Add role="alert" for urgent messages or role="status" for informational messages'
        );
      }
    });

    // ==========================================================================
    // TEST 2: Toast has aria-live attribute (WCAG 4.1.3)
    // ==========================================================================

    toasts.forEach(function(toast) {
      results.stats.elementsScanned++;

      var role = toast.getAttribute('role');
      var ariaLive = toast.getAttribute('aria-live');

      // role="alert" implies aria-live="assertive", role="status" implies aria-live="polite"
      if (role === 'alert' || role === 'status') {
        if (ariaLive) {
          // Check consistency
          if (role === 'alert' && ariaLive !== 'assertive') {
            addIssue(
              'moderate',
              '4.1.3',
              'Status Messages',
              'Toast has role="alert" but aria-live="' + ariaLive + '" (expected "assertive")',
              toast,
              'Either remove aria-live (role="alert" implies assertive) or set aria-live="assertive"'
            );
          } else if (role === 'status' && ariaLive !== 'polite') {
            addIssue(
              'moderate',
              '4.1.3',
              'Status Messages',
              'Toast has role="status" but aria-live="' + ariaLive + '" (expected "polite")',
              toast,
              'Either remove aria-live (role="status" implies polite) or set aria-live="polite"'
            );
          }
        }
        // role alone is fine — implicit live region
        return;
      }

      if (!ariaLive) {
        addIssue(
          'serious',
          '4.1.3',
          'Status Messages',
          'Toast notification has no aria-live attribute or live region role',
          toast,
          'Add aria-live="polite" for status messages or aria-live="assertive" for urgent alerts'
        );
      }
    });

    // ==========================================================================
    // TEST 3: Auto-dismiss timing (WCAG 2.2.1)
    // ==========================================================================

    toasts.forEach(function(toast) {
      results.stats.elementsScanned++;

      // Check for data attributes indicating auto-dismiss timing
      var duration = toast.getAttribute('data-duration') ||
                     toast.getAttribute('data-timeout') ||
                     toast.getAttribute('data-dismiss-after') ||
                     toast.getAttribute('data-auto-dismiss');

      if (duration) {
        var ms = parseInt(duration, 10);
        if (!isNaN(ms) && ms < 5000) {
          addIssue(
            'moderate',
            '2.2.1',
            'Timing Adjustable',
            'Toast auto-dismisses in ' + ms + 'ms (less than 5 seconds)',
            toast,
            'Increase auto-dismiss time to at least 5000ms, or allow users to pause/extend'
          );
        } else if (!isNaN(ms)) {
          addPassed('2.2.1', 'Timing Adjustable', 'Toast auto-dismiss time is ' + ms + 'ms (≥5s)', h.getSelector(toast));
        }
      }

      // Check for CSS animation that might indicate auto-dismiss
      var hasAnimationClass = (toast.className || '').toLowerCase().indexOf('auto') >= 0 ||
                               (toast.className || '').toLowerCase().indexOf('dismiss') >= 0;
      if (hasAnimationClass && !duration) {
        addManualCheck(
          '2.2.1',
          'Verify toast auto-dismiss timing',
          'This toast appears to auto-dismiss. Verify it remains visible for at least 5 seconds.',
          h.getSelector(toast)
        );
      }
    });

    // ==========================================================================
    // TEST 4: Toast with actions does NOT auto-dismiss (WCAG 2.2.1)
    // ==========================================================================

    toasts.forEach(function(toast) {
      results.stats.elementsScanned++;

      var hasActions = toast.querySelector('button, a[href], [role="button"]');
      var hasDismissAction = toast.querySelector('[class*="dismiss"], [class*="close"], [aria-label*="close" i], [aria-label*="dismiss" i]');

      // If it has action buttons (beyond just close/dismiss), check for auto-dismiss
      if (hasActions) {
        var actionButtons = Array.from(toast.querySelectorAll('button, a[href], [role="button"]'));
        var nonDismissActions = actionButtons.filter(function(btn) {
          var label = (btn.textContent || '').toLowerCase();
          var ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          return label.indexOf('close') < 0 && label.indexOf('dismiss') < 0 &&
                 ariaLabel.indexOf('close') < 0 && ariaLabel.indexOf('dismiss') < 0 &&
                 label !== 'x' && label !== '×';
        });

        if (nonDismissActions.length > 0) {
          var duration = toast.getAttribute('data-duration') ||
                         toast.getAttribute('data-timeout') ||
                         toast.getAttribute('data-dismiss-after');

          if (duration) {
            addIssue(
              'serious',
              '2.2.1',
              'Timing Adjustable',
              'Toast with action buttons auto-dismisses — users may not reach the actions in time',
              toast,
              'Do not auto-dismiss toasts that contain interactive actions'
            );
          }
        }
      }
    });

    // ==========================================================================
    // TEST 5: Dismiss button keyboard accessible (WCAG 2.1.1)
    // ==========================================================================

    toasts.forEach(function(toast) {
      results.stats.elementsScanned++;

      var dismissBtn = toast.querySelector('[class*="dismiss"], [class*="close"], [aria-label*="close" i], [aria-label*="dismiss" i]');

      if (dismissBtn) {
        var tagName = dismissBtn.tagName.toLowerCase();
        var role = dismissBtn.getAttribute('role');
        var tabindex = dismissBtn.getAttribute('tabindex');

        var isFocusable = tagName === 'button' || role === 'button' ||
                          (tabindex !== null && tabindex !== '-1');

        if (isFocusable) {
          addPassed('1.3.1', 'Info and Relationships', 'Toast dismiss button is keyboard accessible', h.getSelector(dismissBtn));
        } else {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'Toast dismiss button is not keyboard accessible',
            dismissBtn,
            'Use a <button> element or add role="button" and tabindex="0"'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 6: Toast doesn't obscure interactive content (WCAG 1.3.1)
    // ==========================================================================

    toasts.forEach(function(toast) {
      results.stats.elementsScanned++;

      if (typeof global.getComputedStyle === 'function') {
        var style = global.getComputedStyle(toast);
        var position = style.position;

        if (position === 'fixed' || position === 'absolute') {
          addManualCheck(
            '1.3.1',
            'Verify toast does not obscure interactive content',
            'Check that this fixed/absolute positioned toast does not cover buttons, links, or form controls',
            h.getSelector(toast)
          );
        }
      }
    });

    // ==========================================================================
    // TEST 7: Stacked toasts and content quality (manual checks)
    // ==========================================================================

    if (toasts.length > 1) {
      addManualCheck(
        '4.1.3',
        'Verify stacked toasts are announced in order',
        'Trigger multiple toasts and verify screen reader announces them in the order they appear',
        'toast notifications'
      );
    }

    if (toasts.length > 0) {
      addManualCheck(
        '4.1.3',
        'Verify toast content is concise and meaningful',
        'Review toast messages for clarity — they should be brief and communicate status clearly',
        'toast notifications'
      );
    }

    // ==========================================================================
    // TEST 8: Auto-dismiss has visible timer (minor best practice)
    // ==========================================================================

    toasts.forEach(function(toast) {
      results.stats.elementsScanned++;

      var duration = toast.getAttribute('data-duration') ||
                     toast.getAttribute('data-timeout');

      if (duration) {
        var hasProgressBar = toast.querySelector('[role="progressbar"], progress, [class*="progress"], [class*="timer"]');
        if (!hasProgressBar) {
          addIssue(
            'minor',
            '2.2.1',
            'Timing Adjustable',
            'Auto-dismiss toast has no visible timer or progress indicator',
            toast,
            'Consider adding a progress bar to show remaining time before auto-dismiss'
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

    results.toastSummary = {
      total: toasts.length,
      withRole: toasts.filter(function(t) { return t.getAttribute('role') === 'alert' || t.getAttribute('role') === 'status'; }).length,
      withAriaLive: toasts.filter(function(t) { return t.hasAttribute('aria-live'); }).length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runToastNotificationsAudit = runToastNotificationsAudit;

})(typeof window !== 'undefined' ? window : global);
