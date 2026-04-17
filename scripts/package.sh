#!/bin/bash
# Package Flipword extension for Chrome Web Store upload
set -e

VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
OUTFILE="flipword-v${VERSION}.zip"

echo "Building Flipword v${VERSION}..."
bun run build

echo "Packaging dist/ → ${OUTFILE}..."
cd dist
zip -r "../${OUTFILE}" . -x "*.svg" "*.DS_Store"
cd ..

echo ""
echo "Done: ${OUTFILE} ($(du -h "${OUTFILE}" | cut -f1))"
echo ""
echo "Upload to: https://chrome.google.com/webstore/devconsole"
