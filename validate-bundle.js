/**
 * validate-bundle.js — Validates the CDN bundle has all expected globals.
 * Run standalone: node validate-bundle.js
 * Also called automatically by build-cdn-bundle.sh
 */

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.join(__dirname, 'dist', 'a11y-audit-bundle.js');
const PKG_PATH = path.join(__dirname, 'package.json');

// --- Minimal browser environment mock ---
// The IIFE scripts use: (function(global) { ... })(typeof window !== 'undefined' ? window : global)
// In Node.js, window is undefined so they bind to globalThis. We set window = globalThis so both paths work.

globalThis.window = globalThis;
globalThis.self = globalThis;

// Minimal document mock — scripts may reference document at definition time
globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  getElementsByTagName: () => [],
  getElementsByClassName: () => [],
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    style: {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: () => {},
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
  }),
  createElementNS: () => ({
    tagName: '',
    style: {},
    setAttribute: () => {},
    getAttribute: () => null,
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {},
    style: {},
    querySelectorAll: () => [],
    querySelector: () => null,
  },
  head: {
    appendChild: () => {},
  },
  documentElement: {
    style: {},
    lang: 'en',
    getAttribute: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
  },
  readyState: 'complete',
  addEventListener: () => {},
  createTreeWalker: () => ({
    nextNode: () => null,
    currentNode: null,
  }),
};

// Minimal navigator/location mocks
globalThis.navigator = { userAgent: 'node-validate', language: 'en-US' };
globalThis.location = { href: 'http://localhost', hostname: 'localhost', pathname: '/' };
globalThis.getComputedStyle = () => new Proxy({}, { get: () => '' });
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.matchMedia = () => ({ matches: false, addEventListener: () => {} });
globalThis.XMLHttpRequest = class { open() {} send() {} };
globalThis.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
globalThis.setTimeout = globalThis.setTimeout;
globalThis.clearTimeout = globalThis.clearTimeout;
globalThis.console = globalThis.console;

// --- Load and evaluate bundle ---

if (!fs.existsSync(BUNDLE_PATH)) {
  console.error('FAIL: Bundle not found at', BUNDLE_PATH);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const bundleCode = fs.readFileSync(BUNDLE_PATH, 'utf8');

try {
  // Use indirect eval to execute in global scope
  const indirectEval = eval;
  indirectEval(bundleCode);
} catch (err) {
  console.error('FAIL: Bundle failed to evaluate:', err.message);
  console.error('  Stack:', err.stack?.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

// --- Validation checks ---

const checks = [];
let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    checks.push({ name, status: 'PASS', detail });
    passed++;
  } else {
    checks.push({ name, status: 'FAIL', detail });
    failed++;
  }
}

// Core globals
check(
  'A11Y_VERSION exists',
  typeof globalThis.A11Y_VERSION === 'string' && globalThis.A11Y_VERSION.length > 0,
  `value: "${globalThis.A11Y_VERSION || 'undefined'}"`
);

check(
  'A11Y_VERSION matches package.json',
  globalThis.A11Y_VERSION === pkg.version,
  `bundle: "${globalThis.A11Y_VERSION}", package.json: "${pkg.version}"`
);

check(
  'a11yHelpers exists',
  typeof globalThis.a11yHelpers === 'object' && globalThis.a11yHelpers !== null,
  `type: ${typeof globalThis.a11yHelpers}`
);

check(
  'initAudit is a function',
  typeof globalThis.initAudit === 'function',
  `type: ${typeof globalThis.initAudit}`
);

check(
  'detectComponents is a function',
  typeof globalThis.detectComponents === 'function',
  `type: ${typeof globalThis.detectComponents}`
);

check(
  'analyzeSnapshot is a function',
  typeof globalThis.analyzeSnapshot === 'function',
  `type: ${typeof globalThis.analyzeSnapshot}`
);

check(
  'runOrchestratedAudit is a function',
  typeof globalThis.runOrchestratedAudit === 'function',
  `type: ${typeof globalThis.runOrchestratedAudit}`
);

// Component registry
const components = globalThis.a11yAudit?.components;
const componentCount = components ? Object.keys(components).length : 0;
check(
  'a11yAudit.components exists',
  typeof components === 'object' && components !== null,
  `type: ${typeof components}`
);

check(
  'a11yAudit.components has 47+ entries',
  componentCount >= 47,
  `count: ${componentCount}`
);

// Exceptions
const exceptions = globalThis.__A11Y_EXCEPTIONS;
check(
  '__A11Y_EXCEPTIONS exists',
  typeof exceptions === 'object' && exceptions !== null,
  `type: ${typeof exceptions}`
);

check(
  '__A11Y_EXCEPTIONS has schemaVersion',
  exceptions?.schemaVersion != null,
  `schemaVersion: "${exceptions?.schemaVersion || 'missing'}"`
);

// Key component globals (spot-check)
check(
  'runKeyboardAudit is a function',
  typeof globalThis.runKeyboardAudit === 'function',
  `type: ${typeof globalThis.runKeyboardAudit}`
);

check(
  'auditWCAG22 is a function',
  typeof globalThis.auditWCAG22 === 'function',
  `type: ${typeof globalThis.auditWCAG22}`
);

// --- Report ---

console.log('');
console.log('=== Bundle Validation Results ===');
console.log('');

for (const c of checks) {
  const icon = c.status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`  [${icon}] ${c.name} (${c.detail})`);
}

console.log('');
console.log(`  ${passed} passed, ${failed} failed out of ${checks.length} checks`);

if (failed > 0) {
  console.log('');
  console.error('VALIDATION FAILED');
  process.exit(1);
} else {
  console.log('');
  console.log('ALL CHECKS PASSED');
}
