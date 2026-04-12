/**
 * Forms Accessibility Audit
 * WCAG: 1.3.5, 2.1.1, 2.5.3, 3.2.1, 3.2.2, 3.3.1, 3.3.2, 3.3.3, 3.3.4, 4.1.2, 4.1.3
 */

function runFormsAudit() {
  'use strict';

  const startTime = performance.now();

  // ============================================================
  // Configuration
  // ============================================================

  const CONFIG = {
    scope: ['form', '[role="form"]'],
    inputTypes: ['text', 'email', 'password', 'tel', 'url', 'number', 'date', 'search'],
    
    // Valid autocomplete values per HTML spec (for validation)
    validAutocompleteTokens: {
      // Name fields
      name: ['name', 'honorific-prefix', 'given-name', 'additional-name', 
             'family-name', 'honorific-suffix', 'nickname'],
      // Contact fields
      contact: ['email', 'username', 'tel', 'tel-country-code', 'tel-national',
                'tel-area-code', 'tel-local', 'tel-extension', 'url', 'impp'],
      // Address fields
      address: ['street-address', 'address-line1', 'address-line2', 'address-line3',
                'address-level1', 'address-level2', 'address-level3', 'address-level4',
                'country', 'country-name', 'postal-code'],
      // Payment fields
      payment: ['cc-name', 'cc-given-name', 'cc-additional-name', 'cc-family-name',
                'cc-number', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-type',
                'transaction-currency', 'transaction-amount'],
      // Authentication fields
      auth: ['new-password', 'current-password', 'one-time-code'],
      // Personal fields
      personal: ['bday', 'bday-day', 'bday-month', 'bday-year', 'sex', 'language',
                 'organization', 'organization-title', 'photo'],
      // Section tokens (prefixes)
      sections: ['shipping', 'billing', 'home', 'work', 'mobile', 'fax', 'pager']
    },
    
    // Regex patterns for detecting input purpose (more accurate than keyword matching)
    purposePatterns: {
      'name': /^(name|full.?name|your.?name)$/i,
      'given-name': /^(first.?name|given.?name|fname|forename)$/i,
      'family-name': /^(last.?name|family.?name|lname|surname)$/i,
      'additional-name': /^(middle.?name|mname)$/i,
      'email': /^(email|e.?mail|mail)$/i,
      'tel': /^(phone|tel|telephone|mobile|cell)$/i,
      'street-address': /^(address|street|address.?1|street.?address)$/i,
      'address-line2': /^(address.?2|apt|suite|unit|apartment)$/i,
      'address-level2': /^(city|town|locality)$/i,
      'address-level1': /^(state|province|region)$/i,
      'postal-code': /^(zip|zip.?code|postal|postal.?code|postcode)$/i,
      'country': /^(country)$/i,
      'country-name': /^(country.?name)$/i,
      'cc-name': /^(card.?name|name.?on.?card|cardholder)$/i,
      'cc-number': /^(card.?number|cc.?number|credit.?card)$/i,
      'cc-exp': /^(expir|exp.?date|card.?exp)$/i,
      'cc-exp-month': /^(exp.?month|card.?month)$/i,
      'cc-exp-year': /^(exp.?year|card.?year)$/i,
      'cc-csc': /^(cvv|cvc|csc|security.?code|card.?code)$/i,
      'new-password': /^(new.?pass|create.?pass|set.?pass|confirm.?pass)$/i,
      'current-password': /^(pass|password|current.?pass|old.?pass|login.?pass)$/i,
      'username': /^(user|username|user.?name|login|user.?id)$/i,
      'organization': /^(company|org|organization|employer|business)$/i,
      'organization-title': /^(title|job.?title|position|role)$/i,
      'bday': /^(birth|birthday|dob|date.?of.?birth)$/i
    }
  };

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('forms', 'All forms and form inputs');
  const { isVisible, getSelector, getAccessibleName, getElementSnippet } = h;

  // A7: WeakMap cache for detectInputPurpose — avoids recomputing per input across multiple callers
  const _purposeCache = new WeakMap();

  // ============================================================
  // Enhanced Autocomplete Functions
  // ============================================================

  /**
   * Detect input purpose using regex patterns
   * More accurate than simple keyword matching
   */
  function detectInputPurpose(input) {
    // A7: Return cached result if already computed for this element
    if (_purposeCache.has(input)) return _purposeCache.get(input);

    const name = (input.getAttribute('name') || '').toLowerCase().replace(/[_\-\[\]]/g, '');
    const id = (input.id || '').toLowerCase().replace(/[_\-]/g, '');
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    const label = getAccessibleName(input).toLowerCase();
    const type = input.getAttribute('type');

    // Check each field against patterns
    const fieldsToCheck = [name, id, placeholder, label];

    for (const [purpose, pattern] of Object.entries(CONFIG.purposePatterns)) {
      for (const field of fieldsToCheck) {
        if (field && pattern.test(field)) {
          _purposeCache.set(input, purpose);
          return purpose;
        }
      }
    }
    
    // Fallback for input types
    let result = null;
    if (type === 'email') result = 'email';
    else if (type === 'tel') result = 'tel';
    else if (type === 'url') result = 'url';

    _purposeCache.set(input, result);
    return result;
  }

  /**
   * Validate autocomplete value against HTML spec
   */
  function isValidAutocompleteValue(value) {
    if (!value) return true;
    if (value === 'off' || value === 'on') return true;
    
    const tokens = value.toLowerCase().split(/\s+/);
    const allValidTokens = Object.values(CONFIG.validAutocompleteTokens).flat();
    
    for (const token of tokens) {
      // Check if token is valid
      if (!allValidTokens.includes(token)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get all valid autocomplete tokens as flat array
   */
  function getAllValidTokens() {
    return Object.values(CONFIG.validAutocompleteTokens).flat();
  }

  // ============================================================
  // Test Functions
  // ============================================================

  function testInputLabel(input) {
    const name = getAccessibleName(input);
    const type = input.getAttribute('type') || 'text';
    const hasVisibleLabel = (input.id && document.querySelector('label[for="' + input.id + '"]'))
      || input.closest('label');
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledby = input.getAttribute('aria-labelledby');
    const hasAriaLabel = ariaLabel || ariaLabelledby;
    const placeholder = input.getAttribute('placeholder');
    
    if (!name) {
      addIssue('critical', '3.3.2', 'Labels or Instructions', 
        'Form input has no accessible label', input, 
        'Add <label for="inputId"> or aria-label attribute', 
        'Screen reader users cannot identify input purpose');
      return;
    }
    
    // Flag aria-labelledby for manual review with context
    if (ariaLabelledby && !hasVisibleLabel) {
      const referencedIds = ariaLabelledby.split(/\s+/);
      const referencedTexts = referencedIds.map(id => {
        const el = document.getElementById(id);
        if (el) {
          return {
            id: id,
            text: el.textContent.trim().slice(0, 100),
            isVisible: isVisible(el),
            tagName: el.tagName.toLowerCase()
          };
        }
        return { id: id, text: null, isVisible: false, tagName: null, missing: true };
      });
      
      const hasInvalidReference = referencedTexts.some(ref => ref.missing);
      const allReferencesVisible = referencedTexts.every(ref => ref.isVisible);
      
      if (hasInvalidReference) {
        addIssue('serious', '4.1.2', 'Name, Role, Value',
          'aria-labelledby references non-existent ID(s): ' + referencedTexts.filter(r => r.missing).map(r => r.id).join(', '),
          input,
          'Ensure all IDs in aria-labelledby exist in the document',
          'Screen readers will not announce the intended label');
      } else {
        // Flag for manual review - provide context about what aria-labelledby references
        addManualCheck('4.1.2',
          'Verify aria-labelledby provides appropriate accessible name',
          'aria-labelledby="' + ariaLabelledby + '" references: ' + 
            referencedTexts.map(ref => `"${ref.text}" (${ref.tagName}${ref.isVisible ? '' : ', hidden'})`).join(', ') +
            '. Verify this text appropriately describes the input purpose.',
          getSelector(input));
      }
    }
    
    // Check placeholder-only labeling
    if (placeholder && !hasVisibleLabel && !hasAriaLabel) {
      addIssue('serious', '3.3.2', 'Labels or Instructions', 
        'Input uses only placeholder as label', input, 
        'Add visible label or aria-label (placeholder disappears when typing)', 
        'Label disappears when user starts typing');
    } else if (hasVisibleLabel || hasAriaLabel) {
      addPassed('3.3.2', 'Labels or Instructions', 'Input has proper label', getSelector(input));
    }
    
    // Check label association for visible labels
    if (hasVisibleLabel) {
      const label = document.querySelector('label[for="' + input.id + '"]');
      if (label && !isVisible(label)) {
        const style = window.getComputedStyle(label);
        const isProperlyHidden = style.position === 'absolute' && 
          (parseInt(style.width) <= 1 || style.clip !== 'auto');
        if (!isProperlyHidden) {
          addManualCheck('3.3.2', 'Verify visually hidden label is accessible', 
            'Check that label is hidden using sr-only/visually-hidden pattern', 
            getSelector(label));
        }
      }
    }
    
    // WCAG 2.5.3: Label in Name - Check if visible text is in accessible name
    testLabelInName(input, name);
  }

  function testLabelInName(input, accessibleName) {
    // Skip if no accessible name
    if (!accessibleName) return;
    
    // Get visible label text
    let visibleText = '';
    if (input.id) {
      const label = document.querySelector('label[for="' + input.id + '"]');
      if (label && isVisible(label)) {
        visibleText = label.textContent.trim();
      }
    }
    
    // Also check for aria-labelledby pointing to visible text
    const labelledby = input.getAttribute('aria-labelledby');
    if (labelledby && !visibleText) {
      const labelElement = document.getElementById(labelledby);
      if (labelElement && isVisible(labelElement)) {
        visibleText = labelElement.textContent.trim();
      }
    }
    
    if (visibleText) {
      // Normalize strings for comparison (lowercase, remove extra spaces)
      const normalizedVisible = visibleText.toLowerCase().replace(/\s+/g, ' ');
      const normalizedAccessible = accessibleName.toLowerCase().replace(/\s+/g, ' ');
      
      // Check if visible text is contained in accessible name
      if (!normalizedAccessible.includes(normalizedVisible)) {
        addIssue('moderate', '2.5.3', 'Label in Name', 
          'Visible label text "' + visibleText + '" not found in accessible name "' + accessibleName + '"', 
          input, 
          'Ensure visible label text matches or is contained within the accessible name', 
          'Voice control users may have difficulty activating this control');
      } else {
        addPassed('2.5.3', 'Label in Name', 'Visible label contained in accessible name', getSelector(input));
      }
    }
  }

  function testInputAutocomplete(input) {
    const type = input.getAttribute('type') || 'text';

    // Skip search inputs - autocomplete not applicable
    if (type === 'search') return;

    const autocomplete = input.getAttribute('autocomplete');

    // A7: Skip purpose detection when autocomplete is already set to a valid non-off value
    // (we only need detection to flag missing/incorrect autocomplete)
    if (autocomplete && autocomplete !== 'off' && autocomplete !== 'on' && isValidAutocompleteValue(autocomplete)) {
      if (getAllValidTokens().includes(autocomplete)) {
        addPassed('1.3.5', 'Identify Input Purpose',
          'Input has appropriate autocomplete="' + autocomplete + '"',
          getSelector(input));
      }
      return;
    }

    const detectedPurpose = detectInputPurpose(input);
    
    // Check for invalid autocomplete values
    if (autocomplete && !isValidAutocompleteValue(autocomplete)) {
      addIssue('moderate', '1.3.5', 'Identify Input Purpose',
        'Invalid autocomplete value: "' + autocomplete + '"', input,
        'Use valid autocomplete token from HTML specification',
        'Browser autofill may not work correctly');
      return;
    }
    
    // Check for autocomplete="off" on fields that should allow autofill
    if (autocomplete === 'off' && detectedPurpose) {
      // Password fields with autocomplete="off" are handled separately (security concern)
      if (type !== 'password') {
        addIssue('moderate', '1.3.5', 'Identify Input Purpose',
          'Input appears to collect "' + detectedPurpose + '" but has autocomplete="off"', input,
          'Change to autocomplete="' + detectedPurpose + '" to enable browser autofill',
          'Users with cognitive disabilities cannot use autofill');
      }
      return;
    }
    
    // Skip if autocomplete is already set to new-password
    if (autocomplete === 'new-password') return;
    
    // Check for missing autocomplete on identifiable fields
    // Pattern D fix: only flag as issue for high-confidence detections (type-based);
    // for name/placeholder pattern matches, use manual check instead
    if (detectedPurpose && !autocomplete) {
      const inputType = input.getAttribute('type');
      const isHighConfidence = (inputType === 'email' || inputType === 'tel' || inputType === 'url');
      if (isHighConfidence) {
        addIssue('moderate', '1.3.5', 'Identify Input Purpose',
          'Input type="' + inputType + '" lacks autocomplete attribute',
          input,
          'Add autocomplete="' + detectedPurpose + '"',
          'Users with cognitive disabilities cannot use autofill');
      } else {
        addManualCheck('1.3.5',
          'Input may collect "' + detectedPurpose + '" data — verify and add autocomplete if appropriate',
          'Check if this field collects user data that could benefit from autocomplete="' + detectedPurpose + '"',
          getSelector(input));
      }
    } else if (autocomplete && getAllValidTokens().includes(autocomplete)) {
      addPassed('1.3.5', 'Identify Input Purpose', 
        'Input has appropriate autocomplete="' + autocomplete + '"', 
        getSelector(input));
    }
    
    // Special check for password fields without autocomplete
    if (type === 'password' && !autocomplete) {
      addIssue('moderate', '1.3.5', 'Identify Input Purpose',
        'Password field missing autocomplete attribute', input,
        'Add autocomplete="current-password" for login or autocomplete="new-password" for registration',
        'Password managers may not work correctly');
    }
  }

  function testRequiredIndicator(input) {
    const required = input.hasAttribute('required') || input.getAttribute('aria-required') === 'true';
    
    if (!required) return;
    
    const label = getAccessibleName(input);
    const hasAsterisk = label.includes('*');
    const hasRequiredText = label.toLowerCase().includes('required');
    const ariaRequired = input.getAttribute('aria-required');
    
    // Check if required is communicated visually
    // Pattern B fix: native required attribute is sufficient — don't suggest aria-required
    if (!hasAsterisk && !hasRequiredText && !ariaRequired) {
      const hasNativeRequired = input.hasAttribute('required');
      addIssue('moderate', '3.3.2', 'Labels or Instructions',
        'Required field has no visible indicator', input,
        hasNativeRequired
          ? 'Add asterisk (*) to label or "(required)" text — native required attribute is correctly set'
          : 'Add asterisk (*) to label or "(required)" text, and add required attribute or aria-required="true"',
        'Users may not know which fields are required');
    }
    
    // Check if asterisk meaning is explained
    if (hasAsterisk) {
      const form = input.closest('form');
      if (form) {
        const formText = form.textContent;
        const hasLegend = formText.includes('required') || /\*\s*(indicates|=|denotes)/.test(formText);
        if (!hasLegend) {
          addManualCheck('3.3.2', 'Verify asterisk (*) meaning is explained', 
            'Check that form explains "*" indicates required fields', 
            getSelector(form));
        }
      }
    }
  }

  function testSubmitButton(button) {
    results.stats.elementsScanned++;
    
    const name = getAccessibleName(button) || button.value || button.textContent?.trim();
    
    if (!name) {
      addIssue('serious', '4.1.2', 'Name, Role, Value', 
        'Submit button has no accessible name', button, 
        'Add text content or aria-label to submit button', 
        'Users cannot identify form submission button');
    } else if (name.toLowerCase() === 'submit') {
      addIssue('minor', '3.3.2', 'Labels or Instructions', 
        'Submit button uses generic "Submit" text', button, 
        'Use more descriptive text like "Sign Up", "Send Message", or "Complete Order"');
    } else {
      addPassed('4.1.2', 'Name, Role, Value', 
        'Submit button has accessible name: "' + name.slice(0, 30) + '"', 
        getSelector(button));
    }
    
    // Check if button is keyboard accessible
    const tabindex = button.getAttribute('tabindex');
    if (tabindex === '-1') {
      addIssue('critical', '2.1.1', 'Keyboard', 
        'Submit button is not keyboard focusable', button, 
        'Remove tabindex="-1" or set to 0', 
        'Keyboard users cannot submit form');
    }
  }

  function testErrorHandling(form) {
    // Look for error messages (broader selector set migrated from comprehensive-audit.js auditErrorHandling)
    const errorSelectors = [
      '.error', '.invalid', '[class*="error"]', '[class*="invalid"]',
      '[aria-invalid="true"]', '.form-error', '.field-error',
      '[role="alert"]', '.validation-error', '[aria-invalid="true"] ~ *',
      '[id*="error"]', '[class*="help-block"]'
    ];
    let errorElements = [];

    errorSelectors.forEach(selector => {
      try {
        form.querySelectorAll(selector).forEach(el => {
          if (isVisible(el)) errorElements.push(el);
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    // Check inputs with aria-invalid
    const invalidInputs = form.querySelectorAll('[aria-invalid="true"]');
    
    invalidInputs.forEach(input => {
      results.stats.elementsScanned++;
      
      const describedBy = input.getAttribute('aria-describedby');
      const errorMessage = input.getAttribute('aria-errormessage');
      
      if (!describedBy && !errorMessage) {
        addIssue('serious', '3.3.1', 'Error Identification', 
          'Invalid input not associated with error message', input, 
          'Add aria-describedby or aria-errormessage pointing to error message element', 
          'Screen reader users not informed of error details');
      } else {
        // Check aria-errormessage first (preferred for error associations)
        if (errorMessage) {
          const errorEl = document.getElementById(errorMessage);
          if (!errorEl) {
            addIssue('serious', '3.3.1', 'Error Identification', 
              'aria-errormessage references non-existent element', input, 
              `Ensure element with id="${errorMessage}" exists`);
          } else if (!errorEl.textContent.trim()) {
            addIssue('serious', '3.3.1', 'Error Identification', 
              'aria-errormessage references empty element', input, 
              'Ensure referenced element contains error text');
          } else {
            addPassed('3.3.1', 'Error Identification', 
              'Error message properly associated via aria-errormessage', 
              getSelector(input));
          }
        } else if (describedBy) {
          // Handle multiple IDs in aria-describedby
          const ids = describedBy.split(/\s+/);
          let hasValidReference = false;
          
          for (const id of ids) {
            const errorEl = document.getElementById(id);
            if (errorEl && errorEl.textContent.trim()) {
              hasValidReference = true;
              break;
            }
          }
          
          if (!hasValidReference) {
            addIssue('serious', '3.3.1', 'Error Identification', 
              'aria-describedby references empty or missing element', input, 
              'Ensure referenced element exists and contains error text');
          } else {
            addPassed('3.3.1', 'Error Identification', 
              'Error message properly associated with input', 
              getSelector(input));
          }
        }
      }
    });
    
    // Check error messages have role="alert" or aria-live
    errorElements.forEach(error => {
      const role = error.getAttribute('role');
      const ariaLive = error.getAttribute('aria-live');
      
      if (role !== 'alert' && !ariaLive) {
        addManualCheck('4.1.3', 'Verify error messages are announced', 
          'Check that error messages use role="alert" or aria-live for screen reader announcement', 
          getSelector(error));
      }
    });
    
    // General error handling manual checks
    addManualCheck('3.3.1', 'Test form validation error handling',
      'Submit form with errors and verify: errors are identified, associated with inputs, and announced to screen readers',
      getSelector(form));

    // Automated error suggestion pattern matching (migrated from comprehensive-audit.js auditErrorHandling)
    // WCAG 3.3.3: If errors are detected, check for suggestion patterns
    var suggestionPatterns = [
      /should be/i, /did you mean/i, /must be/i, /expected format/i,
      /please enter/i, /for example/i, /e\.g\./i, /format:/i,
      /must contain/i, /at least \d+/i, /no more than/i, /between \d+ and \d+/i,
      /valid email/i, /valid phone/i, /valid url/i, /valid date/i,
      /required field/i, /cannot be empty/i
    ];

    var errorTexts = errorElements.map(function(el) { return el.textContent.trim(); }).filter(function(t) { return t.length > 0; });
    if (errorTexts.length > 0) {
      var hasSuggestion = errorTexts.some(function(text) {
        return suggestionPatterns.some(function(pattern) { return pattern.test(text); });
      });

      if (hasSuggestion) {
        addPassed('3.3.3', 'Error Suggestion', 'Error messages include correction suggestions', getSelector(form));
      } else {
        addManualCheck('3.3.3', 'Verify error suggestions are provided',
          'Error messages found but no correction suggestions detected. When form errors occur, provide helpful suggestions (e.g., "Please enter a valid email like name@example.com")',
          getSelector(form));
      }
    } else {
      addManualCheck('3.3.3', 'Verify error suggestions are provided',
        'When form errors occur, check that helpful suggestions are provided for correction',
        getSelector(form));
    }

    // WCAG 3.3.4: Error Prevention - Check for confirmation/review mechanisms
    testErrorPrevention(form);
  }

  function testErrorPrevention(form) {
    // Detect if form involves legal, financial, or data transactions
    const formText = form.textContent.toLowerCase();
    const formAction = (form.getAttribute('action') || '').toLowerCase();
    
    // Keywords indicating high-stakes forms
    const legalKeywords = ['terms', 'agreement', 'contract', 'legal', 'binding'];
    const financialKeywords = ['payment', 'credit', 'debit', 'purchase', 'order', 'checkout', 'billing', 'price', 'total', 'card'];
    const dataKeywords = ['delete', 'remove', 'cancel', 'unsubscribe', 'terminate'];
    
    const isLegal = legalKeywords.some(kw => formText.includes(kw) || formAction.includes(kw));
    const isFinancial = financialKeywords.some(kw => formText.includes(kw) || formAction.includes(kw));
    const isDataTransaction = dataKeywords.some(kw => formText.includes(kw) || formAction.includes(kw));
    
    if (isLegal || isFinancial || isDataTransaction) {
      // Look for error prevention mechanisms
      const hasReviewStep = /review|confirm|summary|verify/i.test(formText);
      const hasUndoOption = /undo|reverse|cancel|go back/i.test(formText);
      const hasCheckboxConfirmation = form.querySelector('input[type="checkbox"][required]');

      // Check for confirmation dialog mechanisms (migrated from comprehensive-audit.js auditErrorHandling)
      var hasAlertDialog = form.querySelector('[role="alertdialog"]');
      var hasConfirmDialog = form.querySelector('[role="dialog"][aria-modal="true"]');

      let preventionMechanisms = [];
      if (hasReviewStep) preventionMechanisms.push('review step');
      if (hasUndoOption) preventionMechanisms.push('undo option');
      if (hasCheckboxConfirmation) preventionMechanisms.push('confirmation checkbox');
      if (hasAlertDialog) preventionMechanisms.push('alert dialog');
      if (hasConfirmDialog) preventionMechanisms.push('confirmation dialog');

      if (preventionMechanisms.length === 0) {
        const formType = isFinancial ? 'financial' : isLegal ? 'legal' : 'data deletion';
        addManualCheck('3.3.4', 'Verify error prevention for ' + formType + ' transaction',
          'This form appears to involve ' + formType + ' transactions. Verify that one of the following is provided: ' +
          '(1) Reversible submission, (2) Data validation with correction opportunity, or (3) Confirmation page before final submission',
          getSelector(form));
      } else {
        addPassed('3.3.4', 'Error Prevention (Legal, Financial, Data)',
          'Form has error prevention mechanism: ' + preventionMechanisms.join(', '),
          getSelector(form));
      }
    }

    // Delete button confirmation check (migrated from comprehensive-audit.js auditErrorHandling)
    var deleteButtons = form.querySelectorAll('button, [role="button"], input[type="submit"]');
    deleteButtons.forEach(function(btn) {
      var btnText = (btn.textContent || btn.value || '').toLowerCase();
      if (/delete|remove|destroy|erase/i.test(btnText)) {
        var hasDataConfirm = btn.hasAttribute('data-confirm');
        var hasOnclickConfirm = (btn.getAttribute('onclick') || '').indexOf('confirm') !== -1;
        if (!hasDataConfirm && !hasOnclickConfirm) {
          addManualCheck('3.3.4', 'Verify delete action has confirmation',
            'Button "' + btnText.trim().substring(0, 30) + '" appears to delete data. Verify a confirmation step is provided before permanent deletion.',
            getSelector(btn));
        }
      }
    });
  }

  /**
   * Test for billing/shipping "same as" option
   * Related to 3.3.7 Redundant Entry (tested in wcag22-audit.js)
   * This provides a helpful heads-up during form audits
   */
  function testBillingShippingOption(form) {
    const hasBilling = form.querySelector('[name*="billing"], [id*="billing"], [class*="billing"]');
    const hasShipping = form.querySelector('[name*="shipping"], [id*="shipping"], [class*="shipping"]');
    
    if (hasBilling && hasShipping) {
      // Look for "same as" checkbox
      const sameAsPatterns = [
        '[id*="same"]', '[name*="same"]', 
        '[id*="copy"]', '[name*="copy"]',
        '[id*="use_billing"]', '[name*="use_billing"]',
        '[id*="same_as"]', '[name*="same_as"]'
      ];
      
      let hasSameAsOption = false;
      for (const pattern of sameAsPatterns) {
        try {
          if (form.querySelector(pattern)) {
            hasSameAsOption = true;
            break;
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
      
      if (!hasSameAsOption) {
        addManualCheck('3.3.7', 'Consider adding "same as billing" option',
          'Form has both billing and shipping sections. Adding a checkbox to copy billing to shipping prevents redundant entry.',
          getSelector(form));
      }
    }
  }

  /**
   * Test each form
   */
  function testForm(form) {
    results.stats.elementsScanned++;
    results.stats.formsFound++;
    
    const inputs = form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), ' +
      'select, textarea'
    );
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    
    // Test form accessible name for complex forms
    const formName = getAccessibleName(form);
    
    if (form.tagName === 'FORM' && !formName && inputs.length > 3) {
      addManualCheck('1.3.1', 'Consider adding accessible name to form', 
        'For complex forms, add aria-label or aria-labelledby describing the form purpose', 
        getSelector(form));
    }
    
    // Test each input
    inputs.forEach(input => {
      if (!isVisible(input)) return;
      results.stats.elementsScanned++;
      results.stats.inputsFound++;
      
      testInputLabel(input);
      testInputAutocomplete(input);
      testRequiredIndicator(input);
    });
    
    // Test submit button
    if (submitBtn && isVisible(submitBtn)) {
      testSubmitButton(submitBtn);
    } else {
      // Check if form has no visible submit button
      const allButtons = form.querySelectorAll('button, input[type="submit"], input[type="button"]');
      const hasAnyButton = Array.from(allButtons).some(b => isVisible(b));
      
      if (!hasAnyButton && inputs.length > 0) {
        addIssue('moderate', '3.2.2', 'On Input',
          'Form has no visible submit button', form,
          'Add a submit button. Forms should not submit on blur/change alone.',
          'Users may not know how to submit the form');
      }
    }
    
    // Test error handling
    testErrorHandling(form);
    
    // Test billing/shipping option
    testBillingShippingOption(form);
  }

  // ============================================================
  // Context Change Detection (WCAG 3.2.1, 3.2.2)
  // ============================================================

  /**
   * Detect elements that cause context changes on focus or input.
   * Migrated from comprehensive-audit.js auditContextChanges().
   */
  function testContextChanges() {
    // 3.2.1 On Focus — elements that navigate/submit when receiving focus
    const focusNavPatterns = [
      '[onfocus*="location"]', '[onfocus*="navigate"]', '[onfocus*="href"]',
      '[onfocus*="window.open"]', '[onfocus*="submit"]'
    ];

    focusNavPatterns.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (!isVisible(el)) return;
          results.stats.elementsScanned++;
          addIssue('critical', '3.2.1', 'On Focus',
            'Element causes context change on focus', el,
            'Remove automatic navigation/submission on focus; require explicit user action',
            'Users cannot control page behavior when tabbing through elements');
        });
      } catch (e) { /* selector may throw on some engines */ }
    });

    // 3.2.2 On Input — select menus that auto-navigate
    const selectNavPatterns = [
      'select[onchange*="location"]', 'select[onchange*="href"]',
      'select[onchange*="navigate"]', 'select[onchange*="window.open"]',
      'select[onchange*="submit"]'
    ];

    selectNavPatterns.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (!isVisible(el)) return;
          results.stats.elementsScanned++;
          addIssue('serious', '3.2.2', 'On Input',
            'Select menu causes context change on selection', el,
            'Add a Go button instead of auto-navigation; let user confirm selection',
            'Users may accidentally trigger navigation when selecting options');
        });
      } catch (e) {}
    });

    // 3.2.2 On Input — inputs that auto-submit
    const autoSubmitPatterns = [
      'input[onchange*="submit"]', 'input[oninput*="submit"]',
      'input[onblur*="submit"]', 'textarea[onchange*="submit"]',
      '[onchange*=".submit()"]', '[oninput*=".submit()"]'
    ];

    // Pattern D fix: Only flag definitive auto-submission patterns (.submit()),
    // not substring matches like "submitForm" which may just be a function name
    autoSubmitPatterns.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (!isVisible(el)) return;
          results.stats.elementsScanned++;
          // Check if the handler actually calls .submit() directly
          const handler = el.getAttribute('onchange') || el.getAttribute('oninput') || el.getAttribute('onblur') || '';
          if (/\.submit\s*\(/.test(handler)) {
            addIssue('serious', '3.2.2', 'On Input',
              'Input auto-submits form without explicit user action', el,
              'Require explicit submit button activation',
              'Users may lose data or trigger unintended submissions');
          } else {
            addManualCheck('3.2.2',
              'Input handler contains "submit" — verify it does not auto-submit',
              'Check if this input\'s event handler causes the form to submit without explicit user confirmation',
              getSelector(el));
          }
        });
      } catch (e) {}
    });

    // 3.2.2 — Radio buttons that auto-submit
    try {
      document.querySelectorAll('input[type="radio"][onchange*="submit"]').forEach(el => {
        if (!isVisible(el)) return;
        results.stats.elementsScanned++;
        addIssue('serious', '3.2.2', 'On Input',
          'Radio button auto-submits form', el,
          'Add explicit submit button for form submission',
          'Users cannot explore radio options without triggering submission');
      });
    } catch (e) {}

    // 3.2.2 — Checkboxes that trigger navigation
    try {
      document.querySelectorAll(
        'input[type="checkbox"][onchange*="location"], input[type="checkbox"][onchange*="href"]'
      ).forEach(el => {
        if (!isVisible(el)) return;
        results.stats.elementsScanned++;
        addIssue('serious', '3.2.2', 'On Input',
          'Checkbox causes navigation on change', el,
          'Use a link or button for navigation instead',
          'Checkboxes should not trigger page navigation');
      });
    } catch (e) {}
  }

  // ============================================================
  // Main Execution
  // ============================================================

  // Test context changes (page-wide, not form-specific)
  testContextChanges();

  // Find all forms
  const forms = document.querySelectorAll('form, [role="form"]');

  if (forms.length === 0) {
    // Check for inputs outside forms (orphan inputs)
    const orphanInputs = document.querySelectorAll(
      'input:not(form input):not([type="hidden"]), ' +
      'select:not(form select), ' +
      'textarea:not(form textarea)'
    );
    const visibleOrphans = Array.from(orphanInputs).filter(i => isVisible(i) && i.type !== 'hidden');
    
    if (visibleOrphans.length > 0) {
      addIssue('moderate', '1.3.1', 'Info and Relationships', 
        visibleOrphans.length + ' form inputs found outside of <form> element', 
        visibleOrphans[0], 
        'Wrap related inputs in <form> element for better structure and accessibility', 
        'Form inputs not semantically grouped');
      
      visibleOrphans.forEach(input => {
        results.stats.inputsFound++;
        testInputLabel(input);
        testInputAutocomplete(input);
      });
    } else {
      addManualCheck('3.3.2', 'No forms found on page', 
        'If forms exist, ensure they use proper <form> element');
    }
  } else {
    forms.forEach(form => {
      if (isVisible(form)) {
        testForm(form);
      }
    });
  }

  // ============================================================
  // Finalize Results
  // ============================================================

  results.stats.issuesFound = results.issues.length;
  results.stats.passedChecks = results.passed.length;
  results.stats.manualChecksNeeded = results.manualChecks.length;
  results.stats.executionTimeMs = Math.round(performance.now() - startTime);

  // Sort issues by severity
  const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  results.issues.sort((a, b) => 
    (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
  );

  return results;
}

// Export
if (typeof window !== 'undefined') {
  window.runFormsAudit = runFormsAudit;
}

