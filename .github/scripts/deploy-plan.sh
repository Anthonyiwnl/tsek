#!/usr/bin/env bash
# Decide which services a merge needs to deploy (#150, optimization 4).
#
# Render builds only backend/ and Vercel only frontend/, and each reports the
# commit it serves. A service is deployed only when its folder changed between
# the commit it serves and this commit. Changes that neither host builds or
# runs do not count (#166): the test folders (test/, tests/) and Markdown
# files. Otherwise the smoke test expects the commit it already serves. When
# the served commit cannot be read or is not in this commit's history, the
# service deploys, exactly as before #150.
#
# Usage: deploy-plan.sh <backend|frontend> <served-commit> <this-commit>
# Prints three lines for $GITHUB_OUTPUT: deploy=, expect=, reason=.
# Needs the full history of this commit (actions/checkout with fetch-depth: 0).
set -euo pipefail

service="$1"
served="$2"
sha="$3"

case "$service" in
  backend | frontend) ;;
  *) echo "Unknown service: $service" >&2; exit 2 ;;
esac

plan() {
  echo "deploy=$1"
  echo "expect=$2"
  echo "reason=$3"
}

# The served commit comes from an HTTP response: accept only a full SHA.
if [[ ! "$served" =~ ^[0-9a-f]{40}$ ]]; then
  plan true "$sha" "could not read the commit it serves"
elif [[ "$served" == "$sha" ]]; then
  plan false "$sha" "already serves this commit"
elif ! git cat-file -e "${served}^{commit}" 2>/dev/null \
  || ! git merge-base --is-ancestor "$served" "$sha"; then
  plan true "$sha" "serves ${served:0:7}, which is not in this commit's history"
elif git diff --quiet "$served" "$sha" -- "$service/" \
  ":(exclude)$service/test/" ":(exclude)$service/tests/" ":(exclude,glob)$service/**/*.md"; then
  plan false "$served" "no deployable changes in $service/ since ${served:0:7}, which it serves"
else
  plan true "$sha" "$service/ changed since ${served:0:7}, which it serves"
fi
