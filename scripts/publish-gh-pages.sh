#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/publish-gh-pages.sh [--push] [--skip-tests]

Build web/ and update the gh-pages bookmark so it contains only the static
files from web/dist at the repository root.

Options:
  --push        Push the gh-pages bookmark after updating it.
  --skip-tests  Skip npm run test before building.
  -h, --help    Show this help.
USAGE
}

push=false
run_tests=true

while (($#)); do
  case "$1" in
    --push)
      push=true
      ;;
    --skip-tests)
      run_tests=false
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if ! command -v jj >/dev/null 2>&1; then
  echo "jj is required but was not found in PATH." >&2
  exit 1
fi

if [[ "$run_tests" == true ]]; then
  npm --prefix web run test
fi

npm --prefix web run build

tmp_index=$(mktemp "${TMPDIR:-/tmp}/gh-pages-index.XXXXXX")
cleanup() {
  rm -f "$tmp_index"
}
trap cleanup EXIT

export GIT_INDEX_FILE="$tmp_index"
git read-tree --empty
git --work-tree="$repo_root/web/dist" add -A -f .
tree=$(git write-tree)
unset GIT_INDEX_FILE

commit_args=("$tree")
if parent=$(git rev-parse --verify --quiet refs/heads/gh-pages); then
  commit_args=(-p "$parent" "${commit_args[@]}")
fi

commit=$(printf 'Publish web static site\n' | git commit-tree "${commit_args[@]}")
git update-ref refs/heads/gh-pages "$commit"
jj git import

echo "Updated gh-pages to $commit"

if [[ "$push" == true ]]; then
  jj git push --bookmark gh-pages
else
  echo "Not pushed. Run: jj git push --bookmark gh-pages"
fi
