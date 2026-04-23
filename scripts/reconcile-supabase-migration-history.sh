#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "::error title=Missing SUPABASE_DB_URL::SUPABASE_DB_URL is required."
  exit 1
fi

repair_requested="${REPAIR_MIGRATION_HISTORY:-false}"
diagnostics_dir=".migration-diagnostics"
mkdir -p "$diagnostics_dir"

summary_file="${GITHUB_STEP_SUMMARY:-/dev/null}"
local_migrations_file="$diagnostics_dir/local-migrations.tsv"
remote_versions_file="$diagnostics_dir/remote-versions.txt"
local_only_file="$diagnostics_dir/local-only.tsv"
schema_check_file="$diagnostics_dir/schema-check.tsv"
repair_candidates_file="$diagnostics_dir/repair-candidates.tsv"
schema_mismatch_file="$diagnostics_dir/schema-mismatch.tsv"
repaired_file="$diagnostics_dir/repaired.tsv"
migration_list_before_file="$diagnostics_dir/migration-list-before.txt"
psql_error_file="$diagnostics_dir/psql-error.txt"

: > "$local_migrations_file"
: > "$remote_versions_file"
: > "$local_only_file"
: > "$repair_candidates_file"
: > "$schema_mismatch_file"
: > "$repaired_file"

echo "Supabase migration history before reconciliation:"
supabase migration list --db-url "$SUPABASE_DB_URL" | tee "$migration_list_before_file"

python - <<'PY'
import os
import sys
from urllib.parse import unquote, urlparse

raw = os.environ["SUPABASE_DB_URL"]
parsed = urlparse(raw)

host = parsed.hostname or ""
user = unquote(parsed.username or "")
database = unquote((parsed.path or "/postgres").lstrip("/") or "postgres")

if not host or not user or not parsed.password:
    print(
        "::error title=Invalid SUPABASE_DB_URL for psql diagnostics::"
        "Expected a full postgres URL with host, username, and password.",
        file=sys.stderr,
    )
    sys.exit(1)

if host.endswith(".pooler.supabase.com") and not user.startswith("postgres."):
    print(
        "::error title=Invalid pooler username in SUPABASE_DB_URL::"
        f"Expected the Supabase session pooler username to look like postgres.<project-ref>, got {user!r}.",
        file=sys.stderr,
    )
    sys.exit(1)

print(f"Using psql DSN directly: host={host} user={user} database={database}")
PY

run_psql() {
  local output_file="$1"
  shift

  if psql "$SUPABASE_DB_URL" "$@" > "$output_file" 2> "$psql_error_file"; then
    if [ -s "$psql_error_file" ]; then
    cat "$psql_error_file" >&2
    fi
    return 0
  fi

  echo "::error title=psql diagnostic connection failed::Supabase CLI can list migrations, but psql could not connect with the exact SUPABASE_DB_URL DSN. Check that the secret preserves the session pooler username postgres.<project-ref> and URL-encodes the password."
  cat "$psql_error_file" >&2
  exit 1
}

run_psql_capture() {
  local label="$1"
  shift
  local output_file="$diagnostics_dir/$label.txt"
  run_psql "$output_file" "$@"
  cat "$output_file"
}

run_psql_file() {
  local output_file="$1"
  shift
  run_psql "$output_file" "$@"
  cat "$output_file"
}

while IFS= read -r migration_path; do
  migration_name="$(basename "$migration_path" .sql)"
  migration_version="${migration_name%%_*}"
  printf "%s\t%s\n" "$migration_version" "$migration_name" >> "$local_migrations_file"
done < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort)

remote_history_exists="$(
  run_psql_capture remote-history-exists -v ON_ERROR_STOP=1 -AtX \
    -c "select to_regclass('supabase_migrations.schema_migrations') is not null;"
)"

if [ "$remote_history_exists" = "t" ]; then
  run_psql_file "$remote_versions_file" -v ON_ERROR_STOP=1 -AtX \
    -c "select version from supabase_migrations.schema_migrations order by version;" \
    > /dev/null
fi

run_psql_file "$schema_check_file" -v ON_ERROR_STOP=1 -AtX -F $'\t' \
  -f scripts/check-supabase-legacy-migration-schema.sql \
  | tee "$schema_check_file.display"

