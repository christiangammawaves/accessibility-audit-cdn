/**
 * @module wcag22-audit
 * Tests WCAG 2.2 specific criteria (2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8, and AAA).
 */

(function(global) {
  'use strict';

  function auditWCAG22(options = {}) {
    if (!window.a11yHelpers) throw new Error('[wcag22-audit] shared-helpers.js must be loaded first — check injection order');

    const config = {
      targetSizeMinimum: options.targetSizeMinimum ?? 24,  // WCAG 2.5.8 minimum
      targetSizeEnhanced: options.targetSizeEnhanced ?? 44, // AAA target
      level: options.level ?? 'AA', // 'AA' or 'AAA'
      ...options
    };

    const startTime = performance.now();
    
    const results = {
      meta: {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        auditType: 'wcag-2.2-specific',
        auditVersion: (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown',
        wcagVersion: '2.2',
        level: config.level
      },
      summary: {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        total: 0,
        passed: 0,
        needsManualReview: 0
      },
      criteria: [],
      issues: [],
      manualChecks: []
    };

    const getSelector = (el) => window.a11yHelpers.getSelector(el);
    const isVisible = (el) => window.a11yHelpers.isVisible(el);

    function addIssue(severity, criterion, message, element, fix) {
      results.issues.push({
        severity,
        wcag: criterion,
        criterion,
        message,
        selector: element ? getSelector(element) : null,
        fix,
        category: 'wcag-2.2',
        source: 'wcag22-audit'
      });
      results.summary[severity]++;
      results.summary.total++;
    }

    function addManualCheck(criterion, description, elements = [], priority = 'medium') {
      results.manualChecks.push({
        wcag: criterion,
        criterion,
        description,
        elementCount: elements.length,
        selectors: elements.slice(0, 5).map(e => getSelector(e)),
        priority,
        source: 'wcag22-audit'
      });
      results.summary.needsManualReview++;
    }

    // WCAG 2.4.11 Focus Not Obscured (Minimum) - Level AA

    function testFocusNotObscured() {
      const criterion = {
        id: '2.4.11',
        name: 'Focus Not Obscured (Minimum)',
        level: 'AA',
        status: 'needs-review',
        findings: []
      };

      const stickyElements = [];
      
      const stickyCheckStart = performance.now();
      const stickyAllEls = document.querySelectorAll('[style*="position"], header, nav, footer, [class*="sticky"], [class*="fixed"]');
      for (let i = 0; i < stickyAllEls.length; i++) {
        if (i % 500 === 0 && performance.now() - stickyCheckStart > 2000) break; // 2s timeout guard
        const el = stickyAllEls[i];
        const style = window.getComputedStyle(el);
        if ((style.position === 'fixed' || style.position === 'sticky') && isVisible(el)) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 30) {
            stickyElements.push({
              element: el,
              selector: getSelector(el),
              position: style.position,
              rect: {
                top: Math.round(rect.top),
                bottom: Math.round(rect.bottom),
                height: Math.round(rect.height)
              }
            });
          }
        }
      }

      if (stickyElements.length > 0) {
        criterion.findings.push({
          note: 'Sticky/fixed elements detected that could obscure focus',
          count: stickyElements.length,
          elements: stickyElements.slice(0, 5).map(s => s.selector)
        });

        // A4: Always flag when sticky/fixed elements exist — WCAG 2.4.11 has no percentage threshold
        addIssue('serious', '2.4.11',
          'Sticky/fixed elements may obscure focused content',
          stickyElements[0].element,
          'Ensure focused elements scroll into visible area or are not hidden behind sticky headers/footers');

        addManualCheck('2.4.11', 
          'Tab through page and verify focused elements are not fully hidden behind sticky headers/footers',
          stickyElements.map(s => s.element), 'high');
      } else {
        criterion.status = 'passed';
        criterion.findings.push({ note: 'No significant sticky/fixed elements detected' });
        results.summary.passed++;
      }

      results.criteria.push(criterion);
    }

    // WCAG 2.5.7 Dragging Movements - Level AA

    function testDraggingMovements() {
      const criterion = {
        id: '2.5.7',
        name: 'Dragging Movements',
        level: 'AA',
        status: 'needs-review',
        findings: []
      };

      const dragPatterns = [
        // Native draggable
        ...document.querySelectorAll('[draggable="true"]'),
        // Common drag-and-drop class patterns
        ...document.querySelectorAll('[class*="draggable"], [class*="sortable"], [class*="drag-handle"], [class*="drag-drop"]'),
        // Range sliders
        ...document.querySelectorAll('input[type="range"], [role="slider"]'),
        // Custom sliders/carousels with drag
        ...document.querySelectorAll('[class*="slider"]:not(input), [class*="carousel"], [class*="swiper"]'),
        // Drag-to-reorder patterns
        ...document.querySelectorAll('[class*="reorder"], [class*="dnd"]')
      ];

      const uniqueDragElements = [...new Set(dragPatterns)].filter(el => isVisible(el));

      if (uniqueDragElements.length > 0) {
        uniqueDragElements.forEach(element => {
          // Check for single-pointer alternatives
          const hasButtons = element.querySelector('button, [role="button"]');
          const hasKeyboardAlt = element.hasAttribute('data-keyboard-alternative') ||
                                element.closest('[data-keyboard-alternative]');
          const isNativeSlider = element.type === 'range';
          
          if (!hasButtons && !hasKeyboardAlt && !isNativeSlider) {
            criterion.findings.push({
              element: getSelector(element),
              issue: 'Draggable element may lack single-pointer alternative',
              type: element.getAttribute('class')?.match(/drag|sort|slider|carousel/i)?.[0] || 'draggable'
            });

            addIssue('moderate', '2.5.7', 
              'Draggable element may not have single-pointer alternative',
              element,
              'Provide buttons, keyboard controls, or other single-point activation method');
          }
        });

        addManualCheck('2.5.7', 
          'Verify all drag operations have single-pointer alternatives (buttons, taps, keyboard)',
          uniqueDragElements, 'high');
      } else {
        criterion.status = 'passed';
        criterion.findings.push({ note: 'No draggable elements detected' });
        results.summary.passed++;
      }

      results.criteria.push(criterion);
    }

    // WCAG 2.5.8 Target Size (Minimum) - Level AA

    function testTargetSize() {
      const criterion = {
        id: '2.5.8',
        name: 'Target Size (Minimum)',
        level: 'AA',
        status: 'checking',
        findings: [],
        stats: { total: 0, passing: 0, failing: 0, exempt: 0, spacingPass: 0 }
      };

      const minSize = config.targetSizeMinimum; // 24px for AA

      const targets = document.querySelectorAll(
        'a[href], button, input[type="button"], input[type="submit"], input[type="checkbox"], ' +
        'input[type="radio"], input[type="file"], select, ' +
        '[role="button"], [role="link"], [role="checkbox"], [role="radio"], ' +
        '[role="menuitem"], [role="tab"], [role="switch"], ' +
        '[onclick], [tabindex="0"]'
      );

      const undersizedTargets = [];
      const targetRects = []; // Store rects for spacing calculation

      targets.forEach(target => {
        if (!isVisible(target)) return;
        const rect = target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          targetRects.push({ element: target, rect });
        }
      });

      // P5: Sort by centerX so inner loop can exit early once X-distance exceeds 2×minSize
      targetRects.sort((a, b) => (a.rect.left + a.rect.width / 2) - (b.rect.left + b.rect.width / 2));

      // WCAG 2.5.8 spacing exemption: 24px circles centered on undersized targets must not intersect
      function checkSpacingExemption(rect, index) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const circleRadius = minSize / 2; // 12px for 24px circle

        const maxXSeparation = minSize * 2; // 48px — circles can't interact beyond this X gap
        for (let i = 0; i < targetRects.length; i++) {
          if (i === index) continue;

          const otherRect = targetRects[i].rect;
          const otherCenterX = otherRect.left + otherRect.width / 2;
          const otherCenterY = otherRect.top + otherRect.height / 2;

          // P5: Early exits using sorted X order to skip irrelevant targets
          if (otherCenterX - centerX > maxXSeparation) break;   // sorted: all subsequent too far right
          if (centerX - otherCenterX > maxXSeparation) continue; // before window; keep scanning
          if (Math.abs(otherCenterY - centerY) > maxXSeparation) continue; // too far vertically

          // Calculate distance between centers
          const dx = centerX - otherCenterX;
          const dy = centerY - otherCenterY;
          const distanceBetweenCenters = Math.sqrt(dx * dx + dy * dy);
          
          const otherIsUndersized = otherRect.width < minSize || otherRect.height < minSize;
          
          if (otherIsUndersized) {
            if (distanceBetweenCenters < minSize) {
              return { passes: false, reason: 'circles-intersect', conflictWith: i };
            }
          } else {
            // Closest point on otherRect to our center
            const closestX = Math.max(otherRect.left, Math.min(centerX, otherRect.right));
            const closestY = Math.max(otherRect.top, Math.min(centerY, otherRect.bottom));
            
            const distToClosest = Math.sqrt(
              Math.pow(centerX - closestX, 2) + Math.pow(centerY - closestY, 2)
            );
            
            if (distToClosest < circleRadius) {
              return { passes: false, reason: 'circle-overlaps-target', conflictWith: i };
            }
          }
        }
        
        return { passes: true };
      }

      targetRects.forEach((item, index) => {
        const { element: target, rect } = item;
        criterion.stats.total++;
        
        // WCAG 2.5.8 exemptions: inline, UA-controlled, essential, equivalent
        const isInlineLink = target.tagName === 'A' && 
          target.closest('p, li, td, span, label') &&
          !target.closest('nav, header, footer, [role="navigation"]');
        
        const isUserAgentControlled = (target.tagName === 'INPUT' && 
          ['checkbox', 'radio'].includes(target.type)) &&
          !target.classList.length && // No custom styling
          !target.getAttribute('style');
        
        const isEssential = target.hasAttribute('data-essential-size');
        
        if (isInlineLink || isUserAgentControlled || isEssential) {
          criterion.stats.exempt++;
          return;
        }

        const width = rect.width;
        const height = rect.height;

        if (width >= minSize && height >= minSize) {
          criterion.stats.passing++;
          return;
        }

        const spacingCheck = checkSpacingExemption(rect, index);
        
        if (spacingCheck.passes) {
          criterion.stats.spacingPass++;
          criterion.stats.passing++;
          return;
        }

        criterion.stats.failing++;
        
        const severity = (width < 20 || height < 20) ? 'serious' : 'moderate';
        
        undersizedTargets.push({
          selector: getSelector(target),
          size: `${Math.round(width)}x${Math.round(height)}px`,
          tagName: target.tagName.toLowerCase(),
          failReason: spacingCheck.reason
        });

        const conflictNote = spacingCheck.conflictWith !== undefined 
          ? ` (conflicts with nearby target)` 
          : '';

        addIssue(severity, '2.5.8',
          `Target too small (${Math.round(width)}x${Math.round(height)}px, minimum ${minSize}px)${conflictNote}`,
          target,
          `Increase clickable area to at least ${minSize}x${minSize}px using padding/min-width/min-height, OR add ${minSize}px spacing from other interactive elements`);
      });

      criterion.status = criterion.stats.failing > 0 ? 'failed' : 'passed';
      
      if (criterion.stats.failing === 0) {
        results.summary.passed++;
      }

      criterion.findings.push({
        note: `Checked ${criterion.stats.total} targets: ${criterion.stats.passing} passing (${criterion.stats.spacingPass} via spacing), ${criterion.stats.failing} failing, ${criterion.stats.exempt} exempt`
      });

      results.criteria.push(criterion);
    }

    // WCAG 3.2.6 Consistent Help - Level A

    function testConsistentHelp() {
      const criterion = {
        id: '3.2.6',
        name: 'Consistent Help',
        level: 'A',
        status: 'needs-review',
        findings: []
      };

      const helpPatterns = {
        contactPage: document.querySelectorAll('a[href*="contact"], a[href*="support"]'),
        chatWidget: document.querySelectorAll(
          '[class*="chat"], [class*="messenger"], [class*="intercom"], ' +
          '[class*="zendesk"], [class*="livechat"], [aria-label*="chat" i]'
        ),
        helpLink: document.querySelectorAll('a[href*="help"], a[href*="faq"]'),
        phoneNumber: document.querySelectorAll('a[href^="tel:"]'),
        emailLink: document.querySelectorAll('a[href^="mailto:"][href*="support"], a[href^="mailto:"][href*="help"]'),
        helpButton: document.querySelectorAll('[class*="help"]:is(button, [role="button"])')
      };

      const foundMechanisms = [];
      let totalHelpElements = 0;

      Object.entries(helpPatterns).forEach(([type, elements]) => {
        const visibleElements = Array.from(elements).filter(isVisible);
        if (visibleElements.length > 0) {
          foundMechanisms.push({
            type,
            count: visibleElements.length,
            selectors: visibleElements.slice(0, 3).map(e => getSelector(e))
          });
          totalHelpElements += visibleElements.length;
        }
      });

      if (foundMechanisms.length > 0) {
        criterion.findings.push({
          note: 'Help mechanisms detected',
          mechanisms: foundMechanisms
        });
        criterion.status = 'needs-review';

        addManualCheck('3.2.6',
          'Verify help mechanisms appear in consistent location across all pages (if help is provided on multiple pages)',
          [], 'medium');
      } else {
        criterion.findings.push({
          note: 'No standard help mechanisms detected - verify if help is needed for this page type'
        });
      }

      results.criteria.push(criterion);
    }

    // WCAG 3.3.7 Redundant Entry - Level A

    function testRedundantEntry() {
      const criterion = {
        id: '3.3.7',
        name: 'Redundant Entry',
        level: 'A',
        status: 'needs-review',
        findings: []
      };

      const hasShippingAddress = document.querySelector(
        '[name*="shipping"], [id*="shipping"], [class*="shipping-address"]'
      );
      const hasBillingAddress = document.querySelector(
        '[name*="billing"], [id*="billing"], [class*="billing-address"]'
      );

      if (hasShippingAddress && hasBillingAddress) {
        const sameAsOption = document.querySelector(
          '[name*="same"], [id*="same-as"], [class*="same-as"], ' +
          'input[type="checkbox"][id*="billing"], ' +
          'label[for*="same"], label:has(input[type="checkbox"])'
        );

        const labels = document.querySelectorAll('label');
        let hasSameAsText = false;
        labels.forEach(label => {
          if (/same\s*(as|address)|use\s*shipping|copy\s*from/i.test(label.textContent)) {
            hasSameAsText = true;
          }
        });

        if (!sameAsOption && !hasSameAsText) {
          addIssue('moderate', '3.3.7',
            'Checkout has shipping and billing addresses without "same as" option',
            hasBillingAddress,
            'Add checkbox to copy shipping address to billing address');
          
          criterion.findings.push({
            issue: 'Missing "same as shipping" option for billing address'
          });
        } else {
          criterion.findings.push({
            note: 'Same-as-shipping option detected for billing address'
          });
          results.summary.passed++;
        }
      }

      const formSteps = document.querySelectorAll(
        '[class*="step"], [class*="wizard"], [data-step], ' +
        '[class*="checkout-step"], [class*="progress-step"]'
      );
      
      if (formSteps.length > 1) {
        addManualCheck('3.3.7',
          'Verify multi-step process does not require re-entering previously submitted information',
          Array.from(formSteps), 'medium');
      }

      results.criteria.push(criterion);
    }

    // WCAG 3.3.8 Accessible Authentication (Minimum) - Level AA

    function testAccessibleAuthentication() {
      const criterion = {
        id: '3.3.8',
        name: 'Accessible Authentication (Minimum)',
        level: 'AA',
        status: 'needs-review',
        findings: []
      };

      // Authentication forms
      const authFormPatterns = [
        'form[action*="login"]', 'form[action*="signin"]', 'form[action*="sign-in"]',
        'form[action*="auth"]', 'form[action*="session"]',
        'form[class*="login"]', 'form[class*="signin"]', 'form[class*="auth"]',
        'form[id*="login"]', 'form[id*="signin"]', 'form[id*="auth"]',
        '[class*="login-form"]', '[class*="signin-form"]', '[class*="auth-form"]',
        '[data-testid*="login"]', '[data-testid*="signin"]'
      ];
      
      let authForm = null;
      for (const selector of authFormPatterns) {
        authForm = document.querySelector(selector);
        if (authForm) break;
      }

      // Password fields
      const passwordFields = document.querySelectorAll('input[type="password"]');
      
      if (passwordFields.length > 0) {
        passwordFields.forEach((field, index) => {
          const fieldLabel = field.getAttribute('aria-label') || 
                            field.getAttribute('placeholder') || 
                            `Password field ${index + 1}`;

          const autocomplete = field.getAttribute('autocomplete');
          const validAutocomplete = ['current-password', 'new-password', 'one-time-code'];
          
          if (!autocomplete) {
            addIssue('moderate', '3.3.8',
              `Password field missing autocomplete attribute: "${fieldLabel}"`,
              field,
              'Add autocomplete="current-password" for login or autocomplete="new-password" for registration to support password managers');
          } else if (!validAutocomplete.includes(autocomplete) && autocomplete !== 'off') {
            addIssue('minor', '3.3.8',
              `Password field has non-standard autocomplete value: "${autocomplete}"`,
              field,
              'Use autocomplete="current-password" or autocomplete="new-password"');
          }

          const onpasteAttr = field.getAttribute('onpaste');
          if (onpasteAttr && (onpasteAttr.includes('return false') || 
                              onpasteAttr.includes('preventDefault') ||
                              onpasteAttr.includes('return;'))) {
            addIssue('serious', '3.3.8',
              'Password field blocks pasting via onpaste attribute',
              field,
              'Remove onpaste handler to allow password manager use');
          }

          const form = field.closest('form');
          if (form) {
            const formHtml = form.outerHTML.toLowerCase();
            if (formHtml.includes('paste') && 
                (formHtml.includes('preventdefault') || formHtml.includes('return false'))) {
              criterion.findings.push({
                warning: 'Form may contain paste-blocking JavaScript',
                selector: getSelector(form)
              });
            }
          }

          const fieldName = (field.name || field.id || '').toLowerCase();
          if (fieldName.includes('confirm') || fieldName.includes('verify') || fieldName.includes('retype')) {
            addIssue('moderate', '3.3.8',
              'Password confirmation field may block pasting',
              field,
              'Allow paste on confirmation fields to support password managers');
          }
        });

        criterion.findings.push({
          note: `Found ${passwordFields.length} password field(s)`
        });
      }

      // CAPTCHA
      const captchaSelectors = [
        '[class*="captcha"]', '[class*="recaptcha"]', '[id*="captcha"]',
        'iframe[src*="captcha"]', 'iframe[src*="recaptcha"]', 'iframe[src*="hcaptcha"]',
        '[class*="hcaptcha"]', '[data-sitekey]', '[class*="g-recaptcha"]',
        '[class*="cf-turnstile"]', 'iframe[src*="turnstile"]',
        '[class*="arkose"]', 'iframe[src*="arkose"]'
      ];

      const captchas = [];
      captchaSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (isVisible(el) && !captchas.includes(el)) {
            captchas.push(el);
          }
        });
      });

      if (captchas.length > 0) {
        criterion.findings.push({
          note: `Found ${captchas.length} CAPTCHA element(s)`,
          selectors: captchas.slice(0, 3).map(e => getSelector(e))
        });

          const hasAudioAlt = document.querySelector(
          '[class*="captcha"] audio, [aria-label*="audio" i], button[class*="audio"]'
        );

        if (!hasAudioAlt) {
          addIssue('critical', '3.3.8',
            'CAPTCHA detected without visible audio alternative',
            captchas[0],
            'Ensure CAPTCHA has audio alternative or contact support option');
        }

        addManualCheck('3.3.8',
          'Verify CAPTCHA has accessible alternative (audio option, support contact, or uses recognition instead of transcription)',
          captchas, 'high');
      }

      // Security questions
      const securityQuestionSelectors = [
        'select[name*="security"]', 'select[id*="security"]',
        '[class*="security-question"]', '[id*="security-question"]',
        'label[for*="security"]', 'select[name*="question"]'
      ];

      const securityQuestions = [];
      securityQuestionSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (isVisible(el)) securityQuestions.push(el);
        });
      });

      if (securityQuestions.length > 0) {
        addIssue('critical', '3.3.8',
          'Security questions require users to recall memorized information',
          securityQuestions[0],
          'Provide alternative authentication that does not require transcription or recall');
        
        criterion.findings.push({
          issue: 'Security questions detected',
          count: securityQuestions.length
        });
      }

      // Puzzle/slider/drag verification
      const puzzleSelectors = [
        '[class*="puzzle"]', '[class*="slider-verify"]', '[class*="slide-to"]',
        '[class*="drag-verify"]', '[class*="slider-captcha"]',
        '[class*="jigsaw"]', '[class*="image-verify"]',
        '[class*="rotate-verify"]', '[class*="click-verify"]'
      ];

      const puzzles = [];
      puzzleSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (isVisible(el)) puzzles.push(el);
        });
      });

      if (puzzles.length > 0) {
        addIssue('critical', '3.3.8',
          'Puzzle/slider verification requires cognitive function test',
          puzzles[0],
          'Provide alternative that does not require cognitive problem-solving');
        
        criterion.findings.push({
          issue: 'Puzzle verification detected',
          count: puzzles.length
        });
      }

      // Username/email autocomplete
      const usernameFields = document.querySelectorAll(
        'input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"], ' +
        'input[type="text"][id*="user"], input[type="text"][id*="email"], ' +
        'input[autocomplete="username"], input[autocomplete="email"]'
      );

      usernameFields.forEach(field => {
        const autocomplete = field.getAttribute('autocomplete');
        if (autocomplete === 'off' || autocomplete === 'false') {
          addIssue('moderate', '3.3.8',
            'Username/email field disables autocomplete',
            field,
            'Remove autocomplete="off" to allow browser autofill and password managers');
        }
      });

      // Passkey/WebAuthn detection
      const hasPasskeySupport = document.querySelector(
        '[class*="passkey"], [class*="webauthn"], [data-passkey], button[class*="biometric"], [aria-label*="passkey" i]'
      );

      if (hasPasskeySupport) {
        criterion.findings.push({
          positive: 'Passkey/WebAuthn support detected',
          note: 'Good - passwordless authentication supports accessibility'
        });
      }

      // Status
      if (results.issues.some(i => i.wcag === '3.3.8' && i.severity === 'critical')) {
        criterion.status = 'failed';
      } else if (results.issues.some(i => i.wcag === '3.3.8')) {
        criterion.status = 'needs-attention';
      } else if (passwordFields.length === 0 && captchas.length === 0) {
        criterion.status = 'not-applicable';
        criterion.findings.push({ note: 'No authentication elements detected on this page' });
      }

      results.criteria.push(criterion);
    }

    // Run all WCAG 2.2 tests

    testFocusNotObscured();
    testDraggingMovements();
    testTargetSize();
    testConsistentHelp();
    testRedundantEntry();
    testAccessibleAuthentication();

    // AAA level tests (if requested)

    if (config.level === 'AAA') {
      // 2.4.12 Focus Not Obscured (Enhanced) - AAA
      // Stricter than 2.4.11 - focused element must be FULLY visible
      const criterion2412 = {
        id: '2.4.12',
        name: 'Focus Not Obscured (Enhanced)',
        level: 'AAA',
        status: 'needs-review',
        findings: [{
          note: 'AAA criterion requires focused elements to be fully visible (not just partially)'
        }]
      };
      
      addManualCheck('2.4.12',
        'Tab through all interactive elements and verify each focused element is FULLY visible (no part obscured)',
        [], 'high');
      
      results.criteria.push(criterion2412);

      // 2.4.13 Focus Appearance - AAA
      const criterion2413 = {
        id: '2.4.13',
        name: 'Focus Appearance',
        level: 'AAA',
        status: 'needs-review',
        findings: [{
          note: 'Focus indicator must be at least 2px solid outline OR have area >= perimeter of element'
        }]
      };
      
      addManualCheck('2.4.13',
        'Verify focus indicators meet enhanced requirements: 2px+ outline with 3:1 contrast OR equivalent area coverage',
        [], 'high');
      
      results.criteria.push(criterion2413);

      // 3.3.9 Accessible Authentication (Enhanced) - AAA
      const criterion339 = {
        id: '3.3.9',
        name: 'Accessible Authentication (Enhanced)',
        level: 'AAA',
        status: 'needs-review',
        findings: [{
          note: 'No cognitive function test allowed for authentication (stricter than AA)'
        }]
      };
      
      addManualCheck('3.3.9',
        'Verify authentication does not require any cognitive test (including object recognition)',
        [], 'high');
      
      results.criteria.push(criterion339);
    }

    // WCAG 2.5.1 Pointer Gestures - Level A

    function testPointerGestures() {
      const criterion = {
        id: '2.5.1',
        name: 'Pointer Gestures',
        level: 'A',
        status: 'checking',
        findings: [],
        stats: { checked: 0, issues: 0 }
      };

      const gestureIndicators = {
          hammerjs: document.querySelector('[class*="hammer"]'),
        touchSwipe: document.querySelector('[class*="swipe"]'),
        pinchZoom: document.querySelector('[class*="pinch"], [class*="zoom-gesture"]'),
        
        maps: document.querySelectorAll('[class*="map"], #map, .mapboxgl-map, .gm-style, .leaflet-container'),
        
        carousels: document.querySelectorAll('.swiper, .slick-slider, [class*="carousel"][class*="touch"]'),
        
        imageViewers: document.querySelectorAll('[class*="lightbox"], [class*="gallery-zoom"], [class*="image-viewer"]')
      };

      if (gestureIndicators.maps.length > 0) {
        gestureIndicators.maps.forEach(map => {
          if (!isVisible(map)) return;
          criterion.stats.checked++;
          
          const hasZoomButtons = map.querySelector(
            '[class*="zoom-in"], [class*="zoom-out"], [aria-label*="zoom" i], ' +
            '.mapboxgl-ctrl-zoom-in, .gm-control-active, .leaflet-control-zoom'
          );
          
          if (!hasZoomButtons) {
            criterion.stats.issues++;
            addIssue('serious', '2.5.1',
              'Map may require pinch gesture for zoom without button alternative',
              map,
              'Provide zoom in/out buttons as alternative to pinch-to-zoom gesture');
          } else {
            criterion.findings.push({ positive: 'Map has zoom button controls', selector: getSelector(map) });
          }
        });
      }

      if (gestureIndicators.carousels.length > 0) {
        gestureIndicators.carousels.forEach(carousel => {
          if (!isVisible(carousel)) return;
          criterion.stats.checked++;
          
          const hasNavButtons = carousel.querySelector(
            '[class*="prev"], [class*="next"], [class*="arrow"], ' +
            '[aria-label*="previous" i], [aria-label*="next" i], ' +
            'button[class*="nav"], .swiper-button-prev, .swiper-button-next, .slick-arrow'
          );
          
          if (!hasNavButtons) {
            criterion.stats.issues++;
            addIssue('moderate', '2.5.1',
              'Carousel may require swipe gesture without button navigation',
              carousel,
              'Provide previous/next buttons as alternative to swipe gesture');
          }
        });
      }

      if (typeof Hammer !== 'undefined' || document.querySelector('[data-hammer], [data-gesture]')) {
        addManualCheck('2.5.1',
          'Gesture library detected - verify all multi-point/path gestures have single-pointer alternatives',
          [], 'high');
      }

      criterion.status = criterion.stats.issues > 0 ? 'needs-attention' : 
                         criterion.stats.checked === 0 ? 'not-applicable' : 'passed';
      
      if (criterion.stats.checked === 0) {
        criterion.findings.push({ note: 'No gesture-based components detected' });
      }

      results.criteria.push(criterion);
    }

    // WCAG 2.5.2 Pointer Cancellation - Level A

    function testPointerCancellation() {
      const criterion = {
        id: '2.5.2',
        name: 'Pointer Cancellation',
        level: 'A',
        status: 'checking',
        findings: [],
        stats: { mousedownOnly: 0, touchstartOnly: 0 }
      };

      const allInteractive = document.querySelectorAll(
        'button, a[href], [role="button"], [role="link"], [onclick], [tabindex="0"]'
      );

      allInteractive.forEach(element => {
        if (!isVisible(element)) return;
        
        const hasMousedown = element.hasAttribute('onmousedown') || 
                            element.getAttribute('data-mousedown');
        const hasClick = element.hasAttribute('onclick') || 
                        element.getAttribute('href');
        
        if (hasMousedown && !hasClick) {
          criterion.stats.mousedownOnly++;
          
          if (criterion.stats.mousedownOnly <= 3) { // Limit issues reported
            addIssue('moderate', '2.5.2',
              'Element uses mousedown event which may not allow cancellation',
              element,
              'Use click/mouseup event instead of mousedown to allow pointer cancellation');
          }
        }
      });

      const touchstartElements = document.querySelectorAll('[ontouchstart]');
      touchstartElements.forEach(element => {
        if (!isVisible(element)) return;
        criterion.stats.touchstartOnly++;
        
        if (criterion.stats.touchstartOnly <= 3) {
          addIssue('moderate', '2.5.2',
            'Element uses touchstart event which may not allow cancellation',
            element,
            'Use touchend/click event to allow users to cancel by moving finger away');
        }
      });

      criterion.status = (criterion.stats.mousedownOnly + criterion.stats.touchstartOnly) > 0 
        ? 'needs-attention' : 'passed';

      if (criterion.stats.mousedownOnly > 3 || criterion.stats.touchstartOnly > 3) {
        criterion.findings.push({
          issue: 'Multiple elements use down-events',
          mousedownCount: criterion.stats.mousedownOnly,
          touchstartCount: criterion.stats.touchstartOnly
        });
      }

      results.criteria.push(criterion);
    }

    // WCAG 2.5.4 Motion Actuation - Level A

    function testMotionActuation() {
      const criterion = {
        id: '2.5.4',
        name: 'Motion Actuation',
        level: 'A',
        status: 'checking',
        findings: []
      };

      let hasMotionHandlers = false;

      const motionElements = document.querySelectorAll(
        '[ondevicemotion], [ondeviceorientation], ' +
        '[data-shake], [data-tilt], [data-motion], ' +
        '[class*="shake"], [class*="tilt-to"], [class*="motion-control"]'
      );

      if (motionElements.length > 0) {
        hasMotionHandlers = true;
        motionElements.forEach(el => {
          addIssue('serious', '2.5.4',
            'Element appears to use device motion for functionality',
            el,
            'Provide UI control alternative to motion-activated features');
        });
      }

      if (typeof Shake !== 'undefined' || 
          typeof DeviceOrientationEvent !== 'undefined' && document.querySelector('[data-device-motion]')) {
        hasMotionHandlers = true;
        addManualCheck('2.5.4',
          'Device motion APIs may be in use - verify all motion-triggered functions have UI alternatives',
          [], 'medium');
      }

      const motionIndicatorClasses = document.querySelectorAll(
        '[class*="gyro"], [class*="accelerometer"], [class*="parallax-tilt"]'
      );
      
      if (motionIndicatorClasses.length > 0) {
        hasMotionHandlers = true;
        addManualCheck('2.5.4',
          'Gyroscope/accelerometer-based features detected - verify UI controls exist as alternatives',
          Array.from(motionIndicatorClasses),
          'medium');
      }

      criterion.status = hasMotionHandlers ? 'needs-review' : 'not-applicable';
      
      if (!hasMotionHandlers) {
        criterion.findings.push({ note: 'No device motion handlers detected' });
        results.summary.passed++;
      }

      results.criteria.push(criterion);
    }

    testPointerGestures();
    testPointerCancellation();
    testMotionActuation();

    results.meta.executionTimeMs = Math.round(performance.now() - startTime);

    return results;
  }

  // Export
  global.auditWCAG22 = auditWCAG22;

  console.log('WCAG 2.2 Specific Criteria Audit loaded');

})(typeof window !== 'undefined' ? window : global);
