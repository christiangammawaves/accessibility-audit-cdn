/**
 * Audit Intelligence Summary Generator v8.11.2
 *
 * L2 Feature: Generates learning summaries after audits including:
 * - Framework detection results
 * - Common issue patterns found
 * - False positive candidates
 * - Performance metrics
 * - Recommended new exceptions
 *
 * NOT auto-invoked during audit phases. Available via the audit API:
 *   initAudit().getIntelligence() — calls generateAuditIntelligence() from audit-init.js
 *
 * Usage:
 *   // After running an audit
 *   const intelligence = generateAuditIntelligence(auditResults, siteProfile);
 *
 *   // Get pattern analysis
 *   const patterns = analyzeIssuePatterns(issues);
 *
 *   // Get false positive candidates
 *   const candidates = identifyFalsePositiveCandidates(issues);
 *
 * @requires shared-helpers.js
 * @requires site-profiler.js (optional, for framework detection)
 */

(function(global) {
  'use strict';

  const INTELLIGENCE_VERSION = (global.A11Y_VERSION) || 'unknown';
  const LOG_PREFIX = '[a11y-intelligence]';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  // Thresholds for pattern detection
  const CONFIG = {
    // Minimum occurrences to consider a pattern
    minPatternOccurrences: 3,
    // Minimum occurrences to suggest as exception candidate
    minExceptionCandidateOccurrences: 5,
    // Similarity threshold for selector grouping (0-1)
    selectorSimilarityThreshold: 0.7,
    // Maximum patterns to report
    maxPatternsToReport: 20,
    // Maximum exception candidates to report
    maxExceptionCandidates: 10
  };

  // ============================================================================
  // LOGGING
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

  // ============================================================================
  // PATTERN ANALYSIS
  // ============================================================================

  /**
   * Extract a generalized pattern from a CSS selector
   * @param {string} selector - Full CSS selector
   * @returns {string} Generalized pattern
   */
  function generalizeSelector(selector) {
    if (!selector) return '';
    
    // Remove unique identifiers (IDs with numbers, data attributes with values)
    let pattern = selector
      // Remove numeric IDs like #product-123
      .replace(/#[\w-]*\d+[\w-]*/g, '[id*="..."]')
      // Remove data attributes with values
      .replace(/\[data-[\w-]+="[^"]*"\]/g, '[data-*]')
      // Remove nth-child specifics
      .replace(/:nth-child\(\d+\)/g, ':nth-child(n)')
      // Remove nth-of-type specifics
      .replace(/:nth-of-type\(\d+\)/g, ':nth-of-type(n)')
      // Keep class patterns but generalize numbered ones
      .replace(/\.[\w-]*\d+[\w-]*/g, '.[class*="..."]');
    
    return pattern;
  }

  /**
   * Calculate similarity between two selectors
   * @param {string} sel1 - First selector
   * @param {string} sel2 - Second selector
   * @returns {number} Similarity score 0-1
   */
  function selectorSimilarity(sel1, sel2) {
    if (!sel1 || !sel2) return 0;
    if (sel1 === sel2) return 1;
    
    const gen1 = generalizeSelector(sel1);
    const gen2 = generalizeSelector(sel2);
    
    if (gen1 === gen2) return 0.9;
    
    // Simple token-based similarity
    const tokens1 = new Set(gen1.split(/[\s>+~]+/));
    const tokens2 = new Set(gen2.split(/[\s>+~]+/));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return intersection.size / union.size;
  }

  /**
   * Group issues by similar selector patterns
   * @param {Array} issues - Array of issues
   * @returns {Array} Grouped patterns with counts
   */
  function groupByPattern(issues) {
    const patternGroups = new Map();
    
    for (const issue of issues) {
      const pattern = generalizeSelector(issue.selector);
      const key = `${pattern}|${issue.wcag}`;
      
      if (!patternGroups.has(key)) {
        patternGroups.set(key, {
          pattern: pattern,
          originalSelector: issue.selector,
          wcag: issue.wcag,
          message: issue.message,
          severity: issue.severity,
          count: 0,
          selectors: []
        });
      }
      
      const group = patternGroups.get(key);
      group.count++;
      if (group.selectors.length < 5) {
        group.selectors.push(issue.selector);
      }
    }
    
    // Convert to array and sort by count
    return Array.from(patternGroups.values())
      .filter(g => g.count >= CONFIG.minPatternOccurrences)
      .sort((a, b) => b.count - a.count)
      .slice(0, CONFIG.maxPatternsToReport);
  }

  /**
   * Analyze issues to find common patterns
   * @param {Array} issues - Array of audit issues
   * @returns {Object} Pattern analysis results
   */
  function analyzeIssuePatterns(issues) {
    if (!issues || issues.length === 0) {
      return { patterns: [], summary: { totalIssues: 0 } };
    }

    // Group by WCAG criterion
    const byWcag = {};
    const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    
    for (const issue of issues) {
      // By WCAG
      if (!byWcag[issue.wcag]) {
        byWcag[issue.wcag] = { count: 0, issues: [] };
      }
      byWcag[issue.wcag].count++;
      if (byWcag[issue.wcag].issues.length < 3) {
        byWcag[issue.wcag].issues.push(issue);
      }
      
      // By severity
      const sev = (issue.severity || 'moderate').toLowerCase();
      if (bySeverity[sev] !== undefined) {
        bySeverity[sev]++;
      }
    }

    // Get top WCAG violations
    const topWcag = Object.entries(byWcag)
      .map(([wcag, data]) => ({ wcag, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get pattern groups
    const patterns = groupByPattern(issues);

    return {
      patterns,
      summary: {
        totalIssues: issues.length,
        bySeverity,
        topWcag,
        uniquePatterns: patterns.length
      }
    };
  }

  // ============================================================================
  // FALSE POSITIVE CANDIDATE DETECTION
  // ============================================================================

  /**
   * Identify potential false positive candidates
   * @param {Array} issues - Array of audit issues
   * @returns {Array} False positive candidates with recommendations
   */
  function identifyFalsePositiveCandidates(issues) {
    if (!issues || issues.length === 0) return [];

    const candidates = [];
    const patterns = groupByPattern(issues);

    for (const pattern of patterns) {
      // Skip if not enough occurrences
      if (pattern.count < CONFIG.minExceptionCandidateOccurrences) continue;

      const candidate = {
        pattern: pattern.pattern,
        wcag: pattern.wcag,
        count: pattern.count,
        severity: pattern.severity,
        sampleSelectors: pattern.selectors,
        reasons: [],
        recommendAddToExceptions: false,
        suggestedExceptionType: null
      };

      // Check if likely third-party
      const thirdPartyIndicators = [
        'recaptcha', 'fb-', 'twitter', 'stripe', 'paypal',
        'klaviyo', 'yotpo', 'judgeme', 'stamped', 'gorgias',
        'afterpay', 'klarna', 'intercom', 'shopify-payment'
      ];
      
      const isThirdParty = pattern.selectors.some(sel => 
        thirdPartyIndicators.some(indicator => 
          sel.toLowerCase().includes(indicator)
        )
      );

      if (isThirdParty) {
        candidate.reasons.push('Appears to be third-party widget');
        candidate.recommendAddToExceptions = true;
        candidate.suggestedExceptionType = 'third-party';
      }

      // Check if likely decorative
      const decorativeIndicators = [
        'decorative', 'icon', 'separator', 'divider', 'spacer',
        'background', 'pattern', 'texture'
      ];
      
      const isDecorative = pattern.pattern && decorativeIndicators.some(indicator =>
        pattern.pattern.toLowerCase().includes(indicator)
      );

      if (isDecorative && pattern.wcag === '1.1.1') {
        candidate.reasons.push('May be decorative element');
        candidate.recommendAddToExceptions = true;
        candidate.suggestedExceptionType = 'element-context';
      }

      // Check if high repetition suggests systematic issue vs false positive
      if (pattern.count >= 10) {
        candidate.reasons.push(`High repetition (${pattern.count} occurrences) - review if systematic`);
      }

      if (candidate.reasons.length > 0) {
        candidates.push(candidate);
      }
    }

    return candidates
      .sort((a, b) => b.count - a.count)
      .slice(0, CONFIG.maxExceptionCandidates);
  }

  // ============================================================================
  // MAIN INTELLIGENCE GENERATOR
  // ============================================================================

  /**
   * Generate comprehensive audit intelligence summary
   * @param {Object} auditResults - Results from the audit
   * @param {Object} siteProfile - Optional site profile from site-profiler.js
   * @returns {Object} Intelligence summary
   */
  function generateAuditIntelligence(auditResults, siteProfile = null) {
    const timestamp = new Date().toISOString();
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'unknown';

    log('Generating audit intelligence...', 'info');

    // Extract issues from results
    const issues = auditResults?.data?.issues || auditResults?.issues || [];

    // Get pattern analysis
    const patternAnalysis = analyzeIssuePatterns(issues);

    // Get false positive candidates
    const falsePositiveCandidates = identifyFalsePositiveCandidates(issues);

    // Get exception log if available
    const exceptionsApplied = global.getExceptionLog ? global.getExceptionLog() : [];

    // Get exception usage stats if available (L1)
    const exceptionUsageStats = global.getExceptionUsageStats ? global.getExceptionUsageStats() : null;

    // Get cache stats if available
    const cacheStats = global.a11yHelpers?.getCacheStats ? global.a11yHelpers.getCacheStats() : null;

    // Build framework detection results
    let frameworksDetected = [];
    let componentCounts = {};

    if (siteProfile) {
      frameworksDetected = siteProfile.allFrameworks || [];
      componentCounts = siteProfile.widgetsByCategory || {};
    }
    // Also pull detected page components from orchestrator results if available
    if (typeof window !== 'undefined' && window.__a11yFullResults?.meta?.detectedComponents) {
      const detected = window.__a11yFullResults.meta.detectedComponents;
      if (Array.isArray(detected)) {
        componentCounts = { ...componentCounts, detectedPageComponents: detected };
      }
    }
    // Note: profileSite() is async — callers must pass siteProfile directly
    // to get framework detection results; synchronous fallback is not possible

    const intelligence = {
      version: INTELLIGENCE_VERSION,
      auditDate: timestamp,
      site: hostname,
      
      // Framework and component detection
      frameworksDetected,
      componentCounts,
      
      // Issue analysis
      summary: patternAnalysis.summary,
      commonPatterns: patternAnalysis.patterns.map(p => ({
        pattern: p.pattern,
        count: p.count,
        wcag: p.wcag,
        severity: p.severity,
        sampleMessage: p.message?.substring(0, 100),
        sampleSelectors: p.selectors.slice(0, 3)
      })),
      
      // False positive candidates
      falsePositiveCandidates: falsePositiveCandidates.map(c => ({
        pattern: c.pattern,
        wcag: c.wcag,
        count: c.count,
        reasons: c.reasons,
        recommendAddToExceptions: c.recommendAddToExceptions,
        suggestedExceptionType: c.suggestedExceptionType,
        sampleSelector: c.sampleSelectors[0]
      })),
      
      // Exception tracking (L1 integration)
      exceptionsApplied,
      exceptionUsageStats,
      
      // Performance metrics
      performanceMetrics: {
        issuesFound: issues.length,
        exceptionsApplied: exceptionsApplied.length,
        cacheStats
      },
      
      // Recommendations
      recommendations: generateRecommendations(patternAnalysis, falsePositiveCandidates, exceptionsApplied)
    };

    log(`Intelligence generated: ${issues.length} issues, ${patternAnalysis.patterns.length} patterns, ${falsePositiveCandidates.length} FP candidates`, 'success');

    return intelligence;
  }

  /**
   * Generate actionable recommendations based on analysis
   */
  function generateRecommendations(patternAnalysis, fpCandidates, exceptionsApplied) {
    const recommendations = [];

    // Recommend new exceptions for high-count false positives
    for (const candidate of fpCandidates) {
      if (candidate.recommendAddToExceptions) {
        recommendations.push({
          type: 'add-exception',
          priority: candidate.count >= 10 ? 'high' : 'medium',
          description: `Consider adding exception for "${candidate.pattern}" (${candidate.count} matches)`,
          details: {
            pattern: candidate.pattern,
            wcag: candidate.wcag,
            reason: candidate.reasons.join(', '),
            suggestedType: candidate.suggestedExceptionType
          }
        });
      }
    }

    // Recommend review for high-severity patterns
    for (const pattern of patternAnalysis.patterns) {
      if (pattern.severity === 'critical' && pattern.count >= 5) {
        recommendations.push({
          type: 'priority-fix',
          priority: 'critical',
          description: `Critical pattern affecting ${pattern.count} elements: ${pattern.wcag}`,
          details: {
            pattern: pattern.pattern,
            wcag: pattern.wcag,
            message: pattern.message
          }
        });
      }
    }

    // Note unused exceptions
    if (exceptionsApplied.length === 0 && patternAnalysis.summary.totalIssues > 0) {
      recommendations.push({
        type: 'review-exceptions',
        priority: 'low',
        description: 'No exceptions were applied - review if exception patterns need updating',
        details: null
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    });
  }

  // ============================================================================
  // EXPORT UTILITIES
  // ============================================================================

  /**
   * Format intelligence as markdown for reports
   * @param {Object} intelligence - Intelligence object
   * @returns {string} Markdown formatted report
   */
  function formatIntelligenceAsMarkdown(intelligence) {
    const lines = [
      `# Audit Intelligence Summary`,
      ``,
      `**Site:** ${intelligence.site}`,
      `**Date:** ${intelligence.auditDate}`,
      `**Version:** ${intelligence.version}`,
      ``,
      `## Summary`,
      ``,
      `- **Total Issues:** ${intelligence.summary.totalIssues}`,
      `- **Critical:** ${intelligence.summary.bySeverity?.critical || 0}`,
      `- **Serious:** ${intelligence.summary.bySeverity?.serious || 0}`,
      `- **Moderate:** ${intelligence.summary.bySeverity?.moderate || 0}`,
      `- **Minor:** ${intelligence.summary.bySeverity?.minor || 0}`,
      ``
    ];

    if (intelligence.frameworksDetected?.length > 0) {
      lines.push(`## Frameworks Detected`);
      lines.push(``);
      for (const fw of intelligence.frameworksDetected) {
        lines.push(`- ${fw.name || fw}`);
      }
      lines.push(``);
    }

    if (intelligence.commonPatterns?.length > 0) {
      lines.push(`## Common Issue Patterns`);
      lines.push(``);
      for (const pattern of intelligence.commonPatterns.slice(0, 10)) {
        lines.push(`### ${pattern.wcag} (${pattern.count} occurrences)`);
        lines.push(`- Pattern: \`${pattern.pattern}\``);
        lines.push(`- Severity: ${pattern.severity || 'moderate'}`);
        lines.push(``);
      }
    }

    if (intelligence.falsePositiveCandidates?.length > 0) {
      lines.push(`## False Positive Candidates`);
      lines.push(``);
      for (const fp of intelligence.falsePositiveCandidates) {
        lines.push(`### ${fp.pattern} (${fp.count} matches)`);
        lines.push(`- WCAG: ${fp.wcag}`);
        lines.push(`- Reasons: ${fp.reasons.join(', ')}`);
        lines.push(`- Recommend Exception: ${fp.recommendAddToExceptions ? 'Yes' : 'No'}`);
        lines.push(``);
      }
    }

    if (intelligence.recommendations?.length > 0) {
      lines.push(`## Recommendations`);
      lines.push(``);
      for (const rec of intelligence.recommendations) {
        lines.push(`- **[${rec.priority.toUpperCase()}]** ${rec.description}`);
      }
      lines.push(``);
    }

    return lines.join('\n');
  }

  // ============================================================================
  // EXPOSE GLOBAL API
  // ============================================================================

  global.generateAuditIntelligence = generateAuditIntelligence;
  global.analyzeIssuePatterns = analyzeIssuePatterns;
  global.identifyFalsePositiveCandidates = identifyFalsePositiveCandidates;
  global.formatIntelligenceAsMarkdown = formatIntelligenceAsMarkdown;

  // Namespace
  global.a11yIntelligence = {
    version: INTELLIGENCE_VERSION,
    generateAuditIntelligence,
    analyzeIssuePatterns,
    identifyFalsePositiveCandidates,
    formatIntelligenceAsMarkdown,
    CONFIG
  };

  log(`Audit Intelligence v${INTELLIGENCE_VERSION} loaded`, 'success');

})(typeof window !== 'undefined' ? window : global);