declare -A local_names
declare -A schema_state
declare -A schema_missing

while IFS=$'\t' read -r version migration_name; do
  if [ -z "${local_names[$version]:-}" ]; then
    local_names[$version]="$migration_name"
  else
    local_names[$version]="${local_names[$version]}, $migration_name"
  fi
done < "$local_migrations_file"

while IFS=$'\t' read -r version state missing; do
  schema_state[$version]="$state"
  schema_missing[$version]="${missing:-}"
done < "$schema_check_file"

remote_has_version() {
  grep -Fxq "$1" "$remote_versions_file"
}

while IFS=$'\t' read -r version _migration_name; do
  if ! grep -Fxq "$version" "$local_only_file.versions" 2>/dev/null; then
    if ! remote_has_version "$version"; then
      printf "%s\t%s\n" "$version" "${local_names[$version]}" >> "$local_only_file"
      printf "%s\n" "$version" >> "$local_only_file.versions"
    fi
  fi
done < "$local_migrations_file"

rm -f "$local_only_file.versions"

while IFS=$'\t' read -r version migration_names; do
  state="${schema_state[$version]:-unknown}"
  missing="${schema_missing[$version]:-no schema diagnostic exists for this migration version}"

  case "$state" in
    complete)
      printf "%s\t%s\n" "$version" "$migration_names" >> "$repair_candidates_file"
      ;;
    partial)
      printf "%s\t%s\t%s\n" "$version" "$migration_names" "$missing" >> "$schema_mismatch_file"
      ;;
    absent|unknown)
      ;;
  esac
done < "$local_only_file"

{
  echo "## Supabase migration-history diagnostics"
  echo
  echo "### Local-only migration versions"
  if [ -s "$local_only_file" ]; then
    while IFS=$'\t' read -r version migration_names; do
      echo "- \`$version\`: $migration_names"
    done < "$local_only_file"
  else
    echo "- None"
  fi
  echo
  echo "### Schema-complete local-only migrations"
  if [ -s "$repair_candidates_file" ]; then
    while IFS=$'\t' read -r version migration_names; do
      echo "- \`$version\`: $migration_names"
    done < "$repair_candidates_file"
  else
    echo "- None"
  fi
  echo
  echo "### Partial schema mismatches"
  if [ -s "$schema_mismatch_file" ]; then
    while IFS=$'\t' read -r version migration_names missing; do
      echo "- \`$version\`: $migration_names"
      echo "  Missing checks: $missing"
    done < "$schema_mismatch_file"
  else
    echo "- None"
  fi
} >> "$summary_file"

if [ -s "$schema_mismatch_file" ]; then
  echo "::error title=Partial legacy migration schema::At least one local-only migration is partially represented in the live schema. Add an idempotent repair migration for the missing pieces before marking the legacy migration applied."
  cat "$schema_mismatch_file"
  exit 1
fi

if [ "$repair_requested" != "true" ]; then
  if [ -s "$repair_candidates_file" ]; then
    echo "::error title=Migration history repair required::The live schema already contains local-only legacy migration objects. Rerun this workflow with repair_migration_history=true to mark the verified migrations as applied, then push only truly missing migrations."
    cat "$repair_candidates_file"
    exit 1
  fi

  echo "No verified legacy migration-history repair is needed."
  exit 0
fi

if [ ! -s "$repair_candidates_file" ]; then
  echo "repair_migration_history=true was set, but there are no schema-complete local-only migrations to repair."
  exit 0
fi

while IFS=$'\t' read -r version migration_names; do
  echo "Marking migration version $version as applied: $migration_names"
  supabase migration repair "$version" --status applied --db-url "$SUPABASE_DB_URL"
  printf "%s\t%s\n" "$version" "$migration_names" >> "$repaired_file"
done < "$repair_candidates_file"

{
  echo
  echo "### Migrations marked applied"
  if [ -s "$repaired_file" ]; then
    while IFS=$'\t' read -r version migration_names; do
      echo "- \`$version\`: $migration_names"
    done < "$repaired_file"
  else
    echo "- None"
  fi
} >> "$summary_file"
