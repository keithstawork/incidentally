#!/bin/bash

# ─────────────────────────────────────────────
# Cursor Build Template — Update Process Files
# ─────────────────────────────────────────────
#
# Pulls the latest skills, reference patterns, and rules from the
# instawork/cursor-build-template repo into your project.
#
# Safe to run at any time. Only overwrites:
#   .cursor/skills/
#   .cursor/reference/
#   .cursorrules
#
# Never touches:
#   docs/         (your project context and tracker)
#   scripts/      (your project code)
#   .env          (your secrets)
#   Makefile      (your project commands)
#   README.md     (your project readme)
# ─────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $1"; }
info() { echo -e "${YELLOW}→${RESET} $1"; }

TEMPLATE_REPO="Instawork/cursor-build-template"
TMP_DIR=$(mktemp -d)

info "Fetching latest template from $TEMPLATE_REPO..."
if ! gh repo clone "$TEMPLATE_REPO" "$TMP_DIR" --quiet 2>/dev/null; then
  echo
  echo -e "${YELLOW}Could not access $TEMPLATE_REPO.${RESET}"
  echo "This repo is only visible to instawork org members."
  echo
  echo "If you're not in the org yet, ask your manager to add you, or"
  echo "get the latest cursor-build-template.zip from your workshop facilitator"
  echo "and manually replace .cursor/ and .cursorrules with the contents."
  echo
  exit 1
fi

info "Updating .cursor/skills/..."
rm -rf .cursor/skills
cp -r "$TMP_DIR/.cursor/skills" .cursor/skills
ok ".cursor/skills updated"

info "Updating .cursor/reference/..."
rm -rf .cursor/reference
cp -r "$TMP_DIR/.cursor/reference" .cursor/reference
ok ".cursor/reference updated"

info "Updating .cursorrules..."
cp "$TMP_DIR/.cursorrules" .cursorrules
ok ".cursorrules updated"

rm -rf "$TMP_DIR"

echo -e "\n${GREEN}${BOLD}Template files updated.${RESET}"
echo
echo "Review what changed before committing:"
echo
echo "  git diff"
echo
echo "If everything looks good:"
echo
echo "  git add .cursor/ .cursorrules"
echo "  git commit -m \"Update process files from template\""
echo
