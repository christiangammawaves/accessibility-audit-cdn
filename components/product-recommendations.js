/**
 * Product Recommendations Accessibility Audit
 * WCAG: 1.1.1, 1.3.1, 2.1.1, 2.4.6, 4.1.2, 4.1.3
 *
 * Audits product recommendation sections — "You May Also Like", "Shop the Look",
 * "Recently Viewed", etc. These sections often load dynamically and miss
 * accessibility basics like headings, image alt text, and carousel controls.
 *
 * @module product-recommendations
 * @description Audit product recommendation sections for accessibility compliance
 */

(function(global) {
  'use strict';

  function runProductRecommendationsAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        'product-recommendations',
        'recently-viewed-products',
        '[class*="recommended"]',
        '[class*="you-may-also"]',
        '[class*="shop-the-look"]',
        '[class*="complete-the-look"]',
        '[class*="style-with"]',
        '[class*="recently-viewed"]',
        '[class*="related-products"]',
        '[data-recommendations]',
        '.product-feed'
      ]
    };

    var ref = global.a11yAudit.initComponent('product-recommendations', scope || CONFIG.scope);
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

    // Find recommendation sections
    var recSections = [];
    CONFIG.scope.forEach(function(selector) {
      try {
        var elements = Array.from(doc.querySelectorAll(selector));
        elements.forEach(function(el) {
          if (recSections.indexOf(el) === -1) {
            var isChild = recSections.some(function(existing) {
              return existing.contains(el);
            });
            if (!isChild) {
              recSections = recSections.filter(function(existing) {
                return !el.contains(existing);
              });
              recSections.push(el);
            }
          }
        });
      } catch (e) {
        // Selector not supported
      }
    });

    if (recSections.length === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: Recommendation section has heading or aria-label (WCAG 2.4.6)
    // ==========================================================================

    recSections.forEach(function(section) {
      results.stats.elementsScanned++;

      var heading = section.querySelector('h1, h2, h3, h4, h5, h6');
      var ariaLabel = section.getAttribute('aria-label');
      var ariaLabelledby = section.getAttribute('aria-labelledby');

      if (heading && heading.textContent.trim()) {
        addPassed('2.4.6', 'Headings and Labels', 'Recommendation section has heading: "' + heading.textContent.trim() + '"', h.getSelector(section));
      } else if (ariaLabel) {
        addPassed('2.4.6', 'Headings and Labels', 'Recommendation section has aria-label: "' + ariaLabel + '"', h.getSelector(section));
      } else if (ariaLabelledby) {
        var labelEl = doc.getElementById(ariaLabelledby);
        if (labelEl && labelEl.textContent.trim()) {
          addPassed('2.4.6', 'Headings and Labels', 'Recommendation section has aria-labelledby', h.getSelector(section));
        } else {
          addIssue(
            'moderate',
            '2.4.6',
            'Headings and Labels',
            'Recommendation section aria-labelledby references missing or empty element',
            section,
            'Ensure aria-labelledby points to an element with descriptive text'
          );
        }
      } else {
        addIssue(
          'moderate',
          '2.4.6',
          'Headings and Labels',
          'Recommendation section has no heading or aria-label to identify it',
          section,
          'Add a heading (e.g., <h2>You May Also Like</h2>) or aria-label to the section'
        );
      }
    });

    // ==========================================================================
    // TEST 2: Dynamically loaded recommendations announced (WCAG 4.1.3)
    // ==========================================================================

    recSections.forEach(function(section) {
      results.stats.elementsScanned++;

      var ariaLive = section.getAttribute('aria-live');
      var roleStatus = section.getAttribute('role');
      var parentLive = section.parentElement && section.parentElement.getAttribute('aria-live');

      if (ariaLive || roleStatus === 'status' || parentLive) {
        addPassed('4.1.3', 'Status Messages', 'Recommendation section has aria-live for dynamic content', h.getSelector(section));
      } else {
        addIssue(
          'minor',
          '4.1.3',
          'Status Messages',
          'Recommendation section may load dynamically but has no aria-live region for announcements',
          section,
          'Add aria-live="polite" to the container if recommendations load asynchronously'
        );
      }
    });

    // ==========================================================================
    // TEST 3: Product cards have accessible names (WCAG 4.1.2)
    // ==========================================================================

    recSections.forEach(function(section) {
      var productLinks = Array.from(section.querySelectorAll('a[href]'));

      productLinks.forEach(function(link) {
        results.stats.elementsScanned++;

        var name = h.getAccessibleName ? h.getAccessibleName(link) : '';
        if (!name) {
          name = (link.textContent || '').trim();
        }
        if (!name) {
          name = (link.getAttribute('aria-label') || '').trim();
        }

        if (name) {
          addPassed('4.1.2', 'Name, Role, Value', 'Product link has accessible name', h.getSelector(link));
        } else {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Product link in recommendations has no accessible name',
            link,
            'Add descriptive link text or aria-label with the product name'
          );
        }
      });
    });

    // ==========================================================================
    // TEST 4: Product images have meaningful alt text (WCAG 1.1.1)
    // ==========================================================================

    recSections.forEach(function(section) {
      var images = Array.from(section.querySelectorAll('img'));

      images.forEach(function(img) {
        results.stats.elementsScanned++;

        var alt = img.getAttribute('alt');
        var ariaHidden = img.getAttribute('aria-hidden');
        var role = img.getAttribute('role');

        if (ariaHidden === 'true' || role === 'presentation' || role === 'none') {
          // Decorative — acceptable if link/parent has name
          return;
        }

        if (alt === null || alt === undefined) {
          addIssue(
            'serious',
            '1.1.1',
            'Non-text Content',
            'Product image in recommendations has no alt attribute',
            img,
            'Add alt text with the product name (e.g., alt="Product Name")'
          );
        } else if (alt.trim() === '') {
          // Empty alt — check if it's within a link that has text
          var parentLink = img.closest('a');
          if (parentLink) {
            var linkText = (parentLink.textContent || '').replace((img.textContent || ''), '').trim();
            if (!linkText && !parentLink.getAttribute('aria-label')) {
              addIssue(
                'serious',
                '1.1.1',
                'Non-text Content',
                'Product image has empty alt and is inside a link with no text — product is inaccessible',
                img,
                'Add alt text with the product name or add text to the parent link'
              );
            }
          }
        } else {
          // Check for filename-like alt text
          var isFilename = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(alt);
          if (isFilename) {
            addIssue(
              'serious',
              '1.1.1',
              'Non-text Content',
              'Product image alt text appears to be a filename: "' + alt + '"',
              img,
              'Replace with a meaningful product description'
            );
          } else {
            addPassed('1.1.1', 'Non-text Content', 'Product image has meaningful alt text', h.getSelector(img));
          }
        }
      });
    });

    // ==========================================================================
    // TEST 5: Carousel controls if horizontal slider (WCAG 2.1.1)
    // ==========================================================================

    recSections.forEach(function(section) {
      var carouselIndicators = section.querySelector(
        '[class*="carousel"], [class*="slider"], [class*="swiper"], [class*="slick"], [class*="flickity"], [class*="scroll"]'
      );

      if (carouselIndicators) {
        results.stats.elementsScanned++;

        var navButtons = Array.from(section.querySelectorAll(
          'button[class*="prev"], button[class*="next"], button[class*="arrow"], [class*="nav-button"], [class*="carousel-control"]'
        ));

        if (navButtons.length > 0) {
          var unlabeled = navButtons.filter(function(btn) {
            var name = h.getAccessibleName ? h.getAccessibleName(btn) : (btn.getAttribute('aria-label') || btn.textContent || '').trim();
            return !name;
          });

          if (unlabeled.length > 0) {
            addIssue(
              'moderate',
              '4.1.2',
              'Name, Role, Value',
              unlabeled.length + ' carousel navigation button(s) in recommendations lack accessible names',
              unlabeled[0],
              'Add aria-label (e.g., "Previous products", "Next products") to carousel buttons'
            );
          } else {
            addPassed('4.1.2', 'Name, Role, Value', 'Carousel navigation buttons have accessible names', h.getSelector(section));
          }
        }

        // Check keyboard accessibility of carousel
        var focusableInCarousel = Array.from(section.querySelectorAll('a[href], button, [tabindex="0"]'));
        if (focusableInCarousel.length === 0) {
          addIssue(
            'moderate',
            '2.1.1',
            'Keyboard',
            'Recommendation carousel has no keyboard-focusable elements',
            section,
            'Ensure product links and navigation controls are keyboard accessible'
          );
        } else {
          addPassed('2.1.1', 'Keyboard', 'Recommendation carousel has keyboard-focusable elements', h.getSelector(section));
        }
      }
    });

    // ==========================================================================
    // TEST 6: Quick-add buttons have unique accessible names (WCAG 4.1.2)
    // ==========================================================================

    recSections.forEach(function(section) {
      var quickAddButtons = Array.from(section.querySelectorAll(
        'button[class*="quick"], [class*="quick-add"], [class*="quick-shop"]'
      ));

      if (quickAddButtons.length > 1) {
        results.stats.elementsScanned++;

        var names = quickAddButtons.map(function(btn) {
          return (h.getAccessibleName ? h.getAccessibleName(btn) : (btn.textContent || '').trim()).toLowerCase();
        });

        var allSame = names.every(function(name) { return name === names[0]; });

        if (allSame && names[0]) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'All ' + quickAddButtons.length + ' quick-add buttons have identical name "' + names[0] + '" — screen readers cannot distinguish them',
            quickAddButtons[0],
            'Include product name in each button (e.g., "Quick add: Product Name")'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 7: "Shop the Look" hotspot pins have accessible labels (WCAG 4.1.2)
    // ==========================================================================

    recSections.forEach(function(section) {
      var hotspots = Array.from(section.querySelectorAll(
        '[class*="hotspot"], [class*="pin"], [class*="dot"][role="button"], [class*="lookbook-point"]'
      ));

      hotspots.forEach(function(pin) {
        results.stats.elementsScanned++;

        var name = h.getAccessibleName ? h.getAccessibleName(pin) : (pin.getAttribute('aria-label') || pin.textContent || '').trim();

        if (name) {
          addPassed('4.1.2', 'Name, Role, Value', 'Shop the Look hotspot has accessible label', h.getSelector(pin));
        } else {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            '"Shop the Look" hotspot pin has no accessible label — screen reader users cannot identify the product',
            pin,
            'Add aria-label describing the product (e.g., "View: Linen Blazer")'
          );
        }
      });
    });

    // ==========================================================================
    // MANUAL CHECK: Reading flow disruption
    // ==========================================================================

    if (recSections.length > 0) {
      addManualCheck(
        '1.3.1',
        'Verify recommendation section does not disrupt reading flow for screen readers',
        'Navigate through the page with a screen reader. Verify that the recommendation section is logically placed and does not interrupt the main content flow.',
        h.getSelector(recSections[0])
      );
    }

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.productRecommendationsSummary = {
      total: recSections.length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runProductRecommendationsAudit = runProductRecommendationsAudit;

})(typeof window !== 'undefined' ? window : global);
