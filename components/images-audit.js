/**
 * Images Accessibility Audit Script
 * Part of modular accessibility-audit-unified system
 * 
 * WCAG Success Criteria Covered:
 * - 1.1.1 Non-text Content (Level A)
 * - 1.4.5 Images of Text (Level AA)
 * 
 * Dependencies: shared-helpers.js must be loaded first
 * 
 * Usage:
 *   const results = await runImagesAudit();
 *   console.log(results);
 */

(function() {
  'use strict';

  // Use centralized version if available
  const SCRIPT_VERSION = (window.A11Y_VERSION) || 'unknown';

  // Ensure shared helpers are loaded
  if (typeof window.a11yHelpers === 'undefined') {
    console.error('[images-audit] shared-helpers.js must be loaded first');
    // Return a stub function that reports the error
    window.runImagesAudit = function() {
      return {
        success: false,
        error: {
          message: 'shared-helpers.js must be loaded before images-audit.js',
          context: 'runImagesAudit',
          timestamp: new Date().toISOString()
        }
      };
    };
    return;
  }

  const helpers = window.a11yHelpers;

  /**
   * Poor alt text patterns with confidence scoring
   */
  const POOR_ALT_PATTERNS = [
    { pattern: /^(image|img|picture|photo|graphic)[\d\s_-]*$/i, name: 'filename', confidence: 95 },
    { pattern: /^(placeholder|dummy|test|sample)[\d\s_-]*$/i, name: 'placeholder', confidence: 100 },
    { pattern: /^(image|photo|picture)\s*\d+$/i, name: 'numbered-placeholder', confidence: 100 },
    { pattern: /^(image|photo|picture)\s*(of|for|showing)?\s*$/i, name: 'redundant-prefix', confidence: 90 },
    { pattern: /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i, name: 'filename-extension', confidence: 100 },
    { pattern: /^(img|pic|photo)[-_]\d+/i, name: 'cms-default', confidence: 95 },
    { pattern: /^untitled[-_]?\d*$/i, name: 'untitled', confidence: 100 },
    { pattern: /^dsc[-_]?\d+/i, name: 'camera-default', confidence: 95 },
    // Pattern D fix: "screenshot" can be legitimate descriptive text — lower confidence
    { pattern: /^screenshot[-_]?\d*$/i, name: 'screenshot', confidence: 70 },
    { pattern: /^[a-f0-9]{8,}/i, name: 'hash-id', confidence: 90 },
    { pattern: /^https?:\/\//i, name: 'url', confidence: 100 },
    // Pattern D fix: Require 4+ underscore segments to avoid legitimate descriptions
    { pattern: /^[a-z0-9]+_[a-z0-9]+_[a-z0-9]+_[a-z0-9]+/i, name: 'underscore-separated', confidence: 80 },
    { pattern: /^[A-Z\s]{10,}$/, name: 'all-caps', confidence: 75 },
    { pattern: /[!?.]{3,}/, name: 'excessive-punctuation', confidence: 70 },
    { pattern: /(click|tap|press|select)\s+(here|this|me)/i, name: 'click-instruction', confidence: 85 }
  ];

  /**
   * Decorative image indicators
   */
  const DECORATIVE_INDICATORS = [
    'decorative', 'decoration', 'spacer', 'divider', 'separator',
    'bullet', 'icon', 'arrow', 'line', 'border', 'background'
  ];

  /**
   * Text-in-image patterns for WCAG 1.4.5
   */
  const TEXT_IMAGE_PATTERNS = [
    /logo/i,
    /banner/i,
    /header/i,
    /badge/i,
    /certificate/i,
    /award/i,
    /quote/i,
    /testimonial/i,
    /text[-_]image/i,
    /graphic[-_]text/i
  ];

  /**
   * Analyze alt text quality with confidence scoring
   */
  function analyzeAltTextQuality(alt, context = {}) {
    const issues = [];
    const trimmedAlt = alt.trim();
    
    // Check length
    if (trimmedAlt.length === 0) {
      return { issues, score: 100, isDecorative: true };
    }

    if (trimmedAlt.length > 150) {
      issues.push({
        type: 'too-long',
        confidence: 90,
        message: `Alt text is ${trimmedAlt.length} characters (recommended: <150)`
      });
    }

    if (trimmedAlt.length < 3 && !context.isDecorative) {
      issues.push({
        type: 'too-short',
        confidence: 85,
        message: 'Alt text suspiciously short (less than 3 characters)'
      });
    }

    // Check for poor patterns
    for (const { pattern, name, confidence } of POOR_ALT_PATTERNS) {
      if (pattern.test(trimmedAlt)) {
        issues.push({
          type: 'poor-pattern',
          pattern: name,
          confidence,
          message: `Alt text matches poor pattern: ${name}`
        });
        break; // Stop after first match — one poor pattern is enough
      }
    }

    // Check for single word (unless in product context)
    if (!context.isProduct && !/\s/.test(trimmedAlt) && trimmedAlt.length > 3) {
      issues.push({
        type: 'single-word',
        confidence: 60,
        message: 'Alt text is a single word (may lack context)'
      });
    }

    // Check for redundant "image of" prefixes
    if (/^(image|picture|photo|graphic)\s+(of|showing|depicting)/i.test(trimmedAlt)) {
      issues.push({
        type: 'redundant-prefix',
        confidence: 80,
        message: 'Alt text contains redundant "image of" type prefix'
      });
    }

    // Calculate quality score
    let score = 100;
    issues.forEach(issue => {
      score -= (issue.confidence * 0.2); // Each issue reduces score
    });

    return {
      issues,
      score: Math.max(0, Math.round(score)),
      isDecorative: false
    };
  }

  /**
   * Determine if image is likely decorative based on context
   */
  function isLikelyDecorative(img, alt) {
    const src = img.src || img.getAttribute('src') || '';
    const className = img.className || '';
    const role = img.getAttribute('role');
    
    // Explicit decorative markers
    if (role === 'presentation' || role === 'none') return true;
    if (alt === '') return true;
    
    // Check filename and classes for decorative indicators
    const combined = (src + ' ' + className + ' ' + alt).toLowerCase();
    return DECORATIVE_INDICATORS.some(indicator => combined.includes(indicator));
  }

  /**
   * Get image context (product, hero, etc.)
   */
  function getImageContext(img) {
    const context = {
      isProduct: false,
      isHero: false,
      isLogo: false,
      isIcon: false,
      inLink: false,
      linkText: '',
      inCarousel: false,
      inCard: false
    };

    // Check if in product context
    const productContainer = img.closest('[data-product], .product, [itemtype*="Product"]');
    if (productContainer) context.isProduct = true;

    // Check if in hero
    const heroContainer = img.closest('.hero, [class*="hero"], [class*="banner"]');
    if (heroContainer) context.isHero = true;

    // Check if logo
    const src = img.src || '';
    const alt = img.alt || '';
    if (/logo/i.test(src + alt)) context.isLogo = true;

    // Check if icon
    if (img.width < 50 && img.height < 50) context.isIcon = true;

    // Pattern D fix: Detect carousel and card context for linked images
    const carouselContainer = img.closest('[class*="carousel"], [class*="slider"], [class*="swiper"], [role="region"][aria-roledescription="carousel"]');
    if (carouselContainer) context.inCarousel = true;

    const cardContainer = img.closest('[class*="card"], article, [role="article"], [class*="product-item"]');
    if (cardContainer) context.inCard = true;

    // Check if in link
    const link = img.closest('a');
    if (link) {
      context.inLink = true;
      context.linkText = helpers.getVisibleText(link);
    }

    return context;
  }

  /**
   * Check for text-in-image patterns (WCAG 1.4.5)
   */
  function checkTextInImage(img) {
    const src = img.src || img.getAttribute('src') || '';
    const alt = img.alt || '';
    const className = img.className || '';
    
    const combined = src + ' ' + alt + ' ' + className;
    
    for (const pattern of TEXT_IMAGE_PATTERNS) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          pattern: pattern.source,
          confidence: 70,
          isException: /logo/i.test(combined) // Logos are allowed
        };
      }
    }
    
    return { detected: false };
  }

  /**
   * Audit all images on the page
   */
  async function runImagesAudit(options = {}) {
    console.warn('[DEPRECATED] runImagesAudit() is legacy. Use runPageStructureAudit() + runImagesOfTextAudit() from components/ instead.');
    const {
      skipHidden = true,
      includeBackgroundImages = false
    } = options;

    console.log('  Starting Images Audit...');
    const startTime = performance.now();

    const issues = [];
    const stats = {
      totalImages: 0,
      withAlt: 0,
      withoutAlt: 0,
      emptyAlt: 0,
      decorative: 0,
      poorQuality: 0,
      textInImage: 0
    };

    // Get all img elements
    const images = Array.from(document.querySelectorAll('img'));
    stats.totalImages = images.length;

    for (const img of images) {
      // Skip if hidden and skipHidden is true
      if (skipHidden && !helpers.isVisible(img)) continue;

      const src = img.src || img.getAttribute('src');
      if (!src) continue; // Skip images without src

      const alt = img.alt;
      const hasAlt = typeof alt === 'string';
      const context = getImageContext(img);
      const selector = helpers.getSelector(img);

      // WCAG 1.1.1: Missing alt attribute
      if (!hasAlt) {
        stats.withoutAlt++;
        issues.push({
          wcag: '1.1.1',
          level: 'A',
          category: 'images',
          severity: 'critical',
          element: 'img',
          selector,
          message: 'Image missing alt attribute',
          snippet: helpers.getElementSnippet(img),
          recommendation: 'Add alt attribute with descriptive text or empty string for decorative images'
        });
        continue;
      }

      stats.withAlt++;

      // Check if decorative
      const isDecorative = isLikelyDecorative(img, alt);
      if (isDecorative) {
        stats.decorative++;
        
        // Decorative images should have empty alt
        if (alt !== '') {
          issues.push({
            wcag: '1.1.1',
            level: 'A',
            category: 'images',
            severity: 'minor',
            element: 'img',
            selector,
            message: 'Decorative image has non-empty alt text',
            snippet: helpers.getElementSnippet(img),
            recommendation: 'Use alt="" for decorative images'
          });
        }
        continue;
      }

      if (alt === '') {
        stats.emptyAlt++;
        issues.push({
          wcag: '1.1.1',
          level: 'A',
          category: 'images',
          severity: 'critical',
          element: 'img',
          selector,
          message: 'Content image has empty alt text',
          snippet: helpers.getElementSnippet(img),
          recommendation: 'Provide descriptive alt text for content images'
        });
        continue;
      }

      // Analyze alt text quality
      const quality = analyzeAltTextQuality(alt, context);
      
      if (quality.issues.length > 0) {
        // Pattern D fix: Raise confidence threshold for images in carousels/cards
        // where surrounding content provides context
        const confidenceThreshold = (context.inCarousel || context.inCard) ? 90 : 80;
        const highConfidenceIssues = quality.issues.filter(i => i.confidence >= confidenceThreshold);

        if (highConfidenceIssues.length > 0) {
          stats.poorQuality++;
          issues.push({
            wcag: '1.1.1',
            level: 'A',
            category: 'images',
            severity: quality.score < 50 ? 'critical' : 'moderate',
            element: 'img',
            selector,
            message: `Poor quality alt text (score: ${quality.score}/100)`,
            details: highConfidenceIssues.map(i => i.message).join('; '),
            currentAlt: alt,
            snippet: helpers.getElementSnippet(img),
            recommendation: 'Provide clear, descriptive alt text that conveys the image purpose'
          });
        }
      }

      // Check for linked images without adequate description
      // Pattern D fix: In carousels/cards, surrounding text often provides context
      if (context.inLink) {
        const hasDescriptiveText = context.linkText && context.linkText.length > 2;
        if (!hasDescriptiveText && quality.score < 70) {
          // Check if card/carousel container has text that provides context
          const container = img.closest('[class*="card"], article, [class*="product"], [class*="slide"]');
          const containerText = container ? (container.textContent || '').trim() : '';
          const hasContainerContext = containerText.length > 10;

          if (hasContainerContext) {
            // Downgrade: container text provides context even if link itself is bare
            issues.push({
              wcag: '1.1.1',
              level: 'A',
              category: 'images',
              severity: 'moderate',
              element: 'a > img',
              selector,
              message: 'Linked image has minimal alt text but container provides context',
              currentAlt: alt,
              snippet: helpers.getElementSnippet(img.closest('a')),
              recommendation: 'Add descriptive alt text to the image, or ensure the link\'s accessible name includes the surrounding context'
            });
          } else {
            issues.push({
              wcag: '1.1.1',
              level: 'A',
              category: 'images',
              severity: 'critical',
              element: 'a > img',
              selector,
              message: 'Linked image lacks descriptive text',
              currentAlt: alt,
              snippet: helpers.getElementSnippet(img.closest('a')),
              recommendation: 'Ensure linked images have descriptive alt text or visible link text'
            });
          }
        }
      }

      // WCAG 1.4.5: Images of Text
      const textInImage = checkTextInImage(img);
      if (textInImage.detected && !textInImage.isException) {
        stats.textInImage++;
        issues.push({
          wcag: '1.4.5',
          level: 'AA',
          category: 'images',
          severity: 'moderate',
          element: 'img',
          selector,
          message: 'Possible text in image detected',
          details: `Pattern: ${textInImage.pattern} (confidence: ${textInImage.confidence}%)`,
          snippet: helpers.getElementSnippet(img),
          recommendation: 'Use actual text with CSS styling instead of images of text (unless logo or essential)'
        });
      }
    }

    // Check for background images if requested
    if (includeBackgroundImages) {
      const bgCheckStart = performance.now();
      const elementsWithBg = [];
      const bgAllEls = document.querySelectorAll('[style*="background"], [class*="bg-"], [class*="hero"], [class*="banner"], [class*="cover"], [class*="thumbnail"], div, section, article, header, footer, aside, figure, span');
      for (let i = 0; i < bgAllEls.length; i++) {
        if (i % 500 === 0 && performance.now() - bgCheckStart > 2000) break; // 2s timeout guard
        const bg = helpers.getStyle(bgAllEls[i]).backgroundImage;
        if (bg && bg !== 'none' && !bg.includes('gradient')) {
          elementsWithBg.push(bgAllEls[i]);
        }
      }

      for (const el of elementsWithBg) {
        if (skipHidden && !helpers.isVisible(el)) continue;

        const role = el.getAttribute('role');
        const ariaLabel = el.getAttribute('aria-label');
        const hasTextContent = helpers.getVisibleText(el).trim().length > 0;

        // If background image contains content and no accessible alternative
        if (!hasTextContent && !ariaLabel && role !== 'presentation') {
          const selector = helpers.getSelector(el);
          issues.push({
            wcag: '1.1.1',
            level: 'A',
            category: 'images',
            severity: 'moderate',
            element: el.tagName.toLowerCase(),
            selector,
            message: 'Background image may contain content without text alternative',
            snippet: helpers.getElementSnippet(el),
            recommendation: 'Provide aria-label or visible text for background images containing content'
          });
        }
      }
    }

    const duration = Math.round(performance.now() - startTime);

    // Deduplicate issues
    const deduplicatedIssues = helpers.deduplicateIssues(issues);

    console.log(` Images Audit complete in ${duration}ms`);
    console.log(`   Found ${deduplicatedIssues.length} issues across ${stats.totalImages} images`);

    return {
      summary: {
        category: 'Images',
        duration,
        issueCount: deduplicatedIssues.length,
        criticalCount: deduplicatedIssues.filter(i => i.severity === 'critical').length,
        stats
      },
      issues: deduplicatedIssues
    };
  }

  // Expose to global scope
  window.runImagesAudit = runImagesAudit;

})();
