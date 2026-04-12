#!/bin/bash
# Build CDN bundle — single file containing all audit scripts + learned exceptions.
# Output: dist/a11y-audit-bundle.js (unminified) + dist/a11y-audit-bundle.min.js (minified)
# Regenerate after any script change: bash build-cdn-bundle.sh

set -e
cd "$(dirname "$0")"

VERSION=$(node -e "console.log(require('./package.json').version)")
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BUNDLE="dist/a11y-audit-bundle.js"
BUNDLE_MIN="dist/a11y-audit-bundle.min.js"

# --- Step 1: Validate all source files exist ---

CORE_FILES=(
  scripts/version.js
  scripts/shared-helpers.js
  scripts/issue-verifier.js
  scripts/audit-init.js
  scripts/snapshot-analyzer.js
)

ROOT_FILES=(
  audit-bundle.js
  full-audit-orchestrator.js
  learned-exceptions.json
)

MISSING=0
for f in "${CORE_FILES[@]}" "${ROOT_FILES[@]}" components/_audit-utils.js; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Required file $f not found" >&2
    MISSING=1
  fi
done
if [ "$MISSING" -eq 1 ]; then
  exit 1
fi

# Collect component files (excluding _audit-utils.js which is loaded first)
COMPONENT_FILES=()
for f in components/*.js; do
  if [ "$(basename "$f")" != "_audit-utils.js" ]; then
    COMPONENT_FILES+=("$f")
  fi
done

if [ "${#COMPONENT_FILES[@]}" -eq 0 ]; then
  echo "ERROR: No component files found in components/" >&2
  exit 1
fi

TOTAL_FILES=$(( ${#CORE_FILES[@]} + 1 + 1 + ${#COMPONENT_FILES[@]} + 1 + 1 ))
# 5 core + audit-bundle.js + _audit-utils.js + N components + orchestrator + exceptions

echo "Building CDN bundle v${VERSION} (${TOTAL_FILES} files)..."

# --- Step 2: Create dist directory ---

mkdir -p dist

# --- Step 3: Concatenate in mandatory order ---

{
  # Header
  echo "// a11y-audit-bundle.js — CDN bundle v${VERSION}"
  echo "// Built: ${BUILD_DATE}"
  echo "// Files: ${TOTAL_FILES} (5 core + audit-bundle + ${#COMPONENT_FILES[@]} components + _audit-utils + orchestrator + exceptions)"
  echo "// https://cdn.jsdelivr.net/gh/{org}/accessibility-audit-unified@v${VERSION}/dist/a11y-audit-bundle.min.js"
  echo ""

  # 1-5: Core scripts (order matters)
  for f in "${CORE_FILES[@]}"; do
    echo "// --- $(basename "$f") ---"
    cat "$f"
    echo ""
  done

  # 6: Component registry
  echo "// --- audit-bundle.js ---"
  cat audit-bundle.js
  echo ""

  # 7: Shared component utilities (must come before other components)
  echo "// --- components/_audit-utils.js ---"
  cat components/_audit-utils.js
  echo ""

  # 8-69: Remaining component files (alphabetical)
  for f in "${COMPONENT_FILES[@]}"; do
    echo "// --- $(basename "$f") ---"
    cat "$f"
    echo ""
  done

  # 70: Full audit orchestrator
  echo "// --- full-audit-orchestrator.js ---"
  cat full-audit-orchestrator.js
  echo ""

  # 71: Learned exceptions embedded as JS
  echo "// --- learned-exceptions.json (embedded) ---"
  printf "window.__A11Y_EXCEPTIONS = "
  cat learned-exceptions.json
  printf ";\n"

} > "$BUNDLE"

echo "  Unminified: $BUNDLE ($(wc -c < "$BUNDLE") bytes)"

# --- Step 4: Create minified version ---

npx --yes esbuild "$BUNDLE" --minify --outfile="$BUNDLE_MIN" 2>&1

echo "  Minified:   $BUNDLE_MIN ($(wc -c < "$BUNDLE_MIN") bytes)"

# --- Step 5: Validate ---

echo ""
echo "Running validation..."
node validate-bundle.js

echo ""
echo "=== CDN Bundle Build Complete ==="
echo "  Version:    v${VERSION}"
echo "  Unminified: $(wc -c < "$BUNDLE" | tr -d ' ') bytes ($(wc -l < "$BUNDLE" | tr -d ' ') lines)"
echo "  Minified:   $(wc -c < "$BUNDLE_MIN" | tr -d ' ') bytes"
echo "  Files:      ${TOTAL_FILES}"
