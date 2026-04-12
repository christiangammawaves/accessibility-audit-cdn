/**
 * Wishlist / Favorites Accessibility Audit
 * WCAG: 1.1.1, 1.3.1, 4.1.2, 4.1.3
 *
 * Audits wishlist, favorites, and "save for later" buttons for accessible names,
 * toggle state communication, and screen reader announcements.
 * Common on Shopify fashion/lifestyle stores (heart icons with no accessible name).
 *
 * @module wishlist-favorites
 * @description Audit wishlist/favorites buttons for accessibility compliance
 */

(function(global) {
  'use strict';

  function runWishlistFavoritesAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        '[class*="wishlist"]',
        '[class*="favorite"]',
        '[class*="save-for-later"]',
        '.yotpo-heart',
        '[class*="swym"]',
        'button[aria-label*="wishlist" i]',
        'button[aria-label*="favorite" i]',
        'a[aria-label*="wishlist" i]',
        '.gw-wishlist-button',
        '[data-wishlist]'
      ]
    };

    var ref = global.a11yAudit.initComponent('wishlist-favorites', scope || CONFIG.scope);
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

    // Find wishlist/favorites elements (deduplicated, top-level only)
    var wishlistElements = [];
    CONFIG.scope.forEach(function(selector) {
      try {
        var elements = Array.from(doc.querySelectorAll(selector));
        elements.forEach(function(el) {
          if (wishlistElements.indexOf(el) === -1) {
            var isChild = wishlistElements.some(function(existing) {
              return existing.contains(el);
            });
            if (!isChild) {
              wishlistElements = wishlistElements.filter(function(existing) {
                return !el.contains(existing);
              });
              wishlistElements.push(el);
            }
          }
        });
      } catch (e) {
        // Selector not supported
      }
    });

    if (wishlistElements.length === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: Wishlist button has an accessible name (WCAG 4.1.2)
    // ==========================================================================

    wishlistElements.forEach(function(el) {
      results.stats.elementsScanned++;

      var name = h.getAccessibleName ? h.getAccessibleName(el) : (el.getAttribute('aria-label') || el.textContent || '').trim();

      if (name) {
        addPassed('4.1.2', 'Name, Role, Value', 'Wishlist button has accessible name: "' + name + '"', h.getSelector(el));
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Wishlist button has no accessible name (likely an SVG heart icon with no label)',
          el,
          'Add aria-label="Add to wishlist" or visually hidden text to the button'
        );
      }
    });

    // ==========================================================================
    // TEST 2: Toggle state communicated via aria-pressed (WCAG 4.1.2)
    // ==========================================================================

    wishlistElements.forEach(function(el) {
      results.stats.elementsScanned++;

      var isButton = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button';
      var ariaPressed = el.getAttribute('aria-pressed');
      var ariaChecked = el.getAttribute('aria-checked');

      if (isButton) {
        if (ariaPressed !== null) {
          addPassed('4.1.2', 'Name, Role, Value', 'Wishlist toggle communicates state via aria-pressed', h.getSelector(el));
        } else if (ariaChecked !== null) {
          addPassed('4.1.2', 'Name, Role, Value', 'Wishlist toggle communicates state via aria-checked', h.getSelector(el));
        } else {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Wishlist toggle button does not communicate saved/unsaved state',
            el,
            'Add aria-pressed="true" when item is saved, aria-pressed="false" when not saved'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 3: Non-button elements have role="button" (WCAG 4.1.2)
    // ==========================================================================

    wishlistElements.forEach(function(el) {
      results.stats.elementsScanned++;

      var tag = el.tagName;
      var role = el.getAttribute('role');

      if (tag !== 'BUTTON' && tag !== 'A' && tag !== 'INPUT') {
        if (role === 'button') {
          addPassed('4.1.2', 'Name, Role, Value', 'Non-button wishlist element has role="button"', h.getSelector(el));
        } else {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Wishlist element is not a native <button> and lacks role="button"',
            el,
            'Use a native <button> element or add role="button" and tabindex="0"'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 4: Screen reader announcement for state changes (WCAG 4.1.3)
    // ==========================================================================

    var liveRegions = Array.from(doc.querySelectorAll('[aria-live], [role="status"], [role="alert"]'));
    var hasLiveRegion = liveRegions.length > 0;

    if (wishlistElements.length > 0) {
      results.stats.elementsScanned++;

      if (hasLiveRegion) {
        addPassed('4.1.3', 'Status Messages', 'Page has aria-live region(s) for status announcements', '');
      } else {
        addIssue(
          'moderate',
          '4.1.3',
          'Status Messages',
          'No aria-live region found for wishlist add/remove announcements',
          wishlistElements[0],
          'Add an aria-live="polite" region that announces "Added to wishlist" / "Removed from wishlist"'
        );
      }
    }

    // ==========================================================================
    // TEST 5: Keyboard reachability on product cards (WCAG 2.1.1)
    // ==========================================================================

    wishlistElements.forEach(function(el) {
      results.stats.elementsScanned++;

      var tabindex = el.getAttribute('tabindex');
      var isNativelyFocusable = el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT';

      if (tabindex === '-1') {
        addIssue(
          'moderate',
          '2.1.1',
          'Keyboard',
          'Wishlist button has tabindex="-1" and is not keyboard reachable',
          el,
          'Remove tabindex="-1" to allow keyboard access via Tab'
        );
      } else if (isNativelyFocusable || tabindex === '0') {
        addPassed('2.1.1', 'Keyboard', 'Wishlist button is keyboard reachable', h.getSelector(el));
      } else if (!isNativelyFocusable && tabindex === null) {
        addIssue(
          'moderate',
          '2.1.1',
          'Keyboard',
          'Wishlist element is not natively focusable and has no tabindex',
          el,
          'Add tabindex="0" or use a native <button> element'
        );
      }
    });

    // ==========================================================================
    // TEST 6: Wishlist count in header updates accessibly (WCAG 4.1.3)
    // ==========================================================================

    var wishlistCounts = Array.from(doc.querySelectorAll('[class*="wishlist-count"], [class*="wishlist-badge"], [class*="favorites-count"]'));

    wishlistCounts.forEach(function(countEl) {
      results.stats.elementsScanned++;

      var liveAttr = countEl.getAttribute('aria-live');
      var role = countEl.getAttribute('role');
      var parentLive = countEl.parentElement && countEl.parentElement.getAttribute('aria-live');

      if (liveAttr || role === 'status' || parentLive) {
        addPassed('4.1.3', 'Status Messages', 'Wishlist count element has live region semantics', h.getSelector(countEl));
      } else {
        addIssue(
          'minor',
          '4.1.3',
          'Status Messages',
          'Wishlist count badge does not announce updates to screen readers',
          countEl,
          'Add aria-live="polite" or role="status" to the wishlist count element'
        );
      }
    });

    // ==========================================================================
    // TEST 7: Wishlist button overlap detection (WCAG 1.3.1)
    // ==========================================================================

    wishlistElements.forEach(function(el) {
      results.stats.elementsScanned++;

      if (typeof global.getComputedStyle === 'function') {
        var style = global.getComputedStyle(el);
        var position = style.position;

        if (position === 'absolute' || position === 'fixed') {
          // Check if parent has other interactive elements nearby
          var parent = el.parentElement;
          if (parent) {
            var interactives = Array.from(parent.querySelectorAll('a, button, [role="button"]'));
            var overlappingCount = interactives.filter(function(other) {
              return other !== el && (global.getComputedStyle(other).position === 'absolute' || global.getComputedStyle(other).position === 'fixed');
            }).length;

            if (overlappingCount > 0) {
              addIssue(
                'minor',
                '1.3.1',
                'Info and Relationships',
                'Wishlist button is absolutely positioned near other interactive elements — may overlap',
                el,
                'Ensure wishlist button does not visually or interactively overlap with other buttons'
              );
            }
          }
        }
      }
    });

    // ==========================================================================
    // MANUAL CHECK: Wishlist page/drawer keyboard navigation
    // ==========================================================================

    if (wishlistElements.length > 0) {
      addManualCheck(
        '2.1.1',
        'Verify the wishlist page or drawer is fully navigable by keyboard',
        'Click a wishlist button, then navigate the resulting page/drawer using only the keyboard. Verify all items and actions are reachable.',
        h.getSelector(wishlistElements[0])
      );
    }

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.wishlistFavoritesSummary = {
      total: wishlistElements.length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runWishlistFavoritesAudit = runWishlistFavoritesAudit;

})(typeof window !== 'undefined' ? window : global);
