/**
 * Breadcrumbs Accessibility Audit
 * WCAG: 1.3.1, 2.4.4, 2.4.8, 4.1.2
 */

function runBreadcrumbsAudit() {
  'use strict';

  const startTime = performance.now();

  // Configuration
  const CONFIG = {
    scope: [
      'nav[aria-label*="breadcrumb" i]',
      'nav[aria-label*="Breadcrumb" i]',
      '[role="navigation"][aria-label*="breadcrumb" i]',
      '.breadcrumb',
      '.breadcrumbs',
      '[class*="breadcrumb"]',
      '[data-breadcrumb]',
      'ol.breadcrumb',
      'ul.breadcrumb'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('breadcrumbs', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet } = h;

  // Find breadcrumb elements
  function getBreadcrumbContainer() {
    for (const selector of CONFIG.scope) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  const breadcrumbEl = getBreadcrumbContainer();

  if (!breadcrumbEl) {
    // Breadcrumbs are optional - not finding them is not an issue
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  results.stats.elementsScanned++;

  // Test 1: Navigation Landmark
  function testNavLandmark() {
    const isNav = breadcrumbEl.tagName === 'NAV' || breadcrumbEl.getAttribute('role') === 'navigation';
    const hasAriaLabel = breadcrumbEl.getAttribute('aria-label') || breadcrumbEl.getAttribute('aria-labelledby');

    if (!isNav) {
      // Check if wrapped in nav
      const parentNav = breadcrumbEl.closest('nav, [role="navigation"]');
      if (parentNav) {
        const parentLabel = parentNav.getAttribute('aria-label') || '';
        if (parentLabel.toLowerCase().includes('breadcrumb')) {
          addPassed('1.3.1', 'Info and Relationships', 'Breadcrumbs wrapped in labeled nav element', getSelector(parentNav));
          return;
        }
      }
      addIssue('moderate', '1.3.1', 'Info and Relationships', 'Breadcrumbs not in a nav landmark', breadcrumbEl, 'Wrap breadcrumbs in <nav aria-label="Breadcrumb"> element', 'Screen reader users cannot identify breadcrumbs as navigation');
      return;
    }

    if (!hasAriaLabel) {
      addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Breadcrumb nav lacks accessible label', breadcrumbEl, 'Add aria-label="Breadcrumb" to the nav element', 'Screen reader users cannot distinguish this nav from other navigation');
      return;
    }

    const labelText = breadcrumbEl.getAttribute('aria-label') || '';
    if (!labelText.toLowerCase().includes('breadcrumb')) {
      addIssue('minor', '4.1.2', 'Name, Role, Value', 'Breadcrumb nav label does not indicate purpose: "' + labelText + '"', breadcrumbEl, 'Use aria-label="Breadcrumb" or similar descriptive label');
    } else {
      addPassed('1.3.1', 'Info and Relationships', 'Breadcrumb nav has appropriate aria-label', getSelector(breadcrumbEl));
    }
  }

  // Test 2: List Structure
  function testListStructure() {
    const ol = breadcrumbEl.querySelector('ol') || (breadcrumbEl.tagName === 'OL' ? breadcrumbEl : null);
    const ul = breadcrumbEl.querySelector('ul') || (breadcrumbEl.tagName === 'UL' ? breadcrumbEl : null);
    const list = ol || ul;

    if (!list) {
      addIssue('moderate', '1.3.1', 'Info and Relationships', 'Breadcrumbs not structured as a list', breadcrumbEl, 'Use <ol> (ordered list) to indicate sequential hierarchy', 'Screen reader users do not hear breadcrumb count or position');
      return;
    }

    if (ul && !ol) {
      addIssue('minor', '1.3.1', 'Info and Relationships', 'Breadcrumbs use unordered list instead of ordered list', list, 'Use <ol> instead of <ul> to convey sequential order', 'Screen readers announce "list" but not the hierarchical nature');
    } else if (ol) {
      addPassed('1.3.1', 'Info and Relationships', 'Breadcrumbs use ordered list structure', getSelector(ol));
    }

    const listItems = list.querySelectorAll(':scope > li');
    if (listItems.length === 0) {
      addIssue('moderate', '1.3.1', 'Info and Relationships', 'Breadcrumb list has no list items', list, 'Add <li> elements for each breadcrumb item');
    } else {
      results.stats.elementsScanned += listItems.length;
      addPassed('1.3.1', 'Info and Relationships', 'Breadcrumb has ' + listItems.length + ' list items', getSelector(list));
    }

    return list;
  }

  // Test 3: Current Page Indication
  function testCurrentPage(list) {
    if (!list) return;

    const listItems = list.querySelectorAll(':scope > li');
    if (listItems.length === 0) return;

    const lastItem = listItems[listItems.length - 1];
    const lastLink = lastItem.querySelector('a');
    const ariaCurrent = lastItem.querySelector('[aria-current]') || lastItem.getAttribute('aria-current');

    // Check for aria-current on last item or its contents
    const hasAriaCurrent = lastItem.getAttribute('aria-current') === 'page' ||
                          lastItem.getAttribute('aria-current') === 'location' ||
                          lastItem.querySelector('[aria-current="page"]') ||
                          lastItem.querySelector('[aria-current="location"]');

    if (hasAriaCurrent) {
      addPassed('4.1.2', 'Name, Role, Value', 'Current page marked with aria-current', getSelector(lastItem));
    } else if (!lastLink) {
      // Last item is text only (not a link) - this is acceptable
      addPassed('2.4.8', 'Location', 'Current page is not linked (acceptable pattern)', getSelector(lastItem));
      addManualCheck('4.1.2', 'Consider adding aria-current="page" to current breadcrumb', 'While not linked, aria-current provides explicit indication to screen readers', getSelector(lastItem));
    } else {
      addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Current page breadcrumb lacks aria-current attribute', lastItem, 'Add aria-current="page" to the current breadcrumb item or link', 'Screen reader users cannot identify which breadcrumb is the current page');
    }
  }

  // Test 4: Link Accessibility
  function testLinks(list) {
    if (!list) return;

    const links = list.querySelectorAll('a[href]');
    let emptyLinks = 0;
    let genericLinks = 0;

    links.forEach(link => {
      if (!isVisible(link)) return;
      results.stats.elementsScanned++;

      const name = getAccessibleName(link);
      if (!name) {
        emptyLinks++;
        addIssue('serious', '2.4.4', 'Link Purpose', 'Breadcrumb link has no accessible name', link, 'Add text content to the link');
      } else if (name.toLowerCase() === 'home' && link.querySelector('svg, img, [class*="icon"]')) {
        // Home icon with "Home" text is fine
        addPassed('2.4.4', 'Link Purpose', 'Home breadcrumb has accessible name', getSelector(link));
      } else if (['click here', 'link', 'page'].includes(name.toLowerCase())) {
        genericLinks++;
        addIssue('moderate', '2.4.4', 'Link Purpose', 'Breadcrumb link has generic name: "' + name + '"', link, 'Use descriptive text that indicates the destination page');
      }
    });

    if (links.length > 0 && emptyLinks === 0 && genericLinks === 0) {
      addPassed('2.4.4', 'Link Purpose', 'All ' + links.length + ' breadcrumb links have descriptive names', 'breadcrumb links');
    }
  }

  // Test 5: Separator Accessibility
  function testSeparators(list) {
    if (!list) return;

    const listItems = Array.from(list.querySelectorAll(':scope > li'));
    if (listItems.length < 2) return;

    // Check for CSS-based separators (preferred)
    const firstItem = listItems[0];
    const afterContent = window.getComputedStyle(firstItem, '::after').content;
    const beforeContent = listItems[1] ? window.getComputedStyle(listItems[1], '::before').content : 'none';

    if (afterContent !== 'none' || beforeContent !== 'none') {
      addPassed('1.3.1', 'Info and Relationships', 'Breadcrumb separators use CSS pseudo-elements (hidden from AT)', 'li::after or li::before');
      return;
    }

    // Check for inline separators
    let exposedSeparators = 0;
    const separatorChars = ['/', '>', '\u2192', '\u00BB', '\u203A', '\\', '|', '-', '\u00B7'];

    listItems.forEach((li, index) => {
      if (index === listItems.length - 1) return; // Skip last item

      // Look for separator elements
      const separatorEl = li.querySelector('[aria-hidden="true"], .separator, .divider, [class*="separator"], [class*="divider"]');
      if (separatorEl) return; // Properly hidden

      // Check for text node separators
      const textContent = li.textContent;
      const linkText = li.querySelector('a')?.textContent || '';
      const remainingText = textContent.replace(linkText, '').trim();

      if (separatorChars.some(char => remainingText.includes(char))) {
        // Check if it's aria-hidden
        // M1 fix: Use scoped selector instead of full-subtree querySelectorAll('*')
        const allChildren = li.querySelectorAll(':scope > *');
        let separatorHidden = false;
        allChildren.forEach(child => {
          if (child.getAttribute('aria-hidden') === 'true' && separatorChars.some(char => child.textContent.includes(char))) {
            separatorHidden = true;
          }
        });

        if (!separatorHidden) {
          exposedSeparators++;
        }
      }
    });

    if (exposedSeparators > 0) {
      addIssue('minor', '1.3.1', 'Info and Relationships', exposedSeparators + ' breadcrumb separator(s) may be announced to screen readers', listItems[0], 'Hide separators with aria-hidden="true" or use CSS pseudo-elements', 'Screen reader users hear redundant separator characters between items');
    } else {
      addPassed('1.3.1', 'Info and Relationships', 'Breadcrumb separators properly hidden from assistive technology', 'separators');
    }
  }

  // Test 6: Structured Data (Schema.org)
  function testStructuredData() {
    // Check for JSON-LD breadcrumb schema
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    let hasBreadcrumbSchema = false;

    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent);
        if (data['@type'] === 'BreadcrumbList' || (Array.isArray(data['@graph']) && data['@graph'].some(item => item['@type'] === 'BreadcrumbList'))) {
          hasBreadcrumbSchema = true;
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }

    // Check for microdata
    const microdata = breadcrumbEl.querySelector('[itemtype*="BreadcrumbList"]') || document.querySelector('[itemtype*="BreadcrumbList"]');
    if (microdata) hasBreadcrumbSchema = true;

    if (hasBreadcrumbSchema) {
      addPassed('1.3.1', 'Info and Relationships', 'Breadcrumb has Schema.org structured data', 'BreadcrumbList schema');
    } else {
      addManualCheck('1.3.1', 'Consider adding Schema.org BreadcrumbList markup', 'Not required for WCAG, but improves SEO and machine readability', 'breadcrumbs');
    }
  }

  // Run all tests
  testNavLandmark();
  const list = testListStructure();
  testCurrentPage(list);
  testLinks(list);
  testSeparators(list);
  testStructuredData();

  // Finalize results
  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runBreadcrumbsAudit = runBreadcrumbsAudit;
}
