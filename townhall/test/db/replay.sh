#!/bin/bash
# Replays every migration in supabase/migrations on a local, empty Postgres with small Supabase stubs,
# then runs pivot_rules.sql (expected results are written next to each check).
# Never touches the live project. Usage: PGHOST=/path/to/socket PGPORT=5499 bash test/db/replay.sh
set -e; cd "$(dirname "$0")"; P="psql -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists bb_test" -c "create database bb_test"
$P -d bb_test -f stubs.sql
for f in ../../supabase/migrations/*.sql; do sed -E 's/^create extension.*$//' "$f" | $P -d bb_test >/dev/null; echo "applied $(basename "$f")"; done
psql -U ${PGUSER:-postgres} -d bb_test -q -f pivot_rules.sql 2>&1 | grep -E "NOTICE|=>" | sed 's/^.*NOTICE:  //'
# The two owner self-tests from sql/ (each ends with "RESULTS: ..." and must contain no FAIL)
psql -U ${PGUSER:-postgres} -d bb_test -q -c "grant usage on schema public, private to anon, authenticated; grant select, insert, update, delete on all tables in schema public to anon, authenticated; grant usage on schema storage to authenticated; grant insert on storage.objects to authenticated;"
for t in security_tests library_tests; do r=$(psql -U ${PGUSER:-postgres} -d bb_test -q -f ../../sql/$t.sql 2>&1 | grep -o "RESULTS:.*"); echo "$t: $(echo "$r" | grep -q FAIL && echo FAIL || echo ok) ($(echo "$r" | grep -o '\[ok' | wc -l) checks ok)"; done
