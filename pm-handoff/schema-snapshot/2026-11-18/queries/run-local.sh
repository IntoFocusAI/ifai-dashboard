#!/usr/bin/env bash
# Run every catalog query against a database and write results to ./out-local/
# for diffing against ../out/ (the hosted snapshot).
# Usage: DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres ./run-local.sh
# Read-only: every file is a single SELECT against system catalogs.
set -euo pipefail
cd "$(dirname "$0")"
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
mkdir -p ../out-local
for f in [0-9][0-9]-*.sql; do
  base="${f%.sql}"
  case "$base" in
    06-views|07-functions) ext=sql ;;
    *) ext=json ;;
  esac
  psql "$DB_URL" -X -q -A -t -v ON_ERROR_STOP=1 -c "set default_transaction_read_only = on;" -f "$f" > "../out-local/$base.raw"
  if [ "$ext" = json ]; then
    python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); json.dump(d,open(sys.argv[2],"w"),indent=1,ensure_ascii=False,sort_keys=True); open(sys.argv[2],"a").write("\n")' "../out-local/$base.raw" "../out-local/$base.json"
  else
    cp "../out-local/$base.raw" "../out-local/$base.sql"
  fi
  rm "../out-local/$base.raw"
done
echo "Done. Compare with: diff -ru ../out ../out-local"
