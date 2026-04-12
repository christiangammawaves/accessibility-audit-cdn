/**
 * Focus Trap & Focus Management Audit Script
 * 
 * Tests keyboard focus management for modal dialogs, menus, and interactive components.
 * 
 * WCAG Criteria:
 * - 2.1.2 No Keyboard Trap - User can navigate away from any element using keyboard
 * - 2.4.3 Focus Order - Focus moves in meaningful sequence
 * - 2.4.7 Focus Visible - Focus indicator is visible
 * - 4.1.2 Name, Role, Value - Components have proper ARIA attributes
 * 
 * Coverage:
 * - Modal/dialog focus trapping (must contain focus when open)
 * - Dropdown/menu keyboard navigation
 * - Tab panel focus management
 * - Focus restoration after modal close
 * - Focus indicator visibility
 * - Escape key handling
 * 
 * Limitations:
 * - Static analysis only (cannot simulate actual keyboard interaction)
 * - Heuristic-based detection (may miss custom patterns)
 * - Requires manual verification for complex interactions
 * 
 * Usage:
 *   const results = auditFocusTraps();
 *   console.log(results);
 * 
 * @updated 2026-01-25
 */

(function(global) {
  'use strict';

  // ============================================================
  // Configuration
  // ============================================================

  const MODAL_SELECTORS = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[aria-modal="true"]',
    '.modal',
    '.dialog',
    '.popup',
    '.overlay',
    '[class*="modal"]',
    '[class*="dialog"]'
  ].join(', ');

  const MENU_SELECTORS = [
    '[role="menu"]',
    '[role="listbox"]',
    '[role="combobox"]',
    '[aria-haspopup]',
    '.dropdown',
    '[class*="dropdown"]',
    '[class*="popover"]'
  ].join(', ');

  const FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
    'audio[controls]',
    'video[controls]',
    'details > summary'
  ].join(', ');

  if (!global.a11yHelpers) throw new Error('[focus-trap-audit] shared-helpers.js must be loaded first — check injection order');

  // ============================================================
  // Helper Functions (delegate to a11yHelpers)
  // ============================================================

  const helpers = global.a11yHelpers;

  function getFocusableElements(container) {
    // Delegate to shared-helpers if available
    if (helpers.getFocusableElements) return helpers.getFocusableElements(container);
    
    // Fallback implementation
    if (!container) return [];
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS))
      .filter(el => helpers.isVisible(el) && !el.disabled);
  }

  // ============================================================
  // Modal Focus Management Audit
  // ============================================================

  function auditModalFocusManagement() {
    const issues = [];
    const modals = document.querySelectorAll(MODAL_SELECTORS);

    modals.forEach(modal => {
      const selector = helpers.getSelector(modal);
      const isVisible = helpers.isVisible(modal);
      
      if (!isVisible) return; // Skip hidden modals
      
      const focusableElements = getFocusableElements(modal);
      const hasRole = modal.getAttribute('role') === 'dialog' || 
                     modal.getAttribute('role') === 'alertdialog';
      const hasAriaModal = modal.getAttribute('aria-modal') === 'true';
      const hasLabel = modal.getAttribute('aria-label') || 
                      modal.getAttribute('aria-labelledby');
      
      // Check for accessible name
      if (!hasLabel) {
        issues.push({
          type: 'modal-no-label',
          wcag: '4.1.2',
          severity: 'serious',
          element: selector,
          issue: 'Modal dialog has no accessible name',
          recommendation: 'Add aria-label or aria-labelledby to the dialog',
          manualTests: ['Verify screen reader announces dialog purpose']
        });
      }

      // Check for proper role
      if (!hasRole) {
        issues.push({
          type: 'modal-no-role',
          wcag: '4.1.2',
          severity: 'serious',
          element: selector,
          issue: 'Modal dialog missing role="dialog" or role="alertdialog"',
          recommendation: 'Add role="dialog" to the modal element',
          manualTests: []
        });
      }

      // Check for aria-modal
      if (!hasAriaModal && hasRole) {
        issues.push({
          type: 'modal-no-aria-modal',
          wcag: '4.1.2',
          severity: 'moderate',
          element: selector,
          issue: 'Modal dialog missing aria-modal="true"',
          recommendation: 'Add aria-modal="true" to prevent screen reader from exiting dialog',
          manualTests: []
        });
      }

      // Check for focusable elements
      if (focusableElements.length === 0) {
        issues.push({
          type: 'modal-no-focusable',
          wcag: '2.1.2',
          severity: 'critical',
          element: selector,
          issue: 'Modal dialog has no focusable elements',
          recommendation: 'Add at least one focusable element (close button) to the modal',
          manualTests: ['Verify user can interact with modal content']
        });
      }

      // Check for close mechanism
      const closeButton = modal.querySelector(
        '[aria-label*="close" i], [aria-label*="dismiss" i], [aria-label*="cancel" i], ' +
        'button[class*="close"], .close, .dismiss, [data-dismiss], ' +
        'button:has(svg[class*="close"]), button:has([class*="icon-close"])'
      );

      if (!closeButton) {
        issues.push({
          type: 'modal-no-close',
          wcag: '2.1.2',
          severity: 'serious',
          element: selector,
          issue: 'Modal dialog may lack accessible close button',
          recommendation: 'Add a close button with aria-label="Close" or visible "Close" text',
          manualTests: ['Verify modal can be closed with visible button']
        });
      }

      // Escape key handling heuristics
      const isNativeDialog = modal.tagName === 'DIALOG';
      if (isNativeDialog) {
        // Native <dialog> supports Escape by default — no issue
      } else if (closeButton) {
        // Close button exists — Escape likely works but verify
        issues.push({
          type: 'modal-escape-key',
          wcag: '2.1.1',
          severity: 'minor',
          element: selector,
          issue: 'Modal has a close button. Verify that pressing Escape also closes the modal.',
          recommendation: 'Ensure pressing Escape key closes the modal and returns focus to trigger',
          manualTests: [
            'Open the modal, press Escape, verify it closes and focus returns to trigger'
          ],
          needsManualVerification: true
        });
      } else {
        // No close button and not a native dialog — higher risk
        issues.push({
          type: 'modal-escape-key',
          wcag: '2.1.1',
          severity: 'serious',
          element: selector,
          issue: 'Modal/dialog has no visible close button and is not a native <dialog>. Escape key dismissal cannot be verified automatically.',
          recommendation: 'Add a close button with aria-label="Close" and ensure Escape key closes the modal',
          manualTests: [
            'Press Escape key to close modal',
            'Verify focus returns to trigger element'
          ],
          needsManualVerification: true
        });
      }

      // Flag for focus trap verification
      if (focusableElements.length > 0) {
        issues.push({
          type: 'modal-focus-trap',
          wcag: '2.4.3',
          severity: 'moderate',
          element: selector,
          focusableCount: focusableElements.length,
          firstFocusable: helpers.getSelector(focusableElements[0]),
          lastFocusable: helpers.getSelector(focusableElements[focusableElements.length - 1]),
          issue: 'Manual verification needed: Focus trapping',
          recommendation: 'Verify Tab/Shift+Tab cycle within modal and do not escape',
          manualTests: [
            'Tab to last element, then Tab again - focus should move to first element',
            'From first element, Shift+Tab should move to last element',
            'Focus should not escape to content behind modal'
          ],
          needsManualVerification: true
        });
      }
    });

    return issues;
  }

  // ============================================================
  // Dropdown/Menu Focus Management Audit
  // ============================================================

  function auditDropdownFocusManagement() {
    const issues = [];
    const menus = document.querySelectorAll(MENU_SELECTORS);

    menus.forEach(menu => {
      const selector = helpers.getSelector(menu);
      const isVisible = helpers.isVisible(menu);
      
      // For hidden menus, check the trigger
      const trigger = document.querySelector(`[aria-controls="${menu.id}"], [aria-owns="${menu.id}"]`) ||
                     menu.closest('[aria-haspopup]')?.querySelector('button, [role="button"]');
      
      const role = menu.getAttribute('role');
      const hasAriaExpanded = trigger?.hasAttribute('aria-expanded');

      // Check for proper ARIA attributes on trigger
      if (trigger && !hasAriaExpanded) {
        issues.push({
          type: 'dropdown-no-expanded',
          wcag: '4.1.2',
          severity: 'moderate',
          element: helpers.getSelector(trigger),
          menuSelector: selector,
          issue: 'Dropdown trigger missing aria-expanded attribute',
          recommendation: 'Add aria-expanded="false" to trigger, toggle to "true" when open',
          manualTests: []
        });
      }

      // Check for role on menu
      if (!role && menu.tagName.toLowerCase() !== 'select') {
        issues.push({
          type: 'dropdown-no-role',
          wcag: '4.1.2',
          severity: 'moderate',
          element: selector,
          issue: 'Dropdown menu missing role (menu, listbox, or combobox)',
          recommendation: 'Add appropriate role attribute based on menu type',
          manualTests: []
        });
      }

      // Check menu items
      const items = menu.querySelectorAll(
        '[role="menuitem"], [role="option"], [role="menuitemcheckbox"], ' +
        '[role="menuitemradio"], li, a, button'
      );

      if (items.length > 0 && role === 'menu') {
        const menuItems = Array.from(items).filter(item => 
          item.getAttribute('role')?.startsWith('menuitem') || 
          item.tagName === 'A' || 
          item.tagName === 'BUTTON'
        );

        // Verify menu items have proper roles
        const hasProperRoles = menuItems.every(item => 
          item.getAttribute('role')?.startsWith('menuitem')
        );

        if (!hasProperRoles) {
          issues.push({
            type: 'dropdown-items-no-role',
            wcag: '4.1.2',
            severity: 'moderate',
            element: selector,
            issue: 'Menu items missing role="menuitem"',
            recommendation: 'Add role="menuitem" to each menu option',
            manualTests: []
          });
        }
      }

      // Flag for keyboard navigation testing
      issues.push({
        type: 'dropdown-keyboard',
        wcag: '2.1.1',
        severity: 'moderate',
        element: selector,
        issue: 'Manual verification needed: Dropdown keyboard navigation',
        recommendation: 'Verify arrow keys navigate menu, Escape closes and returns focus',
        manualTests: [
          'Arrow Down/Up keys move through options',
          'Enter/Space selects current option',
          'Escape closes menu and returns focus to trigger',
          'Tab closes menu and moves to next element'
        ],
        needsManualVerification: true
      });
    });

    return issues;
  }

  // ============================================================
  // Tab Panel Focus Management Audit
  // ============================================================

  function auditTabPanelFocusManagement() {
    const issues = [];
    const tabLists = document.querySelectorAll('[role="tablist"]');

    tabLists.forEach(tablist => {
      const selector = helpers.getSelector(tablist);
      const tabs = tablist.querySelectorAll('[role="tab"]');
      
      if (tabs.length === 0) return;

      // Check aria-selected on tabs
      const selectedTabs = Array.from(tabs).filter(tab => 
        tab.getAttribute('aria-selected') === 'true'
      );

      if (selectedTabs.length === 0) {
        issues.push({
          type: 'tab-no-selected',
          wcag: '4.1.2',
          severity: 'moderate',
          element: selector,
          issue: 'No tab has aria-selected="true"',
          recommendation: 'Set aria-selected="true" on the active tab',
          manualTests: []
        });
      }

      // Check tab-tabpanel association
      tabs.forEach(tab => {
        const controls = tab.getAttribute('aria-controls');
        if (!controls) {
          issues.push({
            type: 'tab-no-controls',
            wcag: '4.1.2',
            severity: 'moderate',
            element: helpers.getSelector(tab),
            issue: 'Tab missing aria-controls attribute',
            recommendation: 'Add aria-controls pointing to associated tabpanel id',
            manualTests: []
          });
        } else {
          const panel = document.getElementById(controls);
          if (!panel) {
            issues.push({
              type: 'tab-missing-panel',
              wcag: '4.1.2',
              severity: 'serious',
              element: helpers.getSelector(tab),
              issue: `Tab panel with id="${controls}" not found`,
              recommendation: 'Ensure aria-controls points to existing tabpanel',
              manualTests: []
            });
          } else if (panel.getAttribute('role') !== 'tabpanel') {
            issues.push({
              type: 'panel-no-role',
              wcag: '4.1.2',
              severity: 'moderate',
              element: `#${controls}`,
              issue: 'Associated element missing role="tabpanel"',
              recommendation: 'Add role="tabpanel" to the panel element',
              manualTests: []
            });
          }
        }
      });

      // Flag for keyboard navigation testing
      issues.push({
        type: 'tabs-keyboard',
        wcag: '2.1.1',
        severity: 'moderate',
        element: selector,
        tabCount: tabs.length,
        issue: 'Manual verification needed: Tab widget keyboard navigation',
        recommendation: 'Verify arrow keys move between tabs, Tab moves to panel content',
        manualTests: [
          'Arrow Left/Right keys move between tabs',
          'Tab key moves focus into the active tabpanel',
          'Shift+Tab from panel returns to tablist',
          'Home/End keys move to first/last tab'
        ],
        needsManualVerification: true
      });
    });

    return issues;
  }

  // ============================================================
  // Keyboard Trap Detection
  // ============================================================

  function auditKeyboardTraps() {
    const issues = [];

    // Check for iframes (potential traps)
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      if (!helpers.isVisible(iframe)) return;
      
      issues.push({
        type: 'iframe-trap',
        wcag: '2.1.2',
        severity: 'moderate',
        element: helpers.getSelector(iframe),
        src: iframe.src || 'unknown',
        issue: 'Manual verification needed: iframe keyboard trap',
        recommendation: 'Verify user can Tab out of iframe content',
        manualTests: [
          'Tab into iframe content',
          'Continue tabbing to verify exit from iframe'
        ],
        needsManualVerification: true
      });
    });

    // Check for contenteditable (potential traps)
    const editableElements = document.querySelectorAll('[contenteditable="true"]');
    editableElements.forEach(el => {
      if (!helpers.isVisible(el)) return;
      
      issues.push({
        type: 'contenteditable-trap',
        wcag: '2.1.2',
        severity: 'minor',
        element: helpers.getSelector(el),
        issue: 'Manual verification needed: contenteditable keyboard trap',
        recommendation: 'Verify Tab key exits contenteditable area',
        manualTests: [
          'Focus contenteditable element',
          'Press Tab to verify focus exits'
        ],
        needsManualVerification: true
      });
    });

    // Check for embedded content
    const embeds = document.querySelectorAll('embed, object, video[controls], audio[controls]');
    embeds.forEach(embed => {
      if (!helpers.isVisible(embed)) return;
      
      issues.push({
        type: 'embed-trap',
        wcag: '2.1.2',
        severity: 'moderate',
        element: helpers.getSelector(embed),
        issue: 'Manual verification needed: embedded content keyboard trap',
        recommendation: 'Verify keyboard navigation in and out of embedded content',
        manualTests: [
          'Tab into embedded content',
          'Verify ability to Tab out',
          'Test all interactive controls within embed'
        ],
        needsManualVerification: true
      });
    });

    return issues;
  }

  // ============================================================
  // Focus Indicator Visibility Audit
  // ============================================================

  function auditFocusIndicators() {
    const issues = [];
    let outlineNoneWithoutAlt = false;

    // Check stylesheets for :focus { outline: none }
    try {
      for (const sheet of document.styleSheets) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) continue;
          
          for (const rule of rules) {
            if (!rule.selectorText?.includes(':focus')) continue;
            
            const cssText = rule.cssText;
            
            // Check for outline removal
            if (cssText.includes('outline: none') || 
                cssText.includes('outline:none') ||
                cssText.includes('outline: 0') ||
                cssText.includes('outline:0')) {
              
              // Check for alternative focus indicator
              const hasAlt = cssText.includes('box-shadow') ||
                            cssText.includes('border') ||
                            cssText.includes('background') ||
                            cssText.includes('text-decoration') ||
                            cssText.includes('outline:') && !cssText.includes('outline: none') && !cssText.includes('outline:none');
              
              if (!hasAlt) {
                outlineNoneWithoutAlt = true;
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheet
        }
      }
    } catch (e) {
      // Unable to access stylesheets
    }

    if (outlineNoneWithoutAlt) {
      issues.push({
        type: 'focus-outline-removed',
        wcag: '2.4.7',
        severity: 'serious',
        element: 'global-styles',
        issue: 'CSS removes focus outline without visible alternative',
        recommendation: 'Add custom focus styles (box-shadow, border, etc.) when removing outline',
        manualTests: [
          'Tab through all interactive elements',
          'Verify visible focus indicator on each'
        ]
      });
    }

    // Flag for comprehensive focus testing
    issues.push({
      type: 'focus-visibility-test',
      wcag: '2.4.7',
      severity: 'moderate',
      element: 'page',
      issue: 'Manual verification needed: Focus indicator visibility',
      recommendation: 'Tab through page to verify all elements have visible focus with 3:1 contrast',
      manualTests: [
        'Tab through all interactive elements',
        'Verify focus indicator is clearly visible',
        'Check focus indicator has 3:1 contrast ratio',
        'Test in both light and dark mode if applicable'
      ],
      needsManualVerification: true
    });

    return issues;
  }

  // ============================================================
  // Main Audit Function
  // ============================================================

  function auditFocusTraps(options = {}) {
    const startTime = performance.now();

    const results = {
      meta: {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        auditType: 'focus-management',
        auditVersion: (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown',
        wcagCriteria: ['2.1.2', '2.4.3', '2.4.7', '4.1.2']
      },
      summary: {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        total: 0,
        modalIssues: 0,
        dropdownIssues: 0,
        tabIssues: 0,
        trapIssues: 0,
        focusIndicatorIssues: 0,
        requiresManualVerification: 0
      },
      issues: [],
      manualTestsRequired: []
    };

    // Run all audits
    const modalIssues = auditModalFocusManagement();
    const dropdownIssues = auditDropdownFocusManagement();
    const tabIssues = auditTabPanelFocusManagement();
    const trapIssues = auditKeyboardTraps();
    const focusIssues = auditFocusIndicators();

    // Combine and categorize
    const allIssues = [
      ...modalIssues,
      ...dropdownIssues,
      ...tabIssues,
      ...trapIssues,
      ...focusIssues
    ];

    // Separate manual tests from automated findings
    for (const issue of allIssues) {
      if (issue.needsManualVerification) {
        results.manualTestsRequired.push(issue);
        results.summary.requiresManualVerification++;
      } else {
        results.issues.push(issue);
        results.summary[issue.severity]++;
        results.summary.total++;
      }
    }

    // Update category counts
    results.summary.modalIssues = modalIssues.filter(i => !i.needsManualVerification).length;
    results.summary.dropdownIssues = dropdownIssues.filter(i => !i.needsManualVerification).length;
    results.summary.tabIssues = tabIssues.filter(i => !i.needsManualVerification).length;
    results.summary.trapIssues = trapIssues.filter(i => !i.needsManualVerification).length;
    results.summary.focusIndicatorIssues = focusIssues.filter(i => !i.needsManualVerification).length;

    // Sort by severity
    const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    results.issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    results.meta.executionTimeMs = Math.round(performance.now() - startTime);

    return results;
  }

  // Export
  global.auditFocusTraps = auditFocusTraps;

  console.log(' Focus Trap & Management Audit Script loaded');
  console.log('  Run: auditFocusTraps()');
  console.log('  Tests: WCAG 2.1.2, 2.4.3, 2.4.7, 4.1.2');

})(typeof window !== 'undefined' ? window : global);
