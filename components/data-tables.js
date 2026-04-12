/**
 * Data Tables Accessibility Audit
 * WCAG: 1.3.1, 1.3.2, 4.1.2
 *
 * Audits HTML data tables for accessibility compliance including
 * captions, header cells, scope attributes, and complex header associations.
 *
 * @module data-tables
 * @description Audit HTML data tables for accessibility compliance
 */

(function(global) {
  'use strict';

  function runDataTablesAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        'table:not([role="presentation"]):not([role="none"])'
      ]
    };

    var ref = global.a11yAudit.initComponent('data-tables', scope || CONFIG.scope);
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

    // Find all data tables (not presentational)
    var tables = Array.from(doc.querySelectorAll('table:not([role="presentation"]):not([role="none"])'));

    if (tables.length === 0) {
      results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
      return results;
    }

    // ==========================================================================
    // TEST 1: Table has caption or accessible name (WCAG 1.3.1)
    // ==========================================================================

    tables.forEach(function(table) {
      results.stats.elementsScanned++;

      var caption = table.querySelector('caption');
      var ariaLabel = table.getAttribute('aria-label');
      var ariaLabelledby = table.getAttribute('aria-labelledby');

      if (caption && caption.textContent.trim()) {
        addPassed('1.3.1', 'Info and Relationships', 'Table has a <caption> element', h.getSelector(table));
      } else if (ariaLabel) {
        addPassed('1.3.1', 'Info and Relationships', 'Table has aria-label', h.getSelector(table));
      } else if (ariaLabelledby) {
        var labelEl = doc.getElementById(ariaLabelledby);
        if (labelEl && labelEl.textContent.trim()) {
          addPassed('1.3.1', 'Info and Relationships', 'Table has aria-labelledby', h.getSelector(table));
        } else {
          addIssue(
            'serious',
            '1.3.1',
            'Info and Relationships',
            'Table aria-labelledby references missing or empty element',
            table,
            'Add a valid aria-labelledby pointing to an element with descriptive text, or use <caption>'
          );
        }
      } else {
        addIssue(
          'serious',
          '1.3.1',
          'Info and Relationships',
          'Data table has no caption or accessible name',
          table,
          'Add a <caption> element or aria-label/aria-labelledby to identify the table'
        );
      }
    });

    // ==========================================================================
    // TEST 2: Data tables use <th> elements with scope (WCAG 1.3.1)
    // ==========================================================================

    tables.forEach(function(table) {
      var thElements = Array.from(table.querySelectorAll('th'));
      results.stats.elementsScanned++;

      if (thElements.length === 0) {
        addIssue(
          'serious',
          '1.3.1',
          'Info and Relationships',
          'Data table has no <th> header cells',
          table,
          'Use <th> elements with scope="col" or scope="row" for header cells'
        );
        return;
      }

      var missingScope = thElements.filter(function(th) {
        return !th.getAttribute('scope');
      });

      if (missingScope.length > 0) {
        addIssue(
          'serious',
          '1.3.1',
          'Info and Relationships',
          missingScope.length + ' of ' + thElements.length + ' <th> elements missing scope attribute',
          missingScope[0],
          'Add scope="col" or scope="row" to all <th> elements'
        );
      } else {
        addPassed('1.3.1', 'Info and Relationships', 'All <th> elements have scope attribute', h.getSelector(table));
      }
    });

    // ==========================================================================
    // TEST 3: Complex tables use headers/id associations (WCAG 1.3.1)
    // ==========================================================================

    tables.forEach(function(table) {
      results.stats.elementsScanned++;

      // Detect complex tables: tables with rowspan > 1 or colspan > 1 on <th>
      var complexHeaders = Array.from(table.querySelectorAll('th[rowspan], th[colspan]')).filter(function(th) {
        var rowspan = parseInt(th.getAttribute('rowspan') || '1', 10);
        var colspan = parseInt(th.getAttribute('colspan') || '1', 10);
        return rowspan > 1 || colspan > 1;
      });

      // Also check for multiple rows of <th> elements (multi-level headers)
      var headerRows = Array.from(table.querySelectorAll('tr')).filter(function(tr) {
        return tr.querySelectorAll('th').length > 0;
      });

      var isComplex = complexHeaders.length > 0 || headerRows.length > 1;

      if (isComplex) {
        var tds = Array.from(table.querySelectorAll('td'));
        var ths = Array.from(table.querySelectorAll('th'));
        var hasHeadersAttr = tds.some(function(td) { return td.hasAttribute('headers'); });
        var thsHaveIds = ths.every(function(th) { return th.hasAttribute('id'); });
        // Pattern B fix: Accept scope attribute as sufficient for header association
        var VALID_SCOPE_VALUES = ['col', 'row', 'colgroup', 'rowgroup'];
        var thsHaveScope = ths.every(function(th) {
          var scope = th.getAttribute('scope');
          return scope && VALID_SCOPE_VALUES.indexOf(scope.toLowerCase()) !== -1;
        });

        // Flag invalid scope values
        ths.forEach(function(th) {
          var scope = th.getAttribute('scope');
          if (scope && VALID_SCOPE_VALUES.indexOf(scope.toLowerCase()) === -1) {
            addIssue('moderate', '1.3.1', 'Info and Relationships',
              'Table header has invalid scope value: "' + scope + '". Valid values: col, row, colgroup, rowgroup',
              th);
          }
        });

        if ((hasHeadersAttr && thsHaveIds) || thsHaveScope) {
          addPassed('1.3.1', 'Info and Relationships', 'Complex table uses proper header associations', h.getSelector(table));
        } else {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'Complex table (multi-level headers) missing headers/id or scope associations',
            table,
            'Add scope="col"/"row" to <th> elements, or use id attributes on <th> and headers attributes on <td> cells'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 4: Tables don't use <td> for headers (WCAG 1.3.1)
    // ==========================================================================

    tables.forEach(function(table) {
      results.stats.elementsScanned++;

      // Check first row - if all cells are <td> but look like headers
      var firstRow = table.querySelector('tr');
      if (!firstRow) return;

      var firstRowCells = Array.from(firstRow.children);
      var allTd = firstRowCells.every(function(cell) { return cell.tagName === 'TD'; });
      var hasThAnywhere = table.querySelector('th');

      if (allTd && !hasThAnywhere && firstRowCells.length > 1) {
        // Check if first row cells have bold styling or look like headers
        var hasBoldCells = firstRowCells.some(function(cell) {
          if (typeof global.getComputedStyle === 'function') {
            var style = global.getComputedStyle(cell);
            return style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700;
          }
          return false;
        });

        if (hasBoldCells) {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'Table appears to use <td> elements styled as headers instead of <th>',
            firstRow,
            'Replace header <td> elements with <th> elements with appropriate scope'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 5: Layout tables have presentational role (WCAG 1.3.1)
    // ==========================================================================

    // This is checked by exclusion — tables without role="presentation" are already
    // selected as data tables. We check for tables that look like layout tables.
    tables.forEach(function(table) {
      results.stats.elementsScanned++;

      var hasNoHeaders = !table.querySelector('th');
      var hasNoCaption = !table.querySelector('caption');
      var hasNoAriaLabel = !table.getAttribute('aria-label') && !table.getAttribute('aria-labelledby');
      var hasSingleColumn = Array.from(table.querySelectorAll('tr')).every(function(tr) {
        return tr.children.length <= 1;
      });

      if (hasNoHeaders && hasNoCaption && hasNoAriaLabel && hasSingleColumn) {
        addIssue(
          'minor',
          '1.3.1',
          'Info and Relationships',
          'Table may be used for layout but lacks role="presentation" or role="none"',
          table,
          'If this is a layout table, add role="presentation" or role="none"'
        );
      }
    });

    // ==========================================================================
    // TEST 6: Empty table cells (WCAG 1.3.1)
    // ==========================================================================

    tables.forEach(function(table) {
      var emptyCells = Array.from(table.querySelectorAll('td')).filter(function(td) {
        if (td.textContent.trim()) return false;
        if (td.querySelector('img, input, button, svg, [role]')) return false;
        // Pattern B fix: Skip spacer cells (rowspan/colspan) and corner cells
        if (td.hasAttribute('rowspan') || td.hasAttribute('colspan')) return false;
        // Skip cells that are &nbsp; (non-breaking space) - intentional spacers
        if (td.innerHTML.trim() === '&nbsp;' || td.innerHTML.trim() === '\u00A0') return false;
        return true;
      });

      if (emptyCells.length > 0) {
        var totalCells = table.querySelectorAll('td').length;
        if (emptyCells.length > totalCells * 0.5) {
          addIssue(
            'minor',
            '1.3.1',
            'Info and Relationships',
            'Table has ' + emptyCells.length + ' of ' + totalCells + ' data cells empty',
            table,
            'Ensure empty cells are intentional; consider using a non-breaking space or appropriate content'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 7: Visual-only headers (WCAG 1.3.1)
    // ==========================================================================

    tables.forEach(function(table) {
      results.stats.elementsScanned++;

      // Check if any <td> cells use only color or bold to indicate they are headers
      var tdCells = Array.from(table.querySelectorAll('td'));
      var suspectHeaders = tdCells.filter(function(td) {
        if (typeof global.getComputedStyle !== 'function') return false;
        var style = global.getComputedStyle(td);
        var isBold = style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700;
        var hasRole = td.getAttribute('role') === 'rowheader' || td.getAttribute('role') === 'columnheader';
        return isBold && !hasRole;
      });

      if (suspectHeaders.length > 0 && !table.querySelector('th')) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Table relies on visual formatting (bold) to indicate headers without semantic markup',
          table,
          'Use <th> elements instead of styled <td> elements for headers'
        );
      }
    });

    // ==========================================================================
    // TEST 8: Sortable columns have aria-sort (WCAG 4.1.2)
    // ==========================================================================

    tables.forEach(function(table) {
      results.stats.elementsScanned++;

      var sortableHeaders = Array.from(table.querySelectorAll('th')).filter(function(th) {
        // Detect sortable headers: has button child, or class contains sort, or has data-sort
        var hasButton = th.querySelector('button, [role="button"]');
        var hasSortClass = (th.className || '').toLowerCase().indexOf('sort') >= 0;
        var hasSortAttr = th.hasAttribute('data-sort') || th.hasAttribute('data-sortable');
        return hasButton || hasSortClass || hasSortAttr;
      });

      if (sortableHeaders.length > 0) {
        var missingAriaSort = sortableHeaders.filter(function(th) {
          return !th.hasAttribute('aria-sort');
        });

        if (missingAriaSort.length > 0) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            missingAriaSort.length + ' sortable column headers missing aria-sort attribute',
            missingAriaSort[0],
            'Add aria-sort="ascending", "descending", or "none" to sortable column headers'
          );
        } else {
          addPassed('4.1.2', 'Name, Role, Value', 'All sortable columns have aria-sort', h.getSelector(table));
        }
      }
    });

    // ==========================================================================
    // TEST 9: Responsive behavior (manual check)
    // ==========================================================================

    if (tables.length > 0) {
      addManualCheck(
        '1.3.2',
        'Verify responsive table behavior',
        'Resize viewport to mobile width and verify: (1) Tables use horizontal scroll container or responsive pattern, (2) Data relationships remain understandable, (3) No content is lost or inaccessible',
        'data tables'
      );
    }

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.dataTablesSummary = {
      total: tables.length
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runDataTablesAudit = runDataTablesAudit;

})(typeof window !== 'undefined' ? window : global);
