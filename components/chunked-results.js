/**
 * Chunked Results & Pagination System v8.11.1
 * 
 * Prevents context compaction by returning audit results in smaller batches.
 * Provides cursor-based pagination for retrieving results incrementally.
 * 
 * Usage:
 *   // Initialize chunked results from full audit
 *   initChunkedResults(auditResults);
 *   
 *   // Get first chunk (default 10 issues)
 *   const chunk1 = getNextChunk();
 *   
 *   // Get specific chunk size
 *   const chunk2 = getNextChunk({ limit: 5 });
 *   
 *   // Get chunk by severity
 *   const critical = getChunkBySeverity('critical');
 *   
 *   // Check pagination status
 *   const status = getChunkStatus();
 * 
 */

(function(global) {
  'use strict';

  const CHUNKER_VERSION = (global.A11Y_VERSION) || 'unknown';
  const LOG_PREFIX = '[a11y-chunker]';
  const DEFAULT_CHUNK_SIZE = 10;
  const MAX_CHUNK_SIZE = 25;

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  let chunkState = {
    initialized: false,
    sourceType: null,  // 'full' | 'verified'
    totalIssues: 0,
    totalPassed: 0,
    totalManualChecks: 0,
    
    // Cursors for each category
    cursors: {
      all: 0,
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      passed: 0,
      manualChecks: 0
    },
    
    // Organized data
    issuesBySeverity: {
      critical: [],
      serious: [],
      moderate: [],
      minor: []
    },
    allIssues: [],
    passed: [],
    manualChecks: [],
    
    // Metadata
    meta: null,
    summary: null
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  function log(message, type = 'info') {
    const styles = {
      info: 'color: #2196F3',
      success: 'color: #4CAF50; font-weight: bold',
      warning: 'color: #FF9800',
      error: 'color: #f44336; font-weight: bold'
    };
    console.log(`%c${LOG_PREFIX} ${message}`, styles[type] || styles.info);
  }

  function clampChunkSize(size) {
    return Math.min(Math.max(1, size || DEFAULT_CHUNK_SIZE), MAX_CHUNK_SIZE);
  }

  /**
   * Create a compact issue representation for context efficiency
   */
  function compactIssue(issue, includeDetails = true) {
    const compact = {
      id: issue.id || `${issue.wcag}-${issue.selector?.slice(0, 30)}`,
      severity: issue.severity,
      wcag: issue.wcag,
      message: issue.message?.substring(0, 150),
      selector: issue.selector?.substring(0, 100)
    };

    if (includeDetails) {
      if (issue.element) compact.element = issue.element.substring(0, 200);
      if (issue.fix) compact.fix = issue.fix.substring(0, 200);
      if (issue.component) compact.component = issue.component;
      if (issue.verification) {
        compact.confidence = issue.verification.confidence;
        compact.status = issue.verification.status;
      }
    }

    return compact;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize chunked results from audit results
   * @param {Object} auditResults - Results from runAudit() or verifyAuditResults()
   */
  function initChunkedResults(auditResults) {
    log('Initializing chunked results...');

    // Determine source type
    let issues = [];
    let passed = [];
    let manualChecks = [];
    let meta = null;
    let summary = null;

    // Handle different result structures
    if (auditResults.data) {
      // Standard audit result format
      issues = auditResults.data.issues || auditResults.data.allIssues || [];
      passed = auditResults.data.passed || auditResults.data.allPassed || [];
      manualChecks = auditResults.data.manualChecks || auditResults.data.allManualChecks || [];
      meta = auditResults.meta;
      summary = auditResults.data.summary || auditResults.data.statistics;
      chunkState.sourceType = auditResults.data.statistics ? 'verified' : 'full';
    } else if (auditResults.allIssues) {
      // Full results format (from getFullAuditResults)
      issues = auditResults.allIssues || [];
      passed = auditResults.allPassed || [];
      manualChecks = auditResults.allManualChecks || [];
      meta = auditResults.meta;
      summary = auditResults.summary;
      chunkState.sourceType = 'full';
    } else if (Array.isArray(auditResults)) {
      // Direct array of issues
      issues = auditResults;
      chunkState.sourceType = 'array';
    }

    // Organize issues by severity
    chunkState.issuesBySeverity = {
      critical: [],
      serious: [],
      moderate: [],
      minor: []
    };

    for (const issue of issues) {
      const severity = issue.severity || 'moderate';
      if (chunkState.issuesBySeverity[severity]) {
        chunkState.issuesBySeverity[severity].push(issue);
      }
    }

    // Store all data
    chunkState.allIssues = issues;
    chunkState.passed = passed;
    chunkState.manualChecks = manualChecks;
    chunkState.meta = meta;
    chunkState.summary = summary || {
      critical: chunkState.issuesBySeverity.critical.length,
      serious: chunkState.issuesBySeverity.serious.length,
      moderate: chunkState.issuesBySeverity.moderate.length,
      minor: chunkState.issuesBySeverity.minor.length,
      total: issues.length,
      passed: passed.length,
      manualChecks: manualChecks.length
    };

    // Reset cursors
    chunkState.cursors = {
      all: 0,
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      passed: 0,
      manualChecks: 0
    };

    chunkState.totalIssues = issues.length;
    chunkState.totalPassed = passed.length;
    chunkState.totalManualChecks = manualChecks.length;
    chunkState.initialized = true;

    log(`Initialized with ${issues.length} issues (${chunkState.issuesBySeverity.critical.length} critical, ${chunkState.issuesBySeverity.serious.length} serious)`, 'success');

    return getChunkStatus();
  }

  // ============================================================================
  // CHUNKED RETRIEVAL
  // ============================================================================

  /**
   * Get the next chunk of all issues
   * @param {Object} options - Retrieval options
   * @returns {Object} Chunk of issues with pagination info
   */
  function getNextChunk(options = {}) {
    if (!chunkState.initialized) {
      return { error: 'Not initialized. Call initChunkedResults() first.' };
    }

    const limit = clampChunkSize(options.limit || DEFAULT_CHUNK_SIZE);
    const compact = options.compact !== false;
    const cursor = chunkState.cursors.all;
    const issues = chunkState.allIssues;

    const chunk = issues.slice(cursor, cursor + limit);
    const newCursor = cursor + chunk.length;
    chunkState.cursors.all = newCursor;

    return {
      success: true,
      chunk: compact ? chunk.map(i => compactIssue(i)) : chunk,
      pagination: {
        cursor: newCursor,
        hasMore: newCursor < issues.length,
        remaining: issues.length - newCursor,
        total: issues.length,
        retrieved: newCursor,
        percentComplete: Math.round((newCursor / issues.length) * 100)
      },
      chunkInfo: {
        size: chunk.length,
        index: Math.ceil(cursor / limit),
        isFirst: cursor === 0,
        isLast: newCursor >= issues.length
      }
    };
  }

  /**
   * Get chunk of issues by severity
   * @param {string} severity - 'critical' | 'serious' | 'moderate' | 'minor'
   * @param {Object} options - Retrieval options
   */
  function getChunkBySeverity(severity, options = {}) {
    if (!chunkState.initialized) {
      return { error: 'Not initialized. Call initChunkedResults() first.' };
    }

    if (!chunkState.issuesBySeverity[severity]) {
      return { error: `Invalid severity: ${severity}. Use: critical, serious, moderate, minor` };
    }

    const limit = clampChunkSize(options.limit || DEFAULT_CHUNK_SIZE);
    const compact = options.compact !== false;
    const cursor = chunkState.cursors[severity];
    const issues = chunkState.issuesBySeverity[severity];

    const chunk = issues.slice(cursor, cursor + limit);
    const newCursor = cursor + chunk.length;
    chunkState.cursors[severity] = newCursor;

    return {
      success: true,
      severity,
      chunk: compact ? chunk.map(i => compactIssue(i)) : chunk,
      pagination: {
        cursor: newCursor,
        hasMore: newCursor < issues.length,
        remaining: issues.length - newCursor,
        total: issues.length,
        retrieved: newCursor
      }
    };
  }

  /**
   * Get all issues of a specific severity (with chunking warning)
   */
  function getAllBySeverity(severity, options = {}) {
    if (!chunkState.initialized) {
      return { error: 'Not initialized. Call initChunkedResults() first.' };
    }

    const issues = chunkState.issuesBySeverity[severity] || [];
    const compact = options.compact !== false;

    // Warn if returning a lot
    if (issues.length > 15) {
      log(`Returning ${issues.length} ${severity} issues - consider using getChunkBySeverity()`, 'warning');
    }

    return {
      success: true,
      severity,
      issues: compact ? issues.map(i => compactIssue(i)) : issues,
      count: issues.length
    };
  }

  /**
   * Get summary without issue details (for overview)
   */
  function getSummaryOnly() {
    if (!chunkState.initialized) {
      return { error: 'Not initialized. Call initChunkedResults() first.' };
    }

    return {
      success: true,
      summary: chunkState.summary,
      counts: {
        critical: chunkState.issuesBySeverity.critical.length,
        serious: chunkState.issuesBySeverity.serious.length,
        moderate: chunkState.issuesBySeverity.moderate.length,
        minor: chunkState.issuesBySeverity.minor.length,
        total: chunkState.totalIssues,
        passed: chunkState.totalPassed,
        manualChecks: chunkState.totalManualChecks
      },
      meta: chunkState.meta,
      retrievalStatus: getChunkStatus()
    };
  }

  /**
   * Get passed checks (typically smaller, can return all)
   */
  function getPassedChecks(options = {}) {
    if (!chunkState.initialized) {
      return { error: 'Not initialized. Call initChunkedResults() first.' };
    }

    const limit = options.limit ? clampChunkSize(options.limit) : chunkState.passed.length;
    const cursor = chunkState.cursors.passed;
    const chunk = chunkState.passed.slice(cursor, cursor + limit);
    const newCursor = cursor + chunk.length;
    chunkState.cursors.passed = newCursor;

    return {
      success: true,
      chunk: chunk.map(p => ({
        wcag: p.wcag,
        description: p.description?.substring(0, 100),
        component: p.component
      })),
      pagination: {
        cursor: newCursor,
        hasMore: newCursor < chunkState.passed.length,
        remaining: chunkState.passed.length - newCursor,
        total: chunkState.passed.length
      }
    };
  }

  /**
   * Get manual checks needed
   */
  function getManualChecks(options = {}) {
    if (!chunkState.initialized) {
      return { error: 'Not initialized. Call initChunkedResults() first.' };
    }

    const limit = options.limit ? clampChunkSize(options.limit) : chunkState.manualChecks.length;
    const cursor = chunkState.cursors.manualChecks;
    const chunk = chunkState.manualChecks.slice(cursor, cursor + limit);
    const newCursor = cursor + chunk.length;
    chunkState.cursors.manualChecks = newCursor;

    return {
      success: true,
      chunk: chunk.map(m => ({
        wcag: m.wcag,
        description: m.description?.substring(0, 150) || m.message?.substring(0, 150),
        howToTest: m.howToTest?.substring(0, 200),
        component: m.component
      })),
      pagination: {
        cursor: newCursor,
        hasMore: newCursor < chunkState.manualChecks.length,
        remaining: chunkState.manualChecks.length - newCursor,
        total: chunkState.manualChecks.length
      }
    };
  }

  // ============================================================================
  // PAGINATION CONTROL
  // ============================================================================

  /**
   * Get current pagination status for all categories
   */
  function getChunkStatus() {
    if (!chunkState.initialized) {
      return { initialized: false, error: 'Not initialized' };
    }

    return {
      initialized: true,
      sourceType: chunkState.sourceType,
      totals: {
        issues: chunkState.totalIssues,
        passed: chunkState.totalPassed,
        manualChecks: chunkState.totalManualChecks
      },
      cursors: { ...chunkState.cursors },
      progress: {
        all: {
          retrieved: chunkState.cursors.all,
          total: chunkState.totalIssues,
          percent: chunkState.totalIssues > 0 
            ? Math.round((chunkState.cursors.all / chunkState.totalIssues) * 100) 
            : 100,
          hasMore: chunkState.cursors.all < chunkState.totalIssues
        },
        bySeverity: {
          critical: {
            retrieved: chunkState.cursors.critical,
            total: chunkState.issuesBySeverity.critical.length,
            hasMore: chunkState.cursors.critical < chunkState.issuesBySeverity.critical.length
          },
          serious: {
            retrieved: chunkState.cursors.serious,
            total: chunkState.issuesBySeverity.serious.length,
            hasMore: chunkState.cursors.serious < chunkState.issuesBySeverity.serious.length
          },
          moderate: {
            retrieved: chunkState.cursors.moderate,
            total: chunkState.issuesBySeverity.moderate.length,
            hasMore: chunkState.cursors.moderate < chunkState.issuesBySeverity.moderate.length
          },
          minor: {
            retrieved: chunkState.cursors.minor,
            total: chunkState.issuesBySeverity.minor.length,
            hasMore: chunkState.cursors.minor < chunkState.issuesBySeverity.minor.length
          }
        }
      }
    };
  }

  /**
   * Reset cursor for a specific category or all
   * @param {string} category - Category to reset, or 'all' for everything
   */
  function resetCursor(category = 'all') {
    if (category === 'all') {
      chunkState.cursors = {
        all: 0,
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        passed: 0,
        manualChecks: 0
      };
      log('All cursors reset', 'info');
    } else if (chunkState.cursors.hasOwnProperty(category)) {
      chunkState.cursors[category] = 0;
      log(`Cursor '${category}' reset`, 'info');
    } else {
      return { error: `Unknown category: ${category}` };
    }
    return { success: true };
  }

  /**
   * Set cursor to specific position
   */
  function setCursor(category, position) {
    if (!chunkState.cursors.hasOwnProperty(category)) {
      return { error: `Unknown category: ${category}` };
    }

    let maxPosition;
    if (category === 'all') {
      maxPosition = chunkState.totalIssues;
    } else if (category === 'passed') {
      maxPosition = chunkState.totalPassed;
    } else if (category === 'manualChecks') {
      maxPosition = chunkState.totalManualChecks;
    } else {
      maxPosition = chunkState.issuesBySeverity[category]?.length || 0;
    }

    chunkState.cursors[category] = Math.min(Math.max(0, position), maxPosition);
    return { success: true, cursor: chunkState.cursors[category] };
  }

  // ============================================================================
  // STREAMING INTERFACE
  // ============================================================================

  /**
   * Generator function for iterating through issues
   * Usage: for (const chunk of iterateIssues({ limit: 5 })) { ... }
   */
  function* iterateIssues(options = {}) {
    if (!chunkState.initialized) {
      throw new Error('Not initialized. Call initChunkedResults() first.');
    }

    const limit = clampChunkSize(options.limit || DEFAULT_CHUNK_SIZE);
    const severity = options.severity;
    const compact = options.compact !== false;

    let issues = severity ? chunkState.issuesBySeverity[severity] : chunkState.allIssues;
    let cursor = 0;

    while (cursor < issues.length) {
      const chunk = issues.slice(cursor, cursor + limit);
      cursor += chunk.length;

      yield {
        chunk: compact ? chunk.map(i => compactIssue(i)) : chunk,
        cursor,
        hasMore: cursor < issues.length,
        total: issues.length
      };
    }
  }

  /**
   * Get prioritized chunks (critical first, then serious, etc.)
   * Useful for reporting high-priority issues first
   */
  function getPrioritizedChunk(options = {}) {
    if (!chunkState.initialized) {
      return { error: 'Not initialized. Call initChunkedResults() first.' };
    }

    const limit = clampChunkSize(options.limit || DEFAULT_CHUNK_SIZE);
    const compact = options.compact !== false;
    const result = [];
    let remaining = limit;
    const severities = ['critical', 'serious', 'moderate', 'minor'];

    for (const severity of severities) {
      if (remaining <= 0) break;

      const cursor = chunkState.cursors[severity];
      const available = chunkState.issuesBySeverity[severity].slice(cursor);
      const take = Math.min(remaining, available.length);

      if (take > 0) {
        const issues = available.slice(0, take);
        result.push(...(compact ? issues.map(i => compactIssue(i)) : issues));
        chunkState.cursors[severity] = cursor + take;
        remaining -= take;
      }
    }

    return {
      success: true,
      chunk: result,
      counts: {
        critical: result.filter(i => i.severity === 'critical').length,
        serious: result.filter(i => i.severity === 'serious').length,
        moderate: result.filter(i => i.severity === 'moderate').length,
        minor: result.filter(i => i.severity === 'minor').length
      },
      hasMore: severities.some(s => 
        chunkState.cursors[s] < chunkState.issuesBySeverity[s].length
      ),
      status: getChunkStatus()
    };
  }

  // ============================================================================
  // COMPACT REPORT GENERATION
  // ============================================================================

  /**
   * Generate a compact summary report (context-friendly)
   */
  function generateCompactReport() {
    if (!chunkState.initialized) {
      return { error: 'Not initialized' };
    }

    const { summary, meta } = chunkState;
    let report = `# Accessibility Audit Summary\n\n`;
    
    if (meta?.url) report += `**URL:** ${meta.url}\n`;
    report += `**Total Issues:** ${summary.total}\n\n`;

    report += `## By Severity\n`;
    report += `- Critical: ${summary.critical}\n`;
    report += `- Serious: ${summary.serious}\n`;
    report += `- Moderate: ${summary.moderate}\n`;
    report += `- Minor: ${summary.minor}\n\n`;

    // Top 3 critical issues (compact)
    if (chunkState.issuesBySeverity.critical.length > 0) {
      report += `## Top Critical Issues\n`;
      const topCritical = chunkState.issuesBySeverity.critical.slice(0, 3);
      for (const issue of topCritical) {
        report += `- **${issue.wcag}**: ${issue.message?.substring(0, 80)}...\n`;
      }
      if (chunkState.issuesBySeverity.critical.length > 3) {
        report += `- ...and ${chunkState.issuesBySeverity.critical.length - 3} more\n`;
      }
      report += `\n`;
    }

    // Top 3 serious issues
    if (chunkState.issuesBySeverity.serious.length > 0) {
      report += `## Top Serious Issues\n`;
      const topSerious = chunkState.issuesBySeverity.serious.slice(0, 3);
      for (const issue of topSerious) {
        report += `- **${issue.wcag}**: ${issue.message?.substring(0, 80)}...\n`;
      }
      if (chunkState.issuesBySeverity.serious.length > 3) {
        report += `- ...and ${chunkState.issuesBySeverity.serious.length - 3} more\n`;
      }
    }

    report += `\n---\n`;
    report += `Use getChunkBySeverity() or getNextChunk() for full details.`;

    return {
      success: true,
      report,
      summary
    };
  }

  // ============================================================================
  // EXPORT API
  // ============================================================================

  global.initChunkedResults = initChunkedResults;
  global.getNextChunk = getNextChunk;
  global.getChunkBySeverity = getChunkBySeverity;
  global.getAllBySeverity = getAllBySeverity;
  global.getSummaryOnly = getSummaryOnly;
  global.getPassedChecks = getPassedChecks;
  global.getManualChecks = getManualChecks;
  global.getChunkStatus = getChunkStatus;
  global.resetCursor = resetCursor;
  global.setCursor = setCursor;
  global.getPrioritizedChunk = getPrioritizedChunk;
  global.generateCompactReport = generateCompactReport;
  global.iterateIssues = iterateIssues;

  global.a11yChunker = {
    version: CHUNKER_VERSION,
    initChunkedResults,
    getNextChunk,
    getChunkBySeverity,
    getAllBySeverity,
    getSummaryOnly,
    getPassedChecks,
    getManualChecks,
    getChunkStatus,
    resetCursor,
    setCursor,
    getPrioritizedChunk,
    generateCompactReport,
    iterateIssues,
    DEFAULT_CHUNK_SIZE,
    MAX_CHUNK_SIZE
  };

  log(`Chunked Results v${CHUNKER_VERSION} loaded`, 'success');
  log(`Initialize: initChunkedResults(auditResults)`, 'info');
  log(`Retrieve: getNextChunk() or getChunkBySeverity('critical')`, 'info');

})(typeof window !== 'undefined' ? window : global);
