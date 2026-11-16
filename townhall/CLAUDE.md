# Townhall

Public, non-monetised forum where UK higher and further education staff share what they built with AI. A post states the task, tool, minutes before and after, data used, and what went wrong; colleagues record "I tried this" (worked, partly, didn't). The goal is traction, not revenue. The audience is university staff. "Townhall" is a working name: townhall.com exists, so a rename is pending.

Operator: Ahmad Ismail. The contact email in `src/app.js` (`OPERATOR`) is shown publicly on purpose. Do not send it to any other service.

## Stack

- Front end: one HTML file, no framework. `src/shell.html` (layout, CSS, design tokens) and `src/app.js` (all views, hash routing). `build.py` inlines the fonts, supabase-js and app.js into `dist/index.html`.
- Back end: Supabase project `dlqltqsojkjygzzehvjk` ("aitownhall", eu-west-2 London). Postgres with RLS. Security-definer helpers and trigger functions live in the `private` schema. Triggers enforce the posting rules. Views use `security_invoker`. Storage bucket `shots` (public, 1.5 MB, webp/png/jpeg, members write only to `uid/`).
- Scheduled jobs (pg_cron): `news-request` and `news-collect` every 6 hours (pg_net fetches RSS for the HE AI news page), `housekeeping` weekly.

## Commands

```
npm install                       # fonts, supabase-js, axe-core
pip install playwright && playwright install chromium
python3 build.py                  # writes dist/index.html
python3 test/run.py               # end-to-end flows against a mock Supabase (test/mock.js)
python3 test/return.py            # login returns to the right page; logged-out try is kept
python3 test/a11y.py              # axe-core over every page in 4 display modes
```

Rebuild before running tests. Expected results are `ERRORS: []` and `NO VIOLATIONS`.

## Database

Migrations were applied live through the Supabase MCP and are not yet in this repo. First job: pull them into `supabase/migrations/` (`supabase link --project-ref dlqltqsojkjygzzehvjk` then `supabase db pull`, or read `supabase_migrations.schema_migrations` through the Supabase MCP and write one file per row). Applied so far, in order: core_schema, rls_views_rpcs, move_helpers_private, higher_education_focus, spaces_tools_screenshots_knowledge, my_library, open_signup_and_trust_ac_uk, he_ai_news, he_ai_news_parse_fix, notifications_privacy_metrics.

`sql/` holds scripts the owner still needs to run by hand: `library_tests.sql` (not yet run on live), `seed_samples.sql` (optional, example posts labelled "Example"), `move_pg_net.sql` (optional, clears the "Extension in Public" advisor warning), `security_tests.sql`.

Test risky SQL inside a `DO` block that raises at the end so it rolls back.

## Product rules already decided

- Anyone can sign up with any email. `.ac.uk` accounts get a verified badge and publish immediately. Other accounts need 3 approved posts before they publish without review.
- Each post sits in one task-based space (`/marking-feedback`, `/exams-timetabling`, `/student-support`, `/policy-governance`, `/other`), plus tool and type filters. "Motions & meetings" (`#b-townhall`) is for how the site is run.
- Sidebar: Categories, Townhall (home feed), HE AI news, My library; then a divider; then Share a build, Time saved, Moderation, Settings. No "My feed". No member directory.
- No real data in posts. The form tells people to swap anything sensitive for dummy data, and the database blocks emails, UK phone numbers and NI numbers.
- My library is private: saved copies and drafts, exportable as JSON or Markdown.
- HE AI news shows titles only, linking to the source.
- Posts are CC BY 4.0. Users must be 18 or over.
- Never invent users, posts, counts or activity. Example posts must be labelled "Example".

## Writing style for any UI text or docs

British English. No em dashes, anywhere. Plain words, short sentences, answer first. No filler, no hype, no colon reveals.

## Open items

Name and domain; SMTP (Resend) for confirmation emails; Supabase Pro; deploy; owner joins first; second admin and moderators; Online Safety Act records; founding members. UX fixes from the journey map (`journey/townhall-first-win.mmd`) still to do: show the expected wait on pending posts, link the approval notification to the live post, add a "Discuss" link on news items.
