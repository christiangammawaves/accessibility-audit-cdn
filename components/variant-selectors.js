/**
 * Variant Selectors Accessibility Audit
 * WCAG: 1.1.1, 1.3.1, 1.4.1, 2.1.1, 4.1.2, 4.1.3
 *
 * Audits product variant selectors — size buttons, color swatches, material dropdowns.
 * Goes deeper than pdp.js into radio group semantics, color swatch accessibility,
 * sold-out state communication, and variant change announcements.
 *
 * @module variant-selectors
 * @description Audit product variant selectors for accessibility compliance
 */

(function(global) {
  'use strict';

  function runVariantSelectorsAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        'variant-radios',
        'variant-selects',
        'variant-picker',
        '[class*="variant-picker"]',
        '[class*="variant-selector"]',
        '[class*="swatch-list"]',
        '[class*="option-selector"]',
        '[data-variant-picker]',
        '.product-form__input[data-option]'
      ]
    };

    var ref = global.a11yAudit.initComponent('variant-selectors', scope || CONFIG.scope);
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

    // Find variant selector elements
    var variantGroups = [];
    CONFIG.scope.forEach(function(selector) {
      try {
        var elements = Array.from(doc.querySelectorAll(selector));
        elements.forEach(function(el) {
          if (variantGroups.indexOf(el) === -1) {
            var isChild = variantGroups.some(function(existing) {
              return existing.contains(el);
            });
            if (!isChild) {
              variantGroups = variantGroups.filter(function(existing) {
                return !el.contains(existing);
              });
              variantGroups.push(el);
            }
          }
        });
      } catch (e) {
        // Selector not supported
      }
    });

    if (variantGroups.length === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: Variant group has accessible group label (WCAG 1.3.1)
    // ==========================================================================

    variantGroups.forEach(function(group) {
      results.stats.elementsScanned++;

      var isFieldset = group.tagName === 'FIELDSET';
      var legend = isFieldset ? group.querySelector('legend') : null;
      var roleGroup = group.getAttribute('role');
      var ariaLabel = group.getAttribute('aria-label');
      var ariaLabelledby = group.getAttribute('aria-labelledby');
      var hasGroupLabel = false;

      if (isFieldset && legend && legend.textContent.trim()) {
        hasGroupLabel = true;
      } else if ((roleGroup === 'radiogroup' || roleGroup === 'group') && (ariaLabel || ariaLabelledby)) {
        hasGroupLabel = true;
      } else if (ariaLabel || ariaLabelledby) {
        hasGroupLabel = true;
      }

      // Also check for a heading or label element preceding the group
      if (!hasGroupLabel) {
        var prevSibling = group.previousElementSibling;
        if (prevSibling && (prevSibling.tagName === 'LABEL' || /^H[1-6]$/.test(prevSibling.tagName))) {
          if (prevSibling.textContent.trim()) {
            hasGroupLabel = true;
          }
        }
      }

      if (hasGroupLabel) {
        addPassed('1.3.1', 'Info and Relationships', 'Variant group has accessible label', h.getSelector(group));
      } else {
        addIssue(
          'serious',
          '1.3.1',
          'Info and Relationships',
          'Variant group has no accessible group label (e.g., "Size", "Color")',
          group,
          'Wrap in <fieldset> with <legend>, or use role="radiogroup" with aria-label'
        );
      }
    });

    // ==========================================================================
    // TEST 2: Individual variant options have accessible names (WCAG 4.1.2)
    // ==========================================================================

    variantGroups.forEach(function(group) {
      var options = Array.from(group.querySelectorAll(
        'input[type="radio"], input[type="checkbox"], button, [role="radio"], [role="option"], [class*="swatch"], [class*="option"]'
      ));

      // Filter to only interactive-looking elements
      options = options.filter(function(opt) {
        return opt.tagName === 'INPUT' || opt.tagName === 'BUTTON' ||
               opt.getAttribute('role') === 'radio' || opt.getAttribute('role') === 'option' ||
               opt.getAttribute('tabindex') !== null;
      });

      options.forEach(function(opt) {
        results.stats.elementsScanned++;

        var name = '';
        if (opt.tagName === 'INPUT') {
          var label = opt.getAttribute('aria-label');
          var labelledby = opt.getAttribute('aria-labelledby');
          var id = opt.getAttribute('id');
          if (label) {
            name = label;
          } else if (labelledby) {
            var labelEl = doc.getElementById(labelledby);
            name = labelEl ? labelEl.textContent.trim() : '';
          } else if (id) {
            var associatedLabel = doc.querySelector('label[for="' + id + '"]');
            name = associatedLabel ? associatedLabel.textContent.trim() : '';
          }
          if (!name) {
            name = opt.getAttribute('value') || '';
          }
        } else {
          name = h.getAccessibleName ? h.getAccessibleName(opt) : (opt.getAttribute('aria-label') || opt.textContent || '').trim();
        }

        if (name) {
          addPassed('4.1.2', 'Name, Role, Value', 'Variant option has accessible name: "' + name + '"', h.getSelector(opt));
        } else {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Variant option has no accessible name',
            opt,
            'Add aria-label (e.g., "Size: Medium") or associate with a visible <label>'
          );
        }
      });
    });

    // ==========================================================================
    // TEST 3: Color swatches communicate color via text, not just color (WCAG 1.4.1)
    // ==========================================================================

    variantGroups.forEach(function(group) {
      var swatches = Array.from(group.querySelectorAll(
        '[class*="color"], [class*="colour"], [class*="swatch"], [data-color], [data-colour]'
      ));

      swatches.forEach(function(swatch) {
        results.stats.elementsScanned++;

        var hasTextName = false;
        var ariaLabel = swatch.getAttribute('aria-label');
        var title = swatch.getAttribute('title');
        var textContent = (swatch.textContent || '').trim();
        var dataColor = swatch.getAttribute('data-color') || swatch.getAttribute('data-colour') || swatch.getAttribute('data-value');

        if (ariaLabel || title || textContent || dataColor) {
          hasTextName = true;
        }

        // Check for associated label on input
        if (!hasTextName && swatch.tagName === 'INPUT') {
          var id = swatch.getAttribute('id');
          if (id) {
            var label = doc.querySelector('label[for="' + id + '"]');
            if (label && label.textContent.trim()) {
              hasTextName = true;
            }
          }
        }

        if (hasTextName) {
          addPassed('1.4.1', 'Use of Color', 'Color swatch communicates color name via text', h.getSelector(swatch));
        } else {
          addIssue(
            'serious',
            '1.4.1',
            'Use of Color',
            'Color swatch relies solely on color — no text name, aria-label, or tooltip provided',
            swatch,
            'Add aria-label="Color: Ivory" or a visible text label for each color swatch'
          );
        }
      });
    });

    // ==========================================================================
    // TEST 4: Selected variant state communicated (WCAG 4.1.2)
    // ==========================================================================

    variantGroups.forEach(function(group) {
      var options = Array.from(group.querySelectorAll(
        'input[type="radio"], [role="radio"], [role="option"], button[class*="swatch"], button[class*="option"]'
      ));

      if (options.length === 0) return;

      results.stats.elementsScanned++;

      var hasStateIndicator = options.some(function(opt) {
        return opt.getAttribute('aria-checked') !== null ||
               opt.getAttribute('aria-selected') !== null ||
               opt.getAttribute('aria-pressed') !== null ||
               (opt.tagName === 'INPUT' && opt.type === 'radio');
      });

      if (hasStateIndicator) {
        addPassed('4.1.2', 'Name, Role, Value', 'Variant options communicate selected state', h.getSelector(group));
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Variant options do not communicate selected/unselected state to assistive technology',
          options[0],
          'Use aria-checked="true", aria-selected="true", or native radio inputs for selection state'
        );
      }
    });

    // ==========================================================================
    // TEST 5: Sold-out / unavailable variants indicated accessibly (WCAG 4.1.2)
    // ==========================================================================

    variantGroups.forEach(function(group) {
      var disabledOptions = Array.from(group.querySelectorAll(
        '[class*="sold-out"], [class*="unavailable"], [class*="disabled"], [class*="out-of-stock"], [disabled]'
      ));

      disabledOptions.forEach(function(opt) {
        results.stats.elementsScanned++;

        var ariaDisabled = opt.getAttribute('aria-disabled');
        var nativeDisabled = opt.hasAttribute('disabled');

        if (ariaDisabled === 'true' || nativeDisabled) {
          addPassed('4.1.2', 'Name, Role, Value', 'Unavailable variant is marked as disabled for assistive technology', h.getSelector(opt));
        } else {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Unavailable/sold-out variant is only visually indicated — not communicated to screen readers',
            opt,
            'Add aria-disabled="true" and include "sold out" or "unavailable" in the accessible name'
          );
        }
      });
    });

    // ==========================================================================
    // TEST 6: Variant selection updates announced via aria-live (WCAG 4.1.3)
    // ==========================================================================

    if (variantGroups.length > 0) {
      results.stats.elementsScanned++;

      var liveRegions = Array.from(doc.querySelectorAll('[aria-live], [role="status"], [role="alert"]'));
      var hasLiveRegion = liveRegions.length > 0;

      if (hasLiveRegion) {
        addPassed('4.1.3', 'Status Messages', 'Page has aria-live region(s) for variant change announcements', '');
      } else {
        addIssue(
          'moderate',
          '4.1.3',
          'Status Messages',
          'No aria-live region found for announcing variant selection changes (price, availability)',
          variantGroups[0],
          'Add an aria-live="polite" region to announce price/availability updates when variants change'
        );
      }
    }

    // ==========================================================================
    // TEST 7: Variant options are keyboard navigable (WCAG 2.1.1)
    // ==========================================================================

    variantGroups.forEach(function(group) {
      var options = Array.from(group.querySelectorAll(
        'input[type="radio"], button, [role="radio"], [role="option"], [tabindex]'
      ));

      if (options.length === 0) return;

      results.stats.elementsScanned++;

      var inaccessible = options.filter(function(opt) {
        var tabindex = opt.getAttribute('tabindex');
        return tabindex === '-1' && opt.tagName !== 'INPUT';
      });

      if (inaccessible.length > 0 && inaccessible.length === options.length) {
        addIssue(
          'moderate',
          '2.1.1',
          'Keyboard',
          'All variant options have tabindex="-1" — none are keyboard reachable',
          inaccessible[0],
          'Ensure at least one option per group is keyboard focusable (tabindex="0" or native radio input)'
        );
      } else {
        addPassed('2.1.1', 'Keyboard', 'Variant options are keyboard navigable', h.getSelector(group));
      }
    });

    // ==========================================================================
    // TEST 8: Color swatch images have alt text (WCAG 1.1.1)
    // ==========================================================================

    variantGroups.forEach(function(group) {
      var swatchImages = Array.from(group.querySelectorAll('img'));

      swatchImages.forEach(function(img) {
        results.stats.elementsScanned++;

        var alt = img.getAttribute('alt');
        var ariaHidden = img.getAttribute('aria-hidden');
        var role = img.getAttribute('role');

        if (ariaHidden === 'true' || role === 'presentation' || role === 'none') {
          // Decorative image — check that parent has accessible name
          addPassed('1.1.1', 'Non-text Content', 'Swatch image marked decorative (parent provides name)', h.getSelector(img));
        } else if (alt && alt.trim()) {
          addPassed('1.1.1', 'Non-text Content', 'Swatch image has alt text: "' + alt + '"', h.getSelector(img));
        } else {
          addIssue(
            'moderate',
            '1.1.1',
            'Non-text Content',
            'Color swatch image has no alt text',
            img,
            'Add alt text describing the color (e.g., alt="Ivory Jacquard") or mark as decorative with alt=""'
          );
        }
      });
    });

    // ==========================================================================
    // MANUAL CHECK: Variant-gallery synchronization
    // ==========================================================================

    if (variantGroups.length > 0) {
      addManualCheck(
        '4.1.3',
        'Verify that selecting a variant updates the product gallery accessibly',
        'Select different color/size variants and verify the product image updates. Check that the new image alt text reflects the selected variant.',
        h.getSelector(variantGroups[0])
      );
    }

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.variantSelectorsSummary = {
      total: variantGroups.length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runVariantSelectorsAudit = runVariantSelectorsAudit;

})(typeof window !== 'undefined' ? window : global);
