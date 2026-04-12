/**
 * Tests for parallel phase execution in full-audit-orchestrator.js
 * Validates FORCE_SEQUENTIAL flag, phase parallelism configuration,
 * cache scope factory, and deduplication across parallel results.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadScripts } from '../helpers/load-script.js';
import { createDOMOverrides } from '../helpers/mock-dom.js';

const ROOT = resolve(import.meta.dirname, '..', '..');

describe('Parallel execution — orchestrator configuration', () => {
  let orchestratorSource;
  let PHASES;

  beforeAll(() => {
    orchestratorSource = readFileSync(resolve(ROOT, 'full-audit-orchestrator.js'), 'utf-8');

    // Extract PHASES array
    const phasesMatch = orchestratorSource.match(/const PHASES = (\[[\s\S]*?\]);/);
    if (phasesMatch) {
      PHASES = new Function(`return ${phasesMatch[1]}`)();
    }
  });

  it('FORCE_SEQUENTIAL is set to true (parallel disabled due to checkpoint race conditions)', () => {
    expect(orchestratorSource).toContain('const FORCE_SEQUENTIAL = true;');
  });

  it('phases 1-6 are marked parallel: true', () => {
    expect(PHASES).toBeDefined();
    const parallelPhases = PHASES.filter(p => p.parallel === true);
    expect(parallelPhases.length).toBe(6);
    for (let i = 1; i <= 6; i++) {
      const phase = PHASES.find(p => p.id === i);
      expect(phase).toBeDefined();
      expect(phase.parallel).toBe(true);
    }
  });

  it('phases 7-8 do NOT have parallel: true', () => {
    const phase7 = PHASES.find(p => p.id === 7);
    const phase8 = PHASES.find(p => p.id === 8);
    expect(phase7).toBeDefined();
    expect(phase8).toBeDefined();
    expect(phase7.parallel).toBeFalsy();
    expect(phase8.parallel).toBeFalsy();
  });

  it('phases 7-8 have no components (script-only)', () => {
    const phase7 = PHASES.find(p => p.id === 7);
    const phase8 = PHASES.find(p => p.id === 8);
    expect(phase7.components).toEqual([]);
    expect(phase8.components).toEqual([]);
  });

  it('executePhase accepts options parameter with skipCacheClear', () => {
    // Verify the function signature includes options
    expect(orchestratorSource).toContain('async function executePhase(phase, config, options)');
    // Verify skipCacheClear logic
    expect(orchestratorSource).toContain('options.skipCacheClear');
  });

  it('parallel phases pass skipCacheClear: true', () => {
    expect(orchestratorSource).toContain('{ skipCacheClear: true }');
  });

  it('caches are cleared once before parallel execution', () => {
    // Verify cache clear happens before Promise.allSettled
    const parallelBlock = orchestratorSource.substring(
      orchestratorSource.indexOf('if (parallelPhases.length > 0)'),
      orchestratorSource.indexOf('Promise.allSettled')
    );
    expect(parallelBlock).toContain('clearCaches()');
  });
});

describe('Cache scope factory — shared-helpers.js', () => {
  let ctx;

  beforeAll(() => {
    const domOverrides = createDOMOverrides('<!DOCTYPE html><html><body><p>Test</p></body></html>');
    ctx = loadScripts(
      ['scripts/version.js', 'scripts/shared-helpers.js'],
      domOverrides,
    );
  });

  it('createCacheScope is exported on a11yHelpers', () => {
    expect(ctx.a11yHelpers.createCacheScope).toBeDefined();
    expect(typeof ctx.a11yHelpers.createCacheScope).toBe('function');
  });

  it('createCacheScope returns all required cache Maps', () => {
    const scope = ctx.a11yHelpers.createCacheScope();
    expect(scope.queryCache).toBeInstanceOf(Map);
    expect(scope.queryCacheTimestamps).toBeInstanceOf(Map);
    expect(scope.visibilityCache).toBeInstanceOf(Map);
    expect(scope.visibilityCacheTimestamps).toBeInstanceOf(Map);
    expect(scope.visibilityCacheBySelector).toBeInstanceOf(Map);
    expect(scope.ariaHiddenCache).toBeInstanceOf(Map);
    expect(scope.ariaHiddenCacheTimestamps).toBeInstanceOf(Map);
    expect(scope.styleCache).toBeInstanceOf(Map);
    expect(scope.styleCacheTimestamps).toBeInstanceOf(Map);
    expect(scope.queryOnceCache).toBeInstanceOf(Map);
    expect(scope.queryOnceCacheTimestamps).toBeInstanceOf(Map);
    expect(scope.normalizeSelectorCache).toBeInstanceOf(Map);
  });

  it('each createCacheScope call returns independent Maps', () => {
    const scope1 = ctx.a11yHelpers.createCacheScope();
    const scope2 = ctx.a11yHelpers.createCacheScope();

    scope1.queryCache.set('test', 'value1');
    expect(scope2.queryCache.has('test')).toBe(false);
  });

  it('scope Maps are empty on creation', () => {
    const scope = ctx.a11yHelpers.createCacheScope();
    expect(scope.queryCache.size).toBe(0);
    expect(scope.visibilityCache.size).toBe(0);
    expect(scope.styleCache.size).toBe(0);
    expect(scope.normalizeSelectorCache.size).toBe(0);
    expect(scope.queryOnceCache.size).toBe(0);
  });
});

describe('Issue deduplication across phases', () => {
  let ctx;

  beforeAll(() => {
    const domOverrides = createDOMOverrides('<!DOCTYPE html><html><body></body></html>');
    ctx = loadScripts(
      ['scripts/version.js', 'scripts/shared-helpers.js'],
      domOverrides,
    );
  });

  it('deduplicateIssues removes duplicates from combined phase results', () => {
    const issue1 = { wcag: '1.1.1', selector: 'img.hero', message: 'Missing alt text', severity: 'critical' };
    const issue2 = { wcag: '1.1.1', selector: 'img.hero', message: 'Missing alt text', severity: 'critical' };
    const issue3 = { wcag: '2.4.7', selector: 'button.nav', message: 'No focus indicator', severity: 'serious' };

    const combined = [issue1, issue2, issue3];
    const deduped = ctx.a11yHelpers.deduplicateIssues(combined);

    expect(deduped.length).toBeLessThan(combined.length);
    // Should keep unique issues
    const wcags = deduped.map(i => i.wcag);
    expect(wcags).toContain('1.1.1');
    expect(wcags).toContain('2.4.7');
  });
});
