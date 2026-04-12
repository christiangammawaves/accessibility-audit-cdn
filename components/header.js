/**
 * Header Accessibility Audit
 * WCAG: 1.1.1, 2.4.1, 2.4.4, 2.4.7, 4.1.2
 */

function runHeaderAudit() {
  'use strict';

  const startTime = performance.now();

  // Configuration
  const CONFIG = {
    scope: ['header', '[role="banner"]', '.header', '.site-header', '#header', '.announcement-bar', '.announcement', '.top-bar'],
    skipLinkSelectors: ['a[href^="#main"]', 'a[href^="#content"]', 'a[href="#MainContent"]', '.skip-link', '.skip-to-content', '.skip-to-main', 'a.visually-hidden[href^="#"]', 'a.sr-only[href^="#"]'],
    iconButtonSelectors: ['[class*="cart-icon"]', '[class*="search-icon"]', '[class*="menu-icon"]', '[class*="account-icon"]', 'button svg', 'a svg'],
    logoSelectors: ['.logo', '.site-logo', '.brand-logo', '[class*="logo"]', 'header a img', 'header a svg']
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('header', CONFIG.scope);
  const { isVisible, getSelector, getAccessibleName, getElementSnippet } = h;

  // Find header elements
  function getHeaderElements() {
    for (const selector of CONFIG.scope) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return document.querySelector('header') || document.querySelector('[role="banner"]');
  }

  const headerEl = getHeaderElements();
  if (!headerEl) {
    results.issues.push({
      severity: 'moderate',
      wcag: '1.3.1',
      criterion: 'Info and Relationships',
      message: 'No header landmark found',
      selector: 'body',
      fix: 'Add a <header> element or role="banner" to identify the page header',
      impact: 'Screen reader users cannot quickly navigate to header'
    });
  }

  const scanScope = headerEl || document.body;

  // Test 1: Skip Link
  function testSkipLink() {
    let skipLink = null;
    for (const selector of CONFIG.skipLinkSelectors) {
      skipLink = document.querySelector(selector);
      if (skipLink) break;
    }

    if (!skipLink) {
      addIssue('serious', '2.4.1', 'Bypass Blocks', 'No skip link found', document.body, 'Add a skip link as the first focusable element: <a href="#main" class="skip-link">Skip to content</a>', 'Keyboard users must tab through all header content to reach main content');
      return;
    }

    results.stats.elementsScanned++;
    const href = skipLink.getAttribute('href');
    if (!href || !href.startsWith('#')) {
      addIssue('serious', '2.4.1', 'Bypass Blocks', 'Skip link has invalid href', skipLink, 'Set href to target main content ID, e.g., href="#main"');
      return;
    }

    const targetId = href.slice(1);
    const target = document.getElementById(targetId);
    if (!target) {
      addIssue('serious', '2.4.1', 'Bypass Blocks', 'Skip link target "' + targetId + '" does not exist', skipLink, 'Add id="' + targetId + '" to the main content container');
      return;
    }

    const name = getAccessibleName(skipLink);
    if (!name) {
      addIssue('moderate', '2.4.4', 'Link Purpose', 'Skip link has no accessible name', skipLink, 'Add text content like "Skip to content" or "Skip to main content"');
      return;
    }

    addPassed('2.4.1', 'Bypass Blocks', 'Skip link present and target exists', getSelector(skipLink));
  }

  // Test 2: Logo Accessibility
  function testLogo() {
    let logo = null;
    for (const selector of CONFIG.logoSelectors) {
      logo = scanScope.querySelector(selector);
      if (logo && isVisible(logo)) break;
    }

    if (!logo) {
      addManualCheck('1.1.1', 'Verify logo has appropriate alt text', 'Locate the site logo and check that it has descriptive alt text or is properly labelled');
      return;
    }

    results.stats.elementsScanned++;
    const logoLink = logo.closest('a') || (logo.tagName === 'A' ? logo : null);

    if (logoLink) {
      const name = getAccessibleName(logoLink);
      if (!name) {
        addIssue('serious', '2.4.4', 'Link Purpose', 'Logo link has no accessible name', logoLink, 'Add aria-label="Home - Site Name" or ensure logo image has descriptive alt text', 'Screen reader users cannot identify where the logo link goes');
      } else if (name.toLowerCase() === 'logo' || name.toLowerCase() === 'home') {
        addIssue('minor', '2.4.4', 'Link Purpose', 'Logo link name could be more descriptive', logoLink, 'Use format "Company Name - Home" instead of just "logo" or "home"');
      } else {
        addPassed('2.4.4', 'Link Purpose', 'Logo link has accessible name: "' + name.slice(0, 50) + '"', getSelector(logoLink));
      }
    }

    const logoImg = logo.tagName === 'IMG' ? logo : logo.querySelector('img');
    if (logoImg) {
      const alt = logoImg.getAttribute('alt');
      if (alt === null) {
        addIssue('serious', '1.1.1', 'Non-text Content', 'Logo image missing alt attribute', logoImg, 'Add alt attribute with company/site name');
      } else if (alt === '') {
        if (!logoLink) {
          addIssue('serious', '1.1.1', 'Non-text Content', 'Logo image has empty alt but is not within a labelled link', logoImg, 'Add descriptive alt text or ensure parent link has aria-label');
        }
      }
    }

    const logoSvg = logo.tagName === 'SVG' ? logo : logo.querySelector('svg');
    if (logoSvg) {
      const svgTitle = logoSvg.querySelector('title');
      const ariaLabel = logoSvg.getAttribute('aria-label');
      const ariaLabelledBy = logoSvg.getAttribute('aria-labelledby');
      const role = logoSvg.getAttribute('role');

      if (!svgTitle && !ariaLabel && !ariaLabelledBy) {
        if (!logoLink || !getAccessibleName(logoLink)) {
          addIssue('serious', '1.1.1', 'Non-text Content', 'Logo SVG has no accessible name', logoSvg, 'Add <title> element inside SVG or aria-label on SVG');
        }
      }

      if (role !== 'img' && !ariaLabel && !ariaLabelledBy) {
        addIssue('minor', '4.1.2', 'Name, Role, Value', 'Logo SVG missing role="img"', logoSvg, 'Add role="img" to SVG for better screen reader support');
      }
    }
  }

  // Test 3: Icon Buttons (Cart, Search, Menu)
  function testIconButtons() {
    const buttons = scanScope.querySelectorAll('button, a[role="button"], [role="button"]');
    const iconButtons = [];

    buttons.forEach(btn => {
      if (!isVisible(btn)) return;
      const hasSvg = btn.querySelector('svg');
      const hasImg = btn.querySelector('img');
      const hasIconClass = btn.className && (btn.className.includes('icon') || btn.className.includes('btn-'));
      const textContent = btn.textContent.trim();
      const isIconOnly = (hasSvg || hasImg || hasIconClass) && textContent.length < 3;

      if (isIconOnly) {
        iconButtons.push(btn);
      }
    });

    iconButtons.forEach(btn => {
      results.stats.elementsScanned++;
      const name = getAccessibleName(btn);

      if (!name) {
        let buttonType = 'icon button';
        const classes = btn.className || '';
        if (classes.includes('cart')) buttonType = 'cart button';
        else if (classes.includes('search')) buttonType = 'search button';
        else if (classes.includes('menu') || classes.includes('hamburger')) buttonType = 'menu button';
        else if (classes.includes('account') || classes.includes('user')) buttonType = 'account button';

        addIssue('critical', '4.1.2', 'Name, Role, Value', 'Icon ' + buttonType + ' has no accessible name', btn, 'Add aria-label describing the button action, e.g., aria-label="Open cart"', 'Screen reader users cannot identify button purpose');
      } else {
        addPassed('4.1.2', 'Name, Role, Value', 'Icon button has accessible name: "' + name.slice(0, 30) + '"', getSelector(btn));
      }
    });

    const links = scanScope.querySelectorAll('a[href]');
    links.forEach(link => {
      if (!isVisible(link)) return;
      const hasSvg = link.querySelector('svg');
      const hasImg = link.querySelector('img');
      const textContent = link.textContent.trim();
      const isIconOnly = (hasSvg || hasImg) && textContent.length < 3;

      if (isIconOnly) {
        results.stats.elementsScanned++;
        const name = getAccessibleName(link);

        if (!name) {
          addIssue('serious', '2.4.4', 'Link Purpose', 'Icon link has no accessible name', link, 'Add aria-label or ensure icon has title/alt text', 'Screen reader users cannot identify link destination');
        }
      }
    });
  }

  // Test 4: Hidden Focusables (WCAG 2.4.3 Focus Order)
  // Note: Focus visibility (2.4.7) cannot be tested programmatically without moving user focus;
  // programmatic focus in a loop causes disruptive side effects during audit. Use manual check instead.
  function testHiddenFocusables() {
    const allFocusable = Array.from(scanScope.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ));

    const hiddenFocusables = [];
    allFocusable.forEach(function(el) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const isHidden = style.display === 'none' ||
                       style.visibility === 'hidden' ||
                       style.opacity === '0' ||
                       (rect.width === 0 && rect.height === 0);
      if (isHidden) {
        hiddenFocusables.push(el);
      }
    });

    results.stats.elementsScanned += allFocusable.length;

    if (hiddenFocusables.length > 0) {
      addIssue('serious', '2.4.3', 'Focus Order',
        hiddenFocusables.length + ' hidden elements remain in keyboard tab order',
        hiddenFocusables[0],
        'Add tabindex="-1" to hidden elements or use display:none instead of visibility:hidden',
        'Keyboard users encounter invisible focusable elements creating confusion');
      hiddenFocusables.slice(0, 5).forEach(function(el) {
        addManualCheck('2.4.3', 'Hidden focusable: ' + getSelector(el),
          'Verify this element is removed from tab order when not visible');
      });
    } else if (allFocusable.length > 0) {
      addPassed('2.4.3', 'Focus Order', 'No hidden elements in keyboard tab order', getSelector(scanScope));
    }

    addManualCheck('2.4.7', 'Verify focus indicators on all header interactive elements',
      'Tab through the header and confirm each element shows a visible focus indicator (outline, box-shadow, or border change)');
  }

  // Test 5: Announcement Bar
  function testAnnouncementBar() {
    const announcementSelectors = ['.announcement-bar', '.announcement', '.top-bar', '[class*="announcement"]', '[class*="promo-bar"]', '.header-message'];
    let announcement = null;

    for (const selector of announcementSelectors) {
      announcement = document.querySelector(selector);
      if (announcement && isVisible(announcement)) break;
    }

    if (!announcement) return;

    results.stats.elementsScanned++;

    const isCarousel = announcement.querySelector('[class*="carousel"]') || announcement.querySelector('[class*="slider"]') || announcement.querySelector('[class*="swiper"]') || announcement.querySelectorAll('[class*="slide"]').length > 1;

    if (isCarousel) {
      const slides = announcement.querySelectorAll('[class*="slide"], [class*="item"]');
      let hiddenFocusableCount = 0;

      slides.forEach(slide => {
        const slideStyle = h.getStyle(slide);
        const isHidden = slide.getAttribute('aria-hidden') === 'true' || slideStyle.display === 'none' || slideStyle.visibility === 'hidden';

        if (isHidden) {
          const focusable = slide.querySelectorAll('a[href], button');
          focusable.forEach(el => {
            const tabindex = el.getAttribute('tabindex');
            if (tabindex !== '-1') {
              hiddenFocusableCount++;
            }
          });
        }
      });

      if (hiddenFocusableCount > 0) {
        addIssue('serious', '2.4.3', 'Focus Order', 'Announcement carousel has ' + hiddenFocusableCount + ' focusable elements in hidden slides', announcement, 'Add tabindex="-1" to links/buttons in hidden slides, or use inert attribute', 'Keyboard users encounter invisible focusable elements');
      }

      const pauseButton = announcement.querySelector('[aria-label*="pause" i], [aria-label*="stop" i], .pause-button, [class*="pause"]');
      if (!pauseButton) {
        addIssue('serious', '2.2.2', 'Pause, Stop, Hide', 'Auto-rotating announcement bar has no pause control', announcement, 'Add a pause button for auto-advancing content', 'Users with cognitive disabilities cannot pause moving content');
      }
    }

    const links = announcement.querySelectorAll('a[href]');
    links.forEach(link => {
      if (!isVisible(link)) return;
      results.stats.elementsScanned++;
      const name = getAccessibleName(link);
      if (!name) {
        addIssue('moderate', '2.4.4', 'Link Purpose', 'Announcement bar link has no accessible name', link, 'Add descriptive text to the link');
      }
    });
  }

  // Test 6: Header Landmark
  function testHeaderLandmark() {
    const header = document.querySelector('header');
    const banner = document.querySelector('[role="banner"]');

    if (!header && !banner) {
      addIssue('moderate', '1.3.1', 'Info and Relationships', 'Page has no header landmark', document.body, 'Wrap header content in <header> element or add role="banner"', 'Screen reader users cannot quickly navigate to header');
    } else if (header && !banner) {
      const headerRole = header.getAttribute('role');
      if (headerRole && headerRole !== 'banner') {
        addIssue('minor', '4.1.2', 'Name, Role, Value', 'Header element has non-standard role', header, 'Remove role attribute or set to "banner"');
      } else {
        addPassed('1.3.1', 'Info and Relationships', 'Header landmark present', 'header');
      }
    } else {
      addPassed('1.3.1', 'Info and Relationships', 'Banner landmark present', getSelector(banner));
    }
  }

  // Run all tests
  testSkipLink();
  testLogo();
  testIconButtons();
  testHiddenFocusables();
  testAnnouncementBar();
  testHeaderLandmark();

  // Finalize results
  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runHeaderAudit = runHeaderAudit;
}
