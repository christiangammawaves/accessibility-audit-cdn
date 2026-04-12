/**
 * Page Structure Accessibility Audit
 * WCAG: 1.1.1, 1.3.1, 1.3.4, 1.4.4, 2.2.1, 2.2.2, 2.4.1, 2.4.2, 2.4.6, 3.1.1, 4.1.2
 */

function runPageStructureAudit() {
  'use strict';

  const startTime = performance.now();

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('page-structure', 'document');
  const { isVisible, getSelector, getElementSnippet } = h;

  // ==========================================================================
  // TEST 1: Document Language (WCAG 3.1.1)
  // ==========================================================================

  function testDocumentLanguage() {
    results.stats.elementsScanned++;
    
    const htmlElement = document.documentElement;
    const lang = htmlElement.getAttribute('lang');
    const xmlLang = htmlElement.getAttribute('xml:lang');
    
    if (!lang && !xmlLang) {
      addIssue(
        'serious',
        '3.1.1',
        'Language of Page',
        'Document has no lang attribute',
        htmlElement,
        'Add lang attribute to <html> element: <html lang="en">',
        'Screen readers may use incorrect pronunciation; translation tools may fail'
      );
      return;
    }
    
    const langValue = lang || xmlLang;
    
    // Check for valid language code format (ISO 639-1)
    const validLangPattern = /^[a-z]{2,3}(-[A-Z]{2})?(-[a-z]{4})?$/i;
    if (!validLangPattern.test(langValue)) {
      addIssue(
        'moderate',
        '3.1.1',
        'Language of Page',
        'Document lang attribute "' + langValue + '" may not be a valid language code',
        htmlElement,
        'Use a valid ISO 639-1 language code (e.g., "en", "en-US", "fr", "es")',
        'Screen readers may not correctly identify the page language'
      );
      return;
    }
    
    // Check for common mistakes
    if (langValue.toLowerCase() === 'javascript' || langValue.toLowerCase() === 'text/javascript') {
      addIssue(
        'serious',
        '3.1.1',
        'Language of Page',
        'Document lang is incorrectly set to "' + langValue + '"',
        htmlElement,
        'Set lang to a human language code like "en" or "en-US"',
        'Screen readers will not correctly identify page language'
      );
      return;
    }
    
    addPassed('3.1.1', 'Language of Page', 'Document has valid lang="' + langValue + '"', 'html');
  }

  // ==========================================================================
  // TEST 2: Page Title (WCAG 2.4.2)
  // ==========================================================================

  function testPageTitle() {
    results.stats.elementsScanned++;
    
    const titleElement = document.querySelector('title');
    const title = document.title;
    
    if (!titleElement || !title) {
      addIssue(
        'serious',
        '2.4.2',
        'Page Titled',
        'Page has no <title> element',
        document.head,
        'Add a descriptive <title> element in <head>',
        'Users cannot identify page purpose from browser tab or bookmarks'
      );
      return;
    }
    
    const trimmedTitle = title.trim();
    
    if (trimmedTitle.length === 0) {
      addIssue(
        'serious',
        '2.4.2',
        'Page Titled',
        'Page title is empty',
        titleElement,
        'Add descriptive text to the <title> element',
        'Users cannot identify page purpose from browser tab or bookmarks'
      );
      return;
    }
    
    // Check for generic/placeholder titles (includes patterns migrated from comprehensive-audit.js auditPageTitle)
    const genericTitles = ['untitled', 'home', 'page', 'document', 'new page', 'welcome', 'new tab', 'loading'];
    if (genericTitles.includes(trimmedTitle.toLowerCase())) {
      addIssue(
        'moderate',
        '2.4.2',
        'Page Titled',
        'Page title "' + trimmedTitle + '" is too generic',
        titleElement,
        'Use a descriptive title that identifies the page content and site name',
        'Users cannot distinguish this page from others'
      );
      return;
    }
    
    // Check if title is just the domain
    if (trimmedTitle === window.location.hostname) {
      addIssue(
        'moderate',
        '2.4.2',
        'Page Titled',
        'Page title is just the domain name',
        titleElement,
        'Include page-specific content in the title (e.g., "Products | Brand Name")',
        'Users cannot identify specific page content'
      );
      return;
    }

    // Short title check (migrated from comprehensive-audit.js auditPageTitle)
    if (trimmedTitle.length < 5) {
      addIssue(
        'minor',
        '2.4.2',
        'Page Titled',
        'Page title is very short (' + trimmedTitle.length + ' characters): "' + trimmedTitle + '"',
        titleElement,
        'Use a more descriptive title that identifies both the page and the site',
        'Short titles may not adequately describe the page'
      );
      return;
    }

    // Long title check (migrated from comprehensive-audit.js auditPageTitle)
    if (trimmedTitle.length > 70) {
      addIssue(
        'minor',
        '2.4.2',
        'Page Titled',
        'Page title is very long (' + trimmedTitle.length + ' characters)',
        titleElement,
        'Keep title under 70 characters for readability in tabs and bookmarks',
        'Long titles get truncated in browser tabs and search results'
      );
    }

    // Title vs H1 word-overlap relevance check (migrated from comprehensive-audit.js auditPageTitle)
    var h1Element = document.querySelector('h1');
    if (h1Element) {
      var h1Text = h1Element.textContent.trim();
      if (h1Text) {
        var titleWords = trimmedTitle.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; });
        var h1Words = h1Text.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; });
        if (titleWords.length > 0 && h1Words.length > 0) {
          var overlap = titleWords.filter(function(w) { return h1Words.indexOf(w) !== -1; });
          if (overlap.length === 0) {
            addManualCheck(
              '2.4.2',
              'Title and H1 have no word overlap',
              'Page title "' + trimmedTitle.substring(0, 40) + '" and H1 "' + h1Text.substring(0, 40) + '" share no significant words. Verify title accurately describes page content.',
              'title'
            );
          }
        }
      }
    }

    addPassed('2.4.2', 'Page Titled', 'Page has descriptive title: "' + trimmedTitle.substring(0, 50) + (trimmedTitle.length > 50 ? '...' : '') + '"', 'title');
  }

  // ==========================================================================
  // TEST 3: Single H1 (Best Practice)
  // ==========================================================================

  function testSingleH1() {
    const h1Elements = document.querySelectorAll('h1');
    results.stats.elementsScanned += h1Elements.length;
    
    if (h1Elements.length === 0) {
      addIssue(
        'serious',
        '1.3.1',
        'Info and Relationships',
        'Page has no <h1> element',
        document.body,
        'Add a single <h1> that describes the main content of the page',
        'Screen reader users cannot identify the main topic of the page'
      );
      return;
    }
    
    if (h1Elements.length > 1) {
      addIssue(
        'moderate',
        '1.3.1',
        'Info and Relationships',
        'Page has ' + h1Elements.length + ' <h1> elements (should have exactly 1)',
        h1Elements[1],
        'Use only one <h1> per page; demote others to <h2> or lower',
        'Multiple H1s can confuse screen reader users about the page structure'
      );
      
      // List all H1s for reference
      h1Elements.forEach((h1, index) => {
        if (index > 0) {
          addManualCheck(
            '1.3.1',
            'Review H1 #' + (index + 1) + ': "' + h1.textContent.trim().substring(0, 50) + '"',
            'Determine if this should be demoted to H2 or lower',
            getSelector(h1)
          );
        }
      });
      return;
    }
    
    // Check if H1 has content
    const h1 = h1Elements[0];
    const h1Text = h1.textContent.trim();

    // Check if H1 is SVG-only (common logo pattern)
    const hasSvg = h1.querySelector('svg');
    const hasImg = h1.querySelector('img[alt]:not([alt=""])');
    const h1AriaLabel = h1.getAttribute('aria-label');
    const svgAriaLabel = hasSvg ? hasSvg.getAttribute('aria-label') : null;
    const hasAriaLabel = h1AriaLabel || svgAriaLabel;

    if (hasSvg && !hasImg && !hasAriaLabel) {
      const svgInternalText = hasSvg.textContent.trim();
      const meaningfulText = h1Text.replace(svgInternalText, '').trim();
      if (!meaningfulText || /[{};:]/.test(h1Text)) {
        addIssue(
          'serious',
          '1.3.1',
          'Info and Relationships',
          'H1 contains SVG logo but no accessible text — screen readers cannot identify the page heading',
          h1,
          'Add aria-label to the H1 or the SVG, or include a visually-hidden text span inside the H1',
          'Screen readers rely on H1 to understand page purpose'
        );
        return;
      }
    }

    if (!h1Text) {
      addIssue(
        'serious',
        '1.3.1',
        'Info and Relationships',
        '<h1> element is empty',
        h1,
        'Add descriptive text to the <h1> element',
        'Screen reader users cannot identify the main topic'
      );
      return;
    }
    
    addPassed('1.3.1', 'Info and Relationships', 'Page has exactly one H1: "' + h1Text.substring(0, 50) + '"', 'h1');
  }

  // ==========================================================================
  // TEST 4: Heading Hierarchy (WCAG 2.4.6, 1.3.1)
  // ==========================================================================

  function testHeadingHierarchy() {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
    results.stats.elementsScanned += headings.length;
    
    if (headings.length === 0) {
      addIssue(
        'serious',
        '2.4.6',
        'Headings and Labels',
        'Page has no heading elements',
        document.body,
        'Add semantic headings (H1-H6) to structure the page content',
        'Screen reader users cannot navigate by headings'
      );
      return;
    }
    
    let previousLevel = 0;
    let skippedLevels = [];
    let emptyHeadings = [];
    
    headings.forEach((heading, index) => {
      // Support native headings h1-h6 and [role="heading"] with aria-level
      let level;
      if (/^H[1-6]$/.test(heading.tagName)) {
        level = parseInt(heading.tagName.charAt(1));
      } else {
        // [role="heading"] element — parse aria-level
        var ariaLevel = heading.getAttribute('aria-level');
        if (!ariaLevel) {
          addIssue(
            'serious',
            '1.3.1',
            'Info and Relationships',
            'Element with role="heading" missing aria-level attribute',
            heading,
            'Add aria-level="1" through "6" to indicate the heading level',
            'Screen readers cannot determine heading level'
          );
          return;
        }
        level = parseInt(ariaLevel);
        if (isNaN(level) || level < 1 || level > 6) {
          addIssue(
            'serious',
            '1.3.1',
            'Info and Relationships',
            'Element with role="heading" has invalid aria-level: "' + ariaLevel + '"',
            heading,
            'Use aria-level with a value from 1 to 6',
            'Screen readers cannot determine heading level'
          );
          return;
        }
      }
      const text = heading.textContent.trim();
      
      // Check for empty headings
      if (!text) {
        emptyHeadings.push({ element: heading, level: level, index: index });
      }
      
      // Check for skipped levels (allow first heading to be any level)
      if (previousLevel > 0 && level > previousLevel + 1) {
        skippedLevels.push({
          element: heading,
          from: previousLevel,
          to: level,
          index: index
        });
      }
      
      previousLevel = level;
    });
    
    // Report empty headings
    emptyHeadings.forEach(item => {
      addIssue(
        'moderate',
        '2.4.6',
        'Headings and Labels',
        'Empty <h' + item.level + '> element found',
        item.element,
        'Add descriptive text or remove the empty heading',
        'Screen reader users encounter meaningless headings'
      );
    });
    
    // Report skipped levels
    skippedLevels.forEach(skip => {
      addIssue(
        'moderate',
        '1.3.1',
        'Info and Relationships',
        'Heading level skipped from H' + skip.from + ' to H' + skip.to,
        skip.element,
        'Use sequential heading levels (H' + skip.from + ' should be followed by H' + (skip.from + 1) + ', not H' + skip.to + ')',
        'Skipped heading levels can confuse screen reader users about document structure'
      );
    });
    
    if (skippedLevels.length === 0 && emptyHeadings.length === 0) {
      addPassed('2.4.6', 'Headings and Labels', headings.length + ' headings with proper hierarchy', 'h1-h6');
    }
    
    // Add summary of heading structure
    const headingCounts = {};
    headings.forEach(h => {
      const level = h.tagName;
      headingCounts[level] = (headingCounts[level] || 0) + 1;
    });
    
    const summary = Object.entries(headingCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag, count]) => tag + ':' + count)
      .join(', ');
    
    results.headingStructure = {
      total: headings.length,
      counts: headingCounts,
      summary: summary,
      skippedLevels: skippedLevels.length,
      emptyHeadings: emptyHeadings.length
    };
  }

  // ==========================================================================
  // TEST 5: Landmark Structure (WCAG 1.3.1)
  // ==========================================================================

  function testLandmarks() {
    const landmarks = {
      main: document.querySelectorAll('main, [role="main"]'),
      banner: document.querySelectorAll('header:not(article header):not(section header), [role="banner"]'),
      contentinfo: document.querySelectorAll('footer:not(article footer):not(section footer), [role="contentinfo"]'),
      navigation: document.querySelectorAll('nav, [role="navigation"]'),
      complementary: document.querySelectorAll('aside, [role="complementary"]'),
      search: document.querySelectorAll('[role="search"], form[role="search"]')
    };
    
    let totalLandmarks = 0;
    Object.values(landmarks).forEach(list => totalLandmarks += list.length);
    results.stats.elementsScanned += totalLandmarks;
    
    // Check for main landmark (required)
    if (landmarks.main.length === 0) {
      addIssue(
        'serious',
        '1.3.1',
        'Info and Relationships',
        'Page has no main landmark',
        document.body,
        'Add <main> element or role="main" to wrap the primary content',
        'Screen reader users cannot quickly navigate to main content'
      );
    } else if (landmarks.main.length > 1) {
      addIssue(
        'moderate',
        '1.3.1',
        'Info and Relationships',
        'Page has ' + landmarks.main.length + ' main landmarks (should have exactly 1)',
        landmarks.main[1],
        'Use only one <main> element per page',
        'Multiple main landmarks confuse screen reader navigation'
      );
    } else {
      addPassed('1.3.1', 'Info and Relationships', 'Main landmark present', getSelector(landmarks.main[0]));
    }
    
    // Check for banner/header (recommended)
    if (landmarks.banner.length === 0) {
      addManualCheck(
        '1.3.1',
        'No banner landmark found',
        'Verify if page should have a <header> element with role="banner"',
        'body'
      );
    } else if (landmarks.banner.length > 1) {
      // Only flag if multiple are direct children of body (nested headers in articles are OK)
      const topLevelBanners = Array.from(landmarks.banner).filter(
        el => el.closest('article') === null && el.closest('section') === null
      );
      if (topLevelBanners.length > 1) {
        addIssue(
          'minor',
          '1.3.1',
          'Info and Relationships',
          'Page has multiple top-level banner landmarks',
          topLevelBanners[1],
          'Use only one <header> at the page level',
          'May confuse screen reader navigation'
        );
      }
    } else {
      addPassed('1.3.1', 'Info and Relationships', 'Banner landmark present', getSelector(landmarks.banner[0]));
    }
    
    // Check for contentinfo/footer (recommended)
    if (landmarks.contentinfo.length === 0) {
      addManualCheck(
        '1.3.1',
        'No contentinfo landmark found',
        'Verify if page should have a <footer> element',
        'body'
      );
    } else {
      addPassed('1.3.1', 'Info and Relationships', 'Contentinfo landmark present', getSelector(landmarks.contentinfo[0]));
    }
    
    // Check for navigation landmarks
    if (landmarks.navigation.length === 0) {
      addManualCheck(
        '1.3.1',
        'No navigation landmarks found',
        'Verify if navigation menus should be wrapped in <nav> elements',
        'body'
      );
    } else {
      // Check if multiple navs have distinct labels
      if (landmarks.navigation.length > 1) {
        const unlabeledNavs = Array.from(landmarks.navigation).filter(nav => {
          const label = nav.getAttribute('aria-label') || nav.getAttribute('aria-labelledby');
          return !label;
        });
        
        if (unlabeledNavs.length > 1) {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            landmarks.navigation.length + ' navigation landmarks found, but ' + unlabeledNavs.length + ' lack unique labels',
            unlabeledNavs[0],
            'Add aria-label to distinguish navigation regions (e.g., "Main navigation", "Footer navigation")',
            'Screen reader users cannot distinguish between navigation regions'
          );
        } else {
          addPassed('1.3.1', 'Info and Relationships', landmarks.navigation.length + ' navigation landmarks with distinct labels', 'nav');
        }
      } else {
        addPassed('1.3.1', 'Info and Relationships', 'Navigation landmark present', getSelector(landmarks.navigation[0]));
      }
    }
    
    // Check for section/[role="region"] without accessible name (migrated from comprehensive-audit.js auditLandmarks)
    var regions = document.querySelectorAll('section, [role="region"]');
    regions.forEach(function(region) {
      var regionLabel = region.getAttribute('aria-label') || region.getAttribute('aria-labelledby');
      var regionHeading = region.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
      if (!regionLabel && !regionHeading) {
        results.stats.elementsScanned++;
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Section/region element has no accessible name or heading',
          region,
          'Add aria-label, aria-labelledby, or include a heading element within the section',
          'Screen reader users cannot identify the purpose of this section'
        );
      }
    });

    // Store landmark summary
    results.landmarkStructure = {
      main: landmarks.main.length,
      banner: landmarks.banner.length,
      contentinfo: landmarks.contentinfo.length,
      navigation: landmarks.navigation.length,
      complementary: landmarks.complementary.length,
      search: landmarks.search.length,
      total: totalLandmarks
    };
  }

  // ==========================================================================
  // TEST 6: Skip Link (WCAG 2.4.1)
  // ==========================================================================

  function testSkipLink() {
    const skipLinkSelectors = [
      'a[href^="#main"]',
      'a[href^="#content"]',
      'a[href="#MainContent"]',
      '.skip-link',
      '.skip-to-content',
      '.skip-to-main',
      'a.visually-hidden[href^="#"]',
      'a.sr-only[href^="#"]',
      'a[class*="skip"]'
    ];
    
    let skipLink = null;
    for (const selector of skipLinkSelectors) {
      skipLink = document.querySelector(selector);
      if (skipLink) break;
    }
    
    if (!skipLink) {
      addIssue(
        'serious',
        '2.4.1',
        'Bypass Blocks',
        'No skip link found',
        document.body,
        'Add a skip link as the first focusable element: <a href="#main" class="skip-link">Skip to content</a>',
        'Keyboard users must tab through all header content to reach main content'
      );
      return;
    }
    
    results.stats.elementsScanned++;
    
    const href = skipLink.getAttribute('href');
    if (!href || !href.startsWith('#')) {
      addIssue(
        'serious',
        '2.4.1',
        'Bypass Blocks',
        'Skip link has invalid href: "' + href + '"',
        skipLink,
        'Set href to target main content ID, e.g., href="#main"',
        'Skip link does not function correctly'
      );
      return;
    }
    
    const targetId = href.slice(1);
    const target = document.getElementById(targetId);
    
    if (!target) {
      addIssue(
        'serious',
        '2.4.1',
        'Bypass Blocks',
        'Skip link target "#' + targetId + '" does not exist',
        skipLink,
        'Add id="' + targetId + '" to the main content container',
        'Skip link does not function - target element missing'
      );
      return;
    }
    
    // Check if skip link has accessible name
    const linkText = skipLink.textContent.trim();
    const ariaLabel = skipLink.getAttribute('aria-label');
    
    if (!linkText && !ariaLabel) {
      addIssue(
        'moderate',
        '2.4.4',
        'Link Purpose',
        'Skip link has no accessible name',
        skipLink,
        'Add text content like "Skip to content" or aria-label',
        'Screen reader users cannot identify the link purpose'
      );
      return;
    }
    
    // Check if skip link is among first focusable elements
    const allFocusable = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const skipLinkIndex = Array.from(allFocusable).indexOf(skipLink);
    
    if (skipLinkIndex > 3) {
      addIssue(
        'moderate',
        '2.4.1',
        'Bypass Blocks',
        'Skip link is not among the first focusable elements (position: ' + (skipLinkIndex + 1) + ')',
        skipLink,
        'Move skip link to be the first or second focusable element in the DOM',
        'Keyboard users encounter other elements before the skip link'
      );
    } else {
      addPassed('2.4.1', 'Bypass Blocks', 'Skip link present, functional, and well-positioned', getSelector(skipLink));
    }
  }

  // ==========================================================================
  // TEST 7: Viewport Meta (WCAG 1.4.4)
  // ==========================================================================

  function testViewportMeta() {
    const viewport = document.querySelector('meta[name="viewport"]');
    results.stats.elementsScanned++;
    
    if (!viewport) {
      addManualCheck(
        '1.4.4',
        'No viewport meta tag found',
        'Verify if viewport meta is needed for responsive design',
        'head'
      );
      return;
    }
    
    const content = viewport.getAttribute('content') || '';
    
    // Check for user-scalable=no
    if (/user-scalable\s*=\s*(no|0)/i.test(content)) {
      addIssue(
        'serious',
        '1.4.4',
        'Resize Text',
        'Viewport meta disables user scaling (user-scalable=no)',
        viewport,
        'Remove user-scalable=no to allow users to zoom',
        'Users who need to enlarge text cannot zoom the page'
      );
    }
    
    // Check for maximum-scale=1.0 (or less)
    const maxScaleMatch = content.match(/maximum-scale\s*=\s*([\d.]+)/i);
    if (maxScaleMatch && parseFloat(maxScaleMatch[1]) < 2) {
      addIssue(
        'serious',
        '1.4.4',
        'Resize Text',
        'Viewport meta restricts zoom to ' + maxScaleMatch[1] + 'x (maximum-scale=' + maxScaleMatch[1] + ')',
        viewport,
        'Remove maximum-scale or set to 5.0 or higher',
        'Users who need to enlarge text cannot zoom adequately'
      );
    }
    
    // Check for minimum-scale that's too high
    const minScaleMatch = content.match(/minimum-scale\s*=\s*([\d.]+)/i);
    if (minScaleMatch && parseFloat(minScaleMatch[1]) > 1) {
      addIssue(
        'moderate',
        '1.4.4',
        'Resize Text',
        'Viewport meta sets minimum-scale above 1.0',
        viewport,
        'Set minimum-scale to 1.0 or remove it',
        'Users cannot zoom out to see more content at once'
      );
    }
    
    // If no issues found
    if (!results.issues.some(i => i.wcag === '1.4.4')) {
      addPassed('1.4.4', 'Resize Text', 'Viewport meta allows user scaling and zoom', 'meta[name="viewport"]');
    }
  }

  // ==========================================================================
  // TEST 8: Back-to-Top Button (if present)
  // ==========================================================================

  function testBackToTop() {
    const backToTopSelectors = [
      '[class*="back-to-top"]',
      '[class*="scroll-top"]',
      '[class*="scroll-to-top"]',
      '[class*="to-top"]',
      '[id*="back-to-top"]',
      '[id*="scroll-top"]',
      'a[href="#top"]',
      'a[href="#"]',
      '[aria-label*="back to top" i]',
      '[aria-label*="scroll to top" i]'
    ];
    
    let backToTop = null;
    for (const selector of backToTopSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Filter out false positives (generic href="#" links in nav)
        if (el.matches('a[href="#"]')) {
          const text = el.textContent.toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          if (!text.includes('top') && !ariaLabel.includes('top')) continue;
        }
        backToTop = el;
        break;
      }
      if (backToTop) break;
    }
    
    if (!backToTop) {
      // Not an error - back-to-top is optional
      return;
    }
    
    results.stats.elementsScanned++;
    
    // Check for accessible name
    const text = backToTop.textContent.trim();
    const ariaLabel = backToTop.getAttribute('aria-label');
    const title = backToTop.getAttribute('title');
    
    if (!text && !ariaLabel && !title) {
      // Check for SVG with title
      const svgTitle = backToTop.querySelector('svg title');
      if (!svgTitle) {
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Back-to-top button has no accessible name',
          backToTop,
          'Add aria-label="Back to top" or visible text',
          'Screen reader users cannot identify the button purpose'
        );
        return;
      }
    }
    
    // Check if it's keyboard accessible
    const tagName = backToTop.tagName.toLowerCase();
    const role = backToTop.getAttribute('role');
    const tabindex = backToTop.getAttribute('tabindex');
    
    const isInteractive = 
      tagName === 'a' && backToTop.hasAttribute('href') ||
      tagName === 'button' ||
      role === 'button' ||
      (tabindex !== null && tabindex !== '-1');
    
    if (!isInteractive) {
      addIssue(
        'serious',
        '2.1.1',
        'Keyboard',
        'Back-to-top element is not keyboard accessible',
        backToTop,
        'Use a <button> or <a href="#top"> element, or add role="button" and tabindex="0"',
        'Keyboard users cannot activate the back-to-top control'
      );
    } else {
      addPassed('2.1.1', 'Keyboard', 'Back-to-top button is keyboard accessible', getSelector(backToTop));
    }
  }

  function testOrientation() {
    // WCAG 1.3.4: Orientation - Content should not be locked to a single orientation
    const metaViewport = document.querySelector('meta[name="viewport"]');
    
    if (metaViewport) {
      const content = metaViewport.getAttribute('content') || '';
      
      // Check for orientation lock in viewport meta
      if (/orientation\s*=\s*(portrait|landscape)/i.test(content)) {
        addIssue(
          'serious',
          '1.3.4',
          'Orientation',
          'Viewport meta tag locks content to specific orientation',
          metaViewport,
          'Remove orientation restriction from viewport meta tag',
          'Content should adapt to both portrait and landscape orientations'
        );
        return;
      }
    }
    
    // CSS stylesheet scan for orientation media queries (migrated from comprehensive-audit.js auditOrientation)
    var hasOrientationLockCSS = false;
    try {
      for (var s = 0; s < document.styleSheets.length; s++) {
        try {
          var rules = document.styleSheets[s].cssRules || [];
          for (var r = 0; r < rules.length; r++) {
            if (rules[r].media && rules[r].media.mediaText) {
              var mediaText = rules[r].media.mediaText;
              if (/orientation\s*:\s*(portrait|landscape)/i.test(mediaText)) {
                // Check if the media query hides content (display:none, visibility:hidden)
                var innerRules = rules[r].cssRules || [];
                for (var ir = 0; ir < innerRules.length; ir++) {
                  var cssText = innerRules[ir].cssText || '';
                  if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(cssText)) {
                    hasOrientationLockCSS = true;
                    break;
                  }
                }
              }
            }
            if (hasOrientationLockCSS) break;
          }
        } catch (e) {
          // Cross-origin stylesheet, skip
        }
        if (hasOrientationLockCSS) break;
      }
    } catch (e) {}

    if (hasOrientationLockCSS) {
      addIssue(
        'serious',
        '1.3.4',
        'Orientation',
        'CSS media query hides content based on orientation',
        document.body,
        'Ensure content is available in both orientations; do not use display:none in orientation media queries',
        'Content may be inaccessible when device is in a specific orientation'
      );
    }

    // Inline script scan for screen.orientation.lock (migrated from comprehensive-audit.js auditOrientation)
    var scripts = document.querySelectorAll('script:not([src])');
    scripts.forEach(function(script) {
      var content = script.textContent || '';
      if (/screen\.orientation\.lock/i.test(content)) {
        addIssue(
          'serious',
          '1.3.4',
          'Orientation',
          'JavaScript locks screen orientation via screen.orientation.lock()',
          script,
          'Remove orientation locking unless essential for the content (e.g., a piano app)',
          'Users who need a specific orientation cannot access content'
        );
      }
    });

    if (!hasOrientationLockCSS) {
      addManualCheck('1.3.4', 'Verify content works in both orientations',
        'Test that content and functionality are available in both portrait and landscape orientations (unless specific orientation is essential)',
        'body');

      addPassed('1.3.4', 'Orientation', 'No viewport orientation lock detected', 'meta[name="viewport"]');
    }
  }

  function testParsing() {
    // WCAG 4.1.2: Duplicate IDs cause AT issues (4.1.1 deprecated in WCAG 2.2)
    const issues = [];

    // Check for duplicate IDs
    const allIds = {};
    const elementsWithId = document.querySelectorAll('[id]');

    elementsWithId.forEach(element => {
      const id = element.getAttribute('id');
      if (id) {
        if (allIds[id]) {
          allIds[id].push(element);
        } else {
          allIds[id] = [element];
        }
      }
    });

    // Empty id attribute check (migrated from comprehensive-audit.js auditDuplicateIds)
    elementsWithId.forEach(function(element) {
      var id = element.getAttribute('id');
      if (id !== null && id.trim() === '') {
        results.stats.elementsScanned++;
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Element has empty id attribute',
          element,
          'Remove the empty id or provide a meaningful unique ID',
          'Empty IDs can cause issues with label association and ARIA references'
        );
      }
    });

    // ARIA reference IDs for severity escalation
    var ariaReferencingAttrs = ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-errormessage'];
    var referencedIds = new Set();
    ariaReferencingAttrs.forEach(function(attr) {
      document.querySelectorAll('[' + attr + ']').forEach(function(el) {
        var val = el.getAttribute(attr);
        if (val) {
          val.split(/\s+/).forEach(function(id) { if (id) referencedIds.add(id); });
        }
      });
    });

    // Anchor target references
    document.querySelectorAll('a[href^="#"]').forEach(function(el) {
      var href = el.getAttribute('href');
      if (href && href.length > 1) {
        referencedIds.add(href.substring(1));
      }
    });

    // Report duplicate IDs with severity escalation
    Object.keys(allIds).forEach(id => {
      if (allIds[id].length > 1) {
        // Escalate severity if ID is referenced by ARIA/form attributes
        var severity = 'serious';
        if (referencedIds.has(id)) {
          severity = 'critical';
        }

        // Grouped finding per duplicate ID value (not per occurrence)
        results.stats.elementsScanned += allIds[id].length;
        addIssue(
          severity,
          '4.1.2',
          'Name, Role, Value',
          'Duplicate ID "' + id + '" found ' + allIds[id].length + ' times on the page'
            + (severity === 'critical' ? ' — referenced by ARIA or form attributes' : ''),
          allIds[id][0],
          'Ensure all IDs are unique on the page',
          'Duplicate IDs can cause issues with assistive technologies and JavaScript'
        );
        issues.push(id);
      }
    });

    // Problematic form property IDs (migrated from comprehensive-audit.js auditDuplicateIds)
    var problematicIds = ['submit', 'reset', 'id', 'action', 'method', 'elements', 'length'];
    problematicIds.forEach(function(badId) {
      var el = document.getElementById(badId);
      if (el && el.closest('form')) {
        results.stats.elementsScanned++;
        addIssue(
          'moderate',
          '4.1.2',
          'Name, Role, Value',
          'Form element has id="' + badId + '" which shadows HTMLFormElement property',
          el,
          'Rename the element to avoid conflicting with built-in form properties',
          'JavaScript form.submit(), form.reset(), etc. will fail when shadowed by element IDs'
        );
      }
    });
    
    // Check for unclosed tags and other parsing issues
    const html = document.documentElement.outerHTML;
    
    // Check for common parsing issues
    const parsingIssues = [];
    
    // Missing closing tags (basic check for common elements)
    const commonTags = ['div', 'span', 'p', 'a', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'];
    commonTags.forEach(tag => {
      const openCount = (html.match(new RegExp('<' + tag + '\\b', 'gi')) || []).length;
      const closeCount = (html.match(new RegExp('</' + tag + '>', 'gi')) || []).length;
      
      // Allow for self-closing tags and void elements
      if (openCount !== closeCount && tag !== 'br' && tag !== 'img' && tag !== 'input') {
        parsingIssues.push(tag + ' (open: ' + openCount + ', close: ' + closeCount + ')');
      }
    });
    
    if (parsingIssues.length > 0) {
      addManualCheck('4.1.2', 'Verify HTML parsing - potential unclosed tags detected',
        'Tags with mismatched counts: ' + parsingIssues.join(', ') + '. Validate HTML to ensure proper nesting.',
        'html');
    }
    
    if (issues.length === 0 && parsingIssues.length === 0) {
      addPassed('4.1.2', 'Name, Role, Value', 'No duplicate IDs or obvious parsing errors detected', 'html');
    }
  }

  // ==========================================================================
  // TEST 9: Images (WCAG 1.1.1)
  // ==========================================================================

  function testImages() {
    const images = document.querySelectorAll('img');
    
    if (images.length === 0) {
      return;
    }
    
    // Generic alt text patterns to flag
    const genericPatterns = [
      /^image$/i,
      /^photo$/i,
      /^picture$/i,
      /^img$/i,
      /^graphic$/i,
      /^placeholder$/i,
      /^untitled$/i,
      /^_\d+$/,  // "_123"
      /^\d+$/,   // Just numbers
      /^dsc/i,   // Camera default
      /^img_\d+/i
    ];

    // Extended alt quality patterns (migrated from comprehensive-audit.js auditImages)
    const altQualityPatterns = {
      stockPhotoId: /^(istockphoto|shutterstock|getty|adobestock|dreamstime|fotolia|bigstock|123rf)[-_]?\d+/i,
      cmsPattern: /^(img|image|photo|pic|figure|media)[-_]?\d+$/i,
      hashPattern: /^[a-f0-9]{8,}$/i,
      urlFragment: /^https?:\/\//i,
      underscoreSpaced: /^[a-z]+(_[a-z]+){2,}$/,
      clickInstruction: /^click (here|this|to)/i,
      linkOnly: /^(link|anchor|url)$/i,
      redundantPrefix: /^(image of|picture of|photo of|graphic of|icon of)\s/i,
      redundantSuffix: /\s(image|picture|photo|graphic|icon)$/i,
      allCaps: /^[A-Z\s]{10,}$/,
      excessivePunctuation: /[!?]{3,}|\.{4,}/,
      numberedPlaceholder: /^(image|img|photo|pic)\s?\d+$/i
    };
    
    // Scope guard: skip images inside detected component containers.
    // Component-specific modules (hero, product-grid, pdp, carousels) audit
    // their own images with richer context. page-structure handles the rest.
    const componentContainerSelector = [
      '[class*="hero"]', '[class*="slideshow"]', '.splide', '.slick-slider',
      '.swiper', '.flickity', '[class*="product-grid"]', '[class*="product-card"]',
      '[class*="product-detail"]', '[class*="pdp"]', '[class*="carousel"]',
      '[class*="slider"]:not([class*="slideshow"])'
    ].join(',');

    images.forEach(img => {
      results.stats.elementsScanned++;

      // Skip images inside component containers — let component modules handle them
      if (img.closest(componentContainerSelector)) {
        return;
      }

      const alt = img.getAttribute('alt');
      const role = img.getAttribute('role');
      const ariaHidden = img.getAttribute('aria-hidden');
      const ariaLabel = img.getAttribute('aria-label');
      const src = img.getAttribute('src') || '';
      const isVisible = img.offsetWidth > 0 && img.offsetHeight > 0;
      
      // Skip if explicitly hidden
      if (ariaHidden === 'true' || role === 'presentation' || role === 'none') {
        return;
      }
      
      // Skip invisible images
      if (!isVisible) {
        return;
      }
      
      // Check 1: Missing alt attribute entirely
      if (alt === null && !ariaLabel) {
        addIssue(
          'critical',
          '1.1.1',
          'Non-text Content',
          'Image missing alt attribute',
          img,
          'Add alt="" for decorative images or descriptive alt text for meaningful images',
          'Screen readers cannot identify this image'
        );
        return;
      }
      
      // Check 2: Empty alt is OK for decorative images
      if (alt === '' || alt === null) {
        // This is correct for decorative images
        addPassed('1.1.1', 'Non-text Content', 'Decorative image has empty alt', getSelector(img));
        return;
      }
      
      // Check 3: Generic/placeholder alt text
      const altLower = alt.trim().toLowerCase();
      const isGeneric = genericPatterns.some(pattern => pattern.test(altLower));
      
      if (isGeneric) {
        addIssue(
          'serious',
          '1.1.1',
          'Non-text Content',
          'Image has generic/placeholder alt text: "' + alt + '"',
          img,
          'Provide descriptive alt text that conveys the purpose and content of the image',
          'Alt text should describe the image meaningfully, not just state that it is an image'
        );
        return;
      }
      
      // Check 4: Alt text matches filename
      const filename = src.split('/').pop().split('?')[0].replace(/\.(jpg|jpeg|png|gif|svg|webp)$/i, '');
      if (filename && altLower === filename.toLowerCase().replace(/[-_]/g, ' ')) {
        addIssue(
          'moderate',
          '1.1.1',
          'Non-text Content',
          'Image alt text appears to be the filename: "' + alt + '"',
          img,
          'Provide human-readable alt text that describes the image content',
          'Alt text should be descriptive, not technical filenames'
        );
        return;
      }
      
      // Check 5: Alt quality patterns (migrated from comprehensive-audit.js)
      var altTrimmed = alt.trim();
      for (var patternName in altQualityPatterns) {
        if (altQualityPatterns[patternName].test(altTrimmed)) {
          addIssue(
            'moderate',
            '1.1.1',
            'Non-text Content',
            'Image alt text matches poor quality pattern (' + patternName + '): "' + altTrimmed.substring(0, 50) + '"',
            img,
            'Provide meaningful alt text that describes the image content',
            'Alt text appears to be auto-generated or non-descriptive'
          );
          return;
        }
      }

      // Check 6: Suspiciously short alt text (single char or very short)
      if (altTrimmed.length > 0 && altTrimmed.length < 3) {
        addIssue(
          'minor',
          '1.1.1',
          'Non-text Content',
          'Image alt text is suspiciously short (' + altTrimmed.length + ' characters): "' + altTrimmed + '"',
          img,
          'Provide more descriptive alt text or use alt="" if decorative',
          'Very short alt text is unlikely to convey meaningful information'
        );
        return;
      }

      // Check 7: Single word alt text (may not be descriptive enough)
      if (altTrimmed.length > 2 && altTrimmed.indexOf(' ') === -1 && altTrimmed.length < 20) {
        addManualCheck(
          '1.1.1',
          'Verify single-word alt text is sufficient: "' + altTrimmed + '"',
          'Single-word alt text may not adequately describe the image content',
          getSelector(img)
        );
      }

      // Check 8: Alt text too long (>150 chars)
      if (alt.length > 150) {
        addIssue(
          'minor',
          '1.1.1',
          'Non-text Content',
          'Image alt text is very long (' + alt.length + ' characters)',
          img,
          'Consider using a shorter alt text and providing extended description via aria-describedby or surrounding text',
          'Long alt text can be difficult for screen reader users'
        );
        return;
      }

      // If we made it here, alt text seems reasonable
      addPassed('1.1.1', 'Non-text Content', 'Image has appropriate alt text', getSelector(img));
    });

    // SVG accessible name audit (migrated from comprehensive-audit.js auditImages)
    var svgElements = document.querySelectorAll('svg:not([aria-hidden="true"])');
    svgElements.forEach(function(svg) {
      // Skip tiny decorative SVGs
      if (svg.getAttribute('role') === 'presentation' || svg.getAttribute('role') === 'none') return;
      var svgWidth = svg.getBoundingClientRect().width;
      var svgHeight = svg.getBoundingClientRect().height;
      if (svgWidth === 0 && svgHeight === 0) return;

      results.stats.elementsScanned++;

      var hasTitle = svg.querySelector('title');
      var hasAriaLabel = svg.getAttribute('aria-label');
      var hasAriaLabelledby = svg.getAttribute('aria-labelledby');
      var hasRole = svg.getAttribute('role');

      if (!hasTitle && !hasAriaLabel && !hasAriaLabelledby) {
        // Check if it's inside a button or link that provides the name
        var parent = svg.closest('button, a, [role="button"], [role="link"]');
        if (parent) {
          var parentText = parent.textContent.trim();
          var parentAriaLabel = parent.getAttribute('aria-label');
          if (!parentText && !parentAriaLabel) {
            addIssue(
              'serious',
              '1.1.1',
              'Non-text Content',
              'SVG inside interactive element has no accessible name',
              svg,
              'Add <title> inside SVG, or aria-label on SVG or parent element',
              'Screen reader users cannot identify this SVG icon'
            );
          }
        } else if (hasRole === 'img') {
          addIssue(
            'serious',
            '1.1.1',
            'Non-text Content',
            'SVG with role="img" missing accessible name',
            svg,
            'Add <title> element inside SVG, or aria-label/aria-labelledby attribute',
            'Screen reader users will not know what this image represents'
          );
        }
      } else {
        addPassed('1.1.1', 'Non-text Content', 'SVG has accessible name', getSelector(svg));
      }
    });
  }

  // ==========================================================================
  // TEST 10: Tables (WCAG 1.3.1)
  // ==========================================================================

  function testTables() {
    const tables = document.querySelectorAll('table');
    
    if (tables.length === 0) {
      return;
    }
    
    tables.forEach(table => {
      results.stats.elementsScanned++;
      
      const role = table.getAttribute('role');
      const ariaHidden = table.getAttribute('aria-hidden');
      
      // Skip if explicitly hidden
      if (ariaHidden === 'true') {
        return;
      }

      // Check for role="presentation" conflict with data table elements (migrated from comprehensive-audit.js auditTables)
      if (role === 'presentation' || role === 'none') {
        var presentationThs = table.querySelectorAll('th');
        if (presentationThs.length > 0) {
          addIssue(
            'serious',
            '1.3.1',
            'Info and Relationships',
            'Table with role="presentation" contains <th> header elements',
            table,
            'Remove role="presentation" if this is a data table, or remove <th> elements if truly a layout table',
            'Conflicting roles confuse assistive technology'
          );
        }
        return;
      }
      
      // Check 1: Table should have caption or aria-label
      const caption = table.querySelector('caption');
      const ariaLabel = table.getAttribute('aria-label');
      const ariaLabelledby = table.getAttribute('aria-labelledby');
      
      if (!caption && !ariaLabel && !ariaLabelledby) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Data table missing caption or aria-label',
          table,
          'Add a <caption> element or aria-label to describe the table purpose',
          'Screen reader users benefit from knowing what the table contains before navigating it'
        );
      }
      
      // Check 2: Table should have header cells
      const ths = table.querySelectorAll('th');
      const trs = table.querySelectorAll('tr');
      
      if (trs.length > 1 && ths.length === 0) {
        addIssue(
          'serious',
          '1.3.1',
          'Info and Relationships',
          'Data table missing header cells (<th>)',
          table,
          'Use <th> elements for header cells instead of <td>',
          'Header cells help screen readers understand table structure'
        );
      }
      
      // Check 3: Header cells should have scope attribute for complex tables
      if (ths.length > 0) {
        const complexTable = trs.length > 3 || ths.length > 5;
        let missingScope = false;
        
        ths.forEach(th => {
          const scope = th.getAttribute('scope');
          if (complexTable && !scope) {
            missingScope = true;
          }
        });
        
        if (missingScope) {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'Complex table headers missing scope attribute',
            table,
            'Add scope="col" or scope="row" to <th> elements',
            'Scope attributes help screen readers associate data cells with headers'
          );
        } else {
          addPassed('1.3.1', 'Info and Relationships', 'Table has proper header structure', getSelector(table));
        }
      }
      
      // Check 4: Detect layout tables (migrated from comprehensive-audit.js auditTables)
      const hasNestedTables = table.querySelectorAll('table').length > 0;
      const hasManyEmptyCells = Array.from(table.querySelectorAll('td')).filter(td =>
        td.textContent.trim() === '' && !td.querySelector('img, input, button')
      ).length > 3;

      // Enhanced layout table detection: rows > 1, cells > 1, no headers
      var rows = table.querySelectorAll('tr');
      var cells = table.querySelectorAll('td');
      var isLikelyLayout = rows.length > 1 && cells.length > 1 && ths.length === 0 && !caption && !ariaLabel && !ariaLabelledby;

      if (role !== 'presentation' && (hasNestedTables || hasManyEmptyCells || isLikelyLayout)) {
        addManualCheck(
          '1.3.1',
          'Verify this is a data table, not layout',
          'If this table is used for layout (not data), add role="presentation" or use CSS layout instead',
          getSelector(table)
        );
      }
    });
  }

  // ==========================================================================
  // TEST 11: ARIA Usage (WCAG 4.1.2, 1.3.1)
  // Migrated from comprehensive-audit.js auditAria()
  // ==========================================================================

  function testAriaUsage() {
    // Valid ARIA roles set
    var validRoles = [
      'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
      'cell', 'checkbox', 'columnheader', 'combobox', 'command', 'complementary',
      'composite', 'contentinfo', 'definition', 'dialog', 'directory', 'document',
      'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading', 'img',
      'input', 'landmark', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
      'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
      'menuitemradio', 'meter', 'navigation', 'none', 'note', 'option',
      'presentation', 'progressbar', 'radio', 'radiogroup', 'range', 'region',
      'roletype', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search',
      'searchbox', 'section', 'sectionhead', 'select', 'separator', 'slider',
      'spinbutton', 'status', 'structure', 'switch', 'tab', 'table', 'tablist',
      'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree',
      'treegrid', 'treeitem', 'widget', 'window', 'doc-abstract', 'doc-acknowledgments',
      'doc-afterword', 'doc-appendix', 'doc-backlink', 'doc-biblioentry',
      'doc-bibliography', 'doc-biblioref', 'doc-chapter', 'doc-colophon',
      'doc-conclusion', 'doc-cover', 'doc-credit', 'doc-credits', 'doc-dedication',
      'doc-endnote', 'doc-endnotes', 'doc-epigraph', 'doc-epilogue', 'doc-errata',
      'doc-example', 'doc-footnote', 'doc-foreword', 'doc-glossary', 'doc-glossref',
      'doc-index', 'doc-introduction', 'doc-noteref', 'doc-notice', 'doc-pagebreak',
      'doc-pagelist', 'doc-part', 'doc-preface', 'doc-prologue', 'doc-pullquote',
      'doc-qna', 'doc-subtitle', 'doc-tip', 'doc-toc'
    ];

    // Invalid ARIA role validation
    var elementsWithRole = document.querySelectorAll('[role]');
    elementsWithRole.forEach(function(el) {
      var role = el.getAttribute('role');
      if (role && validRoles.indexOf(role.trim().toLowerCase()) === -1) {
        results.stats.elementsScanned++;
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Invalid ARIA role: "' + role + '"',
          el,
          'Use a valid WAI-ARIA role value',
          'Assistive technologies cannot interpret an invalid role'
        );
      }
    });

    // Custom checkbox/radio/switch missing aria-checked
    var customToggles = document.querySelectorAll('[role="checkbox"], [role="radio"], [role="switch"]');
    customToggles.forEach(function(el) {
      results.stats.elementsScanned++;
      if (el.getAttribute('aria-checked') === null) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Custom ' + el.getAttribute('role') + ' missing aria-checked attribute',
          el,
          'Add aria-checked="true" or aria-checked="false" to convey state',
          'Screen reader users cannot determine the checked state'
        );
      }
    });

    // Focusable elements inside aria-hidden="true" containers
    var ariaHiddenContainers = document.querySelectorAll('[aria-hidden="true"]');
    ariaHiddenContainers.forEach(function(container) {
      var focusable = container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
        'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      focusable.forEach(function(el) {
        if (el.offsetWidth > 0 || el.offsetHeight > 0) {
          results.stats.elementsScanned++;
          addIssue(
            'critical',
            '4.1.2',
            'Name, Role, Value',
            'Focusable element inside aria-hidden="true" container',
            el,
            'Remove aria-hidden from ancestor, add tabindex="-1" to this element, or use the inert attribute',
            'Element is hidden from screen readers but still receives keyboard focus'
          );
        }
      });
    });

    // Dialog missing accessible name
    var dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog');
    dialogs.forEach(function(dialog) {
      results.stats.elementsScanned++;
      var dialogLabel = dialog.getAttribute('aria-label');
      var dialogLabelledby = dialog.getAttribute('aria-labelledby');
      if (!dialogLabel && !dialogLabelledby) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Dialog missing accessible name',
          dialog,
          'Add aria-label or aria-labelledby pointing to the dialog title',
          'Screen reader users cannot identify the dialog purpose'
        );
      }
    });
  }

  // ==========================================================================
  // TEST 12: Semantic Structure (WCAG 1.3.1, 1.1.1)
  // Migrated from comprehensive-audit.js auditAria()
  // ==========================================================================

  function testSemanticStructure() {
    // Definition list structure validation
    var dlElements = document.querySelectorAll('dl');
    dlElements.forEach(function(dl) {
      results.stats.elementsScanned++;
      var children = dl.children;
      var hasDt = false;
      var hasDd = false;

      for (var i = 0; i < children.length; i++) {
        var tag = children[i].tagName.toLowerCase();
        if (tag === 'dt') hasDt = true;
        else if (tag === 'dd') hasDd = true;
        else if (tag !== 'div') {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'Definition list contains invalid child element <' + tag + '>',
            children[i],
            'Only <dt>, <dd>, and <div> elements are valid children of <dl>',
            'Invalid structure may confuse assistive technologies'
          );
        }
      }

      if (hasDt && !hasDd) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Definition list has <dt> without matching <dd>',
          dl,
          'Add <dd> elements to provide definitions for each <dt> term',
          'Incomplete definition list structure'
        );
      } else if (!hasDt && hasDd) {
        addIssue(
          'moderate',
          '1.3.1',
          'Info and Relationships',
          'Definition list has <dd> without matching <dt>',
          dl,
          'Add <dt> elements to label each <dd> definition',
          'Incomplete definition list structure'
        );
      }

      // Empty dt check
      var dts = dl.querySelectorAll('dt');
      dts.forEach(function(dt) {
        if (!dt.textContent.trim()) {
          addIssue(
            'moderate',
            '1.3.1',
            'Info and Relationships',
            'Empty <dt> element in definition list',
            dt,
            'Add content to the term element or remove it',
            'Screen readers announce an empty term'
          );
        }
      });
    });

    // Blockquote empty check
    var blockquotes = document.querySelectorAll('blockquote');
    blockquotes.forEach(function(bq) {
      results.stats.elementsScanned++;
      if (!bq.textContent.trim()) {
        addIssue(
          'minor',
          '1.3.1',
          'Info and Relationships',
          'Empty <blockquote> element',
          bq,
          'Add content to the blockquote or remove it',
          'Empty blockquotes create confusing structure for screen reader users'
        );
      }
    });

    // Figure without figcaption or accessible name
    var figures = document.querySelectorAll('figure');
    figures.forEach(function(fig) {
      results.stats.elementsScanned++;
      var figcaption = fig.querySelector('figcaption');
      var figAriaLabel = fig.getAttribute('aria-label');
      var figAriaLabelledby = fig.getAttribute('aria-labelledby');
      var imgAlt = fig.querySelector('img[alt]');

      if (!figcaption && !figAriaLabel && !figAriaLabelledby && !imgAlt) {
        addIssue(
          'moderate',
          '1.1.1',
          'Non-text Content',
          'Figure element without figcaption or accessible name',
          fig,
          'Add <figcaption>, aria-label, or ensure contained images have alt text',
          'Screen reader users may not understand the figure content'
        );
      }

      // Figcaption position check (should be first or last child)
      if (figcaption) {
        var figChildren = fig.children;
        var isFirstOrLast = figChildren[0] === figcaption || figChildren[figChildren.length - 1] === figcaption;
        if (!isFirstOrLast && figChildren.length > 1) {
          addManualCheck(
            '1.3.1',
            'Figcaption is not first or last child of figure',
            'For best accessibility, place <figcaption> as the first or last child of <figure>',
            getSelector(fig)
          );
        }
      }
    });
  }

  // ==========================================================================
  // TEST 13: Timing (WCAG 2.2.1, 2.2.2)
  // Migrated from comprehensive-audit.js auditTiming()
  // ==========================================================================

  function testTiming() {
    // meta[http-equiv="refresh"] auto-refresh detection
    var metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
    if (metaRefresh) {
      results.stats.elementsScanned++;
      var content = metaRefresh.getAttribute('content') || '';
      var seconds = parseInt(content, 10);

      if (!isNaN(seconds) && seconds > 0) {
        if (content.toLowerCase().indexOf('url') !== -1) {
          addIssue(
            'critical',
            '2.2.1',
            'Timing Adjustable',
            'Page uses meta refresh to redirect after ' + seconds + ' seconds',
            metaRefresh,
            'Use server-side redirects instead of meta refresh, or let users control the redirect',
            'Users may not have enough time to read content before being redirected'
          );
        } else {
          addIssue(
            'critical',
            '2.2.1',
            'Timing Adjustable',
            'Page auto-refreshes every ' + seconds + ' seconds',
            metaRefresh,
            'Remove auto-refresh or provide user controls to adjust or disable timing',
            'Auto-refresh can disorient users and cause loss of focus position'
          );
        }
      }
    }

    // Session timeout manual check
    addManualCheck(
      '2.2.1',
      'Verify session timeout handling',
      'If the page has session timeouts, verify users are warned before timeout and can extend the session (WCAG 2.2.1). Also verify users can save data before timeout (WCAG 2.2.2).',
      'document'
    );
  }

  // ==========================================================================
  // RUN ALL TESTS
  // ==========================================================================

  testDocumentLanguage();
  testPageTitle();
  testSingleH1();
  testHeadingHierarchy();
  testLandmarks();
  testSkipLink();
  testViewportMeta();
  testBackToTop();
  testOrientation();
  testParsing();
  testImages();
  testTables();
  testAriaUsage();
  testSemanticStructure();
  testTiming();

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
  window.runPageStructureAudit = runPageStructureAudit;
}
