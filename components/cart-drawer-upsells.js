/**
 * Cart Drawer Upsells & Sub-Components Accessibility Audit
 * WCAG: 1.3.1, 3.3.1, 3.3.2, 4.1.2, 4.1.3
 *
 * Audits cart drawer sub-components — discount code inputs, upsell/cross-sell sections,
 * free shipping progress bars, and gift note fields. Complements cart.js which covers
 * the cart drawer container, focus trapping, and remove buttons.
 *
 * @module cart-drawer-upsells
 * @description Audit cart drawer sub-components (upsells, discounts, shipping bars) for accessibility
 */

(function(global) {
  'use strict';

  function runCartDrawerUpsellsAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        'cart-discount',
        'cart-discount-bar-component',
        '[class*="cart-upsell"]',
        '[class*="cart-recommend"]',
        '[class*="shipping-bar"]',
        '[class*="free-shipping"]',
        '[class*="cart-gift"]',
        '[class*="gift-note"]',
        '[class*="cart-progress"]',
        '[class*="cart-discount"]'
      ]
    };

    var ref = global.a11yAudit.initComponent('cart-drawer-upsells', scope || CONFIG.scope);
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

    // Find cart drawer sub-components
    var cartSubComponents = [];
    CONFIG.scope.forEach(function(selector) {
      try {
        var elements = Array.from(doc.querySelectorAll(selector));
        elements.forEach(function(el) {
          if (cartSubComponents.indexOf(el) === -1) {
            var isChild = cartSubComponents.some(function(existing) {
              return existing.contains(el);
            });
            if (!isChild) {
              cartSubComponents = cartSubComponents.filter(function(existing) {
                return !el.contains(existing);
              });
              cartSubComponents.push(el);
            }
          }
        });
      } catch (e) {
        // Selector not supported
      }
    });

    if (cartSubComponents.length === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: Discount code input has a label (WCAG 3.3.2)
    // ==========================================================================

    var discountInputs = [];
    cartSubComponents.forEach(function(el) {
      var inputs = Array.from(el.querySelectorAll('input[type="text"], input[type="search"], input:not([type])'));
      inputs.forEach(function(input) {
        if (discountInputs.indexOf(input) === -1) {
          discountInputs.push(input);
        }
      });
    });

    // Also look for discount inputs by attribute patterns
    var extraDiscountInputs = Array.from(doc.querySelectorAll(
      'input[name*="discount" i], input[name*="coupon" i], input[name*="promo" i], input[placeholder*="discount" i], input[placeholder*="coupon" i], input[placeholder*="promo" i]'
    ));
    extraDiscountInputs.forEach(function(input) {
      if (discountInputs.indexOf(input) === -1) {
        discountInputs.push(input);
      }
    });

    discountInputs.forEach(function(input) {
      results.stats.elementsScanned++;

      var ariaLabel = input.getAttribute('aria-label');
      var ariaLabelledby = input.getAttribute('aria-labelledby');
      var id = input.getAttribute('id');
      var hasLabel = ariaLabel || (ariaLabelledby && doc.getElementById(ariaLabelledby));

      if (!hasLabel && id) {
        hasLabel = !!doc.querySelector('label[for="' + id + '"]');
      }

      if (hasLabel) {
        addPassed('3.3.2', 'Labels or Instructions', 'Discount code input has accessible label', h.getSelector(input));
      } else {
        addIssue(
          'serious',
          '3.3.2',
          'Labels or Instructions',
          'Discount code input has no accessible label',
          input,
          'Add a visible <label>, aria-label="Discount code", or aria-labelledby'
        );
      }
    });

    // ==========================================================================
    // TEST 2: Discount "Apply" button has accessible name (WCAG 4.1.2)
    // ==========================================================================

    cartSubComponents.forEach(function(el) {
      var buttons = Array.from(el.querySelectorAll('button, [role="button"], input[type="submit"]'));
      var applyButtons = buttons.filter(function(btn) {
        var text = (btn.textContent || '').toLowerCase().trim();
        var label = (btn.getAttribute('aria-label') || '').toLowerCase();
        var value = (btn.getAttribute('value') || '').toLowerCase();
        return text.indexOf('apply') >= 0 || label.indexOf('apply') >= 0 ||
               value.indexOf('apply') >= 0 || text.indexOf('redeem') >= 0;
      });

      applyButtons.forEach(function(btn) {
        results.stats.elementsScanned++;

        var name = h.getAccessibleName ? h.getAccessibleName(btn) : (btn.textContent || '').trim();

        if (name) {
          addPassed('4.1.2', 'Name, Role, Value', 'Discount apply button has accessible name: "' + name + '"', h.getSelector(btn));
        } else {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Discount "Apply" button has no accessible name',
            btn,
            'Add visible text "Apply" or aria-label="Apply discount code"'
          );
        }
      });
    });

    // ==========================================================================
    // TEST 3: Discount success/error uses aria-live (WCAG 4.1.3)
    // ==========================================================================

    cartSubComponents.forEach(function(el) {
      var messages = Array.from(el.querySelectorAll(
        '[class*="message"], [class*="error"], [class*="success"], [class*="notice"], [class*="feedback"]'
      ));

      if (messages.length > 0) {
        results.stats.elementsScanned++;

        var hasLive = messages.some(function(msg) {
          var liveAttr = msg.getAttribute('aria-live');
          var role = msg.getAttribute('role');
          return liveAttr || role === 'alert' || role === 'status';
        });

        if (hasLive) {
          addPassed('4.1.3', 'Status Messages', 'Discount messages use aria-live for screen reader announcements', h.getSelector(el));
        } else {
          addIssue(
            'serious',
            '4.1.3',
            'Status Messages',
            'Discount success/error messages are not announced to screen readers',
            messages[0],
            'Add aria-live="polite" for success messages or role="alert" for errors'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 4: Invalid discount shows accessible error linked to input (WCAG 3.3.1)
    // ==========================================================================

    cartSubComponents.forEach(function(el) {
      var errorMessages = Array.from(el.querySelectorAll(
        '[class*="error"], [class*="invalid"], [role="alert"]'
      ));

      errorMessages.forEach(function(errMsg) {
        results.stats.elementsScanned++;

        var errId = errMsg.getAttribute('id');
        if (errId) {
          // Check if any input references this error via aria-describedby
          var linkedInput = doc.querySelector('[aria-describedby*="' + errId + '"]');
          if (linkedInput) {
            addPassed('3.3.1', 'Error Identification', 'Error message is linked to input via aria-describedby', h.getSelector(errMsg));
          } else {
            addIssue(
              'moderate',
              '3.3.1',
              'Error Identification',
              'Error message has id but is not linked to the discount input via aria-describedby',
              errMsg,
              'Add aria-describedby="' + errId + '" to the discount code input'
            );
          }
        }
      });
    });

    // ==========================================================================
    // TEST 5: Free shipping progress bar semantics (WCAG 4.1.2)
    // ==========================================================================

    var shippingBars = [];
    cartSubComponents.forEach(function(el) {
      var className = (el.className || '').toLowerCase();
      if (className.indexOf('shipping') >= 0 || className.indexOf('progress') >= 0 || className.indexOf('free-shipping') >= 0) {
        shippingBars.push(el);
      }
      var nested = Array.from(el.querySelectorAll('[class*="shipping-bar"], [class*="progress-bar"], [class*="free-shipping"]'));
      nested.forEach(function(n) {
        if (shippingBars.indexOf(n) === -1) shippingBars.push(n);
      });
    });

    shippingBars.forEach(function(bar) {
      results.stats.elementsScanned++;

      var progressEl = bar.querySelector('[role="progressbar"], progress');
      if (progressEl) {
        var valueNow = progressEl.getAttribute('aria-valuenow');
        var valueMin = progressEl.getAttribute('aria-valuemin');
        var valueMax = progressEl.getAttribute('aria-valuemax');

        if (progressEl.tagName === 'PROGRESS' || (valueNow && valueMax)) {
          addPassed('4.1.2', 'Name, Role, Value', 'Shipping progress bar has proper ARIA attributes', h.getSelector(progressEl));
        } else {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Shipping progress bar missing aria-valuenow/aria-valuemax',
            progressEl,
            'Add aria-valuenow, aria-valuemin="0", and aria-valuemax to the progressbar'
          );
        }
      } else {
        // Check for visual-only progress bar (div with width percentage)
        var visualBars = Array.from(bar.querySelectorAll('[style*="width"]'));
        if (visualBars.length > 0) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Free shipping progress indicator is visual-only — no role="progressbar" or <progress> element',
            bar,
            'Use <progress> or add role="progressbar" with aria-valuenow/aria-valuemin/aria-valuemax'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 6: Shipping bar text accessible to screen readers (WCAG 1.3.1)
    // ==========================================================================

    shippingBars.forEach(function(bar) {
      results.stats.elementsScanned++;

      var textContent = (bar.textContent || '').trim();
      var ariaHidden = bar.getAttribute('aria-hidden');
      var ariaLabel = bar.getAttribute('aria-label');

      if (ariaHidden === 'true' && !ariaLabel) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Shipping bar text is hidden from screen readers (aria-hidden="true")',
          bar,
          'Remove aria-hidden or provide an aria-label with the shipping threshold text'
        );
      } else if (textContent || ariaLabel) {
        addPassed('1.3.1', 'Info and Relationships', 'Shipping bar text is accessible to screen readers', h.getSelector(bar));
      }
    });

    // ==========================================================================
    // TEST 7: Upsell product cards have accessible names (WCAG 4.1.2)
    // ==========================================================================

    cartSubComponents.forEach(function(el) {
      var className = (el.className || '').toLowerCase();
      if (className.indexOf('upsell') < 0 && className.indexOf('recommend') < 0 && className.indexOf('cross-sell') < 0) {
        return;
      }

      var productLinks = Array.from(el.querySelectorAll('a[href]'));
      productLinks.forEach(function(link) {
        results.stats.elementsScanned++;

        var name = h.getAccessibleName ? h.getAccessibleName(link) : (link.textContent || '').trim();

        if (name) {
          addPassed('4.1.2', 'Name, Role, Value', 'Upsell product link has accessible name', h.getSelector(link));
        } else {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Upsell product link has no accessible name',
            link,
            'Add product name as link text or aria-label'
          );
        }
      });

      var addButtons = Array.from(el.querySelectorAll('button, [role="button"]'));
      addButtons.forEach(function(btn) {
        results.stats.elementsScanned++;

        var name = h.getAccessibleName ? h.getAccessibleName(btn) : (btn.textContent || '').trim();

        if (name) {
          addPassed('4.1.2', 'Name, Role, Value', 'Upsell add button has accessible name: "' + name + '"', h.getSelector(btn));
        } else {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Upsell add-to-cart button has no accessible name',
            btn,
            'Add aria-label with product context (e.g., "Add Product Name to cart")'
          );
        }
      });
    });

    // ==========================================================================
    // TEST 8: Gift note textarea has a label (WCAG 3.3.2)
    // ==========================================================================

    var giftNotes = Array.from(doc.querySelectorAll(
      'textarea[class*="gift"], textarea[class*="note"], textarea[name*="note" i]'
    ));
    cartSubComponents.forEach(function(el) {
      var textareas = Array.from(el.querySelectorAll('textarea'));
      textareas.forEach(function(ta) {
        if (giftNotes.indexOf(ta) === -1) giftNotes.push(ta);
      });
    });

    giftNotes.forEach(function(textarea) {
      results.stats.elementsScanned++;

      var ariaLabel = textarea.getAttribute('aria-label');
      var ariaLabelledby = textarea.getAttribute('aria-labelledby');
      var id = textarea.getAttribute('id');
      var hasLabel = ariaLabel || (ariaLabelledby && doc.getElementById(ariaLabelledby));

      if (!hasLabel && id) {
        hasLabel = !!doc.querySelector('label[for="' + id + '"]');
      }

      if (hasLabel) {
        addPassed('3.3.2', 'Labels or Instructions', 'Gift note textarea has accessible label', h.getSelector(textarea));
      } else {
        addIssue(
          'minor',
          '3.3.2',
          'Labels or Instructions',
          'Gift note textarea has no accessible label',
          textarea,
          'Add a visible <label> or aria-label="Gift note" to the textarea'
        );
      }
    });

    // ==========================================================================
    // TEST 9: Cart total update announced on changes (WCAG 4.1.3)
    // ==========================================================================

    if (cartSubComponents.length > 0) {
      results.stats.elementsScanned++;

      var cartTotals = Array.from(doc.querySelectorAll(
        '[class*="cart-total"], [class*="subtotal"], [class*="order-total"]'
      ));

      var totalHasLive = cartTotals.some(function(total) {
        var live = total.getAttribute('aria-live');
        var role = total.getAttribute('role');
        var parentLive = total.parentElement && total.parentElement.getAttribute('aria-live');
        return live || role === 'status' || parentLive;
      });

      if (totalHasLive) {
        addPassed('4.1.3', 'Status Messages', 'Cart total has aria-live for update announcements', '');
      } else if (cartTotals.length > 0) {
        addIssue(
          'moderate',
          '4.1.3',
          'Status Messages',
          'Cart total does not announce updates when items are added via upsell or discount is applied',
          cartTotals[0],
          'Add aria-live="polite" to the cart total container'
        );
      }
    }

    // ==========================================================================
    // MANUAL CHECK: Upsell focus management
    // ==========================================================================

    if (cartSubComponents.length > 0) {
      addManualCheck(
        '2.4.3',
        'Verify upsell interactions do not break focus management within the cart drawer',
        'Add an upsell product to cart and verify focus remains logical. Apply a discount code and verify focus does not jump unexpectedly.',
        h.getSelector(cartSubComponents[0])
      );
    }

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.cartDrawerUpsellsSummary = {
      total: cartSubComponents.length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runCartDrawerUpsellsAudit = runCartDrawerUpsellsAudit;

})(typeof window !== 'undefined' ? window : global);
