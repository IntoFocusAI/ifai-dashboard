#!/usr/bin/env bash
# Local stack for the portal sign-in tests (issue 248). Local only: it never reads or writes a
# hosted project. Docker containers: Postgres (supabase/postgres) and PostgREST, plus a small Node
# gateway (e2e/portal/local-gateway.mjs) on the Supabase API paths.
#
#   scripts/portal-local-stack.sh up     start and load the fixtures (made-up accounts A and B)
#   scripts/portal-local-stack.sh sql    run supabase/tests/dashboard_portal_access.test.sql
#   scripts/portal-local-stack.sh down   stop and remove everything
#
# Writes .tmp/portal-stack.env (gitignored) with the URL, a key and the random JWT secret made
# for this run. playwright.portal.config.ts reads it.
set -euo pipefail
cd "$(dirname "$0")/.."

NET=ifai-portal-test
PG=ifai-portal-pg
REST=ifai-portal-rest
PG_IMAGE=${PG_IMAGE:-public.ecr.aws/supabase/postgres:17.12.0.000}
REST_IMAGE=${REST_IMAGE:-postgrest/postgrest:v16.5}
PG_PORT=${PG_PORT:-54422}
REST_PORT=${REST_PORT:-54423}
GATEWAY_PORT=${GATEWAY_PORT:-54421}
ENV_FILE=.tmp/portal-stack.env
PID_FILE=.tmp/portal-gateway.pid
FIX=supabase/tests/fixtures/portal-dashboard
export PGPASSWORD=postgres

psql_as() { psql -h 127.0.0.1 -p "$PG_PORT" -U "$1" -d postgres -v ON_ERROR_STOP=1 -q "${@:2}"; }

down() {
  if [[ -f $PID_FILE ]]; then kill "$(cat $PID_FILE)" 2>/dev/null || true; rm -f $PID_FILE; fi
  docker rm -f $REST $PG >/dev/null 2>&1 || true
  docker network rm $NET >/dev/null 2>&1 || true
}

up() {
  down
  mkdir -p .tmp
  docker network create $NET >/dev/null
  docker run -d --name $PG --network $NET -e POSTGRES_PASSWORD=postgres -p "$PG_PORT:5432" "$PG_IMAGE" >/dev/null
  for _ in $(seq 1 60); do psql_as postgres -c "select 1" >/dev/null 2>&1 && break; sleep 1; done

  # The image leaves the API login role without a password; give it the local one.
  psql_as supabase_admin -c "alter role authenticator with password 'postgres'"
  psql_as supabase_admin -f $FIX/00-local-auth.sql
  psql_as postgres -f $FIX/10-portal-stub.sql 2>/dev/null
  psql_as postgres -f $FIX/20-isolation-contract-stub.sql 2>/dev/null
  psql_as postgres -f supabase/migrations/20261118210000_dashboard_portal_access.sql
  psql_as postgres -f $FIX/30-accounts-ab.sql

  local secret anon
  secret=$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')
  anon=$(JWT_SECRET=$secret node --input-type=module -e '
    import { signJwt } from "./e2e/portal/jwt.mjs";
    console.log(signJwt({ role: "anon", iss: "local-portal-stack", exp: Math.floor(Date.now() / 1000) + 86400 }, process.env.JWT_SECRET));')

  docker run -d --name $REST --network $NET -p "$REST_PORT:3000" \
    -e PGRST_DB_URI="postgres://authenticator:postgres@$PG:5432/postgres" \
    -e PGRST_DB_SCHEMAS="public,command,ledlenser,sandbox" \
    -e PGRST_DB_ANON_ROLE=anon \
    -e PGRST_JWT_SECRET="$secret" \
    "$REST_IMAGE" >/dev/null

  GATEWAY_PORT=$GATEWAY_PORT POSTGREST_URL="http://127.0.0.1:$REST_PORT" JWT_SECRET=$secret \
    nohup node e2e/portal/local-gateway.mjs > .tmp/portal-gateway.log 2>&1 &
  echo $! > $PID_FILE

  for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:$GATEWAY_PORT/rest/v1/" -H "authorization: Bearer $anon" >/dev/null && break; sleep 1; done

  cat > $ENV_FILE <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$GATEWAY_PORT
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$anon
PORTAL_STACK_JWT_SECRET=$secret
PORTAL_STACK_DB_URL=postgres://postgres:postgres@127.0.0.1:$PG_PORT/postgres
ENV
  echo "Local portal stack is up. Settings in $ENV_FILE."
}

sql() {
  psql_as postgres -f supabase/tests/dashboard_portal_access.test.sql 2>&1 | grep -E "ok:|FAILED|ERROR" | sed 's/^psql:[^ ]* NOTICE:  //'
  ! psql_as postgres -f supabase/tests/dashboard_portal_access.test.sql 2>&1 | grep -qE "FAILED|ERROR"
}

case "${1:-}" in
  up) up ;;
  sql) sql ;;
  down) down ;;
  *) echo "usage: $0 up|sql|down" >&2; exit 2 ;;
esac
