#!/usr/bin/env bash
# Local database tests. Starts a throwaway Postgres cluster, loads the test fixtures, applies the
# migrations under test, then runs every supabase/tests/*.test.sql file. Never connects to hosted.
#
#   bash supabase/tests/run.sh
#
# Needs Postgres 15+ server binaries (initdb, pg_ctl, psql). Set PG_BIN if they are not on PATH.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
if [ -z "${PG_BIN:-}" ]; then
  PG_BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
fi
export PATH="${PG_BIN:+$PG_BIN:}$PATH"

work="$(mktemp -d)"
port="${PGTEST_PORT:-55439}"
cleanup() { pg_ctl -D "$work/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

run_as=()
if [ "$(id -u)" = "0" ]; then
  # Postgres refuses to run as root.
  id pgtest >/dev/null 2>&1 || useradd -M -s /bin/false pgtest
  chown -R pgtest "$work"
  run_as=(runuser -u pgtest --)
fi

${run_as[@]+"${run_as[@]}"} initdb -D "$work/data" -U postgres -A trust >/dev/null
${run_as[@]+"${run_as[@]}"} pg_ctl -D "$work/data" -o "-p $port -k $work -c listen_addresses=''" -l "$work/log" -w start >/dev/null

psql_q() { psql -h "$work" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X "$@"; }

# Fixtures and migrations under test, in order. See supabase/tests/README.md.
while read -r file; do
  [ -z "$file" ] && continue
  case "$file" in \#*) continue ;; esac
  psql_q -f "$root/$file" >/dev/null
done < "$here/load-order.txt"

failed=0
for t in "$here"/*.test.sql; do
  name="$(basename "$t")"
  if out="$(psql_q -f "$t" 2>&1)"; then
    echo "ok   $name"
  else
    echo "FAIL $name"; echo "$out" | sed 's/^/     /'
    failed=1
  fi
done
exit $failed
