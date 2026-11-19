# Pivot plan: Townhall becomes "The Boring Bits"

Approved by Ahmad on 19 Nov 2026. This file is the brief for the build session. Read it with CLAUDE.md before changing anything.

## Product

AI help for everyday life for UK adults using free AI tools (ChatGPT, Copilot, Gemini, Claude), and the people who help them (library volunteers, support workers, family members).

- Name: **The Boring Bits**, held in one `APP_NAME` constant. It may change again.
- Tagline: "AI help for everyday life. Shared by people, tested by us."

## Decisions already made

1. Name: The Boring Bits.
2. Reuse the Supabase project `dlqltqsojkjygzzehvjk` ("aitownhall"). It has no users or posts. Archive the higher education spaces; drop nothing.
3. Remove motions and meetings. Rename ranks plainly (no "Town Clerk", "Citizen" and so on); admins show as "Admin".
4. Personal-data patterns block stories but only warn on recipes (admin-only; they quote official addresses). The always-held spaces (/money, /health-admin, /complaints) apply to stories; admins publish recipes directly.

## Hard constraints

- Keep the look exactly: every colour, token, font, spacing value, icon, layout component, the sidebar and feed layout, slash-style space names, and the readable-font display mode. New UI is built from existing components and tokens only.
- No new frameworks, no refactors beyond what the features need.
- Do not change the live database without Ahmad's explicit go-ahead. Write migrations as files; test against the mock. Read-only SELECTs are fine.
- Never invent users, posts, counts or activity. Seed recipes are marked "DRAFT, NOT TESTED".
- Writing: British English, plain words, short sentences, no em dashes, no hype.
- Keep Ahmad Ismail as named operator and the existing contact email (already in `OPERATOR` in src/app.js). Do not send it to any external service.

## Spaces (replace the HE ones; keep hashtags)

/money, /home, /complaints, /letters, /work, /health-admin (no diagnosis or treatment advice), /family, /getting-started, /staying-safe. Descriptions as in Ahmad's brief.

## Post types

**Story** (anyone): title, space, what I needed to do (`task`), AI tool (`tool_key`), roughly what I typed (`prompt`, optional, behind "see more"), what happened (`body`), what I checked before using the answer (new `checks`, optional), screenshot (optional). Stories keep likes.

**Recipe** (admins only): title, space, task in one sentence (`task`), recommended free tools, prompts with copy buttons, "Never paste this", how to check the answer (links to GOV.UK, Citizens Advice, the relevant ombudsman), known failure points, deadline warning (optional, shown prominently), last tested date (`tested_on`) and tools tested, re-test due date ("May be out of date" badge when passed), linked source stories, printable one-page view.

## Feedback

- Recipes: "Worked for me" and "Didn't work for me" replace likes. "Didn't work" asks for an optional note and the tool used. Reuse the `tries` table (results worked or failed; add `tool_key`). Recipes sort by "Worked for me" by default; cards show both counts.
- "Turn into recipe" admin action on stories: pre-fills a draft recipe and links the story.

## Moderation and safety

- New accounts: posts held until 3 approved, then live straight away. Remove the .ac.uk rule and badge.
- Stories in /money, /health-admin, /complaints always held.
- Personal-data scan before submit and in the database trigger: emails, UK phone numbers, postcodes, National Insurance numbers, sort codes, 8-digit account numbers, card numbers. Update the "dummy data only" wording for the public.
- Report button on every post and comment, into the moderation queue with take-down (reports table exists).
- Notice on every recipe and in the footer: "This is general information, not legal, financial or medical advice."

## Other pages

- My library: keep (save recipes and own prompts).
- HE AI news becomes "AI safety news": titles only, link out; AI scams, consumer warnings, privacy. Check each new feed URL responds before adding it.
- Home: two equal entry points at the top, "Share how AI helped you" and "Browse tested recipes". Log clicks in a new `entry_events` table through a whitelisted function (`share` or `browse`, no identifiers).
- Legal pages: public wording, adults only, a reporting and complaints route, the not-advice notice, and a clearly marked TODO for the Online Safety Act risk assessment summary.
- Remove the CPD export, agent knowledge sources and staff areas.

## Files

- `src/app.js`, `src/shell.html` (copy, footer notice, print styles; no token changes).
- `logo/badge.html` name constant, then re-render `static/badge.png` with `python3 logo/badge.py`.
- `test/mock.js`, `test/run.py`, `test/return.py`, `test/a11y.py`.
- New migration in `supabase/migrations/`; `sql/seed_recipes.sql` (5 drafts); update `CLAUDE.md`, `README.md`, `DEPLOY.md`.

## Database migration (one file, nothing dropped)

- `boards.archived` boolean; archive HE spaces; insert the 9 new spaces; hide archived spaces from reads.
- `posts`: types STORY and RECIPE; status `draft` (admins only can see); new columns `checks`, recipe fields (tools, prompts jsonb, never_paste, how_to_check jsonb, failure_points, deadline_warning, tested_tools, retest_due).
- Only admins create or edit RECIPE posts (trigger and RLS).
- `tries.tool_key`; `recipe_sources` (recipe_id, story_id).
- Rewrite `private.posts_before_insert` approval rules; extend `private.pii_problem`; stop setting ac_verified behaviour in the UI.
- `entry_events` table plus a security-definer logging function.
- News sources: deactivate HE feeds, add safety feeds.

## Seed recipes (status draft, titled "DRAFT, NOT TESTED: ...")

1. Complain to an energy supplier about a wrong bill.
2. Understand a confusing council letter in plain English.
3. Appeal a private parking charge.
4. Check a tenancy agreement for unusual clauses.
5. Prepare questions before a GP appointment.

Check facts against GOV.UK, Citizens Advice and the ombudsmen before writing them (for example the Energy Ombudsman 8-week rule; POPLA or IAS for parking appeals depending on the operator's trade body).

## Done when (run on the mock)

Sign up; post a story with a fake postcode (blocked); post a clean story; as admin, turn it into a recipe; mark "Worked for me"; print a recipe. `npm test` and `npm run a11y` pass with exit code 0. Then report what changed, the migration to run, and anything not done.
