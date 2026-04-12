/**
 * Iframes Accessibility Audit
 * WCAG: 2.4.1, 4.1.2
 */

function runIframesAudit() {
  'use strict';

  const startTime = performance.now();

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('iframes', 'All iframe elements');
  const { isVisible, getSelector, getElementSnippet } = h;

  // ==========================================================================
  // MAIN TEST: All Iframes
  // ==========================================================================

  function testAllIframes() {
    const iframes = document.querySelectorAll('iframe');

    if (iframes.length === 0) {
      return;
    }

    // Generic title patterns to flag (includes patterns migrated from comprehensive-audit.js auditIframes)
    const genericPatterns = [
      /^iframe$/i,
      /^frame$/i,
      /^untitled$/i,
      /^no title$/i,
      /^embedded content$/i,
      /^content$/i,
      /^video$/i,
      /^widget$/i,
      /^blank$/i,
      /^_\d+$/,
      /^\d+$/
    ];

    iframes.forEach(iframe => {
      results.stats.elementsScanned++;

      const title = iframe.getAttribute('title');
      const ariaLabel = iframe.getAttribute('aria-label');
      const ariaLabelledby = iframe.getAttribute('aria-labelledby');
      const ariaHidden = iframe.getAttribute('aria-hidden');
      const src = iframe.getAttribute('src') || '';
      const name = iframe.getAttribute('name') || '';
      const isVisible = iframe.offsetWidth > 0 && iframe.offsetHeight > 0;

      // Skip if explicitly hidden or decorative
      if (ariaHidden === 'true' || !isVisible) {
        // Hidden iframes don't need titles
        return;
      }

      // Check 1: iframe has accessible name (title, aria-label, or aria-labelledby)
      const hasAccessibleName = 
        (title && title.trim().length > 0) ||
        (ariaLabel && ariaLabel.trim().length > 0) ||
        ariaLabelledby;

      if (!hasAccessibleName) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'iframe missing title attribute',
          iframe,
          'Add title attribute describing the iframe content (e.g., title="Google Maps showing store location")',
          'Screen reader users cannot understand what the iframe contains'
        );
        return;
      }

      // Check 2: Generic title text
      if (title && !ariaLabel && !ariaLabelledby) {
        const titleLower = title.trim().toLowerCase();
        const isGeneric = genericPatterns.some(pattern => pattern.test(titleLower));

        if (isGeneric) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'iframe has generic title: "' + title + '"',
            iframe,
            'Provide descriptive title explaining what the iframe contains',
            'Generic titles don\'t help users understand the iframe purpose'
          );
          return;
        }
      }

      // Check 3: Title should describe content, not just domain
      if (title && !ariaLabel && src) {
        const titleLower = title.toLowerCase().trim();
        
        // Extract domain from src
        try {
          const url = new URL(src, window.location.href);
          const domain = url.hostname.replace('www.', '');
          
          // If title is just the domain, it's not descriptive enough
          if (titleLower === domain || titleLower === domain.split('.')[0]) {
            addIssue(
              'moderate',
              '4.1.2',
              'Name, Role, Value',
              'iframe title is just the domain name: "' + title + '"',
              iframe,
              'Describe what the iframe shows (e.g., "YouTube video: How to bake bread" not just "YouTube")',
              'Domain-only titles don\'t convey the iframe purpose'
            );
            return;
          }
        } catch (e) {
          // Invalid URL, continue
        }
      }

      // Check 4: Known third-party iframes should have descriptive titles
      const knownEmbeds = [
        { pattern: /youtube\.com|youtu\.be/i, suggest: 'YouTube video' },
        { pattern: /vimeo\.com/i, suggest: 'Vimeo video' },
        { pattern: /google\.com\/maps/i, suggest: 'Google Maps' },
        { pattern: /facebook\.com/i, suggest: 'Facebook content' },
        { pattern: /twitter\.com|x\.com/i, suggest: 'Twitter/X content' },
        { pattern: /instagram\.com/i, suggest: 'Instagram content' },
        { pattern: /stripe\.com/i, suggest: 'Stripe payment form' },
        { pattern: /paypal\.com/i, suggest: 'PayPal payment form' }
      ];

      for (const embed of knownEmbeds) {
        if (embed.pattern.test(src)) {
          if (!title || title.toLowerCase() === embed.suggest.toLowerCase()) {
            addManualCheck(
              '4.1.2',
              'Verify iframe title is specific',
              'Check if title "' + (title || 'missing') + '" adequately describes this ' + embed.suggest + ' content. It should be more specific (e.g., "YouTube video: How to make sourdough bread" not just "YouTube video")',
              getSelector(iframe)
            );
            return;
          }
          break;
        }
      }

      // External iframe sandbox attribute check (migrated from comprehensive-audit.js auditIframes)
      if (src) {
        try {
          var iframeUrl = new URL(src, window.location.href);
          var isExternal = iframeUrl.hostname !== window.location.hostname;
          if (isExternal && !iframe.hasAttribute('sandbox')) {
            addManualCheck(
              '4.1.2',
              'External iframe missing sandbox attribute',
              'iframe loads content from "' + iframeUrl.hostname + '". Consider adding sandbox attribute to restrict capabilities (e.g., sandbox="allow-scripts allow-same-origin")',
              getSelector(iframe)
            );
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }

      // If we made it here, iframe seems accessible
      addPassed('4.1.2', 'Name, Role, Value', 'iframe has descriptive title', getSelector(iframe));
    });

    // Summary
    const iframesChecked = results.stats.elementsScanned;
    if (iframesChecked > 0) {
      addManualCheck(
        '2.4.1',
        'Verify iframe content is skippable',
        iframesChecked + ' iframes found. Verify that users can skip past iframe content without reading/watching it (e.g., via skip links or proper heading structure)',
        'document'
      );
    }
  }

  // ==========================================================================
  // RUN TESTS
  // ==========================================================================

  testAllIframes();

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
  window.runIframesAudit = runIframesAudit;
}
