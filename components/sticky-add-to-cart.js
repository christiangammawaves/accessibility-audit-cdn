/**
 * Sticky Add-to-Cart Bar Accessibility Audit
 * WCAG: 2.1.1, 2.4.3, 2.4.11, 4.1.2
 *
 * Audits sticky add-to-cart bars that appear when scrolling past the main ATC button.
 * These bars commonly obscure content, have focus management issues, and contain
 * duplicate buttons without distinguishable names.
 *
 * @module sticky-add-to-cart
 * @description Audit sticky add-to-cart bars for accessibility compliance
 */

(function(global) {
  'use strict';

  function runStickyAddToCartAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        'sticky-atc',
        'sticky-add-to-cart',
        '[class*="sticky-atc"]',
        '[class*="sticky-add-to-cart"]',
        '[class*="sticky-bar"][class*="product"]',
        '[class*="sticky-buy"]',
        '[data-sticky-atc]'
      ]
    };

    var ref = global.a11yAudit.initComponent('sticky-add-to-cart', scope || CONFIG.scope);
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

    // Find sticky add-to-cart elements
    var stickyElements = [];
    CONFIG.scope.forEach(function(selector) {
      try {
        var elements = Array.from(doc.querySelectorAll(selector));
        elements.forEach(function(el) {
          if (stickyElements.indexOf(el) === -1) {
            var isChild = stickyElements.some(function(existing) {
              return existing.contains(el);
            });
            if (!isChild) {
              stickyElements = stickyElements.filter(function(existing) {
                return !el.contains(existing);
              });
              stickyElements.push(el);
            }
          }
        });
      } catch (e) {
        // Selector not supported
      }
    });

    if (stickyElements.length === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: Sticky bar ATC button has accessible name (WCAG 4.1.2)
    // ==========================================================================

    stickyElements.forEach(function(bar) {
      results.stats.elementsScanned++;

      var buttons = Array.from(bar.querySelectorAll('button, [role="button"], input[type="submit"]'));
      var atcButtons = buttons.filter(function(btn) {
        var text = (btn.textContent || '').toLowerCase();
        var label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return text.indexOf('add to cart') >= 0 || text.indexOf('add to bag') >= 0 ||
               text.indexOf('buy') >= 0 || label.indexOf('add to cart') >= 0 ||
               label.indexOf('add to bag') >= 0 || label.indexOf('buy') >= 0;
      });

      if (atcButtons.length === 0 && buttons.length > 0) {
        // Check if any button has an accessible name at all
        buttons.forEach(function(btn) {
          var name = h.getAccessibleName ? h.getAccessibleName(btn) : (btn.textContent || '').trim();
          if (!name) {
            addIssue(
              'serious',
              '4.1.2',
              'Name, Role, Value',
              'Sticky bar button has no accessible name',
              btn,
              'Add text content or aria-label to the button (e.g., "Add to cart")'
            );
          }
        });
      } else {
        atcButtons.forEach(function(btn) {
          var name = h.getAccessibleName ? h.getAccessibleName(btn) : (btn.textContent || '').trim();
          if (name) {
            addPassed('4.1.2', 'Name, Role, Value', 'Sticky bar Add to Cart button has accessible name: "' + name + '"', h.getSelector(btn));
          } else {
            addIssue(
              'serious',
              '4.1.2',
              'Name, Role, Value',
              'Sticky bar Add to Cart button has no accessible name',
              btn,
              'Add visible text or aria-label="Add to cart" to the button'
            );
          }
        });
      }
    });

    // ==========================================================================
    // TEST 2: Variant selector in sticky bar has label (WCAG 4.1.2)
    // ==========================================================================

    stickyElements.forEach(function(bar) {
      var selects = Array.from(bar.querySelectorAll('select, [role="listbox"], [role="combobox"]'));

      selects.forEach(function(sel) {
        results.stats.elementsScanned++;

        var labelId = sel.getAttribute('aria-labelledby');
        var ariaLabel = sel.getAttribute('aria-label');
        var id = sel.getAttribute('id');
        var hasLabel = ariaLabel || (labelId && doc.getElementById(labelId));

        if (!hasLabel && id) {
          hasLabel = !!doc.querySelector('label[for="' + id + '"]');
        }

        if (hasLabel) {
          addPassed('4.1.2', 'Name, Role, Value', 'Sticky bar variant selector has accessible label', h.getSelector(sel));
        } else {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Sticky bar variant selector has no accessible label',
            sel,
            'Add aria-label (e.g., "Select size") or associate with a <label> element'
          );
        }
      });
    });

    // ==========================================================================
    // TEST 3: Sticky bar doesn't permanently obscure content (WCAG 2.4.11)
    // ==========================================================================

    stickyElements.forEach(function(bar) {
      results.stats.elementsScanned++;

      if (typeof global.getComputedStyle === 'function') {
        var style = global.getComputedStyle(bar);
        var position = style.position;

        if (position === 'fixed' || position === 'sticky') {
          var ariaHidden = bar.getAttribute('aria-hidden');
          if (ariaHidden === 'true') {
            addPassed('2.4.11', 'Focus Not Obscured', 'Sticky bar is currently hidden (aria-hidden="true")', h.getSelector(bar));
          } else {
            addIssue(
              'serious',
              '2.4.11',
              'Focus Not Obscured',
              'Sticky add-to-cart bar uses position: ' + position + ' — may obscure focused elements beneath it',
              bar,
              'Ensure focused elements are not fully hidden behind the sticky bar (provide scroll offset or auto-dismiss)'
            );
          }
        }
      }
    });

    // ==========================================================================
    // TEST 4: Sticky bar doesn't trap keyboard focus (WCAG 2.1.1)
    // ==========================================================================

    stickyElements.forEach(function(bar) {
      results.stats.elementsScanned++;

      var focusableInBar = Array.from(bar.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'));
      var trappedFocusable = focusableInBar.filter(function(el) {
        var tabindex = el.getAttribute('tabindex');
        return tabindex !== '-1';
      });

      if (trappedFocusable.length > 0) {
        // Check if the bar itself traps focus (e.g., aria-modal on non-dialog)
        var ariaModal = bar.getAttribute('aria-modal');
        if (ariaModal === 'true') {
          addIssue(
            'moderate',
            '2.1.1',
            'Keyboard',
            'Sticky bar has aria-modal="true" which may trap keyboard focus',
            bar,
            'Remove aria-modal="true" from the sticky bar — it is not a dialog'
          );
        } else {
          addPassed('2.1.1', 'Keyboard', 'Sticky bar does not trap keyboard focus', h.getSelector(bar));
        }
      }
    });

    // ==========================================================================
    // TEST 5: Duplicate ATC button distinguishable for screen readers (WCAG 4.1.2)
    // ==========================================================================

    stickyElements.forEach(function(bar) {
      results.stats.elementsScanned++;

      var stickyButtons = Array.from(bar.querySelectorAll('button, [role="button"]'));
      var stickyAtcNames = stickyButtons.map(function(btn) {
        return (h.getAccessibleName ? h.getAccessibleName(btn) : (btn.textContent || '').trim()).toLowerCase();
      }).filter(function(name) {
        return name.indexOf('add to cart') >= 0 || name.indexOf('add to bag') >= 0 || name.indexOf('buy') >= 0;
      });

      // Check for main page ATC buttons outside the sticky bar
      var allPageButtons = Array.from(doc.querySelectorAll('button, [role="button"]'));
      var mainAtcButtons = allPageButtons.filter(function(btn) {
        if (bar.contains(btn)) return false;
        var name = (h.getAccessibleName ? h.getAccessibleName(btn) : (btn.textContent || '').trim()).toLowerCase();
        return name.indexOf('add to cart') >= 0 || name.indexOf('add to bag') >= 0 || name.indexOf('buy') >= 0;
      });

      if (stickyAtcNames.length > 0 && mainAtcButtons.length > 0) {
        var mainName = (h.getAccessibleName ? h.getAccessibleName(mainAtcButtons[0]) : (mainAtcButtons[0].textContent || '').trim()).toLowerCase();
        var stickyName = stickyAtcNames[0];

        if (stickyName === mainName) {
          addIssue(
            'minor',
            '4.1.2',
            'Name, Role, Value',
            'Sticky bar Add to Cart has identical name to main Add to Cart button — screen readers cannot distinguish them',
            stickyButtons[0],
            'Differentiate with aria-label, e.g., "Add to cart - sticky bar"'
          );
        } else {
          addPassed('4.1.2', 'Name, Role, Value', 'Sticky bar ATC button is distinguishable from main ATC button', h.getSelector(bar));
        }
      }
    });

    // ==========================================================================
    // TEST 6: Animations respect prefers-reduced-motion (WCAG 2.3.3)
    // ==========================================================================

    stickyElements.forEach(function(bar) {
      results.stats.elementsScanned++;

      if (typeof global.getComputedStyle === 'function') {
        var style = global.getComputedStyle(bar);
        var animation = style.animation || style.animationName || '';
        var transition = style.transition || '';

        if ((animation && animation !== 'none') || (transition && transition !== 'none' && transition.indexOf('0s') < 0)) {
          addIssue(
            'minor',
            '2.3.3',
            'Animation from Interactions',
            'Sticky bar has animations — verify prefers-reduced-motion is respected',
            bar,
            'Wrap animations in @media (prefers-reduced-motion: no-preference) { ... }'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 7: Sticky bar not hidden from assistive technology (WCAG 4.1.2)
    // ==========================================================================

    stickyElements.forEach(function(bar) {
      results.stats.elementsScanned++;

      var ariaHidden = bar.getAttribute('aria-hidden');
      if (ariaHidden === 'true') {
        // Check if it has visible interactive content
        var visibleButtons = Array.from(bar.querySelectorAll('button, a, input, select'));
        if (visibleButtons.length > 0) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Sticky bar has aria-hidden="true" but contains interactive elements — they are invisible to screen readers',
            bar,
            'Remove aria-hidden="true" or ensure the bar is only hidden when not visible on screen'
          );
        }
      }
    });

    // ==========================================================================
    // MANUAL CHECK: Focus indicators under sticky bar
    // ==========================================================================

    if (stickyElements.length > 0) {
      addManualCheck(
        '2.4.11',
        'Verify sticky add-to-cart bar does not cover focus indicators on elements beneath it',
        'Tab through the page content. When focus reaches elements near the bottom of the viewport, verify the focus outline is not obscured by the sticky bar.',
        h.getSelector(stickyElements[0])
      );
    }

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.stickyAddToCartSummary = {
      total: stickyElements.length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runStickyAddToCartAudit = runStickyAddToCartAudit;

})(typeof window !== 'undefined' ? window : global);
