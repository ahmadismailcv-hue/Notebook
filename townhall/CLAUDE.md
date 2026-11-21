# The Boring Bits

AI help for everyday life for UK adults using free AI tools (ChatGPT, Copilot, Gemini, Claude), and the people who help them (library volunteers, support workers, family members). Tagline: "AI help for everyday life. Shared by people, tested by us." Public and non-commercial. The goal is traction, not revenue.

Formerly "Townhall", a forum for UK higher education staff. The pivot brief is `PIVOT_PLAN.md` (approved 19 Nov 2026). The name lives in one constant, `APP_NAME` in `src/app.js`; `build.py` copies it into the page shell. It may change again.

Operator: Ahmad Ismail. The contact email in `src/app.js` (`OPERATOR`) is shown publicly on purpose. Do not send it to any other service.

## Stack

- Front end: one HTML file, no framework. `src/shell.html` (layout, CSS, design tokens, print styles) and `src/app.js` (all views, hash routing). `build.py` inlines the fonts, supabase-js and app.js into `dist/index.html`.
- Back end: Supabase project `dlqltqsojkjygzzehvjk` ("aitownhall", eu-west-2 London). Postgres with RLS. Security-definer helpers and trigger functions live in the `private` schema. Triggers enforce the posting rules. Views use `security_invoker`. Storage bucket `shots` (public, 1.5 MB, webp/png/jpeg, members write only to `uid/`).
- Scheduled jobs (pg_cron): `news-request` and `news-collect` every 6 hours (pg_net fetches RSS feeds; all switched off by the pivot migration), `housekeeping` weekly.

## Commands

```
npm install                       # fonts, supabase-js, axe-core
pip install playwright==1.63.0    # match the installed Chromium; newer versions look for a different browser build
npm run build                     # writes dist/index.html; prints the em dash count, which must be 0
npm test                          # rebuilds, then test/run.py (the plan's "Done when" flow and more, against test/mock.js) and test/return.py (login returns to the right page; a logged-out recipe answer is kept)
npm run a11y                      # rebuilds, then test/a11y.py: axe-core over every page in 4 display modes
PGHOST=<socket dir> PGPORT=<port> bash test/db/replay.sh   # replays every migration on a local, empty Postgres with Supabase stubs, then checks the pivot rules. Never touches live.
```

Expected results: `ERRORS: []` from both flow tests, `NO VIOLATIONS` from a11y. All three scripts exit 1 on failure.

## Database

The migrations applied to the live project are in `supabase/migrations/`, one file per row of `supabase_migrations.schema_migrations`. Applied so far, in order: core_schema, rls_views_rpcs, move_helpers_private, higher_education_focus, spaces_tools_screenshots_knowledge, my_library, open_signup_and_trust_ac_uk, he_ai_news, he_ai_news_parse_fix, notifications_privacy_metrics, boring_bits_pivot.

**Applied 21 Nov 2026** (by Ahmad in the SQL Editor, then recorded in the migration history): `20261120120000_boring_bits_pivot.sql`. Afterwards `sql/security_tests.sql` (41 ok, no FAIL) and `sql/library_tests.sql` (10 ok) passed on live, and `sql/seed_recipes.sql` added the 5 draft guides (no author yet).

`supabase/schema_snapshot.md`, `advisors.md` and `live_check.md` are read-only reports from 16 Nov 2026, before the pivot.

`sql/` holds scripts the owner runs by hand in the SQL editor: `seed_recipes.sql` (5 draft recipes, after the migration), `security_tests.sql` and `library_tests.sql` (rolled-back self-tests for the pivoted schema; expect "RESULTS:" with no "FAIL"), `move_pg_net.sql` (optional). `seed_samples.sql` is obsolete.

Test risky SQL locally with `test/db/replay.sh`, or inside a `DO` block that raises at the end so it rolls back.

## Product rules already decided

- Two post types. People see them as **tips** and **guides**; the database keeps the names STORY and RECIPE. **Tip** (STORY, anyone): title, space, what I needed to do (`task`), AI tool (`tool_key`), roughly what I typed (`prompt`, optional, behind "See more"), what happened (`body`), what I checked (`checks`, optional), screenshots. **Guide** (RECIPE, admins only): task, recommended tools, prompts with copy buttons, never paste, how to check (https links), failure points, deadline warning, last tested date and tools, re-test due ("May be out of date" once passed), linked source stories, printable one-page view. Guides ask "Did this guide work for you?" (yes or no, with the tool used) and sort by how many said yes. No likes in the interface.
- Share a tip asks an optional "What changed?" (outcome_before and outcome_after, 200 characters each). It shows on the tip as the member's own account ("Your result may be different"), never as a verified saving. No site-wide totals of money or time saved.
- Pressing Share my tip raises a bar reminding people to remove personal data before anything is sent. It blocks the send when the database would refuse it.
- [Square bracket] placeholders in words to copy are highlighted. The home page has "3 rules for staying safe".
- Guides start as drafts titled "DRAFT, NOT TESTED: ...", visible to admins only. A guide can't be published with that prefix. "Turn into a guide" on a tip pre-fills a draft and links the tip.
- Spaces: /money, /home, /complaints, /letters, /work, /health-admin (no diagnosis or treatment advice), /family, /getting-started, /staying-safe. The HE spaces are archived, not deleted.
- Moderation: a new member's stories are held until 3 are approved, then go live straight away. Stories in /money, /health-admin and /complaints are always held. No .ac.uk rule or badge. Report on every post and reply; Take down in the moderation queue.
- Personal data: emails, UK phone numbers, postcodes (real postcode areas only), National Insurance numbers, sort codes, 8-digit account numbers and card numbers are blocked on stories, replies, ratings and private library drafts, in the browser and in the database. On recipes they only warn (official addresses). Saved copies of recipes are checked on the member's notes only.
- Every recipe, and the footer, says: "This is general information, not legal, financial or medical advice."
- Interface (rebuilt 20 Nov 2026 for ordinary users): a top bar with three links, Find help, Share a tip and Saved, plus the bell, Admin (for moderators) and the account. Home asks "What do you need help with?" with a search box and 9 topic tiles with plain names (TOPICS in app.js). Guide pages are numbered steps with a Copy button for each set of words. No sidebar, hashtags, sort tabs, filters, likes, reputation, ranks, news page or back/forward buttons.
- Home has two equal buttons, "Share how AI helped you" and "Browse all guides". Clicks are logged through `log_entry('share' | 'browse')` with no identifiers.
- Saved (the library) is private: saved guides and tips, and the member's own prompts, downloadable as Markdown.
- No news page. Ahmad dropped it on 20 Nov 2026: it didn't fit. The migration switches every feed off; the tables stay.
- Posts are CC BY 4.0. Users must be 18 or over.
- Never invent users, posts, counts or activity. Example posts must be labelled "Example". Seed recipes are marked "DRAFT, NOT TESTED".
- Look (approved 20 Nov 2026): light and calm, one reading column, Atkinson Hyperlegible for text and Newsreader for headings, deep green accent, 48px minimum touch targets. Tokens are at the top of src/shell.html. Text size has Standard and Larger, higher contrast.

## Writing style for any UI text or docs

British English. No em dashes, anywhere. Plain words, short sentences, answer first. No filler, no hype, no colon reveals.

## Open items

Test and publish the seed guides. Online Safety Act risk assessment summary (TODO marked in the Terms page). Name and domain; SMTP (Resend) for confirmation emails; Supabase Pro; deploy; owner joins first; second admin and moderators; founding members.
