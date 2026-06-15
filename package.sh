#!/bin/bash
#
# Build the extension and package it as a zip for release.
# Produces:
#   release/<repo>-<version>.zip   (the built extension, manifest.json at root)
#   target/VERSION                 (consumed by the release action for the tag)
#
# Run locally with deps installed: `npm install && bash ./package.sh`.

set -euo pipefail

REPONAME=$(basename "${GITHUB_REPOSITORY:-linkatlas-extension}")
VERSION=$(tr -d '[:space:]' < ./VERSION)

mkdir -p ./target ./release
echo "${VERSION}" > ./target/VERSION

# Build (manifest version comes from the VERSION file).
npm run build

# Zip the built output with manifest.json at the archive root.
rm -f "./release/${REPONAME}-${VERSION}.zip"
(cd dist && zip -qr "../release/${REPONAME}-${VERSION}.zip" .)

echo "Packaged release/${REPONAME}-${VERSION}.zip (v${VERSION})"
