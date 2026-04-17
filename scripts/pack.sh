#!/usr/bin/env bash
set -euo pipefail

# ── Config ──────────────────────────────────────────
DIST_DIR="dist"
OUT_DIR="releases"
MANIFEST="$DIST_DIR/manifest.json"

# ── Preflight checks ───────────────────────────────
if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: $MANIFEST not found. Run build first." >&2
  exit 1
fi

VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST" \
  | head -1 | grep -o '"[^"]*"$' | tr -d '"')
if [[ -z "$VERSION" ]]; then
  echo "ERROR: Could not parse version from $MANIFEST" >&2
  exit 1
fi

# ── Validate: no forbidden files in dist ────────────
FORBIDDEN=$(find "$DIST_DIR" \( \
  -name "*.ts" ! -name "*.d.ts" -o \
  -name "*.map" -o \
  -name ".env*" -o \
  -name "*.test.*" -o \
  -name "*.spec.*" -o \
  -name "node_modules" -o \
  -name ".git" -o \
  -name ".DS_Store" -o \
  -name "Thumbs.db" \
\) -print 2>/dev/null || true)

if [[ -n "$FORBIDDEN" ]]; then
  echo "WARNING: Forbidden files found in $DIST_DIR:" >&2
  echo "$FORBIDDEN" >&2
  echo "Clean these before packaging." >&2
  exit 1
fi

# ── Validate: manifest.json at root ────────────────
if [[ ! -f "$DIST_DIR/manifest.json" ]]; then
  echo "ERROR: manifest.json must be at $DIST_DIR/ root" >&2
  exit 1
fi

# ── Package ─────────────────────────────────────────
mkdir -p "$OUT_DIR"
ZIP_NAME="extension-v${VERSION}.zip"
ZIP_PATH="$OUT_DIR/$ZIP_NAME"

rm -f "$ZIP_PATH"

(cd "$DIST_DIR" && zip -r -9 "../$ZIP_PATH" . \
  -x "*.DS_Store" -x "__MACOSX/*")

SIZE=$(wc -c < "$ZIP_PATH" | tr -d ' ')
SIZE_MB=$(echo "scale=2; $SIZE / 1048576" | bc)

echo "Packaged: $ZIP_PATH ($SIZE_MB MB)"
echo "  Version:  $VERSION"
echo "  Upload:   https://chrome.google.com/webstore/devconsole"
