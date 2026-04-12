/**
 * Reviews Accessibility Audit
 * WCAG: 1.1.1, 1.3.1, 2.4.1, 4.1.2, 4.1.3
 */

function runReviewsAudit() {
  'use strict';

  const startTime = performance.now();

  const CONFIG = {
    reviewSectionSelectors: [
      '[class*="yotpo"]', '.yotpo-main-widget', '.yotpo-reviews', '[data-yotpo]', '#yotpo-reviews',
      '[class*="jdgm"]', '.jdgm-widget', '.jdgm-review-widget', '[data-jdgm]',
      '[class*="stamped"]', '.stamped-main-widget', '.stamped-reviews', '[data-stamped]',
      '[class*="loox"]', '.loox-reviews',
      '[class*="trustpilot"]',
      '[class*="reviews"]', '[class*="review-section"]', '#reviews', '#product-reviews', '[id*="reviews"]'
    ],
    starRatingSelectors: [
      '[class*="star-rating"]', '[class*="stars"]', '[class*="rating"]',
      '[role="img"][aria-label*="star" i]', '[role="img"][aria-label*="rating" i]',
      '.yotpo-stars', '.jdgm-star', '.stamped-stars', 'svg[class*="star"]'
    ],
    reviewFormSelectors: [
      'form[class*="review"]', '.yotpo-write-review', '.jdgm-form', '.stamped-form',
      '[class*="review-form"]', '[id*="review-form"]'
    ],
    individualReviewSelectors: [
      '[class*="review-item"]', '[class*="review-card"]', '.yotpo-review', '.jdgm-rev',
      '.stamped-review', 'article[class*="review"]', '[itemprop="review"]'
    ]
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('reviews', 'Product reviews, star ratings, review forms (Yotpo, Judge.me, Stamped, etc.)');
  const { isVisible, getSelector, getAccessibleName: getName, getElementSnippet: getSnippet } = h;
  const addManual = addManualCheck;

  function getPlatform(el) {
    const c = (el.className || '').toLowerCase();
    const i = (el.id || '').toLowerCase();
    if (c.includes('yotpo') || i.includes('yotpo')) return 'Yotpo';
    if (c.includes('jdgm') || i.includes('jdgm')) return 'Judge.me';
    if (c.includes('stamped') || i.includes('stamped')) return 'Stamped';
    if (c.includes('loox') || i.includes('loox')) return 'Loox';
    if (c.includes('trustpilot')) return 'Trustpilot';
    return 'Native/Custom';
  }

  function findElements(selectors) {
    const found = new Set();
    selectors.forEach(sel => {
      try { document.querySelectorAll(sel).forEach(el => found.add(el)); } catch (e) {}
    });
    return Array.from(found).filter(isVisible);
  }

  const allSections = findElements(CONFIG.reviewSectionSelectors);
  const allRatings = findElements(CONFIG.starRatingSelectors);
  const allReviews = findElements(CONFIG.individualReviewSelectors);
  const allForms = findElements(CONFIG.reviewFormSelectors);

  function testStarRating(rating) {
    results.stats.elementsScanned++;
    const platform = getPlatform(rating);
    const label = rating.getAttribute('aria-label');
    const alt = rating.getAttribute('alt');
    const title = rating.getAttribute('title');
    const sr = rating.querySelector('.sr-only, .visually-hidden, [class*="screen-reader"]');
    const srText = sr ? sr.textContent.trim() : '';
    const hasValue = label || alt || srText || title;

    if (!hasValue) {
      addIssue('critical', '1.1.1', 'Non-text Content', `Star rating (${platform}) has no accessible value`, rating, 'Add aria-label="4 out of 5 stars"', 'Screen readers cannot perceive rating');
    } else {
      const val = label || alt || srText || title;
      if (!val.match(/\d+(\.\d+)?\s*(out\s+of\s+\d+|stars?|\/\s*\d)/i)) {
        addIssue('serious', '1.1.1', 'Non-text Content', `Star rating "${val.slice(0, 30)}" missing numeric value`, rating, 'Include rating like "4 out of 5 stars"');
      } else {
        addPassed('1.1.1', 'Non-text Content', `Rating: "${val.slice(0, 40)}"`, getSelector(rating));
      }
    }

    const role = rating.getAttribute('role');
    if (!role && rating.querySelector('svg, span, i')) {
      addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Star rating missing role="img"', rating, 'Add role="img" with aria-label');
    }

    const stars = rating.querySelectorAll('svg, span[class*="star"], i[class*="star"]');
    let hasIndividual = false;
    stars.forEach(s => {
      if (s.getAttribute('aria-label') && s.getAttribute('aria-hidden') !== 'true') hasIndividual = true;
    });
    if (hasIndividual) {
      addIssue('moderate', '1.1.1', 'Non-text Content', 'Individual stars have labels - verbose', rating, 'Add aria-hidden="true" to individual stars');
    }
  }

  function testReviewSection(section) {
    results.stats.elementsScanned++;
    const platform = getPlatform(section);
    const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
    const label = section.getAttribute('aria-label');
    const labelledby = section.getAttribute('aria-labelledby');

    if (!heading && !label && !labelledby) {
      addIssue('moderate', '1.3.1', 'Info and Relationships', `Review section (${platform}) has no heading`, section, 'Add heading like <h2>Customer Reviews</h2>');
    } else {
      const name = heading ? heading.textContent.trim() : (label || 'labeled');
      addPassed('1.3.1', 'Info and Relationships', `Section: "${name.slice(0, 30)}"`, getSelector(section));
    }

    const iframe = section.querySelector('iframe');
    if (iframe) {
      if (!iframe.getAttribute('title')) {
        addIssue('serious', '4.1.2', 'Name, Role, Value', `${platform} iframe missing title`, iframe, 'Add title="Customer reviews"');
      }
      addManual('4.1.2', `${platform} iframe needs manual testing`, 'Test reviews inside iframe with screen reader', getSelector(section));
    }
  }

  function testIndividualReview(review) {
    results.stats.elementsScanned++;
    const platform = getPlatform(review);
    const hasAuthor = review.querySelector('[class*="author"], [class*="name"], [itemprop="author"]');
    if (!hasAuthor) {
      addIssue('minor', '1.3.1', 'Info and Relationships', 'Review missing author element', review, 'Mark author with semantic element');
    }

    const reviewRating = review.querySelector('[class*="star"], [class*="rating"]');
    if (reviewRating && !getName(reviewRating)) {
      addIssue('moderate', '1.1.1', 'Non-text Content', `Review rating (${platform}) not accessible`, reviewRating, 'Add aria-label with rating value');
    }

    const helpfulBtn = review.querySelector('button[class*="helpful"], [class*="vote"]');
    if (helpfulBtn && !getName(helpfulBtn)) {
      addIssue('moderate', '4.1.2', 'Name, Role, Value', 'Helpful button has no name', helpfulBtn, 'Add aria-label="Mark as helpful"');
    }
  }

  function testReviewForm(form) {
    results.stats.elementsScanned++;
    const platform = getPlatform(form);
    const inputs = form.querySelectorAll('input:not([type="hidden"]), textarea, select');

    inputs.forEach(input => {
      results.stats.elementsScanned++;
      const id = input.id;
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      const al = input.getAttribute('aria-label');
      const ph = input.getAttribute('placeholder');

      if (!label && !al) {
        if (ph) {
          addIssue('serious', '3.3.2', 'Labels or Instructions', `${platform} input uses placeholder only: "${ph.slice(0, 30)}"`, input, 'Add visible label');
        } else {
          addIssue('critical', '3.3.2', 'Labels or Instructions', `${platform} input has no label`, input, 'Add <label> or aria-label');
        }
      }
    });

    const ratingInput = form.querySelector('[class*="rating-input"], [class*="star-input"]');
    if (ratingInput) {
      const radios = form.querySelectorAll('input[type="radio"][name*="rating"]');
      if (radios.length > 0) {
        let unlabeled = 0;
        radios.forEach(r => {
          const rl = document.querySelector(`label[for="${r.id}"]`);
          if (!rl && !r.getAttribute('aria-label')) unlabeled++;
        });
        if (unlabeled > 0) {
          addIssue('serious', '3.3.2', 'Labels or Instructions', `${unlabeled} star options have no labels`, ratingInput, 'Add labels like "1 star", "2 stars"');
        }
      } else {
        addManual('4.1.2', `Verify ${platform} star selector is keyboard accessible`, 'Try selecting rating with keyboard only', getSelector(ratingInput));
      }
    }

    addManual('4.1.3', `Verify ${platform} form errors are announced`, 'Submit with errors, verify screen reader announces them', getSelector(form));
  }

  if (allSections.length === 0 && allRatings.length === 0) {
    results.manualChecks.push({ wcag: '1.1.1', message: 'No reviews detected', howToTest: 'Check if reviews load asynchronously' });
  } else {
    allRatings.forEach(r => testStarRating(r));
    allSections.forEach(s => testReviewSection(s));
    allReviews.slice(0, 5).forEach(r => testIndividualReview(r));
    if (allReviews.length > 5) {
      addManual('1.3.1', `${allReviews.length - 5} more reviews not tested`, 'Verify remaining reviews follow same pattern', null);
    }
    allForms.forEach(f => testReviewForm(f));

    const platforms = new Set();
    allSections.forEach(s => platforms.add(getPlatform(s)));
    platforms.forEach(p => {
      if (p !== 'Native/Custom') {
        addManual('4.1.2', `Third-party reviews (${p}) require manual verification`, `${p} widgets have limited customization - test with screen reader`, null);
      }
    });
  }

  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

if (typeof window !== 'undefined') {
  window.runReviewsAudit = runReviewsAudit;
}
