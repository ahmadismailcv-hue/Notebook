# Live check: code against database

Project `dlqltqsojkjygzzehvjk` ("aitownhall"). Checked on 16 Nov 2026 with read-only SELECT queries. No rows were inserted or changed.

## 1. What src/app.js uses

### Tables and views

All exist. Every column in `FEED_COLS` (src/app.js:299) exists in `public.post_feed`.

| Object | Kind | Exists |
|---|---|---|
| boards, board_mods, follows, library_items, likes, motion_votes, news_items, notifications, posts, profiles, replies, reports, tries | table | yes |
| post_feed, member_directory, tag_savings | view | yes |
| shots | storage bucket | yes |

Column grants on `public.profiles`:
- `anon` and `authenticated` can select id, handle, profession, role, banned, created_at, ac_verified and staff_area.
- The app reads only `id,handle` from `profiles` directly (src/app.js:806, and embedded `profiles(handle)` and `profiles(handle,profession)`). The member's own full row comes from `my_profile()`.
- `authenticated` can update every column. `private.profiles_guard` resets role, banned and ac_verified for non-admins.

### RPCs

| RPC | Called by app.js | Exists | Security definer |
|---|---|---|---|
| my_profile | yes | yes | yes |
| admin_metrics | yes | yes | yes |
| track_view | yes | yes | yes |
| delete_my_account | yes | yes | yes |
| set_ban | no | yes | yes |
| set_board_mod | no | yes | yes |

`set_ban` and `set_board_mod` exist but nothing in src/app.js calls them. Banning and appointing moderators can only be done in the SQL editor today.

### Board and space IDs

src/app.js hard-codes only `townhall` (Motions & meetings). Spaces load from `public.boards`. Live rows: townhall, marking-feedback, teaching-prep, admissions, exams-timetabling, student-support, research-admin, meetings-minutes, writing-comms, data-reporting, policy-governance, other. None are private.

The keys in `TOOLS` and `KS` (src/app.js:28-29) match the `posts_tool_key_check` constraint and `private.knowledge_ok`.

### Mismatches

None that break the app.

### Live data

0 profiles, 0 posts, 0 sample posts, 22 news items. The owner has not joined yet, and `sql/seed_samples.sql` has not been run.

## 2. News feed

Cron: `news-request` and `news-collect` ran every 6 hours with no failures in the last 7 days. The last run was at 18:12 UTC. `private.news_requests` is empty, so nothing is stuck.

| Source | Active | Last status | Items published in last 7 days | Items stored |
|---|---|---|---|---|
| jisc-ai | yes | 200 | 2 | 12 |
| ihe | yes | 200 | 3 | 4 |
| wonkhe | yes | 200 | 2 | 3 |
| hepi | yes | 200 | 1 | 1 |
| pie | yes | 200 | 1 | 1 |
| conversation | yes | 200 | 0 | 1 |
| govuk-dfe | yes | 200 | 0 | 0 |
| advancehe, educause, feweek, jisc, the | no | 403 | 0 | 0 |
| ofs, qaa, uwn | no | 404 | 0 | 0 |

All 7 active sources respond. govuk-dfe has never produced an item, because its feed has had no headline that matches the AI and higher education filter. FE Week is switched off (403), so the news page has no further education source.

## 3. Open sign-up rules

Read from `pg_get_functiondef`. Each matches the migration that last defined it.

| Rule | Function | Result |
|---|---|---|
| Any email creates a profile | `private.handle_new_user` (migration 20261107154023) | Yes. No email check. The owner address gets role admin. |
| ac_verified follows a .ac.uk address | `handle_new_user` sets it at sign-up; `private.sync_ac_verified` (trigger `on_auth_email_change`) resets it when the email changes; `profiles_guard` stops members changing it | Yes. Test is `lower(email) like '%.ac.uk'`. |
| Admins, ac.uk members and members with 3 or more approved posts publish straight away; everyone else is pending | `private.posts_before_insert` | Yes. `is_admin()` or `ac_verified` or 3 or more published posts gives published, otherwise pending. |

Notes:
- `private.is_admin()` also requires a confirmed email, so the owner address only gets admin powers after confirmation.
- `ac_verified` is set when the account is created, before the email is confirmed. Immediate publishing for .ac.uk accounts therefore depends on "Confirm email" staying on in Supabase Auth. That setting cannot be read through SQL. Check it in the dashboard under Authentication, Sign In / Providers, Email.
