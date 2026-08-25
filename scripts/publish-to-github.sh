#!/usr/bin/env bash
# Publish this repo to GitHub as a private repository named beneath-the-throne-mobile.
# Requires: GitHub CLI authenticated (gh auth login) OR GH_TOKEN / GITHUB_TOKEN set.
set -euo pipefail

REPO_NAME="${1:-beneath-the-throne-mobile}"
OWNER="${2:-}"

cd "$(dirname "$0")/.."

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is required. Install from https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: GitHub CLI is not authenticated."
  echo "  Run: gh auth login"
  echo "  Or set GH_TOKEN / GITHUB_TOKEN with repo scope."
  exit 1
fi

if [[ -z "$OWNER" ]]; then
  OWNER="$(gh api user -q .login)"
fi

FULL="${OWNER}/${REPO_NAME}"

if gh repo view "$FULL" >/dev/null 2>&1; then
  echo "Repository already exists: https://github.com/${FULL}"
else
  echo "Creating private repository ${FULL}..."
  gh repo create "$REPO_NAME" --private --description "Beneath the Throne — mobile/browser dark fantasy RPG playtest"
fi

if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "https://github.com/${FULL}.git"
else
  git remote add github "https://github.com/${FULL}.git"
fi

echo "Pushing main and tags to GitHub..."
git push -u github main
git push github --tags

echo ""
echo "Done: https://github.com/${FULL}"
echo "Game directory: btt-web-playtest/"
echo "Run locally: cd btt-web-playtest && npm install && npm run dev"
