/**
 * Links and Buttons Accessibility Audit Script
 * Part of modular accessibility-audit-unified system
 * 
 * WCAG Success Criteria Covered:
 * - 2.4.4 Link Purpose (In Context) (Level A)
 * - 2.5.3 Label in Name (Level A) - for buttons
 * - 4.1.2 Name, Role, Value (Level A)
 * 
 * @updated 2026-02-04
 * @requires shared-helpers.js must be loaded first
 * 
 * Usage:
 *   const results = await runLinksButtonsAudit();
 *   console.log(results);
 */

(function() {
  'use strict';

  // Use centralized version if available
  const SCRIPT_VERSION = (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown';

  // Ensure shared helpers are loaded
  if (typeof window.a11yHelpers === 'undefined') {
    throw new Error('shared-helpers.js must be loaded before links-buttons-audit.js');
  }

  const helpers = window.a11yHelpers;

  /**
   * Generic link text patterns with confidence scoring
   */
  const GENERIC_LINK_PATTERNS = [
    { pattern: /^(click here|here|link|more|read more)$/i, confidence: 100, allowsContext: true },
    { pattern: /^(learn more|view more|see more|find out more)$/i, confidence: 90, allowsContext: true },
    { pattern: /^(details|info|information)$/i, confidence: 85, allowsContext: true },
    { pattern: /^(go|continue|next|previous|prev|back)$/i, confidence: 80, allowsContext: true },
    { pattern: /^(download|pdf|doc|file)$/i, confidence: 75, allowsContext: true },
    { pattern: /^(button|submit|close|open)$/i, confidence: 70, allowsContext: false },
    { pattern: /^(page \d+|\d+)$/i, confidence: 60, allowsContext: true } // Pagination
  ];

  /**
   * Get programmatic context for a link
   */
  function getLinkContext(link) {
    const contexts = [];
    
    // Check for aria-describedby
    const describedBy = link.getAttribute('aria-describedby');
    if (describedBy) {
      const descElement = document.getElementById(describedBy);
      if (descElement) {
        contexts.push({
          type: 'aria-describedby',
          text: helpers.getVisibleText(descElement),
          confidence: 100
        });
      }
    }

    // Check for aria-labelledby
    const labelledBy = link.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) {
        contexts.push({
          type: 'aria-labelledby',
          text: helpers.getVisibleText(labelElement),
          confidence: 100
        });
      }
    }

    // Check if in list item with heading
    const listItem = link.closest('li');
    if (listItem) {
      const heading = listItem.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading && !heading.contains(link)) {
        contexts.push({
          type: 'list-item-heading',
          text: helpers.getVisibleText(heading),
          confidence: 85
        });
      }
    }

    // Check for adjacent heading
    let prevSibling = link.previousElementSibling;
    while (prevSibling) {
      if (/^H[1-6]$/.test(prevSibling.tagName)) {
        contexts.push({
          type: 'adjacent-heading',
          text: helpers.getVisibleText(prevSibling),
          confidence: 75
        });
        break;
      }
      if (prevSibling.querySelector('h1, h2, h3, h4, h5, h6')) break;
      prevSibling = prevSibling.previousElementSibling;
    }

    // Pattern D fix: Check heading ancestor in same container (section, article, card, div)
    // "Learn more" inside a card/section with a heading has sufficient programmatic context
    const { getAncestorContext } = window.a11yHelpers || {};
    if (getAncestorContext) {
      const ctx = getAncestorContext(link);
      if (ctx.nearestHeading) {
        contexts.push({
          type: ctx.nearestHeading.isSibling ? 'sibling-heading' : 'ancestor-heading',
          text: ctx.nearestHeading.text,
          confidence: ctx.nearestCard ? 90 : 75
        });
      }
    }

    // Check if in card or article with title
    const card = link.closest('[class*="card"], article, [role="article"], [class*="product"], [class*="item"]');
    if (card) {
      const cardTitle = card.querySelector('[class*="title"], [class*="heading"], h1, h2, h3, h4, h5, h6');
      if (cardTitle && !cardTitle.contains(link)) {
        contexts.push({
          type: 'card-title',
          text: helpers.getVisibleText(cardTitle),
          confidence: 85
        });
      }
    }

    // Check if in table cell with header
    const cell = link.closest('td, th');
    if (cell) {
      const row = cell.closest('tr');
      if (row) {
        const headers = Array.from(row.querySelectorAll('th'));
        if (headers.length > 0) {
          contexts.push({
            type: 'table-header',
            text: headers.map(h => helpers.getVisibleText(h)).join(' '),
            confidence: 70
          });
        }
      }
    }

    // Check for parent paragraph text
    const paragraph = link.closest('p');
    if (paragraph) {
      const paraText = helpers.getVisibleText(paragraph);
      const linkText = helpers.getAccessibleName(link);
      // Only use if paragraph has substantial text beyond link
      if (paraText.length > linkText.length + 20) {
        contexts.push({
          type: 'paragraph',
          text: paraText,
          confidence: 60
        });
      }
    }

    return contexts;
  }

  /**
   * Analyze link purpose with context awareness
   */
  function analyzeLinkPurpose(link) {
    const accessibleName = helpers.getAccessibleName(link);
    const visibleText = helpers.getVisibleText(link);
    const href = link.getAttribute('href');

    // Check if link has any text
    if (!accessibleName || accessibleName.trim().length === 0) {
      return {
        hasIssue: true,
        severity: 'critical',
        message: 'Link has no accessible text',
        confidence: 100,
        contexts: []
      };
    }

    // Check for generic patterns
    const contexts = getLinkContext(link);
    let genericMatch = null;
    
    for (const { pattern, confidence, allowsContext } of GENERIC_LINK_PATTERNS) {
      if (pattern.test(accessibleName.trim())) {
        genericMatch = { pattern: pattern.source, confidence, allowsContext };
        break;
      }
    }

    // If generic and has context, might be okay
    if (genericMatch) {
      const hasGoodContext = contexts.some(ctx => 
        ctx.confidence >= 75 && ctx.text.length > 10
      );

      if (hasGoodContext && genericMatch.allowsContext) {
        return {
          hasIssue: false,
          warning: true,
          message: `Generic link text "${accessibleName}" but has programmatic context`,
          confidence: 50,
          contexts
        };
      }

      return {
        hasIssue: true,
        severity: 'critical',
        message: `Generic link text: "${accessibleName}"`,
        confidence: genericMatch.confidence,
        contexts
      };
    }

    // Check for URL as link text
    if (/^https?:\/\//.test(accessibleName)) {
      return {
        hasIssue: true,
        severity: 'moderate',
        message: 'Link text is a URL',
        confidence: 90,
        contexts
      };
    }

    // Check for very short link text (< 3 chars)
    if (accessibleName.length < 3 && !href?.includes('#')) {
      return {
        hasIssue: true,
        severity: 'moderate',
        message: `Link text very short: "${accessibleName}"`,
        confidence: 75,
        contexts
      };
    }

    return {
      hasIssue: false,
      confidence: 100,
      contexts
    };
  }

  /**
   * Check button accessibility
   */
  function analyzeButton(button) {
    const issues = [];
    const accessibleName = helpers.getAccessibleName(button);
    const visibleText = helpers.getVisibleText(button);
    const type = button.type || 'button';
    const selector = helpers.getSelector(button);

    // Check for missing accessible name
    if (!accessibleName || accessibleName.trim().length === 0) {
      issues.push({
        wcag: '4.1.2',
        level: 'A',
        category: 'buttons',
        severity: 'critical',
        element: 'button',
        selector,
        message: 'Button has no accessible name',
        snippet: helpers.getElementSnippet(button),
        recommendation: 'Add aria-label, aria-labelledby, or visible text content'
      });
    }

    // WCAG 2.5.3: Label in Name
    if (visibleText && accessibleName) {
      const visibleLower = visibleText.replace(/\s+/g, ' ').toLowerCase().trim();
      const accessibleLower = accessibleName.replace(/\s+/g, ' ').toLowerCase().trim();
      
      // Visible text should be included in accessible name
      if (visibleLower && !accessibleLower.includes(visibleLower)) {
        issues.push({
          wcag: '2.5.3',
          level: 'A',
          category: 'buttons',
          severity: 'moderate',
          element: 'button',
          selector,
          message: 'Button accessible name does not include visible text',
          visibleText,
          accessibleName,
          snippet: helpers.getElementSnippet(button),
          recommendation: 'Ensure accessible name includes visible text label'
        });
      }
    }

    // Check for generic button text
    // Pattern D fix: Accept action buttons (Delete, Remove) when inside a table row
    // or list item that provides sufficient context
    if (accessibleName && /^(button|submit|click|ok|yes|no)$/i.test(accessibleName.trim())) {
      // Check if context (table row, list item) provides the purpose
      const inRow = button.closest('tr, [role="row"]');
      const inListItem = button.closest('li, [role="listitem"]');
      if (inRow || inListItem) {
        // Table/list context provides purpose — downgrade to manual check
        issues.push({
          wcag: '4.1.2',
          level: 'A',
          category: 'buttons',
          severity: 'minor',
          element: 'button',
          selector,
          message: `Generic button text "${accessibleName}" — row/list context may provide purpose`,
          snippet: helpers.getElementSnippet(button),
          recommendation: 'Consider adding aria-label with row context (e.g., "Delete [item name]")'
        });
      } else {
        issues.push({
          wcag: '4.1.2',
          level: 'A',
          category: 'buttons',
          severity: 'moderate',
          element: 'button',
          selector,
          message: `Generic button text: "${accessibleName}"`,
          snippet: helpers.getElementSnippet(button),
          recommendation: 'Use descriptive button text that explains the action'
        });
      }
    }

    return issues;
  }

  /**
   * Audit all links and buttons
   */
  async function runLinksButtonsAudit(options = {}) {
    console.warn('[DEPRECATED] runLinksButtonsAudit() is legacy. Use runNavigationAudit() + runButtonsAudit() from components/ instead.');
    const {
      skipHidden = true
    } = options;

    console.log(' Starting Links and Buttons Audit...');
    const startTime = performance.now();

    const issues = [];
    const stats = {
      totalLinks: 0,
      linksWithIssues: 0,
      genericLinks: 0,
      totalButtons: 0,
      buttonsWithIssues: 0,
      emptyButtons: 0
    };

    // Audit Links
    const links = Array.from(document.querySelectorAll('a[href]'));
    stats.totalLinks = links.length;

    for (const link of links) {
      if (skipHidden && !helpers.isVisible(link)) continue;

      const analysis = analyzeLinkPurpose(link);
      const selector = helpers.getSelector(link);

      if (analysis.hasIssue) {
        stats.linksWithIssues++;
        if (analysis.message.toLowerCase().includes('generic')) {
          stats.genericLinks++;
        }

        const issue = {
          wcag: '2.4.4',
          level: 'A',
          category: 'links',
          severity: analysis.severity,
          element: 'a',
          selector,
          message: analysis.message,
          snippet: helpers.getElementSnippet(link),
          recommendation: 'Provide descriptive link text that explains the link purpose'
        };

        if (analysis.contexts.length > 0) {
          issue.availableContext = analysis.contexts;
        }

        issues.push(issue);
      } else if (analysis.warning) {
        // Log warning but don't fail
        console.warn(`[!]  ${analysis.message} at ${selector}`);
      }

      // Check for links that open new windows without warning
      const target = link.getAttribute('target');
      if (target === '_blank') {
        const hasWarning = /new window|new tab|opens in|external/i.test(
          helpers.getAccessibleName(link) + ' ' + link.getAttribute('aria-label')
        );
        
        if (!hasWarning) {
          issues.push({
            wcag: '3.2.2',
            level: 'A',
            category: 'links',
            severity: 'serious',
            element: 'a',
            selector,
            message: 'Link opens new window without warning',
            snippet: helpers.getElementSnippet(link),
            recommendation: 'Include "opens in new window" in link text or aria-label'
          });
        }
      }

      // Check for empty href
      const href = link.getAttribute('href');
      if (href === '' || href === '#') {
        issues.push({
          wcag: '2.4.4',
          level: 'A',
          category: 'links',
          severity: 'moderate',
          element: 'a',
          selector,
          message: 'Link has empty or placeholder href',
          snippet: helpers.getElementSnippet(link),
          recommendation: 'Use button element for actions, or provide valid href'
        });
      }
    }

    // Audit Buttons
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]'));
    stats.totalButtons = buttons.length;

    for (const button of buttons) {
      if (skipHidden && !helpers.isVisible(button)) continue;

      const buttonIssues = analyzeButton(button);
      
      if (buttonIssues.length > 0) {
        stats.buttonsWithIssues++;
        
        const hasEmptyName = buttonIssues.some(i => 
          i.message.includes('no accessible name')
        );
        if (hasEmptyName) stats.emptyButtons++;
        
        issues.push(...buttonIssues);
      }

      // Check for disabled state without reason
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
        const hasExplanation = button.title || button.getAttribute('aria-describedby');
        
        if (!hasExplanation) {
          const selector = helpers.getSelector(button);
          issues.push({
            wcag: '4.1.2',
            level: 'A',
            category: 'buttons',
            severity: 'minor',
            element: button.tagName.toLowerCase(),
            selector,
            message: 'Disabled button without explanation',
            snippet: helpers.getElementSnippet(button),
            recommendation: 'Add title or aria-describedby to explain why button is disabled'
          });
        }
      }
    }

    // Check for div/span with onclick but no role
    const clickableDivs = Array.from(document.querySelectorAll('div[onclick], span[onclick]'));
    for (const div of clickableDivs) {
      if (skipHidden && !helpers.isVisible(div)) continue;

      const role = div.getAttribute('role');
      if (!role || (role !== 'button' && role !== 'link')) {
        const selector = helpers.getSelector(div);
        issues.push({
          wcag: '4.1.2',
          level: 'A',
          category: 'buttons',
          severity: 'critical',
          element: div.tagName.toLowerCase(),
          selector,
          message: 'Clickable element without appropriate role',
          snippet: helpers.getElementSnippet(div),
          recommendation: 'Use button element or add role="button" and keyboard support'
        });
      }
    }

    const duration = Math.round(performance.now() - startTime);

    // Deduplicate issues
    const deduplicatedIssues = helpers.deduplicateIssues(issues);

    console.log(` Links and Buttons Audit complete in ${duration}ms`);
    console.log(`   Found ${deduplicatedIssues.length} issues`);
    console.log(`   Links: ${stats.linksWithIssues}/${stats.totalLinks} with issues`);
    console.log(`   Buttons: ${stats.buttonsWithIssues}/${stats.totalButtons} with issues`);

    return {
      summary: {
        category: 'Links and Buttons',
        duration,
        issueCount: deduplicatedIssues.length,
        criticalCount: deduplicatedIssues.filter(i => i.severity === 'critical').length,
        stats
      },
      issues: deduplicatedIssues
    };
  }

  // Expose to global scope
  window.runLinksButtonsAudit = runLinksButtonsAudit;

})();
