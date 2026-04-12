/**
 * Buttons Accessibility Audit
 * WCAG: 2.1.1, 2.5.3, 4.1.2
 */

function runButtonsAudit() {
  'use strict';

  const startTime = performance.now();

  const { results, h, addIssue, addPassed, addManualCheck, getDefaultImpact } = window.a11yAudit.initComponent('buttons', 'All button elements');
  const { isVisible, getSelector, hasAccessibleName, getElementSnippet } = h;

  // ==========================================================================
  // MAIN TEST: All Buttons
  // ==========================================================================

  function testAllButtons() {
    // Get all button elements
    const buttons = document.querySelectorAll(
      'button, ' +
      '[role="button"], ' +
      'input[type="button"], ' +
      'input[type="submit"], ' +
      'input[type="reset"]'
    );

    if (buttons.length === 0) {
      return;
    }

    // Generic button text patterns to flag
    const genericPatterns = [
      /^button$/i,
      /^btn$/i,
      /^submit$/i,
      /^ok$/i,
      /^$/,  // Close icons
      /^x$/i
    ];

    buttons.forEach(button => {
      if (!isVisible(button)) return;

      results.stats.elementsScanned++;

      const tagName = button.tagName.toLowerCase();
      const role = button.getAttribute('role');
      const type = button.getAttribute('type');
      const ariaLabel = button.getAttribute('aria-label');
      const ariaLabelledby = button.getAttribute('aria-labelledby');
      const title = button.getAttribute('title');
      const disabled = button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true';
      
      // Get button text
      let text = '';
      if (tagName === 'input') {
        text = button.getAttribute('value') || '';
      } else {
        text = button.textContent.trim();
      }

      // Check 1: Button has accessible name
      const buttonHasName =
        (text && text.length > 0) ||
        ariaLabel ||
        ariaLabelledby ||
        title ||
        button.querySelector('img[alt]') ||
        button.querySelector('svg[aria-label]');

      if (!buttonHasName) {
        addIssue(
          'critical',
          '4.1.2',
          'Name, Role, Value',
          'Button has no accessible name',
          button,
          'Add text content, aria-label, or ensure icon has proper labeling',
          'Screen reader users cannot identify the button purpose'
        );
        return;
      }

      // Check 2: Generic button text (only if no aria-label override)
      if (!ariaLabel && !ariaLabelledby && text) {
        const textLower = text.toLowerCase().trim();
        const isGeneric = genericPatterns.some(pattern => pattern.test(textLower));

        if (isGeneric && textLower !== 'submit') {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Button has generic text: "' + text + '"',
            button,
            'Use descriptive button text that explains what the button does, or add aria-label',
            'Generic button text doesn\'t clearly convey the button purpose'
          );
          return;
        }
      }

      // Check 3: Button with role="button" needs tabindex
      if (role === 'button' && tagName !== 'button') {
        const tabindex = button.getAttribute('tabindex');
        
        if (tabindex === null || tabindex === '-1') {
          addIssue(
            'serious',
            '2.1.1',
            'Keyboard',
            'Element with role="button" is not keyboard accessible',
            button,
            'Add tabindex="0" to make the button focusable',
            'Keyboard users cannot access this button'
          );
          return;
        }

        // Needs event handlers
        const hasClick = button.hasAttribute('onclick') || button.hasAttribute('ng-click');
        if (!hasClick) {
          addIssue(
            'moderate',
            '4.1.2',
            'Name, Role, Value',
            'Element with role="button" may not be operable',
            button,
            'Ensure button has click handler and responds to Enter/Space keys',
            'Button may not be functional for all users'
          );
        }
      }

      // Check 4: Icon-only buttons should have aria-label
      const hasIcon = button.querySelector('svg, i[class*="icon"], span[class*="icon"]');
      const hasVisibleText = text && text.length > 1;

      if (hasIcon && !hasVisibleText && !ariaLabel && !ariaLabelledby) {
        addIssue(
          'serious',
          '4.1.2',
          'Name, Role, Value',
          'Icon button missing aria-label',
          button,
          'Add aria-label describing the button purpose',
          'Screen reader users cannot determine what this button does'
        );
        return;
      }

      // Check 5: Label in Name (WCAG 2.5.3)
      // aria-label check
      if (ariaLabel && text && text.length > 0) {
        const textLower = text.toLowerCase().trim();
        const labelLower = ariaLabel.toLowerCase().replace(/\s+/g, ' ').trim();

        // Check if visible text is included in accessible name
        if (!labelLower.includes(textLower)) {
          addIssue(
            'serious',
            '2.5.3',
            'Label in Name',
            'Button accessible name doesn\'t include visible text',
            button,
            'Ensure aria-label includes the visible button text: "' + text + '"',
            'Voice control users may not be able to activate the button by speaking the visible text'
          );
          return;
        }
      }

      // aria-labelledby resolution check (migrated from comprehensive-audit.js auditLabelInName)
      if (ariaLabelledby && text && text.length > 0 && !ariaLabel) {
        var resolvedText = '';
        ariaLabelledby.split(/\s+/).forEach(function(refId) {
          var refEl = document.getElementById(refId);
          if (refEl) resolvedText += ' ' + refEl.textContent.trim();
        });
        resolvedText = resolvedText.trim();

        if (resolvedText) {
          var textLower = text.toLowerCase().trim();
          var resolvedLower = resolvedText.toLowerCase().replace(/\s+/g, ' ');
          if (!resolvedLower.includes(textLower)) {
            addIssue(
              'serious',
              '2.5.3',
              'Label in Name',
              'Button aria-labelledby name "' + resolvedText.substring(0, 30) + '" doesn\'t include visible text "' + text.substring(0, 30) + '"',
              button,
              'Ensure aria-labelledby references include the visible button text',
              'Voice control users may not be able to activate the button by speaking the visible text'
            );
            return;
          }
        }
      }

      // Check 6: Disabled state
      if (disabled) {
        const hasAriaDisabled = button.getAttribute('aria-disabled') === 'true';
        const hasDisabledAttr = button.hasAttribute('disabled');
        
        if (!hasAriaDisabled && !hasDisabledAttr) {
          addIssue(
            'minor',
            '4.1.2',
            'Name, Role, Value',
            'Disabled button not properly marked',
            button,
            'Add disabled attribute or aria-disabled="true"',
            'Button state may not be conveyed to assistive technologies'
          );
          return;
        }
      }

      // Check 7: Type attribute for <button> elements
      if (tagName === 'button' && !type) {
        addIssue(
          'minor',
          '4.1.2',
          'Name, Role, Value',
          'Button missing type attribute',
          button,
          'Add type="button" or type="submit" to clarify button behavior',
          'Button defaults to type="submit" which may cause unintended form submissions'
        );
        return;
      }

      // If we made it here, button seems accessible
      // Don't add passed for every single button (too noisy)
    });

    // Summary passed check
    const buttonsChecked = results.stats.elementsScanned;
    if (buttonsChecked > 0) {
      addPassed('4.1.2', 'Name, Role, Value', buttonsChecked + ' buttons checked for accessibility');
    }
  }

  // ==========================================================================
  // RUN TESTS
  // ==========================================================================

  testAllButtons();

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
  window.runButtonsAudit = runButtonsAudit;
}
