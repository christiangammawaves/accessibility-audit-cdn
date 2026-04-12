/**
 * Mega Menu Accessibility Audit
 * WCAG: 1.4.13, 2.1.1, 2.1.2, 2.4.3, 4.1.2
 */

function runMegaMenuAudit() {
  'use strict';

  const startTime = performance.now();

  const CONFIG = {
    megaMenuSelectors: [
      '[class*="mega-menu"]',
      '[class*="megamenu"]',
      '[class*="mega_menu"]',
      '[class*="dropdown-menu"][class*="large"]',
      '[class*="nav-dropdown"][class*="mega"]',
      'nav [class*="submenu"][class*="multi"]',
      '[class*="flyout"]',
      '[data-mega-menu]'
    ],
    dropdownTriggerSelectors: [
      'nav button[aria-expanded]',
      'nav a[aria-expanded]',
      'nav [aria-haspopup]',
      '[class*="has-dropdown"]',
      '[class*="has-submenu"]',
      '[class*="dropdown-toggle"]',
      'nav li:has(ul) > a',
      'nav li:has(ul) > button'
    ],
    dropdownContentSelectors: [
      '[class*="dropdown-content"]',
      '[class*="submenu"]',
      '[class*="dropdown-menu"]',
      '[class*="mega-content"]',
      'nav ul ul'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('mega-menu', 'Mega menus, dropdown navigation, flyout menus');
  const { isVisible, getSelector, getAccessibleName, getElementSnippet } = h;

  // ==========================================================================
  // FIND MEGA MENUS
  // ==========================================================================

  function findMegaMenus() {
    const menus = new Set();
    
    // Find explicit mega menus
    CONFIG.megaMenuSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => menus.add(el));
      } catch (e) { /* Invalid selector */ }
    });
    
    // Find nav dropdowns that are "mega" (multi-column or large)
    document.querySelectorAll('nav').forEach(nav => {
      const dropdowns = nav.querySelectorAll('ul ul, [class*="dropdown"], [class*="submenu"]');
      dropdowns.forEach(dd => {
        const rect = dd.getBoundingClientRect();
        const style = window.getComputedStyle(dd);
        // Consider it a mega menu if it's wide or has multiple columns
        if (rect.width > 300 || style.display === 'grid' || style.display === 'flex' || dd.querySelectorAll('ul').length > 1) {
          menus.add(dd);
        }
      });
    });
    
    return Array.from(menus);
  }

  function findDropdownTriggers() {
    const triggers = new Set();
    CONFIG.dropdownTriggerSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => triggers.add(el));
      } catch (e) { /* Invalid selector */ }
    });
    return Array.from(triggers).filter(t => isVisible(t));
  }

  const allMegaMenus = findMegaMenus();
  const allTriggers = findDropdownTriggers();

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================

  function testDropdownTrigger(trigger) {
    results.stats.elementsScanned++;
    
    const ariaExpanded = trigger.getAttribute('aria-expanded');
    const ariaHaspopup = trigger.getAttribute('aria-haspopup');
    const ariaControls = trigger.getAttribute('aria-controls');
    const name = getAccessibleName(trigger);
    const tagName = trigger.tagName.toLowerCase();
    
    // Test 1: aria-expanded
    if (ariaExpanded === null) {
      addIssue('critical', '4.1.2', 'Name, Role, Value',
        `Dropdown trigger "${name.slice(0, 30)}" missing aria-expanded`,
        trigger,
        'Add aria-expanded="false" (true when open)',
        'Screen reader users not informed of dropdown state');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', `Trigger has aria-expanded="${ariaExpanded}"`, getSelector(trigger));
    }
    
    // Test 2: aria-haspopup
    if (!ariaHaspopup) {
      addIssue('serious', '4.1.2', 'Name, Role, Value',
        `Dropdown trigger "${name.slice(0, 30)}" missing aria-haspopup`,
        trigger,
        'Add aria-haspopup="true" or aria-haspopup="menu"',
        'Screen reader users not informed trigger opens a menu');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', `Trigger has aria-haspopup="${ariaHaspopup}"`, getSelector(trigger));
    }
    
    // Test 3: Trigger is button or has button role
    if (tagName === 'a' && !trigger.getAttribute('role')) {
      // Check if it's a link that also triggers dropdown
      const href = trigger.getAttribute('href');
      if (!href || href === '#' || href === 'javascript:void(0)') {
        addIssue('moderate', '4.1.2', 'Name, Role, Value',
          `Dropdown trigger should be button, not empty link`,
          trigger,
          'Use <button> or add role="button" if link navigates nowhere',
          'Semantically incorrect element type');
      } else {
        // Link with real href + dropdown - needs careful handling
        addManualCheck('2.1.1', `Verify dropdown trigger "${name.slice(0, 20)}" works with Enter and Space`,
          'Links with dropdowns should open dropdown on Space, navigate on Enter',
          getSelector(trigger));
      }
    }
    
    // Test 4: aria-controls
    if (ariaControls) {
      const controlledEl = document.getElementById(ariaControls);
      if (!controlledEl) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value',
          `aria-controls references non-existent ID: ${ariaControls}`,
          trigger,
          'Ensure aria-controls points to valid dropdown ID');
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'aria-controls references valid element', getSelector(trigger));
      }
    }
    
    // Test 5: Visual indicator of dropdown
    const hasIcon = trigger.querySelector('svg, [class*="icon"], [class*="arrow"], [class*="caret"]');
    if (!hasIcon) {
      addManualCheck('1.3.1', `Verify dropdown trigger "${name.slice(0, 20)}" has visual indicator`,
        'Check if trigger shows arrow/caret indicating it opens a menu',
        getSelector(trigger));
    }
  }

  function testMegaMenuStructure(menu) {
    results.stats.elementsScanned++;
    
    const role = menu.getAttribute('role');
    const ariaLabel = menu.getAttribute('aria-label');
    const ariaLabelledby = menu.getAttribute('aria-labelledby');
    
    // Test 1: Menu role
    if (role !== 'menu' && role !== 'navigation') {
      // Check if parent nav exists
      const inNav = menu.closest('nav');
      if (!inNav) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value',
          'Mega menu has no navigation landmark or menu role',
          menu,
          'Wrap in <nav> or add role="menu"',
          'Screen reader users may not identify navigation structure');
      }
    }
    
    // Test 2: Accessible name for mega menu
    if (!ariaLabel && !ariaLabelledby) {
      const parentTrigger = document.querySelector(`[aria-controls="${menu.id}"]`);
      if (!parentTrigger) {
        addIssue('moderate', '4.1.2', 'Name, Role, Value',
          'Mega menu has no accessible name',
          menu,
          'Add aria-label or aria-labelledby to identify menu section');
      }
    }
    
    // Test 3: Check for column structure accessibility
    const columns = menu.querySelectorAll('[class*="column"], [class*="col-"], :scope > ul');
    if (columns.length > 1) {
      let columnsWithHeadings = 0;
      columns.forEach(col => {
        const heading = col.querySelector('h2, h3, h4, h5, [class*="heading"], [class*="title"]');
        if (heading) columnsWithHeadings++;
      });
      
      if (columnsWithHeadings < columns.length) {
        addManualCheck('1.3.1', 'Verify mega menu columns are logically grouped',
          'Check that each column has a heading or label identifying its content',
          getSelector(menu));
      } else {
        addPassed('1.3.1', 'Info and Relationships', 'Mega menu columns have headings', getSelector(menu));
      }
    }
    
    // Test 4: Menu item roles (if using menu pattern)
    if (role === 'menu') {
      const items = menu.querySelectorAll('a, button');
      let itemsWithRole = 0;
      items.forEach(item => {
        if (item.getAttribute('role') === 'menuitem') itemsWithRole++;
      });
      
      if (itemsWithRole < items.length) {
        addIssue('serious', '4.1.2', 'Name, Role, Value',
          `${items.length - itemsWithRole} menu items missing role="menuitem"`,
          menu,
          'Add role="menuitem" to all links/buttons in menu',
          'Screen reader menu navigation may not work correctly');
      }
    }
    
    // Test 5: Check for links
    const links = menu.querySelectorAll('a');
    links.forEach(link => {
      const linkName = getAccessibleName(link);
      if (!linkName) {
        addIssue('serious', '4.1.2', 'Name, Role, Value',
          'Mega menu link has no accessible name',
          link,
          'Add text content or aria-label to link');
      }
    });
  }

  function testKeyboardNavigation() {
    // These are manual checks since we can't simulate keyboard
    
    addManualCheck('2.1.1', 'Verify dropdown opens with Enter/Space',
      'Focus dropdown trigger and press Enter or Space - menu should open',
      null);
    
    addManualCheck('2.1.1', 'Verify Escape closes dropdown',
      'With dropdown open, press Escape - menu should close and focus return to trigger',
      null);
    
    addManualCheck('2.1.1', 'Verify arrow key navigation in mega menu',
      'With menu open: Down/Up arrows move between items, Right/Left navigate submenus',
      null);
    
    addManualCheck('2.4.3', 'Verify focus is trapped within open dropdown',
      'Tab through mega menu - focus should stay within menu until closed',
      null);
    
    addManualCheck('2.4.3', 'Verify focus returns to trigger on close',
      'Close mega menu with Escape - focus should return to the trigger button',
      null);
  }

  function testHoverFocusBehavior() {
    allTriggers.forEach(trigger => {
      results.stats.elementsScanned++;
      
      // Check for CSS-only hover (no JS handlers)
      const parent = trigger.parentElement;
      if (parent) {
        const siblingMenu = parent.querySelector('ul, [class*="dropdown"], [class*="submenu"]');
        if (siblingMenu) {
          // Check if menu is shown via CSS :hover
          const menuStyle = window.getComputedStyle(siblingMenu);
          
          // Cannot fully detect CSS-only hover, but can flag for manual check
          addManualCheck('1.4.13', 'Verify mega menu is keyboard accessible (not hover-only)',
            'Can you open this menu with keyboard (Enter/Space)? CSS-only hover menus are inaccessible.',
            getSelector(trigger));
        }
      }
    });
    
    // General hover/focus checks
    addManualCheck('1.4.13', 'Verify mega menu content is hoverable',
      'Open menu and try to move mouse into the dropdown content - it should stay open',
      null);
    
    addManualCheck('1.4.13', 'Verify mega menu is dismissible without moving focus',
      'Open menu and press Escape - it should close',
      null);
    
    addManualCheck('1.4.13', 'Verify mega menu stays open while focused',
      'Focus a link inside mega menu - menu should remain visible',
      null);
  }

  // ==========================================================================
  // RUN AUDIT
  // ==========================================================================

  if (allTriggers.length === 0 && allMegaMenus.length === 0) {
    results.manualChecks.push({
      wcag: '4.1.2',
      message: 'No mega menus or dropdown triggers detected',
      howToTest: 'Check if site has dropdown navigation that was not detected'
    });
  } else {
    // Test all triggers
    allTriggers.forEach(trigger => testDropdownTrigger(trigger));
    
    // Test mega menu structures
    allMegaMenus.forEach(menu => testMegaMenuStructure(menu));
    
    // Add keyboard navigation checks
    testKeyboardNavigation();
    
    // Add hover/focus behavior checks
    testHoverFocusBehavior();
  }

  // ==========================================================================
  // FINALIZE
  // ==========================================================================

  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

if (typeof window !== 'undefined') {
  window.runMegaMenuAudit = runMegaMenuAudit;
}
