#!/usr/bin/env bash
# Phase 0 of the core migration: snapshot every live canvas read view (definition + columns)
# into supabase/view-snapshots/ so the core-backed replacements can be contract-tested against it.
# Read-only. Usage:
#   SUPABASE_DB_URL=postgres://... scripts/snapshot-canvas-views.sh   (any role; pg_catalog is readable)
#   scripts/snapshot-canvas-views.sh [project-ref]                    (Supabase CLI; needs project access)
set -euo pipefail
cd "$(dirname "$0")/.."
REF="${1:-qftczrlksczfimnzfiov}"
OUT=supabase/view-snapshots
TMP=$(mktemp)
SQL="
select n.nspname as schema, c.relname as name,
  case c.relkind when 'v' then 'view' else 'materialized view' end as kind,
  pg_get_viewdef(c.oid, true) as definition,
  (select json_agg(json_build_object('column', a.attname, 'type', format_type(a.atttypid, a.atttypmod)) order by a.attnum)
     from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('v','m')
  and (c.relname like 'canvas%' or n.nspname in ('canvas_private','ledlenser_private'))
order by 1, 2"
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  psql "$SUPABASE_DB_URL" -At -v ON_ERROR_STOP=1 -c "select coalesce(json_agg(t), '[]') from ($SQL) t" > "$TMP"
else
  supabase db query --remote="$REF" --read-only -o json "$SQL" > "$TMP"
fi
python3 -I scripts/snapshot-canvas-views.py "$TMP" "$OUT"
rm -f "$TMP"
