/**
 * Date Picker Accessibility Audit
 * WCAG: 1.3.1, 2.1.1, 2.4.3, 2.5.3, 4.1.2
 *
 * Audits date picker and calendar widgets for keyboard and screen reader accessibility.
 *
 * @module date-picker
 * @description Audit date picker/calendar widgets for accessibility compliance
 */

(function(global) {
  'use strict';

  function runDatePickerAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        '[type="date"]',
        '[data-datepicker]',
        '[role="dialog"][aria-label*="date" i]',
        '[role="dialog"][aria-label*="calendar" i]',
        '.datepicker',
        '.date-picker',
        '.calendar-widget',
        '[class*="datepicker"]',
        '[class*="date-picker"]'
      ]
    };

    var ref = global.a11yAudit.initComponent('date-picker', scope || CONFIG.scope);
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

    // Find date picker elements
    var datePickers = [];
    CONFIG.scope.forEach(function(selector) {
      try {
        var elements = Array.from(doc.querySelectorAll(selector));
        elements.forEach(function(el) {
          if (datePickers.indexOf(el) === -1) datePickers.push(el);
        });
      } catch (e) {
        // Selector may not be supported in all environments
      }
    });

    if (datePickers.length === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: Calendar grid uses proper roles (WCAG 4.1.2)
    // ==========================================================================

    datePickers.forEach(function(picker) {
      results.stats.elementsScanned++;

      // Native date inputs get a pass
      if (picker.tagName === 'INPUT' && picker.type === 'date') {
        addPassed('4.1.2', 'Name, Role, Value', 'Native date input provides built-in accessibility', h.getSelector(picker));
        return;
      }

      var grid = picker.querySelector('[role="grid"]') || picker.querySelector('table');
      if (grid) {
        if (grid.getAttribute('role') === 'grid') {
          addPassed('4.1.2', 'Name, Role, Value', 'Calendar uses role="grid"', h.getSelector(grid));

          // Check for gridcell roles
          var gridcells = grid.querySelectorAll('[role="gridcell"]');
          var tds = grid.querySelectorAll('td');
          if (gridcells.length > 0) {
            addPassed('4.1.2', 'Name, Role, Value', 'Calendar dates use role="gridcell"', h.getSelector(grid));
          } else if (tds.length > 0) {
            addIssue(
              'serious',
              '4.1.2',
              'Name, Role, Value',
              'Calendar date cells missing role="gridcell"',
              tds[0],
              'Add role="gridcell" to each selectable date cell'
            );
          }
        } else {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Calendar grid missing role="grid"',
            grid,
            'Add role="grid" to the calendar table element'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 2: Date picker has accessible label (WCAG 4.1.2)
    // ==========================================================================

    datePickers.forEach(function(picker) {
      results.stats.elementsScanned++;

      var ariaLabel = picker.getAttribute('aria-label');
      var ariaLabelledby = picker.getAttribute('aria-labelledby');
      var hasLabel = false;

      if (picker.tagName === 'INPUT') {
        var id = picker.getAttribute('id');
        var label = id ? doc.querySelector('label[for="' + id + '"]') : null;
        hasLabel = !!(label || ariaLabel || ariaLabelledby);
      } else {
        hasLabel = !!(ariaLabel || ariaLabelledby);
      }

      if (hasLabel) {
        addPassed('4.1.2', 'Name, Role, Value', 'Date picker has an accessible label', h.getSelector(picker));
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Date picker has no accessible label',
          picker,
          'Add aria-label, aria-labelledby, or associate a <label> element'
        );
      }
    });

    // ==========================================================================
    // TEST 3: Selected date communicated via aria-selected (WCAG 4.1.2)
    // ==========================================================================

    datePickers.forEach(function(picker) {
      if (picker.tagName === 'INPUT' && picker.type === 'date') return;

      results.stats.elementsScanned++;

      var gridcells = picker.querySelectorAll('[role="gridcell"]');
      if (gridcells.length === 0) return;

      var hasSelected = Array.from(gridcells).some(function(cell) {
        return cell.getAttribute('aria-selected') === 'true';
      });

      if (hasSelected) {
        addPassed('4.1.2', 'Name, Role, Value', 'Selected date uses aria-selected="true"', h.getSelector(picker));
      } else {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'No date cell has aria-selected="true" to indicate selection',
          picker,
          'Set aria-selected="true" on the currently selected date'
        );
      }
    });

    // ==========================================================================
    // TEST 4: Current date indicated via aria-current (WCAG 4.1.2)
    // ==========================================================================

    datePickers.forEach(function(picker) {
      if (picker.tagName === 'INPUT' && picker.type === 'date') return;

      results.stats.elementsScanned++;

      var hasCurrent = picker.querySelector('[aria-current="date"]');

      if (hasCurrent) {
        addPassed('4.1.2', 'Name, Role, Value', 'Current date indicated with aria-current="date"', h.getSelector(picker));
      } else {
        addIssue(
          'minor',
          '4.1.2',
          'Name, Role, Value',
          'No date cell uses aria-current="date" to indicate today\'s date',
          picker,
          'Add aria-current="date" to today\'s date cell'
        );
      }
    });

    // ==========================================================================
    // TEST 5: Disabled dates have aria-disabled (WCAG 4.1.2)
    // ==========================================================================

    datePickers.forEach(function(picker) {
      if (picker.tagName === 'INPUT' && picker.type === 'date') return;

      results.stats.elementsScanned++;

      var gridcells = picker.querySelectorAll('[role="gridcell"]');
      var disabledLooking = Array.from(gridcells).filter(function(cell) {
        var hasDisabledClass = (cell.className || '').toLowerCase().indexOf('disabled') >= 0;
        return hasDisabledClass && cell.getAttribute('aria-disabled') !== 'true';
      });

      if (disabledLooking.length > 0) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          disabledLooking.length + ' visually disabled dates missing aria-disabled="true"',
          disabledLooking[0],
          'Add aria-disabled="true" to dates that are not selectable'
        );
      }
    });

    // ==========================================================================
    // TEST 6: Month/year navigation buttons are keyboard accessible (WCAG 2.1.1)
    // ==========================================================================

    datePickers.forEach(function(picker) {
      if (picker.tagName === 'INPUT' && picker.type === 'date') return;

      results.stats.elementsScanned++;

      var navButtons = Array.from(picker.querySelectorAll('button, [role="button"]')).filter(function(btn) {
        var text = (btn.textContent || '').toLowerCase();
        var label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return text.indexOf('prev') >= 0 || text.indexOf('next') >= 0 ||
               label.indexOf('prev') >= 0 || label.indexOf('next') >= 0 ||
               label.indexOf('month') >= 0 || label.indexOf('year') >= 0;
      });

      if (navButtons.length > 0) {
        var inaccessible = navButtons.filter(function(btn) {
          var tabindex = btn.getAttribute('tabindex');
          return tabindex === '-1';
        });

        if (inaccessible.length > 0) {
          addIssue(
            'moderate',
            '2.1.1',
            'Keyboard',
            'Month/year navigation buttons have tabindex="-1"',
            inaccessible[0],
            'Remove tabindex="-1" from navigation buttons or use tabindex="0"'
          );
        } else {
          addPassed('2.1.1', 'Keyboard', 'Month/year navigation buttons are keyboard accessible', h.getSelector(picker));
        }
      }
    });

    // ==========================================================================
    // TEST 7: Dismiss with Escape key (WCAG 2.1.1)
    // ==========================================================================

    datePickers.forEach(function(picker) {
      if (picker.tagName === 'INPUT' && picker.type === 'date') return;

      results.stats.elementsScanned++;

      var isDialog = picker.getAttribute('role') === 'dialog' ||
                     picker.tagName === 'DIALOG';

      if (isDialog) {
        addManualCheck(
          '2.1.1',
          'Verify date picker can be dismissed with Escape key',
          'Open the date picker, then press Escape. Verify the picker closes and focus returns to the trigger.',
          h.getSelector(picker)
        );
      }
    });

    // ==========================================================================
    // TEST 8: Text input alternative (WCAG 2.5.3)
    // ==========================================================================

    datePickers.forEach(function(picker) {
      if (picker.tagName === 'INPUT' && picker.type === 'date') return;

      results.stats.elementsScanned++;

      // Look for a text input associated with the date picker
      var parent = picker.parentElement;
      var textInput = null;

      if (parent) {
        textInput = parent.querySelector('input[type="text"], input:not([type])');
      }

      if (!textInput) {
        addIssue(
          'moderate',
          '2.5.3',
          'Label in Name',
          'Date picker has no text input alternative for manual date entry',
          picker,
          'Provide a text input where users can type a date instead of using the picker'
        );
      } else {
        addPassed('2.5.3', 'Label in Name', 'Text input alternative exists for date entry', h.getSelector(textInput));
      }
    });

    // ==========================================================================
    // TEST 9: Focus trapped within picker dialog (WCAG 2.4.3)
    // ==========================================================================

    datePickers.forEach(function(picker) {
      if (picker.tagName === 'INPUT' && picker.type === 'date') return;

      results.stats.elementsScanned++;

      var isDialog = picker.getAttribute('role') === 'dialog' ||
                     picker.tagName === 'DIALOG';

      if (isDialog) {
        var hasAriaModal = picker.getAttribute('aria-modal') === 'true';
        if (!hasAriaModal && picker.tagName !== 'DIALOG') {
          addIssue(
            'serious',
            '2.4.3',
            'Focus Order',
            'Date picker dialog missing aria-modal="true" for focus trapping',
            picker,
            'Add aria-modal="true" to the date picker dialog'
          );
        } else {
          addPassed('2.4.3', 'Focus Order', 'Date picker dialog has modal semantics', h.getSelector(picker));
        }
      }
    });

    // ==========================================================================
    // TEST 10: Arrow key navigation (manual check)
    // ==========================================================================

    var customPickers = datePickers.filter(function(p) {
      return !(p.tagName === 'INPUT' && p.type === 'date');
    });

    if (customPickers.length > 0) {
      addManualCheck(
        '2.1.1',
        'Verify arrow key navigation within calendar grid',
        'Open the date picker and test: (1) Arrow keys move between dates, (2) Page Up/Down switch months, (3) Home/End move to first/last day, (4) Focus is visible on current date',
        'date picker calendar grids'
      );
    }

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.datePickerSummary = {
      total: datePickers.length,
      native: datePickers.filter(function(p) { return p.tagName === 'INPUT' && p.type === 'date'; }).length,
      custom: datePickers.filter(function(p) { return !(p.tagName === 'INPUT' && p.type === 'date'); }).length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runDatePickerAudit = runDatePickerAudit;

})(typeof window !== 'undefined' ? window : global);
