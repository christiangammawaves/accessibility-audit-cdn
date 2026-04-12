/**
 * Dynamic Component State Testing
 * 
 * Tests interactive components in multiple states (open/closed, expanded/collapsed, etc.)
 * Focuses on ARIA patterns and state management for dynamic UI components.
 * 
 * Coverage: Modals, Tabs, Accordions, Dropdowns, Tooltips, Carousels
 * 
 * WCAG Criteria:
 * - 1.3.1 Info and Relationships - Structure conveyed programmatically
 * - 2.1.1 Keyboard - All functionality keyboard accessible
 * - 2.2.2 Pause, Stop, Hide - Control for auto-advancing content
 * - 2.4.3 Focus Order - Logical navigation sequence
 * - 4.1.2 Name, Role, Value - Components have accessible names and states
 * - 4.1.3 Status Messages - Dynamic content announced appropriately
 * 
 * Usage:
 *   const results = testDynamicComponents();
 *   console.log(JSON.stringify(results, null, 2));
 * 
 *   // With options:
 *   const results = testDynamicComponents({ 
 *     testInteraction: true,
 *     timeout: 3000 
 *   });
 * 
 * @updated 2026-01-25
 */

(function(global) {
  'use strict';

  function testDynamicComponents(options = {}) {
    const config = {
      testInteraction: options.testInteraction ?? true,
      timeout: options.timeout ?? 3000,
      ...options
    };

    const startTime = performance.now();

    const results = {
      meta: {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        auditType: 'dynamic-components',
        auditVersion: (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown',
        wcagVersion: '2.2',
        level: 'AA'
      },
      summary: {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        total: 0,
        passed: 0,
        totalComponents: 0
      },
      components: {
        modals: [],
        tabs: [],
        accordions: [],
        dropdowns: [],
        tooltips: [],
        carousels: []
      },
      issues: [],
      manualChecks: []
    };

    if (!global.a11yHelpers) throw new Error('[dynamic-components] shared-helpers.js must be loaded first — check injection order');

    // ============================================================================
    // HELPER FUNCTIONS (delegate to a11yHelpers)
    // ============================================================================

    const helpers = global.a11yHelpers;

    const WCAG_CRITERION_NAMES = {
      '1.3.1': 'Info and Relationships',
      '2.1.1': 'Keyboard',
      '2.1.2': 'No Keyboard Trap',
      '2.2.2': 'Pause, Stop, Hide',
      '2.4.3': 'Focus Order',
      '4.1.2': 'Name, Role, Value',
      '4.1.3': 'Status Messages'
    };

    function addIssue(severity, wcag, message, element, fix, componentType) {
      results.issues.push({
        severity,
        wcag,
        criterion: WCAG_CRITERION_NAMES[wcag] || wcag,
        message,
        selector: element ? helpers.getSelector(element) : null,
        tagName: element?.tagName?.toLowerCase() || null,
        fix,
        componentType,
        category: 'dynamic-components',
        source: 'dynamic-components'
      });
      results.summary[severity]++;
      results.summary.total++;
    }

    function addManualCheck(wcag, description, elements = [], priority = 'medium') {
      results.manualChecks.push({
        wcag,
        criterion: WCAG_CRITERION_NAMES[wcag] || wcag,
        description,
        elementCount: elements.length,
        selectors: elements.slice(0, 5).map(e => helpers.getSelector(e)),
        priority,
        source: 'dynamic-components'
      });
    }

    // ============================================================================
    // MODAL/DIALOG TESTING
    // ============================================================================

    function testModals() {
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog, [aria-modal="true"]');
      
      dialogs.forEach(dialog => {
        const modal = {
          selector: helpers.getSelector(dialog),
          type: dialog.tagName.toLowerCase() === 'dialog' ? 'native' : 'aria',
          issues: [],
          attributes: {
            role: dialog.getAttribute('role'),
            ariaModal: dialog.getAttribute('aria-modal'),
            ariaLabel: dialog.getAttribute('aria-label'),
            ariaLabelledby: dialog.getAttribute('aria-labelledby'),
            ariaDescribedby: dialog.getAttribute('aria-describedby')
          },
          hasCloseButton: !!dialog.querySelector('[aria-label*="close" i], [aria-label*="dismiss" i], button.close, .close-button, [class*="close"]'),
          isOpen: !dialog.hidden && window.getComputedStyle(dialog).display !== 'none'
        };

        // Check for accessible name
        if (!modal.attributes.ariaLabel && !modal.attributes.ariaLabelledby) {
          modal.issues.push({
            wcag: '4.1.2',
            severity: 'critical',
            issue: 'Dialog missing accessible name',
            fix: 'Add aria-labelledby pointing to dialog title or aria-label'
          });
          addIssue('critical', '4.1.2', 'Dialog missing accessible name', dialog,
            'Add aria-labelledby or aria-label', 'modal');
        } else {
          results.summary.passed++;
        }

        // Check for aria-modal on ARIA dialogs
        if (modal.type !== 'native' && modal.attributes.ariaModal !== 'true') {
          modal.issues.push({
            wcag: '4.1.2',
            severity: 'serious',
            issue: 'ARIA dialog missing aria-modal="true"',
            fix: 'Add aria-modal="true" to indicate modal behavior'
          });
          addIssue('serious', '4.1.2', 'ARIA dialog missing aria-modal', dialog,
            'Add aria-modal="true"', 'modal');
        }

        // Check for close mechanism
        if (!modal.hasCloseButton) {
          const hasEscapeHandler = dialog.hasAttribute('data-dismiss') || 
                                   dialog.closest('[data-dismiss]');
          if (!hasEscapeHandler) {
            modal.issues.push({
              wcag: '2.1.2',
              severity: 'serious',
              issue: 'No visible close button found',
              fix: 'Add close button with accessible label'
            });
            addIssue('serious', '2.1.2', 'Dialog has no visible close button', dialog,
              'Add close button with aria-label', 'modal');
          }
        }

        // Check focus trap indicators
        const focusableInDialog = dialog.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        modal.focusableElements = focusableInDialog.length;

        if (modal.isOpen && focusableInDialog.length === 0) {
          modal.issues.push({
            wcag: '2.4.3',
            severity: 'critical',
            issue: 'Open dialog has no focusable elements',
            fix: 'Ensure dialog has at least one focusable element'
          });
          addIssue('critical', '2.4.3', 'Open dialog has no focusable elements', dialog,
            'Add focusable elements or close button', 'modal');
        }

        // Manual check for focus trap
        if (modal.isOpen) {
          addManualCheck('2.4.3', 
            'Verify focus is trapped within open modal and returns to trigger on close',
            [dialog], 'high');
        }

        results.components.modals.push(modal);
        results.summary.totalComponents++;
      });
    }

    // ============================================================================
    // TAB PANEL TESTING
    // ============================================================================

    function testTabs() {
      const tablists = document.querySelectorAll('[role="tablist"]');
      
      tablists.forEach(tablist => {
        const tabComponent = {
          selector: helpers.getSelector(tablist),
          issues: [],
          attributes: {
            ariaLabel: tablist.getAttribute('aria-label'),
            ariaLabelledby: tablist.getAttribute('aria-labelledby'),
            orientation: tablist.getAttribute('aria-orientation') || 'horizontal'
          },
          tabs: [],
          panels: []
        };

        // Check tablist accessible name
        if (!tabComponent.attributes.ariaLabel && !tabComponent.attributes.ariaLabelledby) {
          tabComponent.issues.push({
            wcag: '4.1.2',
            severity: 'moderate',
            issue: 'Tablist missing accessible name',
            fix: 'Add aria-label describing the tab group purpose'
          });
          addIssue('moderate', '4.1.2', 'Tablist missing accessible name', tablist,
            'Add aria-label', 'tabs');
        }

        const tabs = tablist.querySelectorAll('[role="tab"]');
        let hasSelectedTab = false;
        
        tabs.forEach((tab, index) => {
          const tabData = {
            index,
            selector: helpers.getSelector(tab),
            ariaSelected: tab.getAttribute('aria-selected'),
            ariaControls: tab.getAttribute('aria-controls'),
            tabindex: tab.getAttribute('tabindex'),
            issues: []
          };

          // Check aria-selected
          if (!tabData.ariaSelected) {
            tabData.issues.push({
              wcag: '4.1.2',
              severity: 'critical',
              issue: 'Tab missing aria-selected',
              fix: 'Add aria-selected="true" or "false"'
            });
            addIssue('critical', '4.1.2', 'Tab missing aria-selected', tab,
              'Add aria-selected attribute', 'tabs');
          } else if (tabData.ariaSelected === 'true') {
            hasSelectedTab = true;
          }

          // Check aria-controls
          if (!tabData.ariaControls) {
            tabData.issues.push({
              wcag: '4.1.2',
              severity: 'serious',
              issue: 'Tab missing aria-controls',
              fix: 'Add aria-controls pointing to associated tabpanel ID'
            });
            addIssue('serious', '4.1.2', 'Tab missing aria-controls', tab,
              'Add aria-controls pointing to tabpanel', 'tabs');
          } else {
            // Verify panel exists
            const panel = document.getElementById(tabData.ariaControls);
            if (!panel) {
              tabData.issues.push({
                wcag: '4.1.2',
                severity: 'critical',
                issue: `aria-controls references non-existent ID: ${tabData.ariaControls}`,
                fix: 'Ensure tabpanel with matching ID exists'
              });
              addIssue('critical', '4.1.2', 'aria-controls references missing element', tab,
                'Create tabpanel with matching ID', 'tabs');
            } else if (panel.getAttribute('role') !== 'tabpanel') {
              tabData.issues.push({
                wcag: '4.1.2',
                severity: 'serious',
                issue: 'Controlled element missing role="tabpanel"',
                fix: 'Add role="tabpanel" to panel element'
              });
              addIssue('serious', '4.1.2', 'Panel missing role="tabpanel"', panel,
                'Add role="tabpanel"', 'tabs');
            }
          }

          // Check keyboard handling (selected tab should have tabindex="0")
          if (tabData.ariaSelected === 'true' && tabData.tabindex !== '0') {
            tabData.issues.push({
              wcag: '2.1.1',
              severity: 'serious',
              issue: 'Selected tab should have tabindex="0"',
              fix: 'Set tabindex="0" on selected tab'
            });
            addIssue('serious', '2.1.1', 'Selected tab missing tabindex="0"', tab,
              'Set tabindex="0" on selected tab', 'tabs');
          }

          tabComponent.tabs.push(tabData);
        });

        // Check that at least one tab is selected
        if (tabs.length > 0 && !hasSelectedTab) {
          addIssue('serious', '4.1.2', 'No tab has aria-selected="true"', tablist,
            'Set aria-selected="true" on the active tab', 'tabs');
        }

        // Check tabpanels
        const panels = document.querySelectorAll('[role="tabpanel"]');
        panels.forEach(panel => {
          const panelData = {
            id: panel.id,
            selector: helpers.getSelector(panel),
            ariaLabelledby: panel.getAttribute('aria-labelledby'),
            tabindex: panel.getAttribute('tabindex'),
            hidden: panel.hidden || window.getComputedStyle(panel).display === 'none',
            issues: []
          };

          if (!panelData.ariaLabelledby) {
            panelData.issues.push({
              wcag: '4.1.2',
              severity: 'moderate',
              issue: 'Tabpanel missing aria-labelledby',
              fix: 'Add aria-labelledby pointing to associated tab ID'
            });
            addIssue('moderate', '4.1.2', 'Tabpanel missing aria-labelledby', panel,
              'Add aria-labelledby pointing to tab', 'tabs');
          }

          tabComponent.panels.push(panelData);
        });

        // Manual check for arrow key navigation
        addManualCheck('2.1.1',
          'Verify tabs support arrow key navigation (left/right for horizontal, up/down for vertical)',
          Array.from(tabs), 'medium');

        results.components.tabs.push(tabComponent);
        results.summary.totalComponents++;
      });
    }

    // ============================================================================
    // ACCORDION TESTING
    // ============================================================================

    function testAccordions() {
      // Look for common accordion patterns
      const accordionTriggers = document.querySelectorAll(
        '[aria-expanded][aria-controls], .accordion-header, .accordion-trigger, .accordion button, details > summary'
      );

      const processedParents = new Set();

      accordionTriggers.forEach(trigger => {
        // Skip if part of tabs or menus
        if (trigger.closest('[role="tablist"]')) return;
        if (trigger.closest('[role="menu"]')) return;
        if (trigger.getAttribute('aria-haspopup')) return;
        
        // Group by parent container
        const parent = trigger.closest('.accordion, [data-accordion], [role="region"], details') || trigger.parentElement;
        if (processedParents.has(parent)) return;
        processedParents.add(parent);
        
        const accordion = {
          selector: helpers.getSelector(trigger),
          issues: [],
          attributes: {
            ariaExpanded: trigger.getAttribute('aria-expanded'),
            ariaControls: trigger.getAttribute('aria-controls'),
            role: trigger.getAttribute('role')
          },
          isExpanded: trigger.getAttribute('aria-expanded') === 'true' || 
                      (trigger.tagName === 'SUMMARY' && trigger.parentElement.open)
        };

        // Handle native <details>/<summary>
        if (trigger.tagName === 'SUMMARY') {
          // Native details/summary has good built-in accessibility
          results.components.accordions.push(accordion);
          results.summary.totalComponents++;
          results.summary.passed++;
          return;
        }

        // Check aria-expanded
        if (accordion.attributes.ariaExpanded === null) {
          accordion.issues.push({
            wcag: '4.1.2',
            severity: 'critical',
            issue: 'Accordion trigger missing aria-expanded',
            fix: 'Add aria-expanded="true" or "false" to indicate current state'
          });
          addIssue('critical', '4.1.2', 'Accordion trigger missing aria-expanded', trigger,
            'Add aria-expanded attribute', 'accordion');
        }

        // Check aria-controls
        if (!accordion.attributes.ariaControls) {
          accordion.issues.push({
            wcag: '4.1.2',
            severity: 'serious',
            issue: 'Accordion trigger missing aria-controls',
            fix: 'Add aria-controls pointing to panel ID'
          });
          addIssue('serious', '4.1.2', 'Accordion trigger missing aria-controls', trigger,
            'Add aria-controls attribute', 'accordion');
        } else {
          const panel = document.getElementById(accordion.attributes.ariaControls);
          if (!panel) {
            accordion.issues.push({
              wcag: '4.1.2',
              severity: 'critical',
              issue: 'aria-controls references non-existent panel',
              fix: 'Ensure panel with matching ID exists'
            });
            addIssue('critical', '4.1.2', 'aria-controls references non-existent element', trigger,
              'Create panel with matching ID', 'accordion');
          }
        }

        // Check trigger is a button or has button role
        if (trigger.tagName !== 'BUTTON' && trigger.getAttribute('role') !== 'button') {
          accordion.issues.push({
            wcag: '4.1.2',
            severity: 'serious',
            issue: 'Accordion trigger is not a button',
            fix: 'Use <button> element or add role="button"'
          });
          addIssue('serious', '4.1.2', 'Accordion trigger not a button', trigger,
            'Use button element or role="button"', 'accordion');
        }

        if (accordion.issues.length === 0) {
          results.summary.passed++;
        }

        results.components.accordions.push(accordion);
        results.summary.totalComponents++;
      });
    }

    // ============================================================================
    // DROPDOWN MENU TESTING
    // ============================================================================

    function testDropdowns() {
      const menuButtons = document.querySelectorAll('[aria-haspopup="true"], [aria-haspopup="menu"], [aria-haspopup="listbox"]');

      menuButtons.forEach(button => {
        const dropdown = {
          selector: helpers.getSelector(button),
          issues: [],
          attributes: {
            ariaHaspopup: button.getAttribute('aria-haspopup'),
            ariaExpanded: button.getAttribute('aria-expanded'),
            ariaControls: button.getAttribute('aria-controls')
          },
          isExpanded: button.getAttribute('aria-expanded') === 'true'
        };

        // Check aria-expanded
        if (dropdown.attributes.ariaExpanded === null) {
          dropdown.issues.push({
            wcag: '4.1.2',
            severity: 'critical',
            issue: 'Dropdown trigger missing aria-expanded',
            fix: 'Add aria-expanded to indicate menu state'
          });
          addIssue('critical', '4.1.2', 'Dropdown missing aria-expanded', button,
            'Add aria-expanded attribute', 'dropdown');
        }

        // Check aria-controls and validate menu
        if (dropdown.attributes.ariaControls) {
          const menu = document.getElementById(dropdown.attributes.ariaControls);
          if (menu) {
            const role = menu.getAttribute('role');
            if (role !== 'menu' && role !== 'listbox' && role !== 'tree') {
              dropdown.issues.push({
                wcag: '4.1.2',
                severity: 'serious',
                issue: 'Controlled element missing appropriate role',
                fix: 'Add role="menu" or role="listbox" to dropdown container'
              });
              addIssue('serious', '4.1.2', 'Dropdown menu missing role', menu,
                'Add role="menu" or role="listbox"', 'dropdown');
            }

            // Check menu items
            const items = menu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"]');
            if (items.length === 0 && role === 'menu') {
              dropdown.issues.push({
                wcag: '4.1.2',
                severity: 'serious',
                issue: 'Menu has no menuitem children',
                fix: 'Add role="menuitem" to menu options'
              });
              addIssue('serious', '4.1.2', 'Menu has no menuitem children', menu,
                'Add role="menuitem" to options', 'dropdown');
            }
          } else {
            dropdown.issues.push({
              wcag: '4.1.2',
              severity: 'serious',
              issue: 'aria-controls references non-existent element',
              fix: 'Ensure menu element with matching ID exists'
            });
          }
        }

        if (dropdown.issues.length === 0) {
          results.summary.passed++;
        }

        // Manual check for keyboard navigation
        addManualCheck('2.1.1',
          'Verify dropdown supports Escape to close, arrow keys to navigate items',
          [button], 'medium');

        results.components.dropdowns.push(dropdown);
        results.summary.totalComponents++;
      });
    }

    // ============================================================================
    // TOOLTIP TESTING
    // ============================================================================

    function testTooltips() {
      const tooltipTriggers = document.querySelectorAll('[aria-describedby], [data-tooltip]');
      
      tooltipTriggers.forEach(trigger => {
        const describedbyId = trigger.getAttribute('aria-describedby');
        
        if (describedbyId) {
          const tooltip = {
            selector: helpers.getSelector(trigger),
            type: 'aria-describedby',
            issues: []
          };

          const tooltipEl = document.getElementById(describedbyId);
          if (!tooltipEl) {
            tooltip.issues.push({
              wcag: '4.1.2',
              severity: 'critical',
              issue: `aria-describedby references non-existent ID: ${describedbyId}`,
              fix: 'Ensure tooltip element with matching ID exists'
            });
            addIssue('critical', '4.1.2', 'aria-describedby references missing element', trigger,
              'Create tooltip with matching ID', 'tooltip');
          } else if (tooltipEl.getAttribute('role') !== 'tooltip') {
            tooltip.issues.push({
              wcag: '4.1.2',
              severity: 'moderate',
              issue: 'Tooltip element missing role="tooltip"',
              fix: 'Add role="tooltip" to tooltip container'
            });
            addIssue('moderate', '4.1.2', 'Tooltip missing role="tooltip"', tooltipEl,
              'Add role="tooltip"', 'tooltip');
          } else {
            results.summary.passed++;
          }

          results.components.tooltips.push(tooltip);
          results.summary.totalComponents++;
        }
      });

      // Check for title-only tooltips (problematic pattern)
      const titleOnlyElements = document.querySelectorAll('[title]:not([aria-describedby]):not(img):not(iframe):not(abbr):not(a):not(input)');
      titleOnlyElements.forEach(el => {
        // Only flag interactive elements with title
        if (el.matches('button, [role="button"], [tabindex]')) {
          addIssue('moderate', '2.1.1', 'Title attribute used for tooltip (keyboard/touch inaccessible)', el,
            'Use aria-describedby with visible tooltip element', 'tooltip');
          
          results.components.tooltips.push({
            selector: helpers.getSelector(el),
            type: 'title-only',
            issues: [{
              wcag: '2.1.1',
              severity: 'moderate',
              issue: 'Title tooltip inaccessible on keyboard/touch',
              fix: 'Use aria-describedby pattern instead'
            }]
          });
          results.summary.totalComponents++;
        }
      });
    }

    // ============================================================================
    // CAROUSEL/SLIDER TESTING
    // ============================================================================

    function testCarousels() {
      const carousels = document.querySelectorAll(
        '[class*="carousel"], [class*="slider"]:not(input), [class*="slideshow"], ' +
        '[class*="swiper"], [role="region"][aria-roledescription*="carousel" i], ' +
        '[data-carousel], [data-slider]'
      );

      carousels.forEach(carousel => {
        // Avoid duplicates from nested elements
        if (carousel.closest('[class*="carousel"], [class*="slider"]') !== carousel &&
            carousel.matches('[class*="carousel"] *, [class*="slider"] *')) {
          return;
        }

        const component = {
          selector: helpers.getSelector(carousel),
          issues: [],
          attributes: {
            role: carousel.getAttribute('role'),
            ariaLabel: carousel.getAttribute('aria-label'),
            ariaLabelledby: carousel.getAttribute('aria-labelledby'),
            ariaRoledescription: carousel.getAttribute('aria-roledescription')
          },
          hasControls: {
            previous: !!carousel.querySelector('[class*="prev"], [aria-label*="prev" i], [aria-label*="previous" i], button[class*="back"], button[class*="left"]'),
            next: !!carousel.querySelector('[class*="next"], [aria-label*="next" i], button[class*="forward"], button[class*="right"]'),
            pause: !!carousel.querySelector('[class*="pause"], [aria-label*="pause" i], [aria-label*="stop" i], [class*="play-pause"]'),
            indicators: carousel.querySelectorAll('[role="tab"], [class*="dot"], [class*="indicator"], [class*="pagination"] button').length
          }
        };

        // Check accessible name
        if (!component.attributes.ariaLabel && !component.attributes.ariaLabelledby) {
          component.issues.push({
            wcag: '4.1.2',
            severity: 'serious',
            issue: 'Carousel missing accessible name',
            fix: 'Add aria-label describing the carousel content'
          });
          addIssue('serious', '4.1.2', 'Carousel missing accessible name', carousel,
            'Add aria-label', 'carousel');
        }

        // Check for region role
        if (component.attributes.role !== 'region' && component.attributes.role !== 'group') {
          component.issues.push({
            wcag: '1.3.1',
            severity: 'moderate',
            issue: 'Carousel not identified as landmark region',
            fix: 'Add role="region" or role="group" with aria-roledescription="carousel"'
          });
          addIssue('moderate', '1.3.1', 'Carousel missing region role', carousel,
            'Add role="region" aria-roledescription="carousel"', 'carousel');
        }

        // Check for pause control (required for auto-advancing)
        if (!component.hasControls.pause) {
          component.issues.push({
            wcag: '2.2.2',
            severity: 'serious',
            issue: 'No pause control detected (required if auto-advancing)',
            fix: 'Add pause button if carousel auto-advances'
          });
          addManualCheck('2.2.2',
            'If carousel auto-advances, verify pause control is available',
            [carousel], 'high');
        }

        // Check navigation controls
        if (!component.hasControls.previous && !component.hasControls.next) {
          component.issues.push({
            wcag: '2.1.1',
            severity: 'serious',
            issue: 'No navigation controls detected',
            fix: 'Add previous/next buttons for keyboard navigation'
          });
          addIssue('serious', '2.1.1', 'Carousel missing navigation controls', carousel,
            'Add previous/next buttons', 'carousel');
        }

        // Check slide announcements
        const liveRegion = carousel.querySelector('[aria-live]');
        if (!liveRegion) {
          component.issues.push({
            wcag: '4.1.3',
            severity: 'moderate',
            issue: 'No live region for slide change announcements',
            fix: 'Add aria-live="polite" region to announce current slide'
          });
          addIssue('moderate', '4.1.3', 'Carousel missing live region for announcements', carousel,
            'Add aria-live="polite" to announce slide changes', 'carousel');
        }

        if (component.issues.length === 0) {
          results.summary.passed++;
        }

        results.components.carousels.push(component);
        results.summary.totalComponents++;
      });
    }

    // ============================================================================
    // DISCLOSURE WIDGET TESTING (Bonus)
    // ============================================================================

    function testDisclosures() {
      // Find disclosure buttons not already captured as accordions
      const disclosures = document.querySelectorAll('button[aria-expanded]:not([aria-haspopup])');
      
      disclosures.forEach(button => {
        // Skip if already processed as accordion or tab
        if (button.closest('[role="tablist"]')) return;
        if (button.closest('.accordion')) return;
        
        const controls = button.getAttribute('aria-controls');
        if (controls) {
          const panel = document.getElementById(controls);
          if (panel) {
            // Check panel visibility matches aria-expanded
            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            const panelVisible = window.getComputedStyle(panel).display !== 'none' && !panel.hidden;
            
            if (isExpanded !== panelVisible) {
              addIssue('serious', '4.1.2', 
                'Disclosure aria-expanded state does not match panel visibility', 
                button,
                'Ensure aria-expanded="true" when panel is visible, "false" when hidden',
                'disclosure');
            }
          }
        }
      });
    }

    // ============================================================================
    // RUN ALL TESTS
    // ============================================================================

    testModals();
    testTabs();
    testAccordions();
    testDropdowns();
    testTooltips();
    testCarousels();
    testDisclosures();

    // ============================================================================
    // FINALIZE
    // ============================================================================

    results.meta.executionTimeMs = Math.round(performance.now() - startTime);
    
    // Summary note
    if (results.summary.totalComponents === 0) {
      results.meta.note = 'No dynamic components detected on page';
    } else {
      results.meta.note = `Found ${results.summary.totalComponents} dynamic component(s): ` +
        `${results.components.modals.length} modal(s), ` +
        `${results.components.tabs.length} tablist(s), ` +
        `${results.components.accordions.length} accordion(s), ` +
        `${results.components.dropdowns.length} dropdown(s), ` +
        `${results.components.tooltips.length} tooltip(s), ` +
        `${results.components.carousels.length} carousel(s)`;
    }

    return results;
  }

  // Export - both names for compatibility
  global.testDynamicComponents = testDynamicComponents;
  global.auditDynamicComponents = testDynamicComponents; // Alias for orchestrator compatibility
  global.runDynamicComponentsAudit = testDynamicComponents; // Alias for audit-bundle registry convention

  console.log(' Dynamic Components Audit loaded');
  console.log('  Run: testDynamicComponents() or auditDynamicComponents()');
  console.log('  Tests: modals, tabs, accordions, dropdowns, tooltips, carousels');

})(typeof window !== 'undefined' ? window : global);
