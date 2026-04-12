/**
 * Pagination Accessibility Audit
 * WCAG: 1.3.1, 2.4.4, 2.4.7, 4.1.2
 */

function runPaginationAudit() {
  'use strict';

  const startTime = performance.now();

  // Configuration
  const CONFIG = {
    scope: [
      'nav[aria-label*="pagination" i]',
      'nav[aria-label*="page" i]',
      '[role="navigation"][aria-label*="pagination" i]',
      '.pagination',
      '.pager',
      '[class*="pagination"]',
      '[data-pagination]',
      'nav.pages',
      '.page-numbers'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('pagination', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet } = h;

  // Find pagination elements
  function getPaginationContainer() {
    for (const selector of CONFIG.scope) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  const paginationEl = getPaginationContainer();

  if (!paginationEl) {
    // Pagination is optional - not finding it is not an issue
    results.stats.executionTimeMs = Math.round(performance.now() - startTime);
    return results;
  }

  results.stats.elementsScanned++;

  // Test 1: Navigation Landmark
  function testNavLandmark() {
    const isNav = paginationEl.tagName === 'NAV' || paginationEl.getAttribute('role') === 'navigation';
    const hasAriaLabel = paginationEl.getAttribute('aria-label') || paginationEl.getAttribute('aria-labelledby');

    if (!isNav) {
      // Check if wrapped in nav
      const parentNav = paginationEl.closest('nav, [role="navigation"]');
      if (parentNav) {
        const parentLabel = parentNav.getAttribute('aria-label') || '';
        if (parentLabel.toLowerCase().includes('pagination') || parentLabel.toLowerCase().includes('page')) {
          addPassed('1.3.1', 'Info and Relationships', 'Pagination wrapped in labeled nav element', getSelector(parentNav));
          return;
        }
      }
      addIssue('moderate', '1.3.1', 'Info and Relationships', 'Pagination not in a nav landmark', paginationEl, 'Wrap pagination in <nav aria-label="Pagination"> element', 'Screen reader users cannot identify pagination as navigation');
      return;
    }

    if (!hasAriaLabel) {
      addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Pagination nav lacks accessible label', paginationEl, 'Add aria-label="Pagination" to the nav element', 'Screen reader users cannot distinguish this nav from other navigation');
      return;
    }

    addPassed('1.3.1', 'Info and Relationships', 'Pagination nav has aria-label', getSelector(paginationEl));
  }

  // Test 2: Current Page Indication
  function testCurrentPage() {
    // Look for current page indicator
    const currentSelectors = [
      '[aria-current="page"]',
      '[aria-current="true"]',
      '.current',
      '.active',
      '[class*="current"]',
      '[class*="active"]',
      'span:not(a)' // Often current page is a span, not a link
    ];

    let currentPage = null;
    for (const selector of currentSelectors) {
      const el = paginationEl.querySelector(selector);
      if (el && isVisible(el)) {
        currentPage = el;
        break;
      }
    }

    if (!currentPage) {
      addIssue('moderate', '4.1.2', 'Name, Role, Value', 'No current page indication found in pagination', paginationEl, 'Add aria-current="page" to the current page element', 'Screen reader users cannot identify which page they are on');
      return;
    }

    const hasAriaCurrent = currentPage.getAttribute('aria-current') === 'page' || currentPage.getAttribute('aria-current') === 'true';

    if (hasAriaCurrent) {
      addPassed('4.1.2', 'Name, Role, Value', 'Current page marked with aria-current', getSelector(currentPage));
    } else {
      // Has visual indicator but no aria-current
      addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Current page has visual indicator but lacks aria-current="page"', currentPage, 'Add aria-current="page" to the current page element', 'Screen reader users rely on visual styling which they cannot perceive');
    }

    // Check if current page is not a link (good practice)
    if (currentPage.tagName === 'A') {
      addManualCheck('2.4.4', 'Current page is a link - consider making it non-interactive', 'Current page links that link to themselves can be confusing. Consider using a span or button with aria-current="page"', getSelector(currentPage));
    }
  }

  // Test 3: Previous/Next Links
  function testPrevNextLinks() {
    const prevSelectors = [
      'a[rel="prev"]',
      '[aria-label*="previous" i]',
      '[aria-label*="prev" i]',
      '.prev',
      '.previous',
      '[class*="prev"]'
    ];

    const nextSelectors = [
      'a[rel="next"]',
      '[aria-label*="next" i]',
      '.next',
      '[class*="next"]'
    ];

    let prevLink = null;
    let nextLink = null;

    for (const selector of prevSelectors) {
      const el = paginationEl.querySelector(selector);
      if (el && isVisible(el)) {
        prevLink = el;
        break;
      }
    }

    for (const selector of nextSelectors) {
      const el = paginationEl.querySelector(selector);
      if (el && isVisible(el)) {
        nextLink = el;
        break;
      }
    }

    // Test Previous link
    if (prevLink) {
      results.stats.elementsScanned++;
      const name = getAccessibleName(prevLink);
      const hasIcon = prevLink.querySelector('svg, img, [class*="icon"], [class*="arrow"]');

      if (!name || name === '<' || name === '\u2190' || name === '\u2039') {
        addIssue('serious', '2.4.4', 'Link Purpose', 'Previous page link has no accessible name or only symbol: "' + name + '"', prevLink, 'Add aria-label="Previous page" or include visually hidden text', 'Screen reader users hear only the symbol character');
      } else if (hasIcon && !prevLink.getAttribute('aria-label')) {
        addManualCheck('2.4.4', 'Verify previous link accessible name', 'Icon-based link may need aria-label. Current name: "' + name + '"', getSelector(prevLink));
      } else {
        addPassed('2.4.4', 'Link Purpose', 'Previous link has accessible name: "' + name + '"', getSelector(prevLink));
      }

      // Check for rel="prev"
      if (prevLink.tagName === 'A' && !prevLink.getAttribute('rel')) {
        addManualCheck('1.3.1', 'Consider adding rel="prev" to previous link', 'Helps search engines and assistive technology understand pagination relationship', getSelector(prevLink));
      }
    }

    // Test Next link
    if (nextLink) {
      results.stats.elementsScanned++;
      const name = getAccessibleName(nextLink);
      const hasIcon = nextLink.querySelector('svg, img, [class*="icon"], [class*="arrow"]');

      if (!name || name === '>' || name === '\u2192' || name === '\u203A') {
        addIssue('serious', '2.4.4', 'Link Purpose', 'Next page link has no accessible name or only symbol: "' + name + '"', nextLink, 'Add aria-label="Next page" or include visually hidden text', 'Screen reader users hear only the symbol character');
      } else if (hasIcon && !nextLink.getAttribute('aria-label')) {
        addManualCheck('2.4.4', 'Verify next link accessible name', 'Icon-based link may need aria-label. Current name: "' + name + '"', getSelector(nextLink));
      } else {
        addPassed('2.4.4', 'Link Purpose', 'Next link has accessible name: "' + name + '"', getSelector(nextLink));
      }

      // Check for rel="next"
      if (nextLink.tagName === 'A' && !nextLink.getAttribute('rel')) {
        addManualCheck('1.3.1', 'Consider adding rel="next" to next link', 'Helps search engines and assistive technology understand pagination relationship', getSelector(nextLink));
      }
    }
  }

  // Test 4: Page Number Links
  function testPageNumberLinks() {
    // Find all links that appear to be page numbers
    const allLinks = paginationEl.querySelectorAll('a[href]');
    const pageNumberLinks = [];

    allLinks.forEach(link => {
      if (!isVisible(link)) return;
      const text = link.textContent.trim();
      // Check if link text is a number or contains only a number
      if (/^\d+$/.test(text)) {
        pageNumberLinks.push(link);
      }
    });

    if (pageNumberLinks.length === 0) return;

    results.stats.elementsScanned += pageNumberLinks.length;

    let linksWithoutContext = 0;

    pageNumberLinks.forEach(link => {
      const ariaLabel = link.getAttribute('aria-label');
      const text = link.textContent.trim();

      // Page number alone is not descriptive enough
      if (!ariaLabel) {
        // Check for sr-only text
        const srOnly = link.querySelector('.sr-only, .visually-hidden, [class*="screen-reader"]');
        if (!srOnly) {
          linksWithoutContext++;
        }
      }
    });

    if (linksWithoutContext > 0) {
      addIssue('moderate', '2.4.4', 'Link Purpose', linksWithoutContext + ' page number links lack context (e.g., "Page 3")', pageNumberLinks[0], 'Add aria-label="Page X" or visually hidden text like "Page" before the number', 'Screen reader users hear only the number without context');
    } else {
      addPassed('2.4.4', 'Link Purpose', 'All ' + pageNumberLinks.length + ' page number links have accessible context', 'pagination links');
    }
  }

  // Test 5: Disabled States
  function testDisabledStates() {
    // Check for disabled prev/next when at first/last page
    const disabledSelectors = [
      '[disabled]',
      '[aria-disabled="true"]',
      '.disabled',
      '[class*="disabled"]'
    ];

    disabledSelectors.forEach(selector => {
      const disabledElements = paginationEl.querySelectorAll(selector);
      disabledElements.forEach(el => {
        if (!isVisible(el)) return;
        results.stats.elementsScanned++;

        const isLink = el.tagName === 'A';
        const hasAriaDisabled = el.getAttribute('aria-disabled') === 'true';
        const hasHref = el.getAttribute('href');

        if (isLink && hasHref && !hasAriaDisabled) {
          addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Disabled pagination link still has href but lacks aria-disabled="true"', el, 'Add aria-disabled="true" or remove href from disabled links', 'Screen reader users may not know the link is disabled');
        } else if (hasAriaDisabled) {
          addPassed('4.1.2', 'Name, Role, Value', 'Disabled pagination element has aria-disabled="true"', getSelector(el));
        }
      });
    });
  }

  // Test 6: List Structure (optional but recommended)
  function testListStructure() {
    const list = paginationEl.querySelector('ul, ol');

    if (list) {
      const listItems = list.querySelectorAll(':scope > li');
      if (listItems.length > 0) {
        addPassed('1.3.1', 'Info and Relationships', 'Pagination uses list structure (' + listItems.length + ' items)', getSelector(list));
      }
    } else {
      addManualCheck('1.3.1', 'Consider using list structure for pagination', 'Wrapping pagination links in <ul>/<ol> with <li> elements improves screen reader experience by announcing total count', getSelector(paginationEl));
    }
  }

  // Run all tests
  testNavLandmark();
  testCurrentPage();
  testPrevNextLinks();
  testPageNumberLinks();
  testDisabledStates();
  testListStructure();

  // Finalize results
  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runPaginationAudit = runPaginationAudit;
}
