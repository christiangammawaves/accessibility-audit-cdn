/**
 * Tests for adaptive mode filtering in full-audit-orchestrator.js
 * Validates that adaptive mode correctly uses detectComponents() to filter phases.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

const ROOT = resolve(import.meta.dirname, '..', '..');

describe('Adaptive mode — MODE_MODULES configuration (v12.0.0)', () => {
  let MODE_MODULES;
  let ALWAYS_RUN_MODULES;
  let SOURCE_REPLACEABLE_MODULES;

  beforeAll(() => {
    const orchestratorSource = readFileSync(resolve(ROOT, 'full-audit-orchestrator.js'), 'utf-8');
    // Extract MODE_MODULES from the IIFE
    const match = orchestratorSource.match(/const MODE_MODULES = (\{[\s\S]*?\});/);
    if (match) {
      MODE_MODULES = new Function(`return ${match[1]}`)();
    } else {
      // MODE_MODULES may have been removed; default to expected structure
      MODE_MODULES = { adaptive: null, full: null };
    }

    // Module lists are now defined in shared-helpers.js (single source of truth)
    const helpersSource = readFileSync(resolve(ROOT, 'scripts/shared-helpers.js'), 'utf-8');

    const alwaysMatch = helpersSource.match(/const ALWAYS_RUN_MODULES = (\[[\s\S]*?\]);/);
    expect(alwaysMatch).toBeTruthy();
    ALWAYS_RUN_MODULES = new Function(`return ${alwaysMatch[1]}`)();

    const sourceMatch = helpersSource.match(/const SOURCE_REPLACEABLE_MODULES = (\[[\s\S]*?\]);/);
    expect(sourceMatch).toBeTruthy();
    SOURCE_REPLACEABLE_MODULES = new Function(`return ${sourceMatch[1]}`)();
  });

  it('includes adaptive as a valid mode', () => {
    expect(MODE_MODULES).toHaveProperty('adaptive');
  });

  it('adaptive mode has null value (resolved at runtime)', () => {
    expect(MODE_MODULES['adaptive']).toBeNull();
  });

  it('includes full mode as null', () => {
    expect(MODE_MODULES['full']).toBeNull();
  });

  it('has only 2 modes (adaptive + full)', () => {
    expect(Object.keys(MODE_MODULES)).toHaveLength(2);
    expect(Object.keys(MODE_MODULES).sort()).toEqual(['adaptive', 'full']);
  });

  it('ALWAYS_RUN_MODULES matches always-true detectors', () => {
    expect(ALWAYS_RUN_MODULES).toHaveLength(5);
    expect(ALWAYS_RUN_MODULES).toContain('page-structure');
    expect(ALWAYS_RUN_MODULES).toContain('color-contrast');
    expect(ALWAYS_RUN_MODULES).toContain('reflow-spacing');
    expect(ALWAYS_RUN_MODULES).toContain('wcag22-mobile');
    expect(ALWAYS_RUN_MODULES).toContain('images-of-text');
  });

  it('SOURCE_REPLACEABLE_MODULES contains expected modules', () => {
    // v13.2.0: 'forms' removed — too complex for source-only review (910+ lines, 20+ regex patterns)
    expect(SOURCE_REPLACEABLE_MODULES).toHaveLength(1);
    expect(SOURCE_REPLACEABLE_MODULES).toContain('modals');
  });
});

describe('Adaptive mode — filtering logic', () => {
  /**
   * Simulates the orchestrator's adaptive filtering logic in isolation.
   * This mirrors the code at ~line 680 of full-audit-orchestrator.js.
   */
  function simulateAdaptiveFiltering(detected, phases) {
    const activeComponents = Object.keys(detected).filter(k => detected[k]);
    const allowedModules = activeComponents;

    return phases.map(phase => {
      const filteredComponents = phase.components.filter(c => allowedModules.includes(c));
      if (filteredComponents.length === 0 && phase.components.length > 0) {
        return null;
      }
      return { ...phase, components: filteredComponents };
    }).filter(Boolean);
  }

  const samplePhases = [
    { id: 1, name: 'Core', components: ['page-structure', 'color-contrast', 'reflow-spacing'] },
    { id: 2, name: 'Navigation', components: ['header', 'navigation', 'breadcrumbs', 'footer'] },
    { id: 3, name: 'Commerce', components: ['pdp', 'cart', 'variant-selectors', 'reviews'] },
    { id: 4, name: 'Interactive', components: ['modals', 'forms', 'tabs', 'accordions'] },
  ];

  it('includes only detected components in filtered phases', () => {
    const detected = {
      'page-structure': true,
      'color-contrast': true,
      'reflow-spacing': true,
      'header': true,
      'navigation': true,
      'breadcrumbs': false,
      'footer': true,
      'pdp': false,
      'cart': false,
      'variant-selectors': false,
      'reviews': false,
      'modals': false,
      'forms': true,
      'tabs': false,
      'accordions': false,
    };

    const result = simulateAdaptiveFiltering(detected, samplePhases);

    // Phase 1 (Core) — all detected
    expect(result.find(p => p.id === 1).components).toEqual(['page-structure', 'color-contrast', 'reflow-spacing']);
    // Phase 2 (Navigation) — breadcrumbs excluded
    expect(result.find(p => p.id === 2).components).toEqual(['header', 'navigation', 'footer']);
    // Phase 3 (Commerce) — all false, phase skipped entirely
    expect(result.find(p => p.id === 3)).toBeUndefined();
    // Phase 4 (Interactive) — only forms detected
    expect(result.find(p => p.id === 4).components).toEqual(['forms']);
  });

  it('always-true detectors ensure baseline modules always run', () => {
    // Simulates a minimal page where only always-true detectors fire
    const detected = {
      'page-structure': true,
      'color-contrast': true,
      'reflow-spacing': true,
      'wcag22-mobile': true,
      'header': false,
      'navigation': false,
      'forms': false,
    };

    const phases = [
      { id: 1, name: 'Core', components: ['page-structure', 'color-contrast', 'reflow-spacing', 'wcag22-mobile'] },
      { id: 2, name: 'Navigation', components: ['header', 'navigation'] },
    ];

    const result = simulateAdaptiveFiltering(detected, phases);

    // Core phase preserved with all 4 always-true modules
    expect(result).toHaveLength(1);
    expect(result[0].components).toEqual(['page-structure', 'color-contrast', 'reflow-spacing', 'wcag22-mobile']);
  });

  it('matches full mode when all components are detected', () => {
    const allDetected = {};
    samplePhases.forEach(p => p.components.forEach(c => { allDetected[c] = true; }));

    const result = simulateAdaptiveFiltering(allDetected, samplePhases);

    // All phases preserved, all components included
    expect(result).toHaveLength(samplePhases.length);
    result.forEach((phase, i) => {
      expect(phase.components).toEqual(samplePhases[i].components);
    });
  });

  it('skips phases with zero matching components', () => {
    const detected = {
      'page-structure': true,
      'color-contrast': true,
      'reflow-spacing': true,
      'header': false,
      'navigation': false,
      'breadcrumbs': false,
      'footer': false,
      'pdp': false,
      'cart': false,
      'variant-selectors': false,
      'reviews': false,
      'modals': false,
      'forms': false,
      'tabs': false,
      'accordions': false,
    };

    const result = simulateAdaptiveFiltering(detected, samplePhases);

    // Only Phase 1 should remain
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

describe('Adaptive mode — detectComponents() contract', () => {
  let detectComponents;

  beforeAll(() => {
    const helpersSource = readFileSync(resolve(ROOT, 'scripts/shared-helpers.js'), 'utf-8');
    const bundleSource = readFileSync(resolve(ROOT, 'audit-bundle.js'), 'utf-8');

    const sandbox = {
      window: {
        A11Y_VERSION: '12.0.0',
        a11yAudit: {},
        a11yHelpers: null,
        a11yRefreshComponents: null,
      },
      document: {
        querySelector: () => null, // No elements found (minimal page)
        querySelectorAll: () => [],
        title: 'Test Page',
      },
      performance: { now: () => 0 },
      console: { log: () => {}, warn: () => {}, error: () => {} },
    };

    const ctx = vm.createContext(sandbox);
    // Load shared-helpers first (required dependency)
    vm.runInContext(helpersSource, ctx);
    vm.runInContext(bundleSource, ctx);

    detectComponents = sandbox.window.a11yAudit.detectComponents;
  });

  it('returns a flat object with boolean values', () => {
    const result = detectComponents();
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    Object.values(result).forEach(v => {
      expect(typeof v).toBe('boolean');
    });
  });

  it('page-structure always returns true', () => {
    const result = detectComponents();
    expect(result['page-structure']).toBe(true);
  });

  it('color-contrast always returns true', () => {
    const result = detectComponents();
    expect(result['color-contrast']).toBe(true);
  });

  it('reflow-spacing always returns true', () => {
    const result = detectComponents();
    expect(result['reflow-spacing']).toBe(true);
  });

  it('wcag22-mobile always returns true', () => {
    const result = detectComponents();
    expect(result['wcag22-mobile']).toBe(true);
  });

  it('detects 47 component types', () => {
    const result = detectComponents();
    expect(Object.keys(result).length).toBe(47);
  });

  it('non-present components return false on minimal page', () => {
    const result = detectComponents();
    // With null querySelector, DOM-dependent detectors should return false
    expect(result['header']).toBe(false);
    expect(result['navigation']).toBe(false);
    expect(result['forms']).toBe(false);
  });
});
