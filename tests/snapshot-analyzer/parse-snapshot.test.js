/**
 * Tests for scripts/snapshot-analyzer.js
 * The snapshot analyzer has the highest testability-to-value ratio in the codebase.
 * parseSnapshot() and analyzeAccessibilityTree() are pure string/object operations.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadScripts, ROOT } from '../helpers/load-script.js';

let ctx;
let sampleYaml;
let samplePlaywriter;

beforeAll(() => {
  ctx = loadScripts(['scripts/version.js', 'scripts/snapshot-analyzer.js']);
  sampleYaml = readFileSync(resolve(ROOT, 'tests/helpers/fixtures/snapshot-sample.yaml'), 'utf-8');
  samplePlaywriter = readFileSync(resolve(ROOT, 'tests/helpers/fixtures/snapshot-sample-playwriter.txt'), 'utf-8');
});

// ============================================================================
// parseSnapshot()
// ============================================================================

describe('parseSnapshot', () => {
  it('parses single node with role and name', () => {
    const result = ctx.snapshotAnalyzer.parseSnapshot('- banner "Site Header" [ref=e1]');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].role).toBe('banner');
    expect(result.nodes[0].name).toBe('Site Header');
    expect(result.nodes[0].ref).toBe('e1');
  });

  it('parses node without name', () => {
    const result = ctx.snapshotAnalyzer.parseSnapshot('- generic [ref=e1] [cursor=pointer]');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].role).toBe('generic');
    expect(result.nodes[0].name).toBeNull();
    expect(result.nodes[0].attributes.cursor).toBe('pointer');
  });

  it('parses nested children by indentation', () => {
    const yaml = `- banner "Header" [ref=e1]
  - navigation "Nav" [ref=e2]
    - link "Home" [ref=e3]`;
    const result = ctx.snapshotAnalyzer.parseSnapshot(yaml);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].children).toHaveLength(1);
    expect(result.nodes[0].children[0].children).toHaveLength(1);
    expect(result.nodes[0].children[0].children[0].name).toBe('Home');
  });

  it('parses attributes like [level=1]', () => {
    const result = ctx.snapshotAnalyzer.parseSnapshot('- heading "Title" [ref=e1] [level=1]');
    expect(result.nodes[0].attributes.level).toBe('1');
  });

  it('handles empty input', () => {
    const result = ctx.snapshotAnalyzer.parseSnapshot('');
    expect(result.nodes).toEqual([]);
  });

  it('handles metadata/comment lines (skipped)', () => {
    const yaml = `### Page snapshot
\`\`\`
- main "Content" [ref=e1]
\`\`\``;
    const result = ctx.snapshotAnalyzer.parseSnapshot(yaml);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].role).toBe('main');
  });

  it('maps ref values correctly via nodeMap', () => {
    const result = ctx.snapshotAnalyzer.parseSnapshot(sampleYaml);
    expect(result.nodeMap.get('e1')).toBeDefined();
    expect(result.nodeMap.get('e1').role).toBe('banner');
    expect(result.nodeMap.get('e7').role).toBe('main');
  });

  it('parses the sample fixture correctly', () => {
    const result = ctx.snapshotAnalyzer.parseSnapshot(sampleYaml);
    expect(result.nodes.length).toBeGreaterThan(0);
    // Top level should have banner, main, contentinfo
    const topRoles = result.nodes.map(n => n.role);
    expect(topRoles).toContain('banner');
    expect(topRoles).toContain('main');
    expect(topRoles).toContain('contentinfo');
  });
});

// ============================================================================
// analyzeAccessibilityTree()
// ============================================================================

describe('analyzeAccessibilityTree', () => {
  function getParsedTree() {
    return ctx.snapshotAnalyzer.parseSnapshot(sampleYaml);
  }

  it('detects empty links (no name)', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const emptyLinks = result.issues.filter(i => i.type === 'emptyLink');
    // Our fixture has one empty link (ref=e4)
    expect(emptyLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('detects empty buttons', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const emptyButtons = result.issues.filter(i => i.type === 'emptyButton');
    // ref=e15 is an empty button
    expect(emptyButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('detects images without alt', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const imageIssues = result.issues.filter(i => i.type === 'imageNoAlt');
    // ref=e11 is an image without name (not inside a named link)
    expect(imageIssues.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT flag decorative images inside named links', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const imageIssues = result.issues.filter(i => i.type === 'imageNoAlt');
    // ref=e13 is an image inside link "Shop Now" — should NOT be flagged
    const flaggedRefs = imageIssues.map(i => i.ref);
    expect(flaggedRefs).not.toContain('e13');
  });

  it('counts landmarks correctly', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    expect(result.stats.landmarks.banner).toBe(1);
    expect(result.stats.landmarks.main).toBe(1);
    expect(result.stats.landmarks.navigation).toBe(1);
    expect(result.stats.landmarks.contentinfo).toBe(1);
  });

  it('counts heading levels', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    expect(result.stats.headings.h1).toBe(1);
    expect(result.stats.headings.h2).toBe(1);
  });

  it('detects empty headings', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const emptyHeadings = result.issues.filter(i => i.type === 'emptyHeading');
    // ref=e9 is an empty h2
    expect(emptyHeadings.length).toBeGreaterThanOrEqual(1);
  });

  it('detects form fields without labels', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const unlabeled = result.issues.filter(i => i.type === 'formFieldNoLabel');
    // ref=e14 is an unlabeled textbox
    expect(unlabeled.length).toBeGreaterThanOrEqual(1);
  });

  it('detects generic interactive elements with cursor=pointer', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const genericInteractive = result.issues.filter(i => i.type === 'genericInteractive');
    // ref=e16 is generic with cursor=pointer
    expect(genericInteractive.length).toBeGreaterThanOrEqual(1);
  });

  it('returns summary with severity counts', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    expect(result.summary).toHaveProperty('critical');
    expect(result.summary).toHaveProperty('serious');
    expect(result.summary).toHaveProperty('moderate');
    expect(result.summary).toHaveProperty('minor');
    expect(result.summary).toHaveProperty('total');
    expect(result.summary.total).toBe(result.issues.length);
  });
});

// ============================================================================
// Post-analysis checks
// ============================================================================

describe('post-analysis checks', () => {
  it('detects missing main landmark', () => {
    const parsed = ctx.snapshotAnalyzer.parseSnapshot('- banner "Header" [ref=e1]');
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(parsed);
    const mainIssues = result.issues.filter(i => i.type === 'missingMainLandmark');
    expect(mainIssues).toHaveLength(1);
  });

  it('detects duplicate main landmarks', () => {
    const yaml = `- main "Content 1" [ref=e1]
- main "Content 2" [ref=e2]`;
    const parsed = ctx.snapshotAnalyzer.parseSnapshot(yaml);
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(parsed);
    const dupIssues = result.issues.filter(i => i.type === 'duplicateMainLandmark');
    expect(dupIssues).toHaveLength(1);
  });

  it('detects missing h1', () => {
    const yaml = '- main "Content" [ref=e1]\n  - heading "Sub" [ref=e2] [level=2]';
    const parsed = ctx.snapshotAnalyzer.parseSnapshot(yaml);
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(parsed);
    const h1Issues = result.issues.filter(i => i.type === 'headingHierarchy' && i.message.includes('no h1'));
    expect(h1Issues).toHaveLength(1);
  });

  it('detects multiple h1s', () => {
    const yaml = `- main "Content" [ref=e1]
  - heading "Title 1" [ref=e2] [level=1]
  - heading "Title 2" [ref=e3] [level=1]`;
    const parsed = ctx.snapshotAnalyzer.parseSnapshot(yaml);
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(parsed);
    const h1Issues = result.issues.filter(i => i.type === 'headingHierarchy' && i.message.includes('h1 headings'));
    expect(h1Issues).toHaveLength(1);
  });
});

// ============================================================================
// analyzeSnapshot() — full pipeline
// ============================================================================

describe('analyzeSnapshot', () => {
  it('runs full pipeline from YAML string to results', () => {
    const result = ctx.analyzeSnapshot(sampleYaml);
    expect(result.error).toBeUndefined();
    expect(result.meta).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(result.issues).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('returns error object on invalid input', () => {
    const result = ctx.analyzeSnapshot(null);
    expect(result.error).toBe(true);
    expect(result.message).toBeDefined();
  });

  it('includes timing metadata', () => {
    const result = ctx.analyzeSnapshot(sampleYaml);
    expect(result.meta.executionTimeMs).toBeDefined();
    expect(typeof result.meta.executionTimeMs).toBe('number');
  });
});

// ============================================================================
// mergeSnapshotResults()
// ============================================================================

describe('mergeSnapshotResults', () => {
  function makeMockAuditResults() {
    return {
      issues: [
        { wcag: '1.1.1', selector: 'img.hero', message: 'Missing alt', severity: 'serious' },
      ],
      summary: { critical: 0, serious: 1, moderate: 0, minor: 0, total: 1 },
      meta: {},
    };
  }

  it('adds unique snapshot issues to audit results', () => {
    const snapshotResults = ctx.analyzeSnapshot(sampleYaml);
    const auditResults = makeMockAuditResults();
    const merged = ctx.mergeSnapshotResults(snapshotResults, auditResults);
    expect(merged.issues.length).toBeGreaterThan(auditResults.issues.length);
  });

  it('passes through audit results when snapshot has error', () => {
    const errorResults = { error: true, message: 'Failed' };
    const auditResults = makeMockAuditResults();
    const merged = ctx.mergeSnapshotResults(errorResults, auditResults);
    expect(merged).toEqual(auditResults);
  });

  it('updates summary counts correctly', () => {
    const snapshotResults = ctx.analyzeSnapshot(sampleYaml);
    const auditResults = makeMockAuditResults();
    const merged = ctx.mergeSnapshotResults(snapshotResults, auditResults);
    expect(merged.summary.total).toBe(merged.issues.length);
  });

  it('includes snapshotAnalysis metadata', () => {
    const snapshotResults = ctx.analyzeSnapshot(sampleYaml);
    const auditResults = makeMockAuditResults();
    const merged = ctx.mergeSnapshotResults(snapshotResults, auditResults);
    expect(merged.snapshotAnalysis).toBeDefined();
    expect(merged.snapshotAnalysis.issuesAdded).toBeDefined();
    expect(merged.snapshotAnalysis.issuesDeduped).toBeDefined();
  });
});

// ============================================================================
// getSnapshotSummary()
// ============================================================================

describe('getSnapshotSummary', () => {
  it('returns landmark and heading counts', () => {
    const summary = ctx.getSnapshotSummary(sampleYaml);
    expect(summary.landmarks).toBeDefined();
    expect(summary.headings).toBeDefined();
    expect(summary.landmarks.banner).toBe(1);
    expect(summary.landmarks.main).toBe(1);
  });

  it('counts interactive elements without names', () => {
    const summary = ctx.getSnapshotSummary(sampleYaml);
    expect(typeof summary.interactiveWithoutNames).toBe('number');
    expect(summary.interactiveWithoutNames).toBeGreaterThan(0);
  });

  it('counts images without alt', () => {
    const summary = ctx.getSnapshotSummary(sampleYaml);
    expect(typeof summary.imagesWithoutAlt).toBe('number');
  });
});

// ============================================================================
// Helper functions
// ============================================================================

describe('helper functions', () => {
  it('WCAG_MAP contains expected issue types', () => {
    const map = ctx.snapshotAnalyzer.WCAG_MAP;
    expect(map.emptyLink).toBe('2.4.4');
    expect(map.emptyButton).toBe('4.1.2');
    expect(map.imageNoAlt).toBe('1.1.1');
    expect(map.missingMainLandmark).toBe('1.3.1');
  });

  it('SEVERITY_MAP contains expected severities', () => {
    const map = ctx.snapshotAnalyzer.SEVERITY_MAP;
    expect(map.emptyLink).toBe('serious');
    expect(map.emptyButton).toBe('serious');
    expect(map.genericInteractive).toBe('moderate');
  });
});

// ============================================================================
// detectSnapshotFormat()
// ============================================================================

describe('detectSnapshotFormat', () => {
  it('detects Playwright MCP format by [ref=eNN]', () => {
    expect(ctx.snapshotAnalyzer.detectSnapshotFormat('- banner "Header" [ref=e1]')).toBe('playwright-mcp');
  });

  it('detects Playwriter format by colon syntax', () => {
    expect(ctx.snapshotAnalyzer.detectSnapshotFormat('- banner:\n  - link "Home" [id="nav"]')).toBe('playwriter');
  });

  it('detects Playwriter format by id locator', () => {
    expect(ctx.snapshotAnalyzer.detectSnapshotFormat('- link "Home" [id="nav-home"]')).toBe('playwriter');
  });

  it('detects Playwriter format by data-testid locator', () => {
    expect(ctx.snapshotAnalyzer.detectSnapshotFormat('- link "Docs" [data-testid="docs-link"]')).toBe('playwriter');
  });

  it('detects Playwriter format by role= locator', () => {
    expect(ctx.snapshotAnalyzer.detectSnapshotFormat('- link "Blog" role=link[name="Blog"]')).toBe('playwriter');
  });

  it('defaults to playwright-mcp for ambiguous input', () => {
    expect(ctx.snapshotAnalyzer.detectSnapshotFormat('- main "Content"')).toBe('playwright-mcp');
  });
});

// ============================================================================
// parsePlaywriterSnapshot() — Playwriter format
// ============================================================================

describe('parsePlaywriterSnapshot', () => {
  it('parses container role with colon syntax', () => {
    const result = ctx.snapshotAnalyzer.parsePlaywriterSnapshot('- banner:');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].role).toBe('banner');
    expect(result.nodes[0].name).toBeNull();
    expect(result.format).toBe('playwriter');
  });

  it('parses container role with name and colon', () => {
    const result = ctx.snapshotAnalyzer.parsePlaywriterSnapshot('- main "Main Content":');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].role).toBe('main');
    expect(result.nodes[0].name).toBe('Main Content');
  });

  it('parses interactive element with id locator', () => {
    const result = ctx.snapshotAnalyzer.parsePlaywriterSnapshot('- link "Home" [id="nav-home"]');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].role).toBe('link');
    expect(result.nodes[0].name).toBe('Home');
    expect(result.nodes[0].locator).toBe('[id="nav-home"]');
  });

  it('parses interactive element with data-testid locator', () => {
    const result = ctx.snapshotAnalyzer.parsePlaywriterSnapshot('- link "Docs" [data-testid="docs-link"]');
    expect(result.nodes[0].locator).toBe('[data-testid="docs-link"]');
  });

  it('parses interactive element with role= locator', () => {
    const result = ctx.snapshotAnalyzer.parsePlaywriterSnapshot('- link "Blog" role=link[name="Blog"]');
    expect(result.nodes[0].locator).toBe('role=link[name="Blog"]');
  });

  it('parses nested children by indentation', () => {
    const text = `- banner:
  - navigation:
    - link "Home" [id="nav-home"]`;
    const result = ctx.snapshotAnalyzer.parsePlaywriterSnapshot(text);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].children).toHaveLength(1);
    expect(result.nodes[0].children[0].children).toHaveLength(1);
    expect(result.nodes[0].children[0].children[0].name).toBe('Home');
  });

  it('parses the Playwriter sample fixture correctly', () => {
    const result = ctx.snapshotAnalyzer.parsePlaywriterSnapshot(samplePlaywriter);
    expect(result.nodes.length).toBeGreaterThan(0);
    const topRoles = result.nodes.map(n => n.role);
    expect(topRoles).toContain('banner');
    expect(topRoles).toContain('main');
    expect(topRoles).toContain('contentinfo');
  });

  it('assigns synthetic refs to all nodes', () => {
    const result = ctx.snapshotAnalyzer.parsePlaywriterSnapshot(samplePlaywriter);
    expect(result.nodeMap.size).toBeGreaterThan(0);
    for (const [ref] of result.nodeMap) {
      expect(ref).toMatch(/^pw\d+$/);
    }
  });

  it('handles empty input', () => {
    const result = ctx.snapshotAnalyzer.parsePlaywriterSnapshot('');
    expect(result.nodes).toEqual([]);
  });
});

// ============================================================================
// analyzeAccessibilityTree() with Playwriter format
// ============================================================================

describe('analyzeAccessibilityTree (Playwriter format)', () => {
  function getParsedTree() {
    return ctx.snapshotAnalyzer.parsePlaywriterSnapshot(samplePlaywriter);
  }

  it('detects empty links from Playwriter snapshot', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const emptyLinks = result.issues.filter(i => i.type === 'emptyLink');
    expect(emptyLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('detects empty buttons from Playwriter snapshot', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const emptyButtons = result.issues.filter(i => i.type === 'emptyButton');
    expect(emptyButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('counts landmarks from Playwriter snapshot', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    expect(result.stats.landmarks.banner).toBe(1);
    expect(result.stats.landmarks.main).toBe(1);
    expect(result.stats.landmarks.navigation).toBe(1);
    expect(result.stats.landmarks.contentinfo).toBe(1);
  });

  it('detects images without alt from Playwriter snapshot', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const imageIssues = result.issues.filter(i => i.type === 'imageNoAlt');
    expect(imageIssues.length).toBeGreaterThanOrEqual(1);
  });

  it('detects form fields without labels from Playwriter snapshot', () => {
    const result = ctx.snapshotAnalyzer.analyzeAccessibilityTree(getParsedTree());
    const unlabeled = result.issues.filter(i => i.type === 'formFieldNoLabel');
    expect(unlabeled.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// analyzeSnapshot() with Playwriter format — full pipeline
// ============================================================================

describe('analyzeSnapshot (Playwriter format)', () => {
  it('runs full pipeline from Playwriter text to results', () => {
    const result = ctx.analyzeSnapshot(samplePlaywriter);
    expect(result.error).toBeUndefined();
    expect(result.meta).toBeDefined();
    expect(result.meta.parsingMethod).toBe('playwriter');
    expect(result.stats).toBeDefined();
    expect(result.issues).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('sets parsingMethod to playwright-mcp for YAML format', () => {
    const result = ctx.analyzeSnapshot(sampleYaml);
    expect(result.meta.parsingMethod).toBe('playwright-mcp');
  });

  it('auto-detects format correctly', () => {
    const yamlResult = ctx.analyzeSnapshot(sampleYaml);
    const pwResult = ctx.analyzeSnapshot(samplePlaywriter);
    expect(yamlResult.meta.parsingMethod).toBe('playwright-mcp');
    expect(pwResult.meta.parsingMethod).toBe('playwriter');
  });
});
