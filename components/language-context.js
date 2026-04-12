/**
 * Language & Context Accessibility Audit
 * WCAG: 3.1.2, 3.2.6, 3.3.8
 */

function runLanguageContextAudit() {
  'use strict';

  const startTime = performance.now();

  // ============================================================
  // Configuration
  // ============================================================

  const CONFIG = {
    checkLanguageParts: true,
    checkConsistentHelp: true,
    checkAuthentication: true,
    maxElementsToCheck: 300
  };

  // Common foreign language patterns
  const LANGUAGE_PATTERNS = {
    fr: {
      chars: /[éèêëàâäùûüôöçœæ]/g,
      words: /\b(bonjour|merci|avec|dans|pour|trs|tre|avoir)\b/gi,
      name: 'French'
    },
    es: {
      chars: /[áéíóúñü¿¡]/g,
      words: /\b(hola|gracias|buenos|das|tambin|porque|cuando)\b/gi,
      name: 'Spanish'
    },
    de: {
      chars: /[äöüÄÖÜß]/g,
      words: /\b(danke|bitte|guten|morgen|nicht|haben|werden)\b/gi,
      name: 'German'
    },
    it: {
      chars: /[àèéìíîòóùú]/g,
      words: /\b(ciao|grazie|buongiorno|anche|perch|quando)\b/gi,
      name: 'Italian'
    },
    ja: {
      chars: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g,
      name: 'Japanese'
    },
    zh: {
      chars: /[\u4E00-\u9FFF\u3400-\u4DBF]/g,
      name: 'Chinese'
    },
    ko: {
      chars: /[\uAC00-\uD7AF\u1100-\u11FF]/g,
      name: 'Korean'
    },
    ru: {
      chars: /[\u0400-\u04FF]/g,
      name: 'Russian/Cyrillic'
    },
    ar: {
      chars: /[\u0600-\u06FF\u0750-\u077F]/g,
      name: 'Arabic'
    }
  };

  // ============================================================
  // Helper Functions
  // ============================================================

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('language-context', ['html', 'body', '[lang]', '[hreflang]']);
  const { isVisible, getSelector } = h;

  function detectLanguage(text) {
    if (!text || text.length < 10) return null;
    
    const detectedLanguages = [];
    
    for (const [code, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
      const charMatches = (text.match(pattern.chars) || []).length;
      const wordMatches = pattern.words ? (text.match(pattern.words) || []).length : 0;
      
      if (charMatches > 3 || wordMatches > 2) {
        detectedLanguages.push({
          code: code,
          name: pattern.name,
          confidence: charMatches + wordMatches * 2
        });
      }
    }
    
    if (detectedLanguages.length > 0) {
      detectedLanguages.sort((a, b) => b.confidence - a.confidence);
      return detectedLanguages[0];
    }
    
    return null;
  }

  // ============================================================
  // Audit Functions
  // ============================================================

  function auditLanguageOfParts() {
    const issues = [];
    
    if (!CONFIG.checkLanguageParts) return issues;
    
    // Get page language
    const pageLang = document.documentElement.lang || 'en';
    
    // Check elements that commonly contain foreign text
    const textElements = Array.from(document.querySelectorAll(
      'p, span, div, blockquote, q, cite, figcaption, td, li'
    ))
      .filter(el => isVisible(el))
      .slice(0, CONFIG.maxElementsToCheck);
    
    results.stats.elementsScanned += textElements.length;

    textElements.forEach(element => {
      // Skip if element already has lang attribute
      if (element.hasAttribute('lang')) return;
      
      // Get direct text content (not from children)
      const directText = Array.from(element.childNodes)
        .filter(node => node.nodeType === 3)
        .map(node => node.textContent)
        .join(' ')
        .trim();
      
      if (!directText || directText.length < 20) return;
      
      // Detect if text is in a foreign language
      const detectedLang = detectLanguage(directText);
      
      if (detectedLang && detectedLang.code !== pageLang.substring(0, 2)) {
        issues.push({
          severity: 'moderate',
          wcag: '3.1.2',
          criterion: '3.1.2 Language of Parts',
          message: `Text appears to be in ${detectedLang.name} but lacks lang attribute`,
          selector: getSelector(element),
          element: element.outerHTML.slice(0, 200),
          fix: `Add lang="${detectedLang.code}" attribute to this element`,
          impact: 'moderate'
        });
      }
    });
    
    // Check for quoted foreign text
    const quotes = document.querySelectorAll('q, blockquote');
    results.stats.elementsScanned += quotes.length;
    quotes.forEach(quote => {
      if (!isVisible(quote)) return;
      if (quote.hasAttribute('lang')) return;
      
      const text = quote.textContent.trim();
      const detectedLang = detectLanguage(text);
      
      if (detectedLang) {
        issues.push({
          severity: 'moderate',
          wcag: '3.1.2',
          criterion: '3.1.2 Language of Parts',
          message: `Quote in ${detectedLang.name} lacks lang attribute`,
          selector: getSelector(quote),
          element: quote.outerHTML.slice(0, 200),
          fix: `Add lang="${detectedLang.code}" to <${quote.tagName.toLowerCase()}>`,
          impact: 'moderate'
        });
      }
    });
    
    return issues;
  }

  function auditConsistentHelp() {
    const issues = [];
    
    if (!CONFIG.checkConsistentHelp) return issues;
    
    // Look for help mechanisms
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    results.stats.elementsScanned += allLinks.length;
    const helpLinks = allLinks
      .filter(link => {
        const text = link.textContent.toLowerCase();
        const href = link.href.toLowerCase();
        return /help|contact|support|faq|chat|phone|email|assistance/i.test(text + href);
      });
    
    if (helpLinks.length === 0) {
      // No help links found - might need manual check
      issues.push({
        severity: 'minor',
        wcag: '3.2.6',
        criterion: '3.2.6 Consistent Help',
        message: 'No obvious help mechanism found (contact, help, support, FAQ)',
        selector: 'body',
        element: '<body>...</body>',
        fix: 'Provide consistent help mechanism across all pages (e.g., contact link, help link, chat)',
        impact: 'minor'
      });
    } else {
      // Help links found - check positioning
      const positions = helpLinks.map(link => {
        const rect = link.getBoundingClientRect();
        const inHeader = link.closest('header, [role="banner"], nav');
        const inFooter = link.closest('footer, [role="contentinfo"]');
        
        return {
          element: link,
          selector: getSelector(link),
          text: link.textContent.trim(),
          inHeader: !!inHeader,
          inFooter: !!inFooter,
          x: rect.left,
          y: rect.top
        };
      });
      
      // Check if they're in consistent locations
      const headerHelp = positions.filter(p => p.inHeader);
      const footerHelp = positions.filter(p => p.inFooter);
      
      if (headerHelp.length > 0 || footerHelp.length > 0) {
        addPassed('3.2.6', 'Consistent Help', 'Help mechanism found in ' +
          (headerHelp.length > 0 ? 'header' : '') +
          (headerHelp.length > 0 && footerHelp.length > 0 ? ' and ' : '') +
          (footerHelp.length > 0 ? 'footer' : ''), 'body');
        addManualCheck('3.2.6', 'Verify help link appears in the same relative order on all pages',
          'Confirm that the help/contact/support link is consistently positioned across different page templates');
      }
    }
    
    return issues;
  }

  function auditAccessibleAuthentication() {
    const issues = [];
    
    if (!CONFIG.checkAuthentication) return issues;
    
    // Look for login/authentication forms
    const allForms = Array.from(document.querySelectorAll('form'));
    results.stats.elementsScanned += allForms.length;
    const authForms = allForms
      .filter(form => {
        const inputs = form.querySelectorAll('input[type="password"], input[type="email"], input[type="text"]');
        const hasPassword = form.querySelector('input[type="password"]');
        return hasPassword || /login|sign.?in|auth/i.test(form.id + form.className);
      });
    
    if (authForms.length === 0) {
      return issues; // No auth forms on this page
    }
    
    authForms.forEach(form => {
      const passwordInput = form.querySelector('input[type="password"]');
      
      if (passwordInput) {
        // Check for CAPTCHA
        const hasCaptcha = form.querySelector(
          '[class*="captcha"], [class*="recaptcha"], ' +
          '[id*="captcha"], [id*="recaptcha"], ' +
          'iframe[src*="recaptcha"], iframe[src*="captcha"]'
        );
        
        if (hasCaptcha) {
          issues.push({
            severity: 'serious',
            wcag: '3.3.8',
            criterion: '3.3.8 Accessible Authentication (Minimum)',
            message: 'CAPTCHA detected in authentication form',
            selector: getSelector(form),
            element: form.outerHTML.slice(0, 200),
            fix: 'Provide alternative authentication method that does not require cognitive function test',
            impact: 'serious'
          });
        }
        
        // Check for "forgot password" / password recovery
        const forgotPasswordLink = form.querySelector(
          'a[href*="forgot"], a[href*="reset"], ' +
          'a:is([href*="password"]):is([href*="recover"], [href*="recovery"])'
        ) || document.querySelector(
          'a[href*="forgot"], a[href*="reset-password"]'
        );
        
        if (!forgotPasswordLink) {
          issues.push({
            severity: 'moderate',
            wcag: '3.3.8',
            criterion: '3.3.8 Accessible Authentication (Minimum)',
            message: 'No password recovery mechanism found',
            selector: getSelector(form),
            element: form.outerHTML.slice(0, 200),
            fix: 'Provide password reset/recovery option to avoid requiring memorization',
            impact: 'moderate'
          });
        }
        
        // Check for alternative auth methods (SSO, biometric, etc.)
        const hasSSO = form.querySelector(
          '[class*="oauth"], [class*="sso"], [class*="google"], [class*="facebook"], ' +
          'button:is([class*="social"], [class*="google"], [class*="facebook"])'
        );
        
        const hasOtherAuth = form.querySelector(
          'input[type="email"][autocomplete*="username"], ' +
          '[data-biometric], [class*="fingerprint"], [class*="face-id"]'
        );
        
        if (!hasSSO && !hasOtherAuth) {
          issues.push({
            severity: 'minor',
            wcag: '3.3.8',
            criterion: '3.3.8 Accessible Authentication (Minimum)',
            message: 'Only password authentication detected',
            selector: getSelector(form),
            element: form.outerHTML.slice(0, 200),
            fix: 'Consider providing alternative auth methods (SSO, email links, biometric)',
            impact: 'minor'
          });
        }
      }
    });
    
    return issues;
  }

  // ============================================================
  // Main Audit Function
  // ============================================================

  function runAudit() {
    const issues = [];
    
    // 3.1.2 Language of Parts
    const langIssues = auditLanguageOfParts();
    issues.push(...langIssues);
    
    // 3.2.6 Consistent Help
    const helpIssues = auditConsistentHelp();
    issues.push(...helpIssues);
    
    // 3.3.8 Accessible Authentication (Minimum) — Level AA
    const authIssues = auditAccessibleAuthentication();
    issues.push(...authIssues);
    
    return issues;
  }

  // ============================================================
  // Return Results
  // ============================================================

  const issues = runAudit();
  results.issues.push(...issues);

  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  return results;
}

if (typeof window !== 'undefined') {
  window.runLanguageContextAudit = runLanguageContextAudit;
}
