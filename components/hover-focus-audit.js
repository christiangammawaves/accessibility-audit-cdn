/**
 * @module hover-focus-audit
 * Tests WCAG 1.4.13 Content on Hover or Focus (Level AA) - dismissible, hoverable, persistent.
 */

(function(global) {
  'use strict';

  function auditHoverFocusContent(options = {}) {
    if (!window.a11yHelpers) throw new Error('[hover-focus-audit] shared-helpers.js must be loaded first — check injection order');

    const config = {
      testInteraction: options.testInteraction ?? false, // Requires user permission
      hoverDelay: options.hoverDelay ?? 300,
      detectTooltips: options.detectTooltips ?? true,
      detectDropdowns: options.detectDropdowns ?? true,
      detectPopovers: options.detectPopovers ?? true,
      detectCSSHover: options.detectCSSHover ?? true,
      maxElementsToCheck: options.maxElementsToCheck ?? 300,
      ...options
    };

    const startTime = performance.now();

    const results = {
      meta: {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        auditType: 'hover-focus-content-audit',
        auditVersion: (typeof window !== 'undefined' && window.A11Y_VERSION) || 'unknown',
        wcagVersion: '2.2',
        level: 'AA',
        interactionTested: config.testInteraction
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
      detected: {
        tooltips: [],
        dropdowns: [],
        popovers: [],
        megaMenus: [],
        cssHoverContent: [],
        titleAttributes: []
      },
      issues: [],
      manualChecks: [],
      elementStats: {}
    };

    const getSelector = (el) => window.a11yHelpers.getSelector(el);
    const isVisible   = (el) => window.a11yHelpers.isVisible(el);
    const isHidden    = (el) => !window.a11yHelpers.isVisible(el);

    function addIssue(severity, wcag, message, element, fix, category = 'hover-focus') {
      const issue = {
        severity,
        wcag,
        criterion: 'Content on Hover or Focus',
        message,
        selector: element ? getSelector(element) : null,
        tagName: element?.tagName?.toLowerCase() || null,
        fix,
        category,
        source: 'hover-focus-audit'
      };
      
      results.issues.push(issue);
      results.summary[severity]++;
      results.summary.total++;
    }

    function addManualCheck(wcag, description, elements = [], priority = 'medium') {
      results.manualChecks.push({
        wcag,
        description,
        elementCount: elements.length,
        selectors: elements.slice(0, 5).map(e => getSelector(e)),
        priority,
        source: 'hover-focus-audit'
      });
      results.summary.needsManualReview++;
    }

    function detectTooltips() {
      const tooltips = [];

      const tooltipSelectors = [
        '[data-tooltip]',
        '[data-tip]',
        '[data-tippy]',
        '[data-tippy-content]',
        '[data-toggle="tooltip"]',
        '[data-bs-toggle="tooltip"]',
        '[role="tooltip"]',
        '.tooltip',
        '.tippy',
        '[class*="tooltip"]',
        '[aria-describedby*="tooltip"]'
      ];

      const titleElements = document.querySelectorAll('[title]:not(iframe):not(svg):not(abbr)');
      titleElements.forEach(el => {
        const title = el.getAttribute('title');
        if (title && title.trim().length > 0) {
          results.detected.titleAttributes.push({
            element: el,
            selector: getSelector(el),
            title: title.slice(0, 100),
            tagName: el.tagName.toLowerCase()
          });
        }
      });

      document.querySelectorAll(tooltipSelectors.join(', ')).forEach(el => {
        // Check if it's a trigger or the tooltip itself
        const isTrigger = el.hasAttribute('data-tooltip') || 
                         el.hasAttribute('data-tip') ||
                         el.hasAttribute('data-tippy') ||
                         el.hasAttribute('data-toggle') ||
                         el.hasAttribute('data-bs-toggle');
        
        tooltips.push({
          element: el,
          selector: getSelector(el),
          type: isTrigger ? 'trigger' : 'tooltip',
          hasAriaDescribedby: el.hasAttribute('aria-describedby'),
          content: el.getAttribute('data-tooltip') || 
                   el.getAttribute('data-tip') || 
                   el.getAttribute('data-tippy-content') ||
                   el.getAttribute('title') ||
                   (el.getAttribute('role') === 'tooltip' ? el.textContent?.slice(0, 50) : null)
        });
      });

      results.detected.tooltips = tooltips;
      return tooltips;
    }

    function detectDropdowns() {
      const dropdowns = [];

      const dropdownTriggerSelectors = [
        '[data-toggle="dropdown"]',
        '[data-bs-toggle="dropdown"]',
        '[aria-haspopup="true"]',
        '[aria-haspopup="menu"]',
        '[aria-haspopup="listbox"]',
        '[aria-expanded]',
        'button[class*="dropdown"]',
        '[class*="dropdown-toggle"]',
        '[class*="dropdown"] > button',
        '[class*="dropdown"] > a',
        'nav button[aria-controls]',
        '[class*="menu-trigger"]',
        '[class*="submenu-trigger"]'
      ];

      const dropdownMenuSelectors = [
        '[role="menu"]',
        '[role="listbox"]',
        '.dropdown-menu',
        '[class*="dropdown-content"]',
        '[class*="submenu"]',
        '[aria-labelledby][role="menu"]'
      ];

      document.querySelectorAll(dropdownTriggerSelectors.join(', ')).forEach(trigger => {
        const ariaExpanded = trigger.getAttribute('aria-expanded');
        const ariaControls = trigger.getAttribute('aria-controls');
        const ariaHaspopup = trigger.getAttribute('aria-haspopup');
        
        let menu = null;
        if (ariaControls) {
          menu = document.getElementById(ariaControls);
        } else {
          menu = trigger.nextElementSibling?.matches('[role="menu"], .dropdown-menu, [class*="dropdown"]') 
                 ? trigger.nextElementSibling 
                 : trigger.parentElement?.querySelector('[role="menu"], .dropdown-menu');
        }

        dropdowns.push({
          trigger: {
            element: trigger,
            selector: getSelector(trigger),
            text: (trigger.textContent || '').trim().slice(0, 50)
          },
          menu: menu ? {
            element: menu,
            selector: getSelector(menu),
            isHidden: isHidden(menu)
          } : null,
          hasAriaExpanded: ariaExpanded !== null,
          hasAriaControls: ariaControls !== null,
          hasAriaHaspopup: ariaHaspopup !== null,
          type: ariaHaspopup || 'dropdown'
        });
      });

      results.detected.dropdowns = dropdowns;
      return dropdowns;
    }

    function detectMegaMenus() {
      const megaMenus = [];

      const megaMenuSelectors = [
        '[class*="mega-menu"]',
        '[class*="megamenu"]',
        '[class*="mega_menu"]',
        'nav [class*="mega"]',
        '[data-mega-menu]'
      ];

      document.querySelectorAll(megaMenuSelectors.join(', ')).forEach(el => {
        let trigger = null;
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          trigger = document.getElementById(labelledBy);
        } else {
          trigger = el.previousElementSibling?.matches('a, button') ? el.previousElementSibling : null;
        }

        megaMenus.push({
          menu: {
            element: el,
            selector: getSelector(el),
            isHidden: isHidden(el)
          },
          trigger: trigger ? {
            element: trigger,
            selector: getSelector(trigger),
            text: (trigger.textContent || '').trim().slice(0, 50)
          } : null,
          hasAriaLabelledby: labelledBy !== null,
          columnCount: el.querySelectorAll('[class*="column"], [class*="col-"]').length || 
                       el.querySelectorAll('ul').length
        });
      });

      results.detected.megaMenus = megaMenus;
      return megaMenus;
    }

    function detectPopovers() {
      const popovers = [];

      const popoverSelectors = [
        '[data-toggle="popover"]',
        '[data-bs-toggle="popover"]',
        '[data-popover]',
        '[role="dialog"][aria-modal="false"]',
        '[class*="popover"]',
        '[class*="popup"]:not([class*="cookie"]):not([class*="modal"])'
      ];

      document.querySelectorAll(popoverSelectors.join(', ')).forEach(el => {
        const isTrigger = el.hasAttribute('data-toggle') || 
                         el.hasAttribute('data-bs-toggle') ||
                         el.hasAttribute('data-popover');

        popovers.push({
          element: el,
          selector: getSelector(el),
          type: isTrigger ? 'trigger' : 'popover',
          isHidden: isHidden(el),
          hasAriaControls: el.hasAttribute('aria-controls'),
          triggerType: el.getAttribute('data-trigger') || el.getAttribute('data-bs-trigger') || 'click'
        });
      });

      results.detected.popovers = popovers;
      return popovers;
    }

    function detectCSSHoverContent() {
      const cssHoverContent = [];

      const potentialHoverContainers = document.querySelectorAll([
        '[class*="hover"]',
        '[class*="show-on-hover"]',
        '[class*="reveal"]',
        '[class*="hidden-until"]',
        '.card', '.product', '.item', '.tile' // Common container patterns
      ].join(', '));

      potentialHoverContainers.forEach(container => {
        const hiddenChildren = container.querySelectorAll('div, span, a, button, img, ul, li, p, [class*="overlay"], [class*="action"], [class*="hover"], [class*="hidden"]');
        hiddenChildren.forEach(child => {
          if (child === container) return;
          
          const style = window.a11yHelpers.getStyle(child);
          const isCurrentlyHidden = style.opacity === '0' ||
                                    style.visibility === 'hidden' ||
                                    style.display === 'none';
          
          // Check if has transition properties (indication of hover effect)
          const hasTransition = style.transition !== 'none' && style.transition !== '' && 
                               style.transition !== 'all 0s ease 0s';
          
          if (isCurrentlyHidden && hasTransition) {
            // Likely a hover-revealed element
            const className = child.className || '';
            if (className.includes('hover') || className.includes('overlay') || 
                className.includes('hidden') || className.includes('action')) {
              cssHoverContent.push({
                container: {
                  element: container,
                  selector: getSelector(container)
                },
                hiddenElement: {
                  element: child,
                  selector: getSelector(child),
                  hiddenBy: style.opacity === '0' ? 'opacity' : 
                           style.visibility === 'hidden' ? 'visibility' : 'display'
                }
              });
            }
          }
        });
      });

      try {
        for (const sheet of document.styleSheets) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (!rules) continue;
            
            for (const rule of rules) {
              if (rule.selectorText && 
                  (rule.selectorText.includes(':hover') || rule.selectorText.includes(':focus'))) {
                const cssText = rule.cssText || '';
                
                // Check if rule reveals content
                if (cssText.includes('display: block') || 
                    cssText.includes('display: flex') ||
                    cssText.includes('visibility: visible') ||
                    cssText.includes('opacity: 1') ||
                    cssText.includes('opacity:1')) {
                  
                  results.elementStats.hoverRevealRulesFound = 
                    (results.elementStats.hoverRevealRulesFound || 0) + 1;
                }
              }
            }
          } catch (e) {
            // Cross-origin stylesheet, skip
          }
        }
      } catch (e) {
        // Unable to access stylesheets
      }

      results.detected.cssHoverContent = cssHoverContent;
      return cssHoverContent;
    }

    function analyzeTooltips() {
      results.detected.titleAttributes.forEach(item => {
        addIssue('serious', '1.4.13',
          `Element uses native title tooltip: "${item.title.slice(0, 50)}${item.title.length > 50 ? '...' : ''}"`,
          item.element,
          'Native tooltips cannot be hovered over. Consider using a custom tooltip that meets WCAG requirements.',
          'tooltip'
        );
      });

      const tooltipTriggers = results.detected.tooltips.filter(t => t.type === 'trigger');
      
      tooltipTriggers.forEach(tooltip => {
        // Check for aria-describedby (associates tooltip with trigger)
        if (!tooltip.hasAriaDescribedby) {
          addIssue('serious', '1.4.13',
            'Tooltip trigger missing aria-describedby',
            tooltip.element,
            'Add aria-describedby pointing to the tooltip element ID',
            'tooltip'
          );
        }
      });

      if (results.detected.tooltips.length > 0 || results.detected.titleAttributes.length > 0) {
        const allTooltipTriggers = [
          ...results.detected.tooltips.filter(t => t.type === 'trigger').map(t => t.element),
          ...results.detected.titleAttributes.map(t => t.element)
        ];
        
        addManualCheck('1.4.13',
          'Verify tooltips: (1) can be dismissed with Escape, (2) remain visible when pointer moves to them, (3) persist until dismissed',
          allTooltipTriggers,
          'high'
        );
      }
    }

    function analyzeDropdowns() {
      results.detected.dropdowns.forEach(dropdown => {
        if (!dropdown.hasAriaExpanded) {
          addIssue('serious', '1.4.13',
            'Dropdown trigger missing aria-expanded',
            dropdown.trigger.element,
            'Add aria-expanded="false" (or "true" when open) to indicate dropdown state',
            'dropdown'
          );
        }

        if (!dropdown.hasAriaHaspopup) {
          addIssue('moderate', '1.4.13',
            'Dropdown trigger missing aria-haspopup',
            dropdown.trigger.element,
            'Add aria-haspopup="menu" (or appropriate value) to indicate popup behavior',
            'dropdown'
          );
        }

        if (!dropdown.hasAriaControls && dropdown.menu) {
          addIssue('moderate', '1.4.13',
            'Dropdown trigger missing aria-controls',
            dropdown.trigger.element,
            'Add aria-controls pointing to the dropdown menu ID',
            'dropdown'
          );
        }
      });

      if (results.detected.dropdowns.length > 0) {
        addManualCheck('1.4.13',
          'Verify dropdown menus: (1) can be dismissed with Escape, (2) remain open when pointer moves into them, (3) keyboard navigable',
          results.detected.dropdowns.map(d => d.trigger.element),
          'high'
        );
      }
    }

    function analyzeMegaMenus() {
      results.detected.megaMenus.forEach(megaMenu => {
        if (!megaMenu.trigger) {
          addIssue('serious', '1.4.13',
            'Mega menu has no identifiable trigger element',
            megaMenu.menu.element,
            'Ensure mega menu has a trigger with aria-expanded and aria-controls',
            'mega-menu'
          );
        }

        if (!megaMenu.hasAriaLabelledby && megaMenu.trigger) {
          addIssue('moderate', '1.4.13',
            'Mega menu not associated with trigger via aria-labelledby',
            megaMenu.menu.element,
            'Add aria-labelledby pointing to the trigger element ID',
            'mega-menu'
          );
        }
      });

      if (results.detected.megaMenus.length > 0) {
        addManualCheck('1.4.13',
          'Verify mega menus: (1) remain open long enough to navigate, (2) can be dismissed with Escape, (3) don\'t disappear when moving pointer to submenu',
          results.detected.megaMenus.map(m => m.menu.element),
          'high'
        );
      }
    }

    function analyzePopovers() {
      const hoverPopovers = results.detected.popovers.filter(p => 
        p.type === 'trigger' && p.triggerType.includes('hover')
      );

      hoverPopovers.forEach(popover => {
        addIssue('moderate', '1.4.13',
          'Popover triggered on hover - verify it meets hover content requirements',
          popover.element,
          'Ensure popover: (1) is dismissible, (2) hoverable, (3) persistent',
          'popover'
        );
      });

      if (results.detected.popovers.length > 0) {
        addManualCheck('1.4.13',
          'Verify popovers: (1) can be dismissed without moving pointer, (2) content can be hovered, (3) persist until dismissed',
          results.detected.popovers.filter(p => p.type === 'trigger').map(p => p.element),
          'medium'
        );
      }
    }

    function analyzeCSSHoverContent() {
      results.detected.cssHoverContent.forEach(item => {
        addIssue('serious', '1.4.13',
          'Content appears on CSS hover - may not meet dismissible/hoverable requirements',
          item.container.element,
          'Ensure hover-revealed content: (1) can be dismissed with Escape, (2) remains when pointer moves to it, (3) doesn\'t auto-hide on timeout',
          'css-hover'
        );
      });

      if (results.detected.cssHoverContent.length > 0 || 
          (results.elementStats.hoverRevealRulesFound || 0) > 0) {
        addManualCheck('1.4.13',
          'CSS hover effects detected - manually verify all hover-revealed content meets WCAG requirements',
          results.detected.cssHoverContent.map(c => c.container.element),
          'high'
        );
      }
    }

    function addGeneralManualChecks() {
      addManualCheck('1.4.13',
        'Test all hover content with keyboard only - content should appear on focus and meet same requirements',
        [], 'high'
      );

      addManualCheck('1.4.13',
        'Verify no content auto-dismisses on a timeout (content should persist until user action)',
        [], 'medium'
      );

      addManualCheck('1.4.13',
        'Test with screen magnification - hover content should not block the trigger or other content',
        [], 'medium'
      );
    }

    if (config.detectTooltips) {
      detectTooltips();
      analyzeTooltips();
    }

    if (config.detectDropdowns) {
      detectDropdowns();
      analyzeDropdowns();
    }

    detectMegaMenus();
    analyzeMegaMenus();

    if (config.detectPopovers) {
      detectPopovers();
      analyzePopovers();
    }

    if (config.detectCSSHover) {
      detectCSSHoverContent();
      analyzeCSSHoverContent();
    }

    addGeneralManualChecks();

    results.meta.executionTimeMs = Math.round(performance.now() - startTime);

    const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    results.issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    results.elementStats = {
      ...results.elementStats,
      tooltipsDetected: results.detected.tooltips.length,
      titleAttributesDetected: results.detected.titleAttributes.length,
      dropdownsDetected: results.detected.dropdowns.length,
      megaMenusDetected: results.detected.megaMenus.length,
      popoversDetected: results.detected.popovers.length,
      cssHoverContentDetected: results.detected.cssHoverContent.length,
      totalHoverFocusComponents: 
        results.detected.tooltips.length +
        results.detected.titleAttributes.length +
        results.detected.dropdowns.length +
        results.detected.megaMenus.length +
        results.detected.popovers.length +
        results.detected.cssHoverContent.length
    };

    if (results.summary.critical === 0 && results.summary.serious === 0) {
      results.summary.passed++;
    }

    return results;
  }

  function testHoverBehavior(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      return { error: `Element not found: ${selector}` };
    }

    const mouseenterEvent = new MouseEvent('mouseenter', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(mouseenterEvent);

    const newlyVisible = [];
    const hoverCheckStart = performance.now();
    const allEls = document.querySelectorAll('div, span, p, a, button, img, ul, ol, li, section, article, nav, aside, [class*="overlay"], [class*="dropdown"], [class*="menu"], [class*="tooltip"], [class*="popup"]');
    for (let i = 0; i < allEls.length; i++) {
      if (i % 500 === 0 && performance.now() - hoverCheckStart > 2000) break; // 2s timeout guard
      const el = allEls[i];
      const style = window.a11yHelpers.getStyle(el);
      if (style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0') {
        newlyVisible.push({ selector: getSelector(el), tagName: el.tagName.toLowerCase() });
      }
    }

    return {
      element: selector,
      tested: true,
      newlyVisibleElements: newlyVisible,
      note: 'Check console and DOM for hover effects'
    };
  }

  global.auditHoverFocusContent = auditHoverFocusContent;
  global.testHoverBehavior = testHoverBehavior;

  console.log('Hover/Focus Content Audit loaded');

})(typeof window !== 'undefined' ? window : global);
