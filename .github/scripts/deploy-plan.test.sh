#!/usr/bin/env bash
# Tests for deploy-plan.sh (#150). Builds a throwaway repository with known
# history and checks every decision. Run: bash .github/scripts/deploy-plan.test.sh
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/deploy-plan.sh"
repo="$(mktemp -d)"
trap 'rm -rf "$repo"' EXIT
cd "$repo"

git init --quiet --initial-branch=main
git config user.email test@example.com
git config user.name test
commit() { # commit <file> <message>; prints the new SHA
  mkdir -p "$(dirname "$1")"
  echo "$2" >> "$1"
  git add "$1"
  git commit --quiet -m "$2"
  git rev-parse HEAD
}

base="$(commit backend/a.js base-backend)"
commit frontend/b.js base-frontend > /dev/null
docs="$(commit docs/c.md docs-only)"
back="$(commit backend/a.js backend-change)"
front="$(commit frontend/b.js frontend-change)"
# #166: changes neither host builds or runs.
betest="$(commit backend/test/a.test.js backend-test-only)"
bedoc="$(commit backend/README.md backend-readme-only)"
benested="$(commit backend/docs/notes.md backend-nested-markdown)"
fetest="$(commit frontend/tests/b.test.js frontend-test-only)"
fedoc="$(commit frontend/README.md frontend-readme-only)"
mixed="$(commit backend/test/c.test.js backend-test-before-code)"
mixed="$(commit backend/a.js backend-code-after-test)"
lookalike="$(commit backend/src/testing.js backend-code-named-like-test)"
git checkout --quiet -b other "$base"
side="$(commit backend/a.js side-branch)"
git checkout --quiet main

failures=0
check() { # check <name> <service> <served> <sha> <deploy> <expect>
  local out deploy expect
  out="$(bash "$script" "$2" "$3" "$4")"
  deploy="$(sed -n 's/^deploy=//p' <<< "$out")"
  expect="$(sed -n 's/^expect=//p' <<< "$out")"
  if [[ "$deploy" == "$5" && "$expect" == "$6" ]] && grep -q '^reason=.' <<< "$out"; then
    echo "ok - $1"
  else
    echo "not ok - $1: got deploy=$deploy expect=$expect, want deploy=$5 expect=$6"
    failures=$((failures + 1))
  fi
}

check "docs-only merge keeps the backend" backend "$base" "$docs" false "$base"
check "frontend changed after the served commit deploys" frontend "$base" "$docs" true "$docs"
check "frontend unchanged since the served commit is kept" frontend "$docs" "$back" false "$docs"
check "backend change deploys the backend" backend "$docs" "$back" true "$back"
check "frontend change deploys the frontend" frontend "$back" "$front" true "$front"
check "frontend change keeps the backend" backend "$back" "$front" false "$back"
check "change several merges ago still deploys" backend "$base" "$front" true "$front"
check "already serving this commit" backend "$front" "$front" false "$front"
check "unreadable served commit deploys" backend "" "$front" true "$front"
check "malformed served commit deploys" frontend "not-a-sha; rm -rf /" "$front" true "$front"
check "short served commit deploys" backend "${base:0:7}" "$front" true "$front"
check "unknown served commit deploys" backend "0123456789abcdef0123456789abcdef01234567" "$front" true "$front"
check "served commit outside main's history deploys" backend "$side" "$front" true "$front"
check "backend test-only change keeps the backend" backend "$front" "$betest" false "$front"
check "backend README-only change keeps the backend" backend "$betest" "$bedoc" false "$betest"
check "nested Markdown in backend keeps the backend" backend "$front" "$benested" false "$front"
check "frontend test-only change keeps the frontend" frontend "$front" "$fetest" false "$front"
check "frontend README-only change keeps the frontend" frontend "$fetest" "$fedoc" false "$fetest"
check "tests plus code still deploy the backend" backend "$fedoc" "$mixed" true "$mixed"
check "code in a test-like file name still deploys" backend "$mixed" "$lookalike" true "$lookalike"

if bash "$script" database "$base" "$front" > /dev/null 2>&1; then
  echo "not ok - unknown service is rejected"
  failures=$((failures + 1))
else
  echo "ok - unknown service is rejected"
fi

if (( failures )); then
  echo "$failures test(s) failed"
  exit 1
fi
echo "All deploy-plan tests passed."
