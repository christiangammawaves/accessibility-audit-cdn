/**
 * Snapshot Analyzer for Accessibility Audits
 *
 * Parses accessibility tree snapshot output and extracts accessibility issues
 * that complement DOM-based auditing. Supports two formats:
 *   - Playwright MCP YAML format: `- role "name" [ref=eNN]`
 *   - Playwriter text format: `- role:` / `- role "name" [locator]`
 *
 * Key advantages over DOM-based auditing:
 * - Shows computed accessible names (what screen readers actually see)
 * - Reveals actual landmark/role hierarchy
 * - Identifies elements with missing accessible names
 * - Provides locator/ref values for targeted follow-up actions
 *
 * Usage (in Claude conversation):
 *   1. Run snapshot() (Playwriter) or browser_snapshot (Playwright MCP) to get output
 *   2. Pass output to analyzeSnapshot() — format is auto-detected
 *   3. Merge results with audit output using mergeSnapshotResults()
 *
 * @updated 2026-03-04
 */

(function(global) {
  'use strict';

  // Use centralized version if available
  const SCRIPT_VERSION = global.A11Y_VERSION || 'unknown';

  /**
   * WCAG criteria relevant to accessibility tree analysis
   */
  const SNAPSHOT_WCAG_MAP = {
    missingAccessibleName: '4.1.2',      // Name, Role, Value
    emptyLink: '2.4.4',                   // Link Purpose
    emptyButton: '4.1.2',                 // Name, Role, Value
    imageNoAlt: '1.1.1',                  // Non-text Content
    formFieldNoLabel: '1.3.1',            // Info and Relationships
    landmarkStructure: '1.3.1',           // Info and Relationships
    headingHierarchy: '1.3.1',            // Info and Relationships
    duplicateMainLandmark: '1.3.1',       // Info and Relationships
    missingMainLandmark: '1.3.1',         // Info and Relationships
    emptyHeading: '2.4.6',                // Headings and Labels
    headingLevelSkip: '1.3.1',            // Info and Relationships
    focusableNoName: '4.1.2',             // Name, Role, Value
    genericInteractive: '4.1.2'           // Name, Role, Value
  };

  /**
   * Severity mapping for snapshot-detected issues
   */
  const SEVERITY_MAP = {
    missingAccessibleName: 'serious',
    emptyLink: 'serious',
    emptyButton: 'serious',
    imageNoAlt: 'serious',
    formFieldNoLabel: 'serious',
    landmarkStructure: 'moderate',
    headingHierarchy: 'moderate',
    duplicateMainLandmark: 'moderate',
    missingMainLandmark: 'serious',
    emptyHeading: 'serious',
    focusableNoName: 'serious',
    genericInteractive: 'moderate'
  };

  /**
   * Detect snapshot format based on content patterns
   *
   * @param {string} snapshotText - Raw snapshot output
   * @returns {string} 'playwright-mcp' or 'playwriter'
   */
  function detectSnapshotFormat(snapshotText) {
    // Playwright MCP format uses [ref=eNN] element references
    if (/\[ref=\w+\]/.test(snapshotText)) return 'playwright-mcp';

    // Playwriter format uses colon syntax for containers (e.g. "- banner:")
    // or inline locators like [id="..."], [data-testid="..."], role=...[name="..."]
    if (/^\s*-\s+\w+(?:\s+"[^"]*")?\s*:\s*$/m.test(snapshotText)) return 'playwriter';
    if (/\[id="[^"]*"\]/.test(snapshotText)) return 'playwriter';
    if (/\[data-testid="[^"]*"\]/.test(snapshotText)) return 'playwriter';
    if (/role=\w+\[name="[^"]*"\]/.test(snapshotText)) return 'playwriter';

    // Default to playwright-mcp for backward compatibility
    return 'playwright-mcp';
  }

  /**
   * Parse snapshot output from either Playwright MCP or Playwriter format.
   * Auto-detects the format and delegates to the appropriate parser.
   *
   * @param {string} snapshotText - Raw output from snapshot() or browser_snapshot
   * @returns {Object} Parsed accessibility tree with { nodes, nodeMap, totalNodes, format }
   */
  function parseSnapshot(snapshotText) {
    const format = detectSnapshotFormat(snapshotText);
    if (format === 'playwriter') {
      return parsePlaywriterSnapshot(snapshotText);
    }
    return parsePlaywrightMcpSnapshot(snapshotText);
  }

  /**
   * Parse the YAML-like snapshot output from Playwright MCP
   * Format: "- role "name" [ref=eNN] [attributes]"
   *
   * @param {string} snapshotYaml - Raw YAML output from browser_snapshot
   * @returns {Object} Parsed accessibility tree
   */
  function parsePlaywrightMcpSnapshot(snapshotYaml) {
    const lines = snapshotYaml.split('\n');
    const nodes = [];
    const nodeMap = new Map(); // ref -> node for quick lookup

    let currentNode = null;
    let indentStack = [{ indent: -1, children: nodes }];

    for (const line of lines) {
      // Skip empty lines and metadata
      if (!line.trim() || line.startsWith('###') || line.startsWith('```')) {
        continue;
      }

      // Calculate indent level
      const indent = line.search(/\S/);
      if (indent === -1) continue;

      // Parse node line: "- role "name" [ref=xxx] [attributes]"
      const nodeMatch = line.match(/^(\s*)-\s+(\w+)(?:\s+"([^"]*)")?(?:\s+\[ref=(\w+)\])?(.*)$/);

      if (nodeMatch) {
        const [, , role, name, ref, rest] = nodeMatch;

        const node = {
          role: role,
          name: name || null,
          ref: ref || null,
          attributes: {},
          children: [],
          indent: indent,
          rawLine: line.trim()
        };

        // Parse additional attributes like [level=1], [cursor=pointer]
        const attrMatches = rest.matchAll(/\[(\w+)=([^\]]+)\]/g);
        for (const [, key, value] of attrMatches) {
          node.attributes[key] = value;
        }

        // Check for URL
        const urlMatch = rest.match(/\/url:\s*(\S+)/);
        if (urlMatch) {
          node.attributes.url = urlMatch[1];
        }

        // Find parent based on indent
        while (indentStack.length > 1 && indentStack[indentStack.length - 1].indent >= indent) {
          indentStack.pop();
        }

        const parent = indentStack[indentStack.length - 1];
        parent.children.push(node);

        indentStack.push({ indent: indent, children: node.children });

        if (ref) {
          nodeMap.set(ref, node);
        }

        currentNode = node;
      }
      // Parse text content: "- text: Some text here"
      else if (line.includes('- text:')) {
        const textMatch = line.match(/-\s+text:\s*(.+)$/);
        if (textMatch && currentNode) {
          if (!currentNode.textContent) currentNode.textContent = [];
          currentNode.textContent.push(textMatch[1]);
        }
      }
    }

    return {
      nodes: nodes,
      nodeMap: nodeMap,
      totalNodes: nodeMap.size,
      format: 'playwright-mcp'
    };
  }

  /**
   * Parse the text snapshot output from Playwriter
   * Formats:
   *   Container: "- role:" (colon, no name)
   *   Container with name: "- role "name":" (colon after name)
   *   Interactive: '- role "name" [id="xxx"]' or '- role "name" role=role[name="..."]'
   *   Text content: '- text "Some text"' or '- "Some text"'
   *
   * @param {string} snapshotText - Raw output from Playwriter snapshot()
   * @returns {Object} Parsed accessibility tree
   */
  function parsePlaywriterSnapshot(snapshotText) {
    const lines = snapshotText.split('\n');
    const nodes = [];
    const nodeMap = new Map();
    let nodeCounter = 0;

    let currentNode = null;
    let indentStack = [{ indent: -1, children: nodes }];

    for (const line of lines) {
      if (!line.trim() || line.startsWith('###') || line.startsWith('```')) {
        continue;
      }

      const indent = line.search(/\S/);
      if (indent === -1) continue;

      // Pattern 1: Container role with colon — "- banner:" or "- navigation "Main Menu":"
      const containerMatch = line.match(/^(\s*)-\s+(\w+)(?:\s+"([^"]*)")?\s*:\s*$/);
      if (containerMatch) {
        const [, , role, name] = containerMatch;
        const syntheticRef = `pw${++nodeCounter}`;

        const node = {
          role: role,
          name: name || null,
          ref: syntheticRef,
          locator: null,
          attributes: {},
          children: [],
          indent: indent,
          rawLine: line.trim()
        };

        while (indentStack.length > 1 && indentStack[indentStack.length - 1].indent >= indent) {
          indentStack.pop();
        }
        const parent = indentStack[indentStack.length - 1];
        parent.children.push(node);
        indentStack.push({ indent: indent, children: node.children });
        nodeMap.set(syntheticRef, node);
        currentNode = node;
        continue;
      }

      // Pattern 2: Interactive element — '- role "name" [locator]' or '- role "name" role=...[name="..."]'
      const interactiveMatch = line.match(/^(\s*)-\s+(\w+)(?:\s+"([^"]*)")?\s*(.*)$/);
      if (interactiveMatch) {
        const [, , role, name, rest] = interactiveMatch;

        // Skip bare text nodes like '- "some text"' — those are handled below
        if (role === 'text' || !role) {
          if (currentNode) {
            const textContent = name || rest.replace(/^["']|["']$/g, '');
            if (textContent) {
              if (!currentNode.textContent) currentNode.textContent = [];
              currentNode.textContent.push(textContent);
            }
          }
          continue;
        }

        const syntheticRef = `pw${++nodeCounter}`;

        // Extract locator from rest of line
        let locator = null;
        const trimmedRest = (rest || '').trim();

        // Locator patterns:
        // [id="nav-home"], [data-testid="docs-link"]
        const bracketLocatorMatch = trimmedRest.match(/\[(id|data-testid|data-test|data-qa)="([^"]*)"\]/);
        if (bracketLocatorMatch) {
          locator = `[${bracketLocatorMatch[1]}="${bracketLocatorMatch[2]}"]`;
        }

        // role=link[name="Blog"]
        if (!locator) {
          const roleLocatorMatch = trimmedRest.match(/(role=\w+\[name="[^"]*"\])/);
          if (roleLocatorMatch) {
            locator = roleLocatorMatch[1];
          }
        }

        // Handle >> nth=N suffix for duplicates
        if (locator) {
          const nthMatch = trimmedRest.match(/>>\s*nth=(\d+)/);
          if (nthMatch) {
            locator += ` >> nth=${nthMatch[1]}`;
          }
        }

        const node = {
          role: role,
          name: name || null,
          ref: syntheticRef,
          locator: locator,
          attributes: {},
          children: [],
          indent: indent,
          rawLine: line.trim()
        };

        // Parse attributes like [level=1], [cursor=pointer]
        const attrMatches = trimmedRest.matchAll(/\[(\w+)=([^\]"]+)\]/g);
        for (const [, key, value] of attrMatches) {
          // Skip locator attributes that look like id="..." or data-testid="..."
          if (key !== 'id') {
            node.attributes[key] = value;
          }
        }

        // Find parent based on indent
        while (indentStack.length > 1 && indentStack[indentStack.length - 1].indent >= indent) {
          indentStack.pop();
        }
        const parent = indentStack[indentStack.length - 1];
        parent.children.push(node);
        indentStack.push({ indent: indent, children: node.children });
        nodeMap.set(syntheticRef, node);
        currentNode = node;
      }
    }

    return {
      nodes: nodes,
      nodeMap: nodeMap,
      totalNodes: nodeMap.size,
      format: 'playwriter'
    };
  }

  /**
   * Analyze parsed snapshot for accessibility issues
   * 
   * @param {Object} parsedTree - Output from parseSnapshot()
   * @returns {Object} Analysis results with issues and stats
   */
  function analyzeAccessibilityTree(parsedTree) {
    const issues = [];
    const stats = {
      totalNodes: parsedTree.totalNodes,
      landmarks: { banner: 0, main: 0, navigation: 0, contentinfo: 0, region: 0, complementary: 0 },
      landmarkInstances: {},
      headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      interactiveElements: { links: 0, buttons: 0, inputs: 0 },
      images: { total: 0, withName: 0, withoutName: 0 },
      forms: { fields: 0, labeled: 0, unlabeled: 0 }
    };
    
    const helpers = {
      addIssue: function(type, node, message, fix) {
        issues.push({
          type: type,
          severity: SEVERITY_MAP[type] || 'moderate',
          wcag: SNAPSHOT_WCAG_MAP[type] || '4.1.2',
          message: message,
          ref: node?.ref || null,
          role: node?.role || null,
          name: node?.name || null,
          fix: fix,
          source: 'snapshot-analyzer'
        });
      },
      // v8.6.1 FIX: Expose issues array for duplicate checking
      getIssues: function() {
        return issues;
      }
    };
    
    // Recursive tree walker
    function walkTree(nodes, depth = 0, context = {}) {
      for (const node of nodes) {
        analyzeNode(node, depth, context, helpers, stats);
        
        if (node.children && node.children.length > 0) {
          walkTree(node.children, depth + 1, {
            ...context,
            parentRole: node.role,
            parentName: node.name,
            inLandmark: context.inLandmark || isLandmark(node.role)
          });
        }
      }
    }
    
    walkTree(parsedTree.nodes);
    
    // Post-analysis checks
    postAnalysisChecks(stats, helpers);
    
    return {
      meta: {
        analyzerVersion: SCRIPT_VERSION,
        timestamp: new Date().toISOString(),
        totalNodesAnalyzed: stats.totalNodes
      },
      stats: stats,
      issues: issues,
      summary: {
        critical: issues.filter(i => i.severity === 'critical').length,
        serious: issues.filter(i => i.severity === 'serious').length,
        moderate: issues.filter(i => i.severity === 'moderate').length,
        minor: issues.filter(i => i.severity === 'minor').length,
        total: issues.length
      }
    };
  }

  /**
   * Check if a role is a landmark
   */
  function isLandmark(role) {
    return ['banner', 'main', 'navigation', 'contentinfo', 'region', 
            'complementary', 'search', 'form'].includes(role);
  }

  /**
   * Check if a role is interactive
   */
  function isInteractive(role) {
    return ['link', 'button', 'textbox', 'checkbox', 'radio', 'combobox',
            'slider', 'spinbutton', 'switch', 'tab', 'menuitem', 'option'].includes(role);
  }

  /**
   * Analyze individual node for issues
   */
  function analyzeNode(node, depth, context, helpers, stats) {
    const role = node.role;
    const name = node.name;
    const ref = node.ref;
    
    // === LANDMARK ANALYSIS ===
    if (isLandmark(role)) {
      if (stats.landmarks[role] !== undefined) {
        stats.landmarks[role]++;
      }
      if (!stats.landmarkInstances[role]) {
        stats.landmarkInstances[role] = [];
      }
      stats.landmarkInstances[role].push({ name: name || null, ref });
    }
    
    // === HEADING ANALYSIS ===
    if (role === 'heading') {
      const level = node.attributes.level || '2';
      const headingKey = `h${level}`;
      if (stats.headings[headingKey] !== undefined) {
        stats.headings[headingKey]++;
      }
      
      // Check for empty headings
      if (!name || name.trim() === '') {
        helpers.addIssue(
          'emptyHeading',
          node,
          `Empty heading (level ${level}) found - headings must have text content`,
          `Add descriptive text to this h${level} element`
        );
      }
    }
    
    // === LINK ANALYSIS ===
    if (role === 'link') {
      stats.interactiveElements.links++;
      
      // Check for empty/missing accessible name
      if (!name || name.trim() === '') {
        helpers.addIssue(
          'emptyLink',
          node,
          'Link has no accessible name - screen reader users cannot determine its purpose',
          'Add descriptive link text or aria-label'
        );
      }
    }
    
    // === BUTTON ANALYSIS ===
    if (role === 'button') {
      stats.interactiveElements.buttons++;
      
      if (!name || name.trim() === '') {
        helpers.addIssue(
          'emptyButton',
          node,
          'Button has no accessible name - screen reader users cannot determine its purpose',
          'Add button text, aria-label, or aria-labelledby'
        );
      }
    }
    
    // === IMAGE ANALYSIS ===
    if (role === 'img') {
      stats.images.total++;
      
      if (name && name.trim() !== '') {
        stats.images.withName++;
      } else {
        stats.images.withoutName++;
        
        // Check if it's likely decorative (inside a link with text)
        const isLikelyDecorative = context.parentRole === 'link' && context.parentName &&
          context.parentName !== name; // Only decorative if parent has a DIFFERENT name source
        
        if (!isLikelyDecorative) {
          helpers.addIssue(
            'imageNoAlt',
            node,
            'Image has no accessible name (alt text)',
            'Add alt attribute with descriptive text, or alt="" if decorative'
          );
        }
      }
    }
    
    // === FORM FIELD ANALYSIS ===
    if (['textbox', 'checkbox', 'radio', 'combobox', 'slider', 'spinbutton', 'switch'].includes(role)) {
      stats.forms.fields++;
      stats.interactiveElements.inputs++;
      
      if (name && name.trim() !== '') {
        stats.forms.labeled++;
      } else {
        stats.forms.unlabeled++;
        helpers.addIssue(
          'formFieldNoLabel',
          node,
          `Form ${role} has no accessible name/label`,
          'Add a <label> element, aria-label, or aria-labelledby'
        );
      }
    }
    
    // === GENERIC INTERACTIVE CHECK ===
    // Elements with cursor=pointer but generic role may be inaccessible
    if (role === 'generic' && node.attributes.cursor === 'pointer') {
      helpers.addIssue(
        'genericInteractive',
        node,
        'Interactive element (clickable) has no semantic role',
        'Use appropriate semantic element (button, link) or add role attribute'
      );
    }
    
    // === FOCUSABLE WITHOUT NAME ===
    // v8.6.1 FIX: Use helpers.getIssues() instead of helpers.issues (was undefined)
    if (isInteractive(role) && (!name || name.trim() === '') && 
        !['emptyLink', 'emptyButton', 'formFieldNoLabel'].some(t => 
          helpers.getIssues().some(i => i.ref === ref && i.type === t))) {
      // Generic catch for other interactive elements without names
      helpers.addIssue(
        'focusableNoName',
        node,
        `Interactive ${role} element has no accessible name`,
        'Add appropriate labeling (aria-label, aria-labelledby, or visible text)'
      );
    }
  }

  /**
   * Post-analysis structural checks
   */
  function postAnalysisChecks(stats, helpers) {
    // Check for missing main landmark
    if (stats.landmarks.main === 0) {
      helpers.addIssue(
        'missingMainLandmark',
        null,
        'Page has no main landmark - assistive technology users cannot easily find main content',
        'Add <main> element or role="main" to wrap primary content'
      );
    }
    
    // Check for duplicate main landmarks
    if (stats.landmarks.main > 1) {
      helpers.addIssue(
        'duplicateMainLandmark',
        null,
        `Page has ${stats.landmarks.main} main landmarks - should only have one`,
        'Consolidate content into a single <main> element'
      );
    }
    
    // Check for missing h1
    if (stats.headings.h1 === 0) {
      helpers.addIssue(
        'headingHierarchy',
        null,
        'Page has no h1 heading - every page should have one h1',
        'Add an h1 element that describes the page content'
      );
    }
    
    // Check for multiple h1s
    if (stats.headings.h1 > 1) {
      helpers.addIssue(
        'headingHierarchy',
        null,
        `Page has ${stats.headings.h1} h1 headings - typically should have only one`,
        'Review heading structure; consider using h2 for section headings'
      );
    }

    // Check for skipped heading levels
    // L4 fix: Validate heading levels are 1-6 before processing
    const headingLevels = Object.entries(stats.headings)
      .filter(([, count]) => count > 0)
      .map(([key]) => parseInt(key.replace('h', ''), 10))
      .filter(level => level >= 1 && level <= 6)
      .sort((a, b) => a - b);
    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] - headingLevels[i - 1] > 1) {
        helpers.addIssue(
          'headingLevelSkip',
          null,
          `Heading level skipped: h${headingLevels[i - 1]} to h${headingLevels[i]}`,
          `Add intermediate heading levels between h${headingLevels[i - 1]} and h${headingLevels[i]}`
        );
        break; // Only flag the first skip
      }
    }

    // Check for duplicate landmark types without accessible names
    if (stats.landmarkInstances) {
      for (const [type, instances] of Object.entries(stats.landmarkInstances)) {
        if (instances.length > 1) {
          const unnamed = instances.filter(l => !l.name);
          if (unnamed.length > 0) {
            helpers.addIssue(
              'landmarkStructure',
              null,
              `${unnamed.length} of ${instances.length} '${type}' landmarks have no accessible name. When multiple landmarks of the same type exist, each needs a unique name.`,
              `Add aria-label or aria-labelledby to distinguish each '${type}' landmark`
            );
          }
        }
      }
    }
  }

  /**
   * Main entry point - analyze raw snapshot text (auto-detects format)
   *
   * @param {string} snapshotText - Raw output from snapshot() or browser_snapshot
   * @returns {Object} Complete analysis results
   */
  function analyzeSnapshot(snapshotText) {
    const startTime = performance.now();

    try {
      const parsed = parseSnapshot(snapshotText);
      const results = analyzeAccessibilityTree(parsed);

      results.meta.executionTimeMs = Math.round(performance.now() - startTime);
      results.meta.parsingMethod = parsed.format || 'playwright-mcp';

      return results;
    } catch (error) {
      return {
        error: true,
        message: `Snapshot analysis failed: ${error.message}`,
        stack: error.stack
      };
    }
  }

  /**
   * Merge snapshot analysis results with audit results
   * Deduplicates issues based on selector/ref matching where possible
   *
   * @param {Object} snapshotResults - Output from analyzeSnapshot()
   * @param {Object} auditResults - Output from any audit function (orchestrator or component-based)
   * @returns {Object} Merged results
   */
  function mergeSnapshotResults(snapshotResults, auditResults) {
    if (snapshotResults.error) {
      console.warn('[snapshot-analyzer] Skipping merge due to snapshot error');
      return auditResults;
    }

    // Normalize: accept getResultsSafe() wrapper shape { success, data: { issues }, meta }
    if (auditResults.data && auditResults.data.issues) {
      var issues = auditResults.data.issues;
      auditResults = {
        issues: issues,
        summary: auditResults.data.statistics || {
          total: issues.length,
          critical: issues.filter(function(i) { return i.severity === 'critical'; }).length,
          serious: issues.filter(function(i) { return i.severity === 'serious'; }).length,
          moderate: issues.filter(function(i) { return i.severity === 'moderate'; }).length,
          minor: issues.filter(function(i) { return i.severity === 'minor'; }).length
        },
        meta: auditResults.meta || {}
      };
    }

    const merged = JSON.parse(JSON.stringify(auditResults)); // Deep clone
    
    // Track existing issues by WCAG criterion + rough selector matching
    const existingIssueKeys = new Set();
    for (const issue of merged.issues || []) {
      const key = `${issue.wcag}|${issue.selector?.slice(0, 50) || 'none'}`;
      existingIssueKeys.add(key);
    }
    
    // Add snapshot issues that don't duplicate existing ones
    let addedCount = 0;
    for (const snapshotIssue of snapshotResults.issues || []) {
      // Convert ref to pseudo-selector for deduplication
      const pseudoSelector = snapshotIssue.ref ? `[ref=${snapshotIssue.ref}]` : 'none';
      const key = `${snapshotIssue.wcag}|${pseudoSelector.slice(0, 50)}`;
      
      if (!existingIssueKeys.has(key)) {
        merged.issues.push({
          severity: snapshotIssue.severity,
          wcag: snapshotIssue.wcag,
          message: snapshotIssue.message,
          selector: snapshotIssue.ref ? `[snapshot-ref=${snapshotIssue.ref}]` : null,
          fix: snapshotIssue.fix,
          category: 'snapshot-analysis',
          source: 'snapshot-analyzer',
          snapshotRef: snapshotIssue.ref,
          snapshotRole: snapshotIssue.role,
          snapshotName: snapshotIssue.name
        });
        
        merged.summary[snapshotIssue.severity]++;
        merged.summary.total++;
        addedCount++;
      }
    }
    
    // Add snapshot stats to merged results
    merged.snapshotAnalysis = {
      stats: snapshotResults.stats,
      issuesAdded: addedCount,
      issuesDeduped: snapshotResults.issues.length - addedCount,
      analyzerVersion: snapshotResults.meta.analyzerVersion
    };
    
    // Update meta
    merged.meta.includesSnapshotAnalysis = true;
    merged.meta.snapshotAnalyzerVersion = SCRIPT_VERSION;
    
    console.log(`[snapshot-analyzer] Merged ${addedCount} new issues (${snapshotResults.issues.length - addedCount} duplicates removed)`);
    
    return merged;
  }

  /**
   * Quick structural summary from snapshot
   * Useful for pre-audit overview
   * 
   * @param {string} snapshotText - Raw output from snapshot() or browser_snapshot
   * @returns {Object} Quick structural summary
   */
  function getSnapshotSummary(snapshotText) {
    const parsed = parseSnapshot(snapshotText);
    const stats = {
      landmarks: {},
      headings: {},
      interactiveWithoutNames: 0,
      imagesWithoutAlt: 0
    };
    
    function walkForSummary(nodes) {
      for (const node of nodes) {
        // Count landmarks
        if (isLandmark(node.role)) {
          stats.landmarks[node.role] = (stats.landmarks[node.role] || 0) + 1;
        }
        
        // Count headings
        if (node.role === 'heading') {
          const level = `h${node.attributes.level || '?'}`;
          stats.headings[level] = (stats.headings[level] || 0) + 1;
        }
        
        // Count issues
        if (isInteractive(node.role) && (!node.name || node.name.trim() === '')) {
          stats.interactiveWithoutNames++;
        }
        
        if (node.role === 'img' && (!node.name || node.name.trim() === '')) {
          stats.imagesWithoutAlt++;
        }
        
        if (node.children) walkForSummary(node.children);
      }
    }
    
    walkForSummary(parsed.nodes);
    
    return stats;
  }

  // ==========================================================================
  // EXPORTS
  // ==========================================================================

  global.snapshotAnalyzer = {
    version: SCRIPT_VERSION,
    parseSnapshot: parseSnapshot,
    detectSnapshotFormat: detectSnapshotFormat,
    parsePlaywrightMcpSnapshot: parsePlaywrightMcpSnapshot,
    parsePlaywriterSnapshot: parsePlaywriterSnapshot,
    analyzeSnapshot: analyzeSnapshot,
    analyzeAccessibilityTree: analyzeAccessibilityTree,
    mergeSnapshotResults: mergeSnapshotResults,
    getSnapshotSummary: getSnapshotSummary,
    WCAG_MAP: SNAPSHOT_WCAG_MAP,
    SEVERITY_MAP: SEVERITY_MAP
  };

  // Also export functions globally for easy access
  global.analyzeSnapshot = analyzeSnapshot;
  global.mergeSnapshotResults = mergeSnapshotResults;
  global.getSnapshotSummary = getSnapshotSummary;

  console.log(`[a11y] Snapshot Analyzer loaded (v${SCRIPT_VERSION})`);
  console.log('  Usage: analyzeSnapshot(snapshotText) — auto-detects Playwriter/Playwright MCP format');
  console.log('  Merge: mergeSnapshotResults(snapshotResults, auditResults)');
  console.log('  Quick: getSnapshotSummary(snapshotText)');

})(typeof window !== 'undefined' ? window : global);
