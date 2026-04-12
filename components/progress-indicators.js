/**
 * Progress Indicators Accessibility Audit
 * WCAG: 1.3.1, 1.4.1, 4.1.2, 4.1.3
 *
 * Audits progress bars, loading spinners, and step indicators
 * for proper ARIA roles and screen reader communication.
 *
 * @module progress-indicators
 * @description Audit progress bars, spinners, and step indicators for accessibility
 */

(function(global) {
  'use strict';

  function runProgressIndicatorsAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        '[role="progressbar"]',
        'progress',
        '[role="meter"]',
        '.spinner',
        '.loading',
        '[class*="progress"]',
        '[class*="spinner"]',
        '[class*="loader"]',
        '[class*="step-indicator"]',
        '[aria-busy="true"]'
      ]
    };

    var ref = global.a11yAudit.initComponent('progress-indicators', scope || CONFIG.scope);
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

    // Categorize found elements
    var progressBars = [];
    var spinners = [];
    var stepIndicators = [];
    var busyRegions = [];

    // Find progress bars
    Array.from(doc.querySelectorAll('[role="progressbar"], progress, [role="meter"]')).forEach(function(el) {
      if (progressBars.indexOf(el) === -1) progressBars.push(el);
    });

    // Find spinners/loaders
    ['.spinner', '.loading', '[class*="spinner"]', '[class*="loader"]'].forEach(function(selector) {
      try {
        Array.from(doc.querySelectorAll(selector)).forEach(function(el) {
          if (progressBars.indexOf(el) === -1 && spinners.indexOf(el) === -1) {
            spinners.push(el);
          }
        });
      } catch (e) {
        // Selector not supported
      }
    });

    // Find step indicators
    try {
      Array.from(doc.querySelectorAll('[class*="step-indicator"], [class*="stepper"], [class*="wizard-step"]')).forEach(function(el) {
        if (stepIndicators.indexOf(el) === -1) stepIndicators.push(el);
      });
    } catch (e) {
      // Selector not supported
    }

    // Find busy regions
    Array.from(doc.querySelectorAll('[aria-busy="true"]')).forEach(function(el) {
      if (progressBars.indexOf(el) === -1 && spinners.indexOf(el) === -1) {
        busyRegions.push(el);
      }
    });

    // Also find generic progress elements
    try {
      Array.from(doc.querySelectorAll('[class*="progress"]')).forEach(function(el) {
        if (progressBars.indexOf(el) === -1 && spinners.indexOf(el) === -1 &&
            stepIndicators.indexOf(el) === -1) {
          // Check if it looks like a progress bar
          var role = el.getAttribute('role');
          if (role === 'progressbar' || el.tagName === 'PROGRESS') return;
          progressBars.push(el);
        }
      });
    } catch (e) {
      // Selector not supported
    }

    var totalElements = progressBars.length + spinners.length + stepIndicators.length + busyRegions.length;

    if (totalElements === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: Progress bars have role="progressbar" or use <progress> (WCAG 4.1.2)
    // ==========================================================================

    progressBars.forEach(function(bar) {
      results.stats.elementsScanned++;

      var role = bar.getAttribute('role');
      var tagName = bar.tagName.toLowerCase();

      if (tagName === 'progress') {
        addPassed('4.1.2', 'Name, Role, Value', 'Uses native <progress> element', h.getSelector(bar));
      } else if (role === 'progressbar') {
        addPassed('4.1.2', 'Name, Role, Value', 'Progress bar has role="progressbar"', h.getSelector(bar));
      } else if (role === 'meter') {
        addPassed('4.1.2', 'Name, Role, Value', 'Meter element has role="meter"', h.getSelector(bar));
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Progress indicator missing role="progressbar" (or native <progress> element)',
          bar,
          'Add role="progressbar" or use the native <progress> element'
        );
      }
    });

    // ==========================================================================
    // TEST 2: Progress bar has aria-valuenow, min, max (WCAG 4.1.2)
    // ==========================================================================

    progressBars.forEach(function(bar) {
      results.stats.elementsScanned++;

      var tagName = bar.tagName.toLowerCase();
      var role = bar.getAttribute('role');

      // Native <progress> uses value/max attributes
      if (tagName === 'progress') {
        if (bar.hasAttribute('value')) {
          addPassed('4.1.2', 'Name, Role, Value', 'Native <progress> has value attribute', h.getSelector(bar));
        }
        return;
      }

      if (role !== 'progressbar' && role !== 'meter') return;

      var hasValueNow = bar.hasAttribute('aria-valuenow');
      var hasValueMin = bar.hasAttribute('aria-valuemin');
      var hasValueMax = bar.hasAttribute('aria-valuemax');

      // Check for indeterminate progress (no valuenow is OK)
      var isIndeterminate = !hasValueNow && (bar.className || '').toLowerCase().indexOf('indeterminate') >= 0;

      if (isIndeterminate) {
        addPassed('4.1.2', 'Name, Role, Value', 'Indeterminate progress bar (no aria-valuenow needed)', h.getSelector(bar));
        return;
      }

      var missing = [];
      if (!hasValueNow) missing.push('aria-valuenow');
      if (!hasValueMin) missing.push('aria-valuemin');
      if (!hasValueMax) missing.push('aria-valuemax');

      if (missing.length === 0) {
        addPassed('4.1.2', 'Name, Role, Value', 'Progress bar has all value attributes', h.getSelector(bar));
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Progress bar missing: ' + missing.join(', '),
          bar,
          'Add ' + missing.join(', ') + ' to communicate progress to screen readers'
        );
      }
    });

    // ==========================================================================
    // TEST 3: Progress bar has accessible label (WCAG 4.1.2)
    // ==========================================================================

    progressBars.forEach(function(bar) {
      results.stats.elementsScanned++;

      var role = bar.getAttribute('role');
      if (role !== 'progressbar' && role !== 'meter' && bar.tagName.toLowerCase() !== 'progress') return;

      var ariaLabel = bar.getAttribute('aria-label');
      var ariaLabelledby = bar.getAttribute('aria-labelledby');

      if (ariaLabel) {
        addPassed('4.1.2', 'Name, Role, Value', 'Progress bar has aria-label', h.getSelector(bar));
      } else if (ariaLabelledby) {
        addPassed('4.1.2', 'Name, Role, Value', 'Progress bar has aria-labelledby', h.getSelector(bar));
      } else {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Progress bar has no accessible label',
          bar,
          'Add aria-label (e.g., "Upload progress") or aria-labelledby'
        );
      }
    });

    // ==========================================================================
    // TEST 4: Indeterminate progress uses aria-busy (WCAG 4.1.3)
    // ==========================================================================

    busyRegions.forEach(function(region) {
      results.stats.elementsScanned++;

      var ariaLive = region.getAttribute('aria-live');
      var role = region.getAttribute('role');

      if (ariaLive || role === 'alert' || role === 'status') {
        addPassed('4.1.3', 'Status Messages', 'Busy region has live region semantics', h.getSelector(region));
      } else {
        addIssue(
          'moderate',
          '4.1.3',
          'Status Messages',
          'Region with aria-busy="true" has no live region to announce completion',
          region,
          'Add aria-live="polite" to announce when loading completes'
        );
      }
    });

    // ==========================================================================
    // TEST 5: Loading spinners have screen-reader text (WCAG 4.1.2)
    // ==========================================================================

    spinners.forEach(function(spinner) {
      results.stats.elementsScanned++;

      var ariaLabel = spinner.getAttribute('aria-label');
      var ariaLabelledby = spinner.getAttribute('aria-labelledby');
      var role = spinner.getAttribute('role');
      var textContent = (spinner.textContent || '').trim();

      // Check for visually hidden text
      var srText = spinner.querySelector('.sr-only, .visually-hidden, [class*="screen-reader"], [class*="sr-only"]');

      if (ariaLabel) {
        addPassed('4.1.2', 'Name, Role, Value', 'Spinner has aria-label="' + ariaLabel + '"', h.getSelector(spinner));
      } else if (ariaLabelledby) {
        addPassed('4.1.2', 'Name, Role, Value', 'Spinner has aria-labelledby', h.getSelector(spinner));
      } else if (srText) {
        addPassed('4.1.2', 'Name, Role, Value', 'Spinner has screen-reader text', h.getSelector(spinner));
      } else if (role === 'progressbar' || role === 'status') {
        // Has a role, partial pass
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Spinner has role but no accessible label',
          spinner,
          'Add aria-label="Loading" or similar descriptive text'
        );
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Loading spinner has no screen-reader-accessible text',
          spinner,
          'Add aria-label="Loading" and role="status" to the spinner'
        );
      }
    });

    // ==========================================================================
    // TEST 6: Step indicators communicate current step (WCAG 4.1.2)
    // ==========================================================================

    stepIndicators.forEach(function(stepper) {
      results.stats.elementsScanned++;

      var currentStep = stepper.querySelector('[aria-current="step"]');
      var activeClass = stepper.querySelector('[class*="active"], [class*="current"]');

      if (currentStep) {
        addPassed('4.1.2', 'Name, Role, Value', 'Step indicator uses aria-current="step"', h.getSelector(stepper));
      } else if (activeClass) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Step indicator shows current step via CSS class but lacks aria-current="step"',
          stepper,
          'Add aria-current="step" to the current step element'
        );
      }
    });

    // ==========================================================================
    // TEST 7: Step indicators communicate total steps (WCAG 1.3.1)
    // ==========================================================================

    stepIndicators.forEach(function(stepper) {
      results.stats.elementsScanned++;

      var steps = stepper.querySelectorAll('[class*="step"], li');
      if (steps.length > 1) {
        // Check for text like "Step 2 of 5"
        var textContent = stepper.textContent || '';
        var hasStepCount = /step\s+\d+\s+(of|\/)\s+\d+/i.test(textContent);
        var hasAriaLabel = stepper.getAttribute('aria-label');

        if (hasStepCount) {
          addPassed('1.3.1', 'Info and Relationships', 'Step indicator communicates total steps', h.getSelector(stepper));
        } else if (hasAriaLabel && /\d+/.test(hasAriaLabel)) {
          addPassed('1.3.1', 'Info and Relationships', 'Step indicator aria-label includes step info', h.getSelector(stepper));
        } else {
          addIssue(
            'minor',
            '1.3.1',
            'Info and Relationships',
            'Step indicator does not communicate total steps (e.g., "Step 2 of 5")',
            stepper,
            'Add text or aria-label indicating current step and total (e.g., "Step 2 of 5")'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 8: Completed steps distinguishable by more than color (WCAG 1.4.1)
    // ==========================================================================

    stepIndicators.forEach(function(stepper) {
      results.stats.elementsScanned++;

      var completedSteps = stepper.querySelectorAll('[class*="complete"], [class*="done"], [class*="finished"]');

      if (completedSteps.length > 0) {
        // Check if completed steps have non-color indicators (checkmarks, icons, text)
        var hasNonColorIndicator = Array.from(completedSteps).some(function(step) {
          var hasIcon = step.querySelector('svg, img, [class*="icon"], [class*="check"]');
          var hasAriaLabel = step.getAttribute('aria-label');
          return hasIcon || hasAriaLabel;
        });

        if (hasNonColorIndicator) {
          addPassed('1.4.1', 'Use of Color', 'Completed steps use non-color indicators', h.getSelector(stepper));
        } else {
          addIssue(
            'moderate',
            '1.4.1',
            'Use of Color',
            'Completed steps may rely only on color to indicate completion',
            stepper,
            'Add icons, checkmarks, or text to distinguish completed steps beyond color'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 9: Live region for progress updates (minor best practice)
    // ==========================================================================

    progressBars.forEach(function(bar) {
      results.stats.elementsScanned++;

      var role = bar.getAttribute('role');
      if (role !== 'progressbar') return;

      var ariaLive = bar.getAttribute('aria-live');
      var parent = bar.parentElement;
      var parentLive = parent ? parent.getAttribute('aria-live') : null;

      if (!ariaLive && !parentLive) {
        addIssue(
          'minor',
          '4.1.3',
          'Status Messages',
          'Progress bar has no live region to announce updates',
          bar,
          'Consider wrapping in aria-live="polite" for long operations'
        );
      }
    });

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.progressSummary = {
      progressBars: progressBars.length,
      spinners: spinners.length,
      stepIndicators: stepIndicators.length,
      busyRegions: busyRegions.length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runProgressIndicatorsAudit = runProgressIndicatorsAudit;

})(typeof window !== 'undefined' ? window : global);
