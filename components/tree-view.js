/**
 * Tree View Accessibility Audit
 * WCAG: 1.3.1, 2.1.1, 4.1.2
 *
 * Audits tree view / hierarchical list widgets for proper ARIA roles,
 * keyboard navigation, and state communication.
 *
 * @module tree-view
 * @description Audit tree view widgets for accessibility compliance
 */

(function(global) {
  'use strict';

  function runTreeViewAudit(scope) {
    var startTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var CONFIG = {
      scope: [
        '[role="tree"]',
        '[role="treeitem"]',
        '.tree-view',
        '.treeview',
        '[class*="tree-view"]',
        '[data-tree]'
      ]
    };

    var ref = global.a11yAudit.initComponent('tree-view', scope || CONFIG.scope);
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

    // Find tree containers
    var trees = Array.from(doc.querySelectorAll('[role="tree"]'));

    // Also find custom tree-like patterns
    var customTrees = [];
    ['.tree-view', '.treeview', '[class*="tree-view"]', '[data-tree]'].forEach(function(selector) {
      try {
        var elements = Array.from(doc.querySelectorAll(selector));
        elements.forEach(function(el) {
          if (el.getAttribute('role') !== 'tree' && customTrees.indexOf(el) === -1) {
            customTrees.push(el);
          }
        });
      } catch (e) {
        // Selector not supported
      }
    });

    if (trees.length === 0 && customTrees.length === 0) {
      // Check for orphan treeitems
      var orphanTreeitems = doc.querySelectorAll('[role="treeitem"]');
      if (orphanTreeitems.length === 0) {
        results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);
        return results;
      }
    }

    // ==========================================================================
    // TEST 1: Tree container has role="tree" (WCAG 4.1.2)
    // ==========================================================================

    if (trees.length > 0) {
      trees.forEach(function(tree) {
        results.stats.elementsScanned++;
        addPassed('4.1.2', 'Name, Role, Value', 'Tree container has role="tree"', h.getSelector(tree));
      });
    }

    customTrees.forEach(function(tree) {
      results.stats.elementsScanned++;
      addIssue(
        'serious',
        '4.1.2',
        'Name, Role, Value',
        'Tree-like widget missing role="tree"',
        tree,
        'Add role="tree" to the container element'
      );
    });

    // Check for orphan treeitems without a tree parent
    var allTreeitems = Array.from(doc.querySelectorAll('[role="treeitem"]'));
    var orphanItems = allTreeitems.filter(function(item) {
      return !item.closest('[role="tree"]');
    });

    if (orphanItems.length > 0) {
      addIssue(
        'serious',
        '4.1.2',
        'Name, Role, Value',
        orphanItems.length + ' treeitem(s) found outside a role="tree" container',
        orphanItems[0],
        'Wrap treeitems in a container with role="tree"'
      );
    }

    // ==========================================================================
    // TEST 2: Tree items have role="treeitem" (WCAG 4.1.2)
    // ==========================================================================

    trees.forEach(function(tree) {
      results.stats.elementsScanned++;

      var treeitems = tree.querySelectorAll('[role="treeitem"]');
      if (treeitems.length > 0) {
        addPassed('4.1.2', 'Name, Role, Value', 'Tree has ' + treeitems.length + ' items with role="treeitem"', h.getSelector(tree));
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Tree container has no items with role="treeitem"',
          tree,
          'Add role="treeitem" to each item in the tree'
        );
      }
    });

    // ==========================================================================
    // TEST 3: Nested groups wrapped in role="group" (WCAG 1.3.1)
    // ==========================================================================

    trees.forEach(function(tree) {
      results.stats.elementsScanned++;

      var treeitems = Array.from(tree.querySelectorAll('[role="treeitem"]'));
      var hasNestedItems = treeitems.some(function(item) {
        return item.querySelector('[role="treeitem"]');
      });

      if (hasNestedItems) {
        var groups = tree.querySelectorAll('[role="group"]');
        if (groups.length > 0) {
          addPassed('1.3.1', 'Info and Relationships', 'Nested tree groups use role="group"', h.getSelector(tree));
        } else {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'Tree has nested items but no role="group" wrappers',
            tree,
            'Wrap nested treeitem groups in an element with role="group"'
          );
        }
      }
    });

    // ==========================================================================
    // TEST 4: Expandable nodes have aria-expanded (WCAG 4.1.2)
    // ==========================================================================

    trees.forEach(function(tree) {
      var treeitems = Array.from(tree.querySelectorAll('[role="treeitem"]'));

      treeitems.forEach(function(item) {
        results.stats.elementsScanned++;

        // Check if item has children (is expandable)
        var hasChildren = item.querySelector('[role="treeitem"]') ||
                          item.querySelector('[role="group"]');
        var nextGroup = item.nextElementSibling;
        var hasAdjacentGroup = nextGroup && nextGroup.getAttribute('role') === 'group';

        if (hasChildren || hasAdjacentGroup) {
          var ariaExpanded = item.getAttribute('aria-expanded');
          if (ariaExpanded === 'true' || ariaExpanded === 'false') {
            addPassed('4.1.2', 'Name, Role, Value', 'Expandable tree node has aria-expanded="' + ariaExpanded + '"', h.getSelector(item));
          } else {
            addIssue(
              'serious',
              '4.1.2',
              'Name, Role, Value',
              'Expandable tree node missing aria-expanded attribute',
              item,
              'Add aria-expanded="true" or "false" to indicate expansion state'
            );
          }
        }
      });
    });

    // ==========================================================================
    // TEST 5: Tree has accessible name (WCAG 4.1.2)
    // ==========================================================================

    trees.forEach(function(tree) {
      results.stats.elementsScanned++;

      var ariaLabel = tree.getAttribute('aria-label');
      var ariaLabelledby = tree.getAttribute('aria-labelledby');

      if (ariaLabel) {
        addPassed('4.1.2', 'Name, Role, Value', 'Tree has aria-label: "' + ariaLabel.substring(0, 30) + '"', h.getSelector(tree));
      } else if (ariaLabelledby) {
        var labelEl = doc.getElementById(ariaLabelledby);
        if (labelEl && labelEl.textContent.trim()) {
          addPassed('4.1.2', 'Name, Role, Value', 'Tree has aria-labelledby', h.getSelector(tree));
        } else {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Tree aria-labelledby references missing or empty element',
            tree,
            'Ensure the referenced element exists and has descriptive text'
          );
        }
      } else {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Tree has no accessible name',
          tree,
          'Add aria-label or aria-labelledby to describe the tree\'s purpose'
        );
      }
    });

    // ==========================================================================
    // TEST 6: Selected item has aria-selected (WCAG 4.1.2)
    // ==========================================================================

    trees.forEach(function(tree) {
      results.stats.elementsScanned++;

      var treeitems = Array.from(tree.querySelectorAll('[role="treeitem"]'));
      var hasSelection = treeitems.some(function(item) {
        return item.getAttribute('aria-selected') === 'true';
      });

      var hasSelectedClass = treeitems.some(function(item) {
        return (item.className || '').toLowerCase().indexOf('selected') >= 0 ||
               (item.className || '').toLowerCase().indexOf('active') >= 0;
      });

      if (hasSelection) {
        addPassed('4.1.2', 'Name, Role, Value', 'Selected tree item uses aria-selected="true"', h.getSelector(tree));
      } else if (hasSelectedClass) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Tree item appears selected via CSS class but lacks aria-selected="true"',
          tree,
          'Add aria-selected="true" to the selected treeitem'
        );
      }
    });

    // ==========================================================================
    // TEST 7: aria-level on tree items (WCAG 1.3.1)
    // ==========================================================================

    trees.forEach(function(tree) {
      results.stats.elementsScanned++;

      var treeitems = Array.from(tree.querySelectorAll('[role="treeitem"]'));
      var hasAriaLevel = treeitems.some(function(item) {
        return item.hasAttribute('aria-level');
      });

      var hasNesting = tree.querySelector('[role="group"]');

      if (hasAriaLevel) {
        addPassed('1.3.1', 'Info and Relationships', 'Tree items have aria-level for hierarchy', h.getSelector(tree));
      } else if (hasNesting) {
        addIssue(
          'minor',
          '1.3.1',
          'Info and Relationships',
          'Tree items lack aria-level attributes (nesting via role="group" provides some hierarchy)',
          tree,
          'Consider adding aria-level to explicitly convey nesting depth'
        );
      }
    });

    // ==========================================================================
    // TEST 8: Manual checks for visual and keyboard behavior
    // ==========================================================================

    if (trees.length > 0 || customTrees.length > 0) {
      addManualCheck(
        '1.3.1',
        'Verify visual indentation matches semantic level',
        'Check that tree item indentation visually reflects the nesting hierarchy (aria-level or role="group" structure)',
        'tree views'
      );

      addManualCheck(
        '2.1.1',
        'Verify keyboard navigation for tree view',
        'Test: (1) Up/Down arrows move between visible items, (2) Right arrow expands/moves into node, (3) Left arrow collapses/moves to parent, (4) Enter/Space selects item, (5) Home/End move to first/last item',
        'tree views'
      );
    }

    // ==========================================================================
    // FINALIZE RESULTS
    // ==========================================================================

    results.stats.issuesFound = results.issues.length;
    results.stats.passedChecks = results.passed.length;
    results.stats.manualChecksNeeded = results.manualChecks.length;
    results.stats.executionTimeMs = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - startTime);

    results.treeViewSummary = {
      properTrees: trees.length,
      customTrees: customTrees.length,
      totalTreeitems: allTreeitems ? allTreeitems.length : 0
    };

    return results;
  }

  // Make available globally
  if (!global.a11yAudit) global.a11yAudit = {};
  global.runTreeViewAudit = runTreeViewAudit;

})(typeof window !== 'undefined' ? window : global);
