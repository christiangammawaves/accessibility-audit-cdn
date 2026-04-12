/**
 * Load IIFE-based source scripts into a sandboxed context for testing.
 *
 * The source files use IIFE patterns like:
 *   (function(global) { ... })(typeof window !== 'undefined' ? window : global);
 *
 * This loader creates a sandbox with mock globals and evaluates the script,
 * then returns the sandbox so tests can access attached APIs.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

const ROOT = resolve(import.meta.dirname, '..', '..');

/**
 * Create a minimal mock global context for Node.js script evaluation.
 * @param {Object} overrides - Additional properties to add to the sandbox
 * @returns {Object} Sandbox context
 */
function createSandbox(overrides = {}) {
  const sandbox = {
    // Core JS globals needed by the scripts
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    Map,
    WeakMap,
    Set,
    WeakSet,
    Array,
    Date,
    Object,
    JSON,
    Math,
    RegExp,
    String,
    Number,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    Error,
    TypeError,
    setTimeout,
    clearTimeout,
    // Performance API mock
    performance: {
      now: () => Date.now(),
    },
    // Needed by IIFE closings: typeof window !== 'undefined' ? window : global
    // We set window to undefined so scripts fall through to `global` which IS the sandbox
    ...overrides,
  };

  // The scripts use `global` as the IIFE parameter name.
  // When the IIFE closing is: })(typeof window !== 'undefined' ? window : global)
  // In our sandbox, `window` is undefined and `global` IS the sandbox itself.
  sandbox.global = sandbox;

  return sandbox;
}

/**
 * Load a script file into a sandboxed context.
 *
 * @param {string} relativePath - Path relative to project root (e.g., 'scripts/shared-helpers.js')
 * @param {Object} [existingSandbox] - Optional existing sandbox to reuse (for loading multiple scripts in order)
 * @param {Object} [overrides] - Additional sandbox properties
 * @returns {Object} The sandbox with all globals the script attached
 */
export function loadScript(relativePath, existingSandbox, overrides = {}) {
  const filePath = resolve(ROOT, relativePath);
  const code = readFileSync(filePath, 'utf-8');

  const sandbox = existingSandbox || createSandbox(overrides);
  Object.assign(sandbox, overrides);

  const context = vm.createContext(sandbox);
  vm.runInContext(code, context, { filename: filePath });

  // When `window` is present (DOM tests), the IIFE closing
  // `typeof window !== 'undefined' ? window : global` uses `window`.
  // So exports land on window, not on the sandbox. Sync them back.
  if (sandbox.window && sandbox.window !== sandbox) {
    const knownExports = [
      'a11yHelpers', 'A11Y_VERSION', 'A11Y_VERSION_INFO', 'A11Y_WCAG_VERSION', 'A11Y_WCAG_LEVEL',
      'verifyAuditResults', 'loadLearnedExceptions', 'getLearnedExceptions', 'getExceptionLog',
      'addLearnedException', 'exportExceptions', 'getExceptionsWithStats', 'getExceptionUsageStats',
      'clearExceptionUsageStats', 'groupSimilarIssues', 'getConfidenceLabel',
      'snapshotAnalyzer', 'analyzeSnapshot', 'mergeSnapshotResults', 'getSnapshotSummary',
      'initAudit', 'getResultsSafe', 'a11yInit', 'isAuditInitialized', 'getAuditState',
      'a11yAudit',
    ];
    for (const key of knownExports) {
      if (sandbox.window[key] !== undefined && sandbox[key] === undefined) {
        sandbox[key] = sandbox.window[key];
      }
    }

    // Sync component audit functions (run*Audit) attached to window by IIFE modules
    for (const key of Object.keys(sandbox.window)) {
      if (/^run\w+Audit$/.test(key) && typeof sandbox.window[key] === 'function' && sandbox[key] === undefined) {
        sandbox[key] = sandbox.window[key];
      }
    }
  }

  return sandbox;
}

/**
 * Load multiple scripts in order into the same sandbox.
 * Useful for scripts that depend on each other (e.g., version.js → shared-helpers.js → issue-verifier.js).
 *
 * @param {string[]} relativePaths - Array of paths relative to project root
 * @param {Object} [overrides] - Additional sandbox properties
 * @returns {Object} The sandbox with all globals from all scripts
 */
export function loadScripts(relativePaths, overrides = {}) {
  const sandbox = createSandbox(overrides);
  for (const path of relativePaths) {
    loadScript(path, sandbox);
  }
  return sandbox;
}

export { createSandbox, ROOT };
