/**
 * Navigation Accessibility Audit
 * WCAG: 1.3.1, 2.1.1, 2.1.2, 2.4.3, 2.4.4, 2.5.3, 4.1.2
 */

function runNavigationAudit() {
  'use strict';

  const startTime = performance.now();

  const CONFIG = {
    scope: ['nav', '[role="navigation"]', '.navigation', '.main-nav', '.primary-nav', '#nav', '.site-nav'],
    menuTriggerSelectors: ['[aria-expanded]', '[aria-haspopup]', 'button.menu-toggle', '[class*="dropdown-toggle"]', '[class*="menu-trigger"]', '.has-submenu > a', '.has-dropdown > a'],
    submenuSelectors: ['[role="menu"]', '.submenu', '.dropdown-menu', '.mega-menu', '[class*="submenu"]', '[class*="dropdown"]'],
    mobileMenuSelectors: ['.mobile-nav', '.mobile-menu', '[class*="drawer"]', '[class*="mobile-nav"]', '#mobile-menu', '[role="dialog"][class*="nav"]']
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('navigation', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet } = h;

  // Find navigation elements — test all nav elements, not just first match
  function findNavigation() {
    for (const selector of CONFIG.scope) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  function findAllNavigations() {
    const navs = new Set();
    CONFIG.scope.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (isVisible(el)) navs.add(el);
        });
      } catch (e) { /* Invalid selector */ }
    });
    // Pattern A fix: Deduplicate nested nav elements
    const { deduplicateElements, isExposedToAT } = window.a11yHelpers;
    let result = Array.from(navs);
    if (deduplicateElements) result = deduplicateElements(result);
    if (isExposedToAT) result = result.filter(el => isExposedToAT(el));
    return result;
  }

  const navEl = findNavigation();
  const allNavElements = findAllNavigations();

  // Test 1: Navigation Landmark
  function testNavigationLandmark() {
    const navs = document.querySelectorAll('nav, [role="navigation"]');
    
    if (navs.length === 0) {
      addIssue('serious', '1.3.1', 'Info and Relationships', 'No navigation landmark found', document.body, 'Wrap navigation in <nav> element or add role="navigation"', 'Screen reader users cannot quickly find navigation');
      return;
    }
    
    results.stats.elementsScanned += navs.length;
    
    if (navs.length > 1) {
      let unnamedNavs = 0;
      navs.forEach(nav => {
        const name = getAccessibleName(nav);
        if (!name) unnamedNavs++;
      });
      
      if (unnamedNavs > 0) {
        addIssue('moderate', '1.3.1', 'Info and Relationships', 'Multiple navigation landmarks without unique labels', navs[0], 'Add aria-label to distinguish navigations, e.g., "Main navigation", "Footer navigation"', 'Screen reader users cannot distinguish between navigations');
      } else {
        addPassed('1.3.1', 'Info and Relationships', 'Multiple navigations have unique labels', 'nav elements');
      }
    } else {
      addPassed('1.3.1', 'Info and Relationships', 'Navigation landmark present', getSelector(navs[0]));
    }
  }

  // Test 2: Dropdown/Menu Triggers
  function testMenuTriggers() {
    if (!navEl) return;
    
    const triggers = navEl.querySelectorAll('[aria-expanded], [aria-haspopup], .has-submenu > a, .has-dropdown > a, [class*="dropdown"] > a');
    
    triggers.forEach(trigger => {
      if (!isVisible(trigger)) return;
      results.stats.elementsScanned++;
      
      const tagName = trigger.tagName.toLowerCase();
      const role = trigger.getAttribute('role');
      const ariaExpanded = trigger.getAttribute('aria-expanded');
      const ariaHaspopup = trigger.getAttribute('aria-haspopup');
      
      // Check if trigger is a button or has button role
      if (tagName !== 'button' && role !== 'button') {
        // Link used as dropdown trigger
        if (tagName === 'a') {
          const href = trigger.getAttribute('href');
          if (href === '#' || href === 'javascript:void(0)' || !href) {
            addIssue('serious', '4.1.2', 'Name, Role, Value', 'Link used as menu trigger with non-functional href', trigger, 'Change to <button> element or add role="button"', 'Semantic confusion for assistive technology');
          } else {
            // Link with real href but also acts as trigger
            addManualCheck('2.1.1', 'Link doubles as navigation and dropdown trigger', 'Verify both clicking the link and accessing submenu work correctly', getSelector(trigger));
          }
        }
      }
      
      // Check for aria-expanded
      if (!ariaExpanded) {
        addIssue('serious', '4.1.2', 'Name, Role, Value', 'Menu trigger missing aria-expanded', trigger, 'Add aria-expanded="false" that toggles to "true" when menu opens', 'Screen reader users not informed of menu state');
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Menu trigger has aria-expanded', getSelector(trigger));
      }
      
      // Check for aria-haspopup (recommended but not required)
      if (!ariaHaspopup && !ariaExpanded) {
        addIssue('minor', '4.1.2', 'Name, Role, Value', 'Menu trigger missing aria-haspopup', trigger, 'Add aria-haspopup="true" or aria-haspopup="menu"');
      }
    });
    
    if (triggers.length === 0) {
      // Check for CSS-only dropdowns (hover-based without ARIA)
      const hoverDropdowns = navEl.querySelectorAll('li:hover > ul, .has-submenu, .has-dropdown');
      if (hoverDropdowns.length > 0) {
        addIssue('serious', '2.1.1', 'Keyboard', 'CSS hover-only dropdowns detected without keyboard support', hoverDropdowns[0], 'Add keyboard triggers with aria-expanded and focus management', 'Keyboard users cannot access dropdown menus');
      }
    }
  }

  // Test 3: Submenu Accessibility
  function testSubmenus() {
    if (!navEl) return;
    
    const submenus = navEl.querySelectorAll('[role="menu"], .submenu, .dropdown-menu, .mega-menu, ul ul');
    
    submenus.forEach(submenu => {
      results.stats.elementsScanned++;
      
      const role = submenu.getAttribute('role');
      const isHidden = submenu.getAttribute('aria-hidden') === 'true' || !isVisible(submenu);
      
      // Check for menu role (not required but good for complex menus)
      if (!role && submenu.querySelectorAll('a').length > 5) {
        addManualCheck('4.1.2', 'Consider adding role="menu" for complex submenu', 'For menus with many items, role="menu" enables better keyboard navigation', getSelector(submenu));
      }
      
      // Check focusable elements in hidden submenus
      if (isHidden) {
        const focusable = submenu.querySelectorAll('a[href], button');
        let hasActiveFocusable = false;
        
        focusable.forEach(el => {
          const tabindex = el.getAttribute('tabindex');
          if (tabindex !== '-1' && !el.closest('[inert]')) {
            hasActiveFocusable = true;
          }
        });
        
        if (hasActiveFocusable && submenu.getAttribute('aria-hidden') !== 'true') {
          addIssue('serious', '2.4.3', 'Focus Order', 'Hidden submenu has focusable elements without aria-hidden', submenu, 'Add aria-hidden="true" to closed submenus or set tabindex="-1" on items', 'Keyboard users encounter invisible elements');
        }
      }
    });
  }

  // Test 4: Mobile Navigation Drawer
  function testMobileNav() {
    const mobileNavs = [];
    CONFIG.mobileMenuSelectors.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) mobileNavs.push(el);
    });
    
    if (mobileNavs.length === 0) {
      addManualCheck('4.1.2', 'Test mobile navigation if present', 'On mobile viewport, open nav drawer and verify it has proper dialog role and focus management');
      return;
    }
    
    mobileNavs.forEach(mobileNav => {
      results.stats.elementsScanned++;
      
      const role = mobileNav.getAttribute('role');
      const ariaModal = mobileNav.getAttribute('aria-modal');
      const isOpen = isVisible(mobileNav);
      
      // Mobile nav should typically be a dialog when open
      if (role !== 'dialog' && role !== 'navigation') {
        addIssue('serious', '4.1.2', 'Name, Role, Value', 'Mobile navigation drawer missing role', mobileNav, 'Add role="dialog" aria-modal="true" for overlay-style, or role="navigation" for slide-in', 'Screen reader users not informed of navigation context');
      }
      
      if (role === 'dialog' && ariaModal !== 'true') {
        addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Mobile nav dialog missing aria-modal', mobileNav, 'Add aria-modal="true" when drawer overlays content');
      }
      
      // Check for close button
      const closeBtn = mobileNav.querySelector('[aria-label*="close" i], .close, [class*="close"]');
      if (!closeBtn) {
        addIssue('serious', '2.1.1', 'Keyboard', 'Mobile navigation has no visible close button', mobileNav, 'Add close button with aria-label="Close menu"', 'Users may not know how to close navigation');
      }
      
      if (isOpen) {
        addManualCheck('2.1.2', 'Verify mobile nav focus trap', 'Tab through mobile nav - focus should stay within until closed', getSelector(mobileNav));
      }
    });
  }

  // Test 5: Hamburger Menu Button
  function testHamburgerButton() {
    const hamburgerSelectors = ['[aria-label*="menu" i]', '.hamburger', '.menu-toggle', '[class*="hamburger"]', '[class*="menu-icon"]', 'button.mobile-menu'];
    let hamburger = null;
    
    for (const selector of hamburgerSelectors) {
      hamburger = document.querySelector(selector);
      if (hamburger && isVisible(hamburger)) break;
    }
    
    if (!hamburger) {
      addManualCheck('4.1.2', 'Verify mobile menu button accessibility', 'On mobile viewport, check that hamburger/menu button has accessible name');
      return;
    }
    
    results.stats.elementsScanned++;
    
    const name = getAccessibleName(hamburger);
    if (!name) {
      addIssue('critical', '4.1.2', 'Name, Role, Value', 'Hamburger menu button has no accessible name', hamburger, 'Add aria-label="Open menu" or "Navigation menu"', 'Screen reader users cannot identify button purpose');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 'Menu button has accessible name: "' + name.slice(0, 30) + '"', getSelector(hamburger));
    }
    
    const ariaExpanded = hamburger.getAttribute('aria-expanded');
    if (!ariaExpanded) {
      addIssue('serious', '4.1.2', 'Name, Role, Value', 'Hamburger button missing aria-expanded', hamburger, 'Add aria-expanded="false" that toggles when menu opens', 'Screen reader users not informed of menu state');
    }
    
    const ariaControls = hamburger.getAttribute('aria-controls');
    if (!ariaControls) {
      addIssue('minor', '4.1.2', 'Name, Role, Value', 'Hamburger button missing aria-controls', hamburger, 'Add aria-controls pointing to mobile nav ID');
    }
  }

  // Test 6: Keyboard Navigation
  function testKeyboardNavigation() {
    addManualCheck('2.1.1', 'Test dropdown keyboard navigation', 'Use Tab to reach menu triggers, Enter/Space to open, Arrow keys to navigate items, Escape to close');
    
    addManualCheck('2.1.2', 'Verify no focus traps in closed menus', 'Tab through navigation - focus should not enter closed dropdown menus');
    
    addManualCheck('2.4.3', 'Verify logical focus order', 'Tab through navigation and confirm order matches visual layout');
  }

  // Test 7: All Links (WCAG 2.4.4) - Scoped to navigation element
  function testAllLinks() {
    if (!navEl) return; // No navigation element found — nothing to scope to

    const links = navEl.querySelectorAll('a');
    let linksChecked = 0;

    if (links.length === 0) {
      return;
    }
    
    // Generic link text patterns to flag
    const genericPatterns = [
      /^click here$/i,
      /^read more$/i,
      /^more$/i,
      /^link$/i,
      /^here$/i,
      /^continue$/i,
      /^learn more$/i,
      /^see more$/i,
      /^view more$/i,
      /^download$/i,
      /^details$/i
    ];
    
    links.forEach(link => {
      if (!isVisible(link)) return;

      results.stats.elementsScanned++;
      linksChecked++;

      const href = link.getAttribute('href');
      const ariaLabel = link.getAttribute('aria-label');
      const ariaLabelledby = link.getAttribute('aria-labelledby');
      const title = link.getAttribute('title');
      const text = link.textContent.trim();
      const role = link.getAttribute('role');
      
      // Skip if has role="button" (handled by button component)
      if (role === 'button') {
        return;
      }
      
      // Check 1: Link has href attribute
      if (!href || href === '' || href === '#') {
        // Empty href or # - likely a button disguised as link
        if (href === '#' && link.hasAttribute('onclick')) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Link with href="#" should be a button',
            link,
            'Use <button> instead of <a href="#"> for click handlers',
            'Links should navigate, buttons should trigger actions'
          );
          return;
        }
        
        if (!href || href === '') {
          addIssue(
            'serious',
            '2.4.4',
            'Link Purpose',
            'Link missing href attribute',
            link,
            'Add href attribute with valid URL or use a <button> instead',
            'Links without href cannot be activated or navigated to'
          );
          return;
        }
      }
      
      // Check 2: Link has accessible name
      const hasAccessibleName = 
        (text && text.length > 0) ||
        ariaLabel ||
        ariaLabelledby ||
        title ||
        link.querySelector('img[alt]');
      
      if (!hasAccessibleName) {
        addIssue(
          'critical',
          '2.4.4',
          'Link Purpose',
          'Link has no accessible name',
          link,
          'Add text content, aria-label, or ensure child images have alt text',
          'Screen reader users cannot determine the link purpose'
        );
        return;
      }
      
      // Check 3: Generic link text (only if no aria-label override)
      if (!ariaLabel && !ariaLabelledby && text) {
        const textLower = text.toLowerCase().trim();
        const isGeneric = genericPatterns.some(pattern => pattern.test(textLower));
        
        if (isGeneric) {
          addIssue(
            'moderate',
            '2.4.4',
            'Link Purpose',
            'Link has generic text: "' + text + '"',
            link,
            'Use descriptive link text that makes sense out of context, or add aria-label',
            'Generic link text like "click here" doesn\'t convey the link purpose'
          );
          return;
        }
      }
      
      // Check 4: Link only contains image - ensure image has alt
      const imgs = link.querySelectorAll('img');
      if (imgs.length > 0 && !text && !ariaLabel) {
        const missingAlt = Array.from(imgs).some(img => {
          const alt = img.getAttribute('alt');
          return !alt || alt.trim() === '';
        });
        
        if (missingAlt) {
          addIssue(
            'serious',
            '2.4.4',
            'Link Purpose',
            'Image link has no alt text',
            link,
            'Add descriptive alt text to the image, or add aria-label to the link',
            'Screen reader users cannot determine where this image link goes'
          );
          return;
        }
      }
      
      // If we made it here, link seems accessible
      // Don't add passed for every single link (too noisy), just count
    });
    
    // Summary passed check
    if (linksChecked > 0) {
      addPassed('2.4.4', 'Link Purpose', linksChecked + ' links checked for accessibility');
    }
  }

  // ==========================================================================
  // Test 8: Link Label in Name (WCAG 2.5.3)
  // Migrated from comprehensive-audit.js auditLabelInName()
  // ==========================================================================

  function getVisibleTextContent(element) {
    var clone = element.cloneNode(true);
    // Remove SVG internal elements whose text isn't visually rendered
    var svgInternals = clone.querySelectorAll('svg style, svg defs, svg clipPath, svg mask, svg metadata');
    svgInternals.forEach(function(el) { el.remove(); });
    // Also remove entirely hidden elements
    var hiddenEls = clone.querySelectorAll('[aria-hidden="true"], [hidden], .visually-hidden, .sr-only');
    hiddenEls.forEach(function(el) { el.remove(); });
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function testLinkLabelInName() {
    // Check links with aria-label
    var linksWithAriaLabel = document.querySelectorAll('a[aria-label]');
    linksWithAriaLabel.forEach(function(link) {
      if (!isVisible(link)) return;
      results.stats.elementsScanned++;

      var visibleText = getVisibleTextContent(link);
      var ariaLabel = link.getAttribute('aria-label');
      if (visibleText && ariaLabel) {
        var normalizedVisible = visibleText.toLowerCase().replace(/\s+/g, ' ');
        var normalizedLabel = ariaLabel.toLowerCase().replace(/\s+/g, ' ');
        if (!normalizedLabel.includes(normalizedVisible)) {
          addIssue(
            'serious',
            '2.5.3',
            'Label in Name',
            'Link visible text "' + normalizedVisible.substring(0, 30) + '" not in accessible name "' + normalizedLabel.substring(0, 30) + '"',
            link,
            'Ensure aria-label includes the visible link text',
            'Voice control users cannot activate this link by speaking the visible text'
          );
        }
      }
    });

    // Check links with aria-labelledby
    var linksWithAriaLabelledby = document.querySelectorAll('a[aria-labelledby]');
    linksWithAriaLabelledby.forEach(function(link) {
      if (!isVisible(link)) return;
      results.stats.elementsScanned++;

      var visibleText = getVisibleTextContent(link);
      var labelledbyId = link.getAttribute('aria-labelledby');
      if (visibleText && labelledbyId) {
        // Resolve aria-labelledby to text
        var resolvedText = '';
        labelledbyId.split(/\s+/).forEach(function(id) {
          var refEl = document.getElementById(id);
          if (refEl) resolvedText += ' ' + getVisibleTextContent(refEl);
        });
        resolvedText = resolvedText.trim();

        if (resolvedText) {
          var normalizedVisible = visibleText.toLowerCase().replace(/\s+/g, ' ');
          var normalizedLabel = resolvedText.toLowerCase().replace(/\s+/g, ' ');
          if (!normalizedLabel.includes(normalizedVisible)) {
            addIssue(
              'serious',
              '2.5.3',
              'Label in Name',
              'Link visible text "' + normalizedVisible.substring(0, 30) + '" not in aria-labelledby name "' + normalizedLabel.substring(0, 30) + '"',
              link,
              'Ensure aria-labelledby resolves to text that includes the visible link text',
              'Voice control users cannot activate this link by speaking the visible text'
            );
          }
        }
      }
    });

    // Check elements with role="link"
    var roleLinks = document.querySelectorAll('[role="link"][aria-label]');
    roleLinks.forEach(function(link) {
      if (!isVisible(link)) return;
      results.stats.elementsScanned++;

      var visibleText = getVisibleTextContent(link);
      var ariaLabel = link.getAttribute('aria-label');
      if (visibleText && ariaLabel) {
        var normalizedVisible = visibleText.toLowerCase().replace(/\s+/g, ' ');
        var normalizedLabel = ariaLabel.toLowerCase().replace(/\s+/g, ' ');
        if (!normalizedLabel.includes(normalizedVisible)) {
          addIssue(
            'serious',
            '2.5.3',
            'Label in Name',
            'Element with role="link" visible text "' + normalizedVisible.substring(0, 30) + '" not in accessible name "' + normalizedLabel.substring(0, 30) + '"',
            link,
            'Ensure aria-label includes the visible text',
            'Voice control users cannot activate this element by speaking the visible text'
          );
        }
      }
    });
  }

  // Run all tests
  testNavigationLandmark();
  testMenuTriggers();
  testSubmenus();
  testMobileNav();
  testHamburgerButton();
  testKeyboardNavigation();
  testAllLinks();
  testLinkLabelInName();

  // Finalize
  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

if (typeof window !== 'undefined') {
  window.runNavigationAudit = runNavigationAudit;
}
