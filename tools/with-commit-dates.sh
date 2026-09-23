#!/bin/sh
# Run a command with the first and last commit dates (YYYY-MM-DD, committer
# time zone) exported for the credit on the HIRED card, e.g.
#   sh tools/with-commit-dates.sh vite build
set -eu
VITE_FIRST_COMMIT=$(git log --format=%cs | tail -n 1)
VITE_LAST_COMMIT=$(git log -1 --format=%cs)
export VITE_FIRST_COMMIT VITE_LAST_COMMIT
exec "$@"
