/**
 * Collections Navigation Accessibility Audit
 * WCAG: 1.3.1, 1.3.2, 2.1.1, 2.4.4, 2.4.6, 4.1.2
 */

function runCollectionsNavAudit() {
  'use strict';

  const startTime = performance.now();

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  const CONFIG = {
    scope: [
      // Sidebar/collection navigation
      '.collection-nav',
      '.collections-nav',
      '.category-nav',
      '.category-navigation',
      '[class*="collection-nav"]',
      '[class*="category-nav"]',
      '[class*="sidebar-nav"]',
      // Shopify patterns
      '.collection-list',
      '.collection-menu',
      '[data-collection-nav]',
      '[data-category-nav]',
      // Generic sidebar navigation
      'aside nav',
      'aside [role="navigation"]',
      '.sidebar nav',
      '.sidebar-navigation',
      '[class*="sidebar"] nav',
      '[class*="sidebar"] ul',
      // Tree navigation
      '[role="tree"]',
      '[role="treeitem"]',
      // Filter sidebar with categories
      '.filter-nav',
      '.facet-nav',
      '[class*="filter-sidebar"]',
      // Category list patterns
      '.category-list',
      '.categories',
      '[class*="category-list"]',
      '.shop-by-category',
      '.browse-categories'
    ],
    expandableSelectors: [
      '[aria-expanded]',
      '[class*="expandable"]',
      '[class*="collapsible"]',
      '[class*="accordion"]',
      'details',
      '[data-toggle]',
      '[data-collapse]'
    ],
    mobileDrawerSelectors: [
      '.category-drawer',
      '.collection-drawer',
      '[class*="mobile-nav"]',
      '[class*="mobile-menu"]',
      '[data-mobile-nav]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('collections-nav', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet, getFocusableElements, isFocusable } = h;

  // ==========================================================================
  // FIND COLLECTIONS NAV
  // ==========================================================================

  function findCollectionsNav() {
    const navs = new Set();
    
    CONFIG.scope.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (isVisible(el)) {
            // Filter to likely collection/category navigation (not main nav)
            const isMainNav = el.closest('header') || el.closest('[role="banner"]');
            const isFooter = el.closest('footer') || el.closest('[role="contentinfo"]');
            
            // Check if it contains category-related content
            const text = el.textContent.toLowerCase();
            const hasCategories = text.includes('categor') || text.includes('collection') || 
                                  text.includes('shop by') || text.includes('browse') ||
                                  el.querySelectorAll('a').length > 3;
            
            if (!isMainNav && !isFooter && hasCategories) {
              // Avoid nested elements
              let dominated = false;
              navs.forEach(existing => {
                if (existing.contains(el) && existing !== el) dominated = true;
                if (el.contains(existing) && existing !== el) navs.delete(existing);
              });
              if (!dominated) navs.add(el);
            }
          }
        });
      } catch (e) {
        // Invalid selector
      }
    });
    
    return Array.from(navs);
  }

  const collectionsNavs = findCollectionsNav();
  
  if (collectionsNavs.length === 0) {
    results.manualChecks.push({
      wcag: '1.3.1',
      message: 'No collection/category navigation found on page',
      howToTest: 'Verify if this page should have sidebar category navigation (common on collection/PLP pages)'
    });
    
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  // ==========================================================================
  // TEST FUNCTIONS
  // ==========================================================================
  
  /**
   * Test 1: List Structure
   * WCAG: 1.3.1
   */
  function testListStructure() {
    collectionsNavs.forEach(nav => {
      results.stats.elementsScanned++;
      
      const lists = nav.querySelectorAll('ul, ol, [role="list"], [role="tree"]');
      const links = nav.querySelectorAll('a[href]');
      
      if (links.length > 3 && lists.length === 0) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Collection navigation with ' + links.length + ' links not structured as a list',
          nav,
          'Wrap navigation links in <ul>/<li> elements to convey list relationship',
          'Screen reader users cannot understand the grouped relationship of categories'
        );
      } else if (lists.length > 0) {
        addPassed('1.3.1', 'Info and Relationships', 'Collection navigation uses list structure', getSelector(nav));
      }
      
      // Check for nested lists (hierarchical categories)
      const nestedLists = nav.querySelectorAll('ul ul, ol ol, li > ul, li > ol');
      if (nestedLists.length > 0) {
        // Verify proper nesting
        nestedLists.forEach(nested => {
          const parent = nested.parentElement;
          if (parent && parent.tagName !== 'LI') {
            addIssue(
              'moderate',
              '1.3.1',
              'Info and Relationships',
              'Nested list not properly contained within parent <li>',
              nested,
              'Ensure nested <ul> is inside the parent <li> element',
              'Hierarchical relationship not properly conveyed'
            );
          }
        });
        
        addPassed('1.3.1', 'Info and Relationships', 'Collection navigation has hierarchical structure with nested lists', getSelector(nav));
      }
    });
  }

  /**
   * Test 2: Navigation Landmark
   * WCAG: 1.3.1, 2.4.1
   */
  function testNavigationLandmark() {
    collectionsNavs.forEach(nav => {
      results.stats.elementsScanned++;
      
      const isNavElement = nav.tagName.toLowerCase() === 'nav';
      const hasNavRole = nav.getAttribute('role') === 'navigation';
      const isInNav = nav.closest('nav') || nav.closest('[role="navigation"]');
      
      if (!isNavElement && !hasNavRole && !isInNav) {
        addManualCheck(
          '1.3.1',
          'Consider wrapping collection navigation in <nav> or role="navigation"',
          'If this is a significant navigation region, using <nav> helps screen reader users find it via landmarks',
          getSelector(nav)
        );
      } else {
        // Check for accessible name on navigation
        const navContainer = isNavElement ? nav : (nav.closest('nav') || nav.closest('[role="navigation"]'));
        if (navContainer) {
          const name = getAccessibleName(navContainer);
          const ariaLabel = navContainer.getAttribute('aria-label');
          const ariaLabelledby = navContainer.getAttribute('aria-labelledby');
          
          if (!ariaLabel && !ariaLabelledby) {
            // Check if there's a visible heading that could label it
            const heading = navContainer.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading && heading.id) {
              addIssue(
                'minor',
                '2.4.1',
                'Bypass Blocks',
                'Navigation landmark has heading but not linked via aria-labelledby',
                navContainer,
                'Add aria-labelledby="' + heading.id + '" to the nav element',
                'Screen reader users may not understand the navigation purpose'
              );
            } else if (heading) {
              addManualCheck(
                '2.4.1',
                'Consider adding aria-label to distinguish this navigation',
                'With multiple nav landmarks, add aria-label="Categories" or similar',
                getSelector(navContainer)
              );
            } else {
              addIssue(
                'minor',
                '2.4.1',
                'Bypass Blocks',
                'Navigation landmark has no accessible name',
                navContainer,
                'Add aria-label="Product Categories" or similar descriptive label',
                'Screen reader users cannot distinguish this from other navigation'
              );
            }
          } else {
            addPassed('2.4.1', 'Bypass Blocks', 'Navigation landmark has accessible name', getSelector(navContainer));
          }
        }
      }
    });
  }

  /**
   * Test 3: Expandable Categories (aria-expanded)
   * WCAG: 4.1.2
   */
  function testExpandableCategories() {
    collectionsNavs.forEach(nav => {
      // Find expandable triggers
      const expandables = [];
      CONFIG.expandableSelectors.forEach(selector => {
        nav.querySelectorAll(selector).forEach(el => {
          if (isVisible(el) || el.tagName === 'DETAILS') expandables.push(el);
        });
      });
      
      // Also look for buttons/links that toggle subcategories
      const toggleButtons = nav.querySelectorAll('button, [role="button"], a[href="#"], a[href="javascript"]');
      toggleButtons.forEach(btn => {
        const hasSublist = btn.parentElement && btn.parentElement.querySelector('ul, ol');
        const hasIcon = btn.querySelector('svg, [class*="icon"], [class*="chevron"], [class*="arrow"], [class*="plus"], [class*="minus"]');
        if (hasSublist || hasIcon) {
          if (!expandables.includes(btn)) expandables.push(btn);
        }
      });
      
      if (expandables.length === 0) return;
      
      expandables.forEach(trigger => {
        results.stats.elementsScanned++;
        
        // Skip <details> elements - they have native handling
        if (trigger.tagName === 'DETAILS') {
          const summary = trigger.querySelector('summary');
          if (summary) {
            addPassed('4.1.2', 'Name, Role, Value', 'Uses native <details>/<summary> for expandable category', getSelector(trigger));
          }
          return;
        }
        
        const ariaExpanded = trigger.getAttribute('aria-expanded');
        const ariaControls = trigger.getAttribute('aria-controls');
        
        if (!ariaExpanded) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Expandable category toggle missing aria-expanded',
            trigger,
            'Add aria-expanded="false" (or "true" when expanded) to indicate state',
            'Screen reader users cannot determine if subcategories are shown'
          );
        } else {
          addPassed('4.1.2', 'Name, Role, Value', 'Expandable toggle has aria-expanded="' + ariaExpanded + '"', getSelector(trigger));
        }
        
        // Check aria-controls
        if (!ariaControls) {
          const nextSibling = trigger.nextElementSibling;
          const parentList = trigger.parentElement && trigger.parentElement.querySelector('ul, ol, [role="group"]');
          
          if (nextSibling || parentList) {
            addManualCheck(
              '4.1.2',
              'Consider adding aria-controls to link toggle with controlled content',
              'Add id to subcategory list and aria-controls pointing to it',
              getSelector(trigger)
            );
          }
        }
      });
    });
  }

  /**
   * Test 4: Tree Navigation Pattern
   * WCAG: 4.1.2
   */
  function testTreePattern() {
    collectionsNavs.forEach(nav => {
      const hasTree = nav.querySelector('[role="tree"]');
      const hasTreeItems = nav.querySelectorAll('[role="treeitem"]').length;
      
      if (hasTree) {
        results.stats.elementsScanned++;
        
        // Validate tree structure
        const treeItems = nav.querySelectorAll('[role="treeitem"]');
        const groups = nav.querySelectorAll('[role="group"]');
        
        if (treeItems.length === 0) {
          addIssue(
            'serious',
            '4.1.2',
            'Name, Role, Value',
            'Tree role used but no treeitems found',
            hasTree,
            'Add role="treeitem" to each category item in the tree',
            'Tree navigation is not properly structured'
          );
        } else {
          addPassed('4.1.2', 'Name, Role, Value', 'Tree navigation has ' + treeItems.length + ' treeitems', getSelector(hasTree));
        }
        
        // Check for proper nesting with groups
        treeItems.forEach(item => {
          const nestedList = item.querySelector('ul, ol, [role="group"]');
          if (nestedList && nestedList.getAttribute('role') !== 'group') {
            addIssue(
              'moderate',
              '4.1.2',
              'Name, Role, Value',
              'Nested tree items should be wrapped in role="group"',
              nestedList,
              'Add role="group" to the nested <ul> within the treeitem',
              'Screen readers may not properly convey tree hierarchy'
            );
          }
        });
        
        // Add manual check for keyboard
        addManualCheck(
          '2.1.1',
          'Verify tree keyboard navigation works correctly',
          'Arrow Up/Down moves between visible items, Arrow Right expands/enters, Arrow Left collapses/exits, Home/End move to first/last',
          getSelector(hasTree)
        );
      } else if (hasTreeItems > 0) {
        // Has treeitems but no tree container
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Found role="treeitem" but no parent role="tree"',
          nav,
          'Wrap treeitem elements in a container with role="tree"',
          'Tree navigation structure is incomplete'
        );
      }
    });
  }

  /**
   * Test 5: Category Links
   * WCAG: 2.4.4
   */
  function testCategoryLinks() {
    collectionsNavs.forEach(nav => {
      const links = nav.querySelectorAll('a[href]');
      
      links.forEach(link => {
        if (!isVisible(link)) return;
        results.stats.elementsScanned++;
        
        const name = getAccessibleName(link);
        const href = link.getAttribute('href');
        
        if (!name) {
          addIssue(
            'serious',
            '2.4.4',
            'Link Purpose',
            'Category link has no accessible name',
            link,
            'Add text content or aria-label to the link',
            'Screen reader users cannot determine category name'
          );
        } else if (name.length < 2) {
          addIssue(
            'moderate',
            '2.4.4',
            'Link Purpose',
            'Category link name too short: "' + name + '"',
            link,
            'Use descriptive category name',
            'Link purpose may be unclear'
          );
        } else {
          // Check for duplicate link text with different destinations
          const sameName = Array.from(links).filter(l => 
            getAccessibleName(l).toLowerCase() === name.toLowerCase() && 
            l.getAttribute('href') !== href
          );
          
          if (sameName.length > 0) {
            addManualCheck(
              '2.4.4',
              'Multiple links with same text "' + name.slice(0, 30) + '" go to different pages',
              'Ensure link purpose is clear in context or use aria-label to differentiate',
              getSelector(link)
            );
          }
        }
        
        // Check for current page indicator
        const ariaCurrent = link.getAttribute('aria-current');
        const isActive = link.classList.contains('active') || link.classList.contains('current') ||
                         link.closest('.active') || link.closest('.current') ||
                         link.closest('[aria-current]');
        
        if (isActive && !ariaCurrent) {
          addIssue(
            'minor',
            '4.1.2',
            'Name, Role, Value',
            'Active category link missing aria-current',
            link,
            'Add aria-current="page" to indicate current location',
            'Screen reader users not informed they are on this category'
          );
        } else if (ariaCurrent) {
          addPassed('4.1.2', 'Name, Role, Value', 'Current category has aria-current', getSelector(link));
        }
      });
    });
  }

  /**
   * Test 6: Section Heading
   * WCAG: 2.4.6
   */
  function testSectionHeading() {
    collectionsNavs.forEach(nav => {
      results.stats.elementsScanned++;
      
      const heading = nav.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
      const parentHeading = nav.previousElementSibling && 
                            nav.previousElementSibling.matches('h1, h2, h3, h4, h5, h6, [role="heading"]');
      
      if (!heading && !parentHeading) {
        // Check for visually hidden heading
        const srHeading = nav.querySelector('.sr-only, .visually-hidden, [class*="screen-reader"]');
        
        if (!srHeading) {
          addManualCheck(
            '2.4.6',
            'Consider adding a heading to label the category navigation',
            'A heading like "Shop by Category" or "Collections" helps users understand the section',
            getSelector(nav)
          );
        } else {
          addPassed('2.4.6', 'Headings and Labels', 'Category navigation has visually hidden heading', getSelector(srHeading));
        }
      } else {
        const headingEl = heading || nav.previousElementSibling;
        addPassed('2.4.6', 'Headings and Labels', 'Category navigation has heading', getSelector(headingEl));
      }
    });
  }

  /**
   * Test 7: Keyboard Navigation
   * WCAG: 2.1.1, 2.4.3
   */
  function testKeyboardNavigation() {
    collectionsNavs.forEach(nav => {
      const focusable = getFocusableElements(nav);
      results.stats.elementsScanned += focusable.length;
      
      // Check for positive tabindex
      focusable.forEach(el => {
        const tabindex = el.getAttribute('tabindex');
        if (tabindex && parseInt(tabindex) > 0) {
          addIssue(
            'moderate',
            '2.4.3',
            'Focus Order',
            'Element has positive tabindex disrupting focus order',
            el,
            'Remove positive tabindex or set to 0',
            'Focus order may be confusing'
          );
        }
      });
      
      // Check for interactive elements that aren't focusable
      const clickables = nav.querySelectorAll('[onclick], [class*="toggle"], [class*="expand"]');
      clickables.forEach(el => {
        if (!isVisible(el)) return;
        const isFocusable = el.matches('a[href], button, [tabindex]') || 
                            el.tagName === 'A' || el.tagName === 'BUTTON';
        
        if (!isFocusable) {
          addIssue(
            'serious',
            '2.1.1',
            'Keyboard',
            'Interactive element is not keyboard focusable',
            el,
            'Use <button> for toggles or add tabindex="0" and keyboard event handlers',
            'Keyboard users cannot activate this control'
          );
        }
      });
      
      // Manual check for focus indicators
      addManualCheck(
        '2.4.7',
        'Verify focus indicators are visible on category links',
        'Tab through the navigation and confirm each item has a visible focus indicator',
        getSelector(nav)
      );
    });
  }

  /**
   * Test 8: Mobile Category Drawer
   * WCAG: 4.1.2, 2.1.2
   */
  function testMobileDrawer() {
    let drawer = null;
    
    for (const selector of CONFIG.mobileDrawerSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        drawer = el;
        break;
      }
    }
    
    if (!drawer) return;
    
    results.stats.elementsScanned++;
    
    const role = drawer.getAttribute('role');
    const ariaModal = drawer.getAttribute('aria-modal');
    
    if (isVisible(drawer)) {
      if (role !== 'dialog') {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Mobile category drawer lacks role="dialog"',
          drawer,
          'Add role="dialog" to the drawer container',
          'Screen readers may not understand the modal context'
        );
      }
      
      if (ariaModal !== 'true') {
        addManualCheck(
          '2.1.2',
          'Verify focus is trapped within mobile category drawer',
          'When open, Tab should cycle within drawer only, Escape should close',
          getSelector(drawer)
        );
      }
      
      // Check for close button
      const closeButton = drawer.querySelector('[class*="close"], [aria-label*="close" i], button');
      if (!closeButton) {
        addIssue(
          'moderate',
          '2.1.1',
          'Keyboard',
          'Mobile category drawer has no visible close button',
          drawer,
          'Add a close button with aria-label="Close category menu"',
          'Users may not know how to close the drawer'
        );
      }
    }
    
    // Check for trigger button
    const triggerSelectors = [
      '[data-category-toggle]',
      '[aria-controls="' + drawer.id + '"]',
      '[class*="category-toggle"]',
      '[class*="menu-toggle"]'
    ];
    
    let trigger = null;
    for (const selector of triggerSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        trigger = el;
        break;
      }
    }
    
    if (trigger) {
      results.stats.elementsScanned++;
      
      const ariaExpanded = trigger.getAttribute('aria-expanded');
      if (!ariaExpanded) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Category drawer toggle missing aria-expanded',
          trigger,
          'Add aria-expanded="false" (or "true" when open)',
          'Screen reader users cannot determine drawer state'
        );
      }
    }
  }

  /**
   * Test 9: Category Count Indicators
   * WCAG: 1.3.1
   */
  function testCategoryCounts() {
    collectionsNavs.forEach(nav => {
      // Look for product counts like "Dresses (42)"
      const countPatterns = nav.querySelectorAll('[class*="count"], [class*="badge"], [class*="num"]');
      
      countPatterns.forEach(count => {
        if (!isVisible(count)) return;
        results.stats.elementsScanned++;
        
        const text = count.textContent.trim();
        const isNumber = /^\(?\d+\)?$/.test(text);
        
        if (isNumber) {
          // Check if it has context
          const parent = count.parentElement;
          const parentText = parent ? parent.textContent.trim() : '';
          const hasContext = parentText.length > text.length + 2;
          
          if (!hasContext) {
            addManualCheck(
              '1.3.1',
              'Verify category count has accessible context',
              'Number "' + text + '" should be associated with category name (e.g., "Dresses (42 products)")',
              getSelector(count)
            );
          }
          
          // Check for sr-only text explaining the count
          const srText = count.querySelector('.sr-only, .visually-hidden') || 
                         count.getAttribute('aria-label');
          
          if (!srText) {
            addManualCheck(
              '1.3.1',
              'Consider adding screen reader context to product count',
              'Add visually hidden text like "42 products" instead of just "(42)"',
              getSelector(count)
            );
          }
        }
      });
    });
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================
  
  testListStructure();
  testNavigationLandmark();
  testExpandableCategories();
  testTreePattern();
  testCategoryLinks();
  testSectionHeading();
  testKeyboardNavigation();
  testMobileDrawer();
  testCategoryCounts();

  // ==========================================================================
  // FINALIZE RESULTS
  // ==========================================================================
  
  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runCollectionsNavAudit = runCollectionsNavAudit;
}
