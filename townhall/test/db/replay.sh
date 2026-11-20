#!/bin/bash
# Replays every migration in supabase/migrations on a local, empty Postgres with small Supabase stubs,
# then runs pivot_rules.sql (expected results are written next to each check).
# Never touches the live project. Usage: PGHOST=/path/to/socket PGPORT=5499 bash test/db/replay.sh
set -e; cd "$(dirname "$0")"; P="psql -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists bb_test" -c "create database bb_test"
$P -d bb_test -f stubs.sql
for f in ../../supabase/migrations/*.sql; do sed -E 's/^create extension.*$//' "$f" | $P -d bb_test >/dev/null; echo "applied $(basename "$f")"; done
psql -U ${PGUSER:-postgres} -d bb_test -q -f pivot_rules.sql 2>&1 | grep -E "NOTICE|=>" | sed 's/^.*NOTICE:  //'
