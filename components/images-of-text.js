/**
 * Images of Text Accessibility Audit
 * WCAG: 1.4.5
 */

function runImagesOfTextAudit() {
  'use strict';

  const startTime = performance.now();

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('images-of-text', 'Images containing text');
  const { isVisible, getSelector } = h;

  // ==========================================================================
  // DETECTION HEURISTICS
  // ==========================================================================

  function isLikelyLogo(img) {
    // Check if image is likely a logo (exception to 1.4.5)
    const src = (img.getAttribute('src') || '').toLowerCase();
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    const className = (img.className || '').toLowerCase();
    const parent = img.parentElement;
    const parentClass = parent ? (parent.className || '').toLowerCase() : '';

    // Filename indicators
    if (/logo|brand|icon/i.test(src)) return true;
    
    // Alt text indicators
    if (/logo|brand/i.test(alt)) return true;
    
    // Class indicators
    if (/logo|brand/i.test(className)) return true;
    if (/logo|brand/i.test(parentClass)) return true;
    
    // Location indicators (header/footer)
    if (parent && (parent.tagName === 'HEADER' || parent.closest('header'))) {
      // Small image in header is likely a logo
      const rect = img.getBoundingClientRect();
      if (rect.height < 100) return true;
    }

    return false;
  }

  function isDecorativeOrPhoto(img) {
    // Check if image is likely decorative or a photo (not text)
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    const src = (img.getAttribute('src') || '').toLowerCase();
    
    // Empty alt = decorative
    if (alt === '') return true;
    
    // Photo/image file naming
    if (/photo|image|picture|gallery|hero|banner/i.test(src)) return true;
    
    return false;
  }

  function hasTextIndicators(img) {
    // Check for indicators that image might contain text
    const src = (img.getAttribute('src') || '').toLowerCase();
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    const className = (img.className || '').toLowerCase();

    // Filename indicators suggesting text
    const textFilenamePatterns = [
      /text/i,
      /heading/i,
      /title/i,
      /quote/i,
      /testimonial/i,
      /banner.*text/i,
      /cta/i,  // Call to action
      /button/i,
      /badge/i,
      /label/i,
      /sign/i
    ];

    for (const pattern of textFilenamePatterns) {
      if (pattern.test(src)) return true;
    }

    // Alt text suggesting there's text in the image
    // Long alt text might indicate text was transcribed
    if (alt.length > 50 && !/photo|image|showing|displays/i.test(alt)) {
      return true;
    }

    // Class indicators
    if (/text|heading|cta|banner/i.test(className)) {
      return true;
    }

    return false;
  }

  function getImageCategory(img) {
    if (isLikelyLogo(img)) return 'logo';
    if (isDecorativeOrPhoto(img)) return 'decorative-or-photo';
    if (hasTextIndicators(img)) return 'likely-text';
    return 'unknown';
  }

  // ==========================================================================
  // MAIN TEST: Images of Text
  // ==========================================================================

  function testImagesOfText() {
    const images = document.querySelectorAll('img');

    if (images.length === 0) {
      return;
    }

    let likelyTextImages = [];
    let unknownImages = [];
    let logoCount = 0;

    images.forEach(img => {
      if (!isVisible(img)) return;

      results.stats.elementsScanned++;

      const category = getImageCategory(img);
      const alt = img.getAttribute('alt') || '';
      const src = img.getAttribute('src') || '';

      switch (category) {
        case 'logo':
          logoCount++;
          // Logos are OK to have text
          break;

        case 'likely-text':
          likelyTextImages.push(img);
          addManualCheck(
            '1.4.5',
            'Verify image does not contain text that could be real text',
            'Image appears to contain text based on filename/class/alt. Verify: (1) Is there text in the image? (2) Could that text be presented as real HTML text instead? (3) Is it essential (logo/brand) or decorative?',
            getSelector(img)
          );
          break;

        case 'unknown':
          unknownImages.push(img);
          break;

        case 'decorative-or-photo':
          // Likely fine, no action needed
          break;
      }
    });

    // Summary manual checks
    if (likelyTextImages.length > 0) {
      addManualCheck(
        '1.4.5',
        'Review ' + likelyTextImages.length + ' images that may contain text',
        'Manual inspection required: Check each flagged image to see if it contains text that could be presented as real HTML text with CSS styling instead. Exceptions: logos, essential graphics, text that is part of a photo.',
        'document'
      );
    }

    // General guidance
    if (images.length > 0) {
      addManualCheck(
        '1.4.5',
        'General: Verify no images of text exist',
        'Review all ' + images.length + ' images on the page. If any contain text (headings, quotes, captions, etc.), that text should be real HTML text with CSS styling instead of embedded in images. Exceptions: logos, branding, photos where text is incidental.',
        'document'
      );
    }

    // Note about exceptions
    if (logoCount > 0) {
      addPassed('1.4.5', 'Images of Text', logoCount + ' logo/brand images identified (exception to 1.4.5)', 'document');
    }
  }

  // ==========================================================================
  // TEST 2: SVG Text Elements
  // ==========================================================================

  function testSvgTextElements() {
    const PERF = (window.a11yAudit && window.a11yAudit.PERF) || { TIMEOUT_MS: 2000, SAMPLING_INTERVAL: 500 };
    const svgTextStart = performance.now();
    const svgTexts = document.querySelectorAll('svg text, svg textPath');

    for (let i = 0; i < svgTexts.length; i++) {
      if (i % PERF.SAMPLING_INTERVAL === 0 && performance.now() - svgTextStart > PERF.TIMEOUT_MS) break;
      const textEl = svgTexts[i];
      if (!isVisible(textEl)) continue;

      results.stats.elementsScanned++;

      const svgParent = textEl.closest('svg');
      if (!svgParent) continue;

      // Skip decorative SVGs
      if (svgParent.getAttribute('aria-hidden') === 'true') continue;
      if (svgParent.getAttribute('role') === 'img' && svgParent.getAttribute('aria-label')) continue;

      addManualCheck(
        '1.4.5',
        'SVG contains text element — verify this is not an image of text',
        'SVG contains a <text> or <textPath> element. Verify this is not text that could be rendered as real HTML text instead. Exceptions: logos, diagrams where text is integral.',
        getSelector(textEl)
      );
    }
  }

  // ==========================================================================
  // TEST 3: Background Images with Text
  // ==========================================================================

  function testBackgroundImagesWithText() {
    const PERF = (window.a11yAudit && window.a11yAudit.PERF) || { TIMEOUT_MS: 2000, SAMPLING_INTERVAL: 500 };
    // Check for elements with background images that might contain text
    const bgTextStart = performance.now();
    const allElements = document.querySelectorAll(
      '[style*="background-image"], [class*="bg-"], [class*="background"], [class*="hero"], [class*="banner"], [class*="cta"], section, div, article, header, footer, aside, main'
    );
    let bgImagesWithText = [];

    for (let i = 0; i < allElements.length; i++) {
      if (i % PERF.SAMPLING_INTERVAL === 0 && performance.now() - bgTextStart > PERF.TIMEOUT_MS) break;
      const el = allElements[i];
      if (!isVisible(el)) continue;

      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;

      // Skip if no background image
      if (!bgImage || bgImage === 'none') continue;

      results.stats.elementsScanned++;

      // Check if element has text content
      const hasDirectText = el.childNodes.length > 0 &&
                           Array.from(el.childNodes).some(node =>
                             node.nodeType === 3 && node.textContent.trim().length > 0
                           );

      // Check if element looks like a text container
      const className = (el.className || '').toLowerCase();
      const hasTextClass = /heading|title|text|quote|caption/i.test(className);

      if (hasDirectText || hasTextClass) {
        bgImagesWithText.push(el);
      }
    }

    if (bgImagesWithText.length > 0) {
      addManualCheck(
        '1.4.5',
        'Verify background images do not contain essential text',
        bgImagesWithText.length + ' elements found with background images and text. Verify that any text in the background image is decorative only, not essential content.',
        'document'
      );
    }
  }

  // ==========================================================================
  // RUN TESTS
  // ==========================================================================

  testImagesOfText();
  testSvgTextElements();
  testBackgroundImagesWithText();

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
  window.runImagesOfTextAudit = runImagesOfTextAudit;
}
