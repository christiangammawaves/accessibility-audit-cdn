/**
 * Tabs Accessibility Audit
 * WCAG: 1.3.1, 2.1.1, 2.4.3, 2.4.7, 4.1.2
 */

function runTabsAudit() {
  'use strict';

  const startTime = performance.now();

  // Configuration
  const CONFIG = {
    scope: [
      '[role="tablist"]',
      '.tabs',
      '[class*="tabs"]',
      '.tab-list',
      '[class*="tab-list"]',
      '[data-tabs]',
      '.product-tabs',
      '.content-tabs',
      '.nav-tabs'
    ],
    tabSelectors: [
      '[role="tab"]',
      '.tab',
      '[class*="tab-item"]',
      '[class*="tab-btn"]',
      '[class*="tab-link"]',
      '[data-tab]',
      '.nav-tab'
    ],
    panelSelectors: [
      '[role="tabpanel"]',
      '.tab-panel',
      '.tab-content',
      '[class*="tab-panel"]',
      '[class*="tab-content"]',
      '[class*="tabpanel"]',
      '[data-tab-panel]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('tabs', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet } = h;

  // ==========================================================================
  // FIND TAB INTERFACES
  // ==========================================================================

  function findTabInterfaces() {
    const tabInterfaces = [];
    
    // First, find proper tablists with role="tablist"
    const tablists = document.querySelectorAll('[role="tablist"]');
    tablists.forEach(tablist => {
      if (!isVisible(tablist)) return;
      
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      const panels = [];
      
      // Find panels via aria-controls
      tabs.forEach(tab => {
        const controlsId = tab.getAttribute('aria-controls');
        if (controlsId) {
          const panel = document.getElementById(controlsId);
          if (panel) panels.push(panel);
        }
      });
      
      // If no panels found via aria-controls, look for tabpanels nearby
      if (panels.length === 0) {
        const parent = tablist.parentElement;
        if (parent) {
          const nearbyPanels = parent.querySelectorAll('[role="tabpanel"]');
          panels.push(...Array.from(nearbyPanels));
        }
      }
      
      tabInterfaces.push({
        type: 'proper',
        tablist: tablist,
        tabs: tabs,
        panels: panels
      });
    });
    
    // Find custom tab patterns without proper ARIA
    for (const selector of CONFIG.scope) {
      if (selector === '[role="tablist"]') continue;
      
      const containers = document.querySelectorAll(selector);
      containers.forEach(container => {
        if (!isVisible(container)) return;
        
        // Skip if already found as proper tablist
        if (container.getAttribute('role') === 'tablist') return;
        if (container.querySelector('[role="tablist"]')) return;
        
        // Find tab-like elements
        let tabs = [];
        for (const tabSel of CONFIG.tabSelectors) {
          const found = container.querySelectorAll(tabSel);
          if (found.length > 1) {
            tabs = Array.from(found).filter(t => isVisible(t));
            break;
          }
        }
        
        if (tabs.length < 2) return; // Need at least 2 tabs
        
        // Find panels
        let panels = [];
        for (const panelSel of CONFIG.panelSelectors) {
          const found = document.querySelectorAll(panelSel);
          if (found.length > 0) {
            panels = Array.from(found);
            break;
          }
        }
        
        // Also check siblings of container
        if (panels.length === 0) {
          let sibling = container.nextElementSibling;
          while (sibling) {
            for (const panelSel of CONFIG.panelSelectors) {
              if (sibling.matches(panelSel)) {
                panels.push(sibling);
              }
            }
            sibling = sibling.nextElementSibling;
          }
        }
        
        tabInterfaces.push({
          type: 'custom',
          tablist: container,
          tabs: tabs,
          panels: panels
        });
      });
    }
    
    return tabInterfaces;
  }

  const tabInterfaces = findTabInterfaces();
  
  if (tabInterfaces.length === 0) {
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  // ==========================================================================
  // TEST 1: Tablist Role (WCAG 4.1.2)
  // ==========================================================================

  function testTablistRole() {
    tabInterfaces.forEach((tabInterface, index) => {
      const tablist = tabInterface.tablist;
      results.stats.elementsScanned++;
      
      if (tabInterface.type === 'proper') {
        addPassed('4.1.2', 'Name, Role, Value', 'Tab container has role="tablist"', getSelector(tablist));
      } else {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Tab container missing role="tablist"',
          tablist,
          'Add role="tablist" to the container that holds the tab buttons',
          'Screen readers cannot identify this as a tab interface'
        );
      }
    });
  }

  // ==========================================================================
  // TEST 2: Tab Role (WCAG 4.1.2)
  // ==========================================================================

  function testTabRole() {
    tabInterfaces.forEach((tabInterface, index) => {
      tabInterface.tabs.forEach((tab, tabIndex) => {
        results.stats.elementsScanned++;
        
        const role = tab.getAttribute('role');
        
        if (role === 'tab') {
          addPassed('4.1.2', 'Name, Role, Value', 'Tab has role="tab"', getSelector(tab));
        } else {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Tab element missing role="tab"',
            tab,
            'Add role="tab" to each tab button/trigger',
            'Screen readers cannot identify this as a tab control'
          );
        }
      });
    });
  }

  // ==========================================================================
  // TEST 3: Tabpanel Role (WCAG 4.1.2)
  // ==========================================================================

  function testTabpanelRole() {
    tabInterfaces.forEach((tabInterface, index) => {
      if (tabInterface.panels.length === 0) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'No tab panels found for tab interface',
          tabInterface.tablist,
          'Add role="tabpanel" to each content panel',
          'Tab content areas are not identified to assistive technology'
        );
        return;
      }
      
      tabInterface.panels.forEach((panel, panelIndex) => {
        results.stats.elementsScanned++;
        
        const role = panel.getAttribute('role');
        
        if (role === 'tabpanel') {
          addPassed('4.1.2', 'Name, Role, Value', 'Panel has role="tabpanel"', getSelector(panel));
        } else {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Tab content panel missing role="tabpanel"',
            panel,
            'Add role="tabpanel" to each content panel',
            'Screen readers cannot identify this as tab content'
          );
        }
      });
    });
  }

  // ==========================================================================
  // TEST 4: aria-selected State (WCAG 4.1.2)
  // ==========================================================================

  function testAriaSelected() {
    tabInterfaces.forEach((tabInterface, index) => {
      let selectedCount = 0;
      let missingAriaSelected = 0;
      
      tabInterface.tabs.forEach((tab, tabIndex) => {
        results.stats.elementsScanned++;
        
        const ariaSelected = tab.getAttribute('aria-selected');
        
        if (ariaSelected === null) {
          missingAriaSelected++;
        } else if (ariaSelected === 'true') {
          selectedCount++;
        } else if (ariaSelected !== 'false') {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'aria-selected has invalid value: "' + ariaSelected + '"',
            tab,
            'Set aria-selected to "true" or "false"',
            'Screen readers may not correctly convey selection state'
          );
        }
      });
      
      if (missingAriaSelected > 0) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          missingAriaSelected + ' of ' + tabInterface.tabs.length + ' tabs missing aria-selected attribute',
          tabInterface.tabs[0],
          'Add aria-selected="true" to the active tab and aria-selected="false" to inactive tabs',
          'Screen reader users cannot determine which tab is currently selected'
        );
      } else if (selectedCount === 0) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'No tab has aria-selected="true"',
          tabInterface.tabs[0],
          'Set aria-selected="true" on the currently active tab',
          'Screen reader users cannot determine which tab is selected'
        );
      } else if (selectedCount > 1) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          selectedCount + ' tabs have aria-selected="true" (should be exactly 1)',
          tabInterface.tabs[0],
          'Only one tab should have aria-selected="true" at a time',
          'Multiple tabs appear selected which is confusing'
        );
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Exactly one tab has aria-selected="true"', getSelector(tabInterface.tablist));
      }
    });
  }

  // ==========================================================================
  // TEST 5: aria-controls Relationship (WCAG 1.3.1)
  // ==========================================================================

  function testAriaControls() {
    tabInterfaces.forEach((tabInterface, index) => {
      let hasAriaControls = 0;
      let brokenControls = 0;
      
      tabInterface.tabs.forEach((tab, tabIndex) => {
        results.stats.elementsScanned++;
        
        const ariaControls = tab.getAttribute('aria-controls');
        
        if (!ariaControls) {
          return; // Will be counted at the end
        }
        
        hasAriaControls++;
        
        const panel = document.getElementById(ariaControls);
        if (!panel) {
          brokenControls++;
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'aria-controls references non-existent ID: "' + ariaControls + '"',
            tab,
            'Ensure the panel has id="' + ariaControls + '"',
            'Programmatic relationship between tab and panel is broken'
          );
        }
      });
      
      if (hasAriaControls === 0) {
        addIssue(
          'serious',
          '1.3.1',
          'Info and Relationships',
          'Tabs have no aria-controls attributes',
          tabInterface.tabs[0],
          'Add aria-controls="panelId" to each tab, pointing to its corresponding panel',
          'No programmatic relationship between tabs and panels'
        );
      } else if (hasAriaControls === tabInterface.tabs.length && brokenControls === 0) {
        addPassed('1.3.1', 'Info and Relationships', 'All tabs have valid aria-controls', getSelector(tabInterface.tablist));
      }
    });
  }

  // ==========================================================================
  // TEST 6: Tabpanel aria-labelledby (WCAG 1.3.1)
  // ==========================================================================

  function testPanelLabels() {
    tabInterfaces.forEach((tabInterface, index) => {
      tabInterface.panels.forEach((panel, panelIndex) => {
        results.stats.elementsScanned++;
        
        const ariaLabelledby = panel.getAttribute('aria-labelledby');
        const ariaLabel = panel.getAttribute('aria-label');
        
        if (!ariaLabelledby && !ariaLabel) {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'Tab panel has no accessible name (missing aria-labelledby or aria-label)',
            panel,
            'Add aria-labelledby pointing to the associated tab\'s ID',
            'Screen reader users cannot identify which tab this panel belongs to'
          );
        } else if (ariaLabelledby) {
          const labelElement = document.getElementById(ariaLabelledby);
          if (!labelElement) {
            addIssue(
              'moderate',
              '1.3.1',
              'Info and Relationships',
              'aria-labelledby references non-existent ID: "' + ariaLabelledby + '"',
              panel,
              'Ensure the tab has id="' + ariaLabelledby + '"',
              'Panel label relationship is broken'
            );
          } else {
            addPassed('1.3.1', 'Info and Relationships', 'Panel has aria-labelledby pointing to tab', getSelector(panel));
          }
        } else {
          addPassed('1.3.1', 'Info and Relationships', 'Panel has aria-label', getSelector(panel));
        }
      });
    });
  }

  // ==========================================================================
  // TEST 7: Tab Accessible Names (WCAG 4.1.2)
  // ==========================================================================

  function testTabNames() {
    tabInterfaces.forEach((tabInterface, index) => {
      tabInterface.tabs.forEach((tab, tabIndex) => {
        results.stats.elementsScanned++;
        
        const name = getAccessibleName(tab);
        
        if (!name) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Tab has no accessible name',
            tab,
            'Add visible text content or aria-label to the tab',
            'Screen reader users cannot identify what this tab controls'
          );
        } else if (name.length < 2) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Tab has very short name: "' + name + '"',
            tab,
            'Use a more descriptive label for the tab',
            'Tab purpose may be unclear'
          );
        } else {
          addPassed('4.1.2', 'Name, Role, Value', 'Tab has name: "' + name.substring(0, 30) + '"', getSelector(tab));
        }
      });
    });
  }

  // ==========================================================================
  // TEST 8: Keyboard Focus Management (WCAG 2.1.1, 2.4.3)
  // ==========================================================================

  function testKeyboardAccess() {
    tabInterfaces.forEach((tabInterface, index) => {
      // Check tabindex on tabs
      let activeTabindex = null;
      let inactiveWithTabindex0 = 0;
      
      tabInterface.tabs.forEach((tab, tabIndex) => {
        results.stats.elementsScanned++;
        
        const tabindex = tab.getAttribute('tabindex');
        const ariaSelected = tab.getAttribute('aria-selected');
        const isSelected = ariaSelected === 'true';
        
        if (isSelected) {
          activeTabindex = tabindex;
          if (tabindex === '-1') {
            addIssue(
              'serious',
              '2.1.1',
              'Keyboard',
              'Active tab has tabindex="-1" making it unfocusable',
              tab,
              'Active tab should have tabindex="0" or no tabindex',
              'Keyboard users cannot focus the selected tab'
            );
          }
        } else {
          // Inactive tabs should have tabindex="-1" for roving tabindex pattern
          if (tabindex === '0' || tabindex === null) {
            inactiveWithTabindex0++;
          }
        }
        
        // Check for positive tabindex
        if (tabindex && parseInt(tabindex) > 0) {
          addIssue(
            'moderate',
            '2.4.3',
            'Focus Order',
            'Tab has positive tabindex=' + tabindex,
            tab,
            'Use tabindex="0" or "-1" instead of positive values',
            'Positive tabindex disrupts natural focus order'
          );
        }
      });
      
      // Check if roving tabindex pattern is used
      if (tabInterface.tabs.length > 1 && inactiveWithTabindex0 > 1) {
        addManualCheck(
          '2.1.1',
          'Multiple inactive tabs are in tab order',
          'Verify keyboard navigation: Arrow keys should move between tabs, Tab should move to panel. If Tab moves between tabs, this is a valid alternative pattern.',
          getSelector(tabInterface.tablist)
        );
      }
    });
    
    // Add manual keyboard testing
    if (tabInterfaces.length > 0) {
      addManualCheck(
        '2.1.1',
        'Verify keyboard navigation for tabs',
        'Test: (1) Tab to the tablist, (2) Use Left/Right arrows to move between tabs, (3) Press Tab to move focus into the active panel, (4) Verify focus is visible on all tabs',
        'tab interfaces'
      );
    }
  }

  // ==========================================================================
  // TEST 9: Hidden Panel Focus (WCAG 2.4.3)
  // ==========================================================================

  function testHiddenPanelFocus() {
    tabInterfaces.forEach((tabInterface, index) => {
      tabInterface.panels.forEach((panel, panelIndex) => {
        results.stats.elementsScanned++;
        
        // Check if panel is hidden
        const style = window.getComputedStyle(panel);
        const isHidden = 
          panel.hasAttribute('hidden') ||
          panel.getAttribute('aria-hidden') === 'true' ||
          style.display === 'none' ||
          style.visibility === 'hidden';
        
        if (!isHidden) return;
        
        // Check for focusable elements in hidden panel
        const focusable = panel.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        const stillFocusable = Array.from(focusable).filter(el => {
          const elStyle = window.getComputedStyle(el);
          return elStyle.display !== 'none' && 
                 elStyle.visibility !== 'hidden' && 
                 el.getAttribute('tabindex') !== '-1';
        });
        
        if (stillFocusable.length > 0) {
          addIssue(
            'serious',
            '2.4.3',
            'Focus Order',
            'Hidden tab panel contains ' + stillFocusable.length + ' focusable elements still in tab order',
            panel,
            'Use display:none or hidden attribute on inactive panels, or set tabindex="-1" on focusable children',
            'Keyboard users can focus elements in content they cannot see'
          );
        }
      });
    });
  }

  // ==========================================================================
  // TEST 10: Focus Visibility (WCAG 2.4.7)
  // ==========================================================================

  function testFocusVisibility() {
    let outlineNoneCount = 0;
    
    tabInterfaces.forEach((tabInterface, index) => {
      tabInterface.tabs.forEach((tab, tabIndex) => {
        const style = window.getComputedStyle(tab);
        const outline = style.outline;
        const outlineStyle = style.outlineStyle;
        
        if (outline === 'none' || outline === '0' || outlineStyle === 'none') {
          outlineNoneCount++;
        }
      });
    });
    
    if (outlineNoneCount > 0) {
      addManualCheck(
        '2.4.7',
        outlineNoneCount + ' tabs have outline:none in default state',
        'Tab to each tab and verify visible focus indicator (outline, box-shadow, border, or background change)',
        'tab elements'
      );
    }
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================

  testTablistRole();
  testTabRole();
  testTabpanelRole();
  testAriaSelected();
  testAriaControls();
  testPanelLabels();
  testTabNames();
  testKeyboardAccess();
  testHiddenPanelFocus();
  testFocusVisibility();

  // ==========================================================================
  // FINALIZE RESULTS
  // ==========================================================================

  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  // Add summary
  results.tabsSummary = {
    total: tabInterfaces.length,
    proper: tabInterfaces.filter(t => t.type === 'proper').length,
    custom: tabInterfaces.filter(t => t.type === 'custom').length,
    totalTabs: tabInterfaces.reduce((sum, t) => sum + t.tabs.length, 0),
    totalPanels: tabInterfaces.reduce((sum, t) => sum + t.panels.length, 0)
  };

  return results;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runTabsAudit = runTabsAudit;
}
