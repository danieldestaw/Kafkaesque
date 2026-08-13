#!/usr/bin/env bash
# Push Kafkaesque with full history (all branches) to GitHub
set -euo pipefail
cd "$(dirname "$0")"

export PATH="${HOME}/.local/bin:${PATH}"

OWNER="${GITHUB_OWNER:-mrdrobotE}"
REPO="${GITHUB_REPO:-Kafkaesque}"
REMOTE_URL="https://github.com/${OWNER}/${REPO}.git"

echo "==> Checking GitHub auth..."
if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in. Run:  gh auth login"
  echo "Then re-run this script."
  exit 1
fi

echo "==> GitHub user: $(gh api user -q .login)"
echo "==> Local commits: $(git log --oneline | wc -l | tr -d ' ')"
echo "==> Local branches: $(git branch | wc -l | tr -d ' ')"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

if ! gh repo view "${OWNER}/${REPO}" >/dev/null 2>&1; then
  echo "==> Creating public repo ${OWNER}/${REPO}..."
  gh repo create "${OWNER}/${REPO}" \
    --public \
    --source=. \
    --remote=origin \
    --description "Open-source Kafka management and observability platform"
else
  echo "==> Repo ${OWNER}/${REPO} already exists"
fi

echo "==> Pushing master..."
git push -u origin master

echo "==> Pushing all branches (full history)..."
git push origin --all

echo ""
echo "Done! Repository:"
gh repo view "${OWNER}/${REPO}" --json url -q .url
echo ""
echo "Remote branches:"
git ls-remote --heads origin | sed 's/.*\///'
