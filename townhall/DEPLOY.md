# The Boring Bits: putting it live

The site is one file (index.html) plus three images, all in `dist/` after `npm run build`. The database is your Supabase project "aitownhall" (London).

## 0. The Boring Bits pivot (applied 21 Nov 2026; steps 1 to 4 done, self-tests passed)
Done on 21 Nov 2026. Kept for the record:
1. Check the database is still empty of posts: `select count(*) from public.posts;` (the migration refuses to run if any old-type posts exist).
2. Supabase > SQL Editor > paste `supabase/migrations/20261120120000_boring_bits_pivot.sql` > Run. It runs as one transaction. (Or apply it through the Supabase CLI or MCP as a migration named `boring_bits_pivot`, so it is recorded in the migration history.)
3. Run `sql/security_tests.sql` and `sql/library_tests.sql`. Each ends with an error starting "RESULTS:". It must contain no "FAIL". Both roll back.
4. Run `sql/seed_recipes.sql` once to add the 5 draft guides. They are visible to admins only (Admin > Draft guides). Test each one, check every fact and link, then edit it: set the tested date, tested tools and re-test date, remove "DRAFT, NOT TESTED: " from the title, and press Publish.
5. The news page is gone. The migration switches every news feed off, so the 6-hourly news jobs fetch nothing.

What the pivot changes in the database: HE spaces archived and 9 new spaces added; post types Story and Recipe; a draft status only admins can see; recipe columns; only admins write or edit recipes; "Worked for me" and "Didn't work for me" reuse the tries table, with the tool used; recipe_sources links recipes to stories; a click log for the two home page buttons (`log_entry`, no identifiers; shown on the Moderation page); a wider personal-data block on stories (postcodes, sort codes, 8-digit account numbers, card numbers, landline numbers); new approval rules (3 approved stories, and /money, /health-admin and /complaints always held); the ac.uk badge is no longer used; all news feeds switched off. Nothing is dropped.

## 1. Host the site (free, about 5 minutes)
Cloudflare Pages: dash.cloudflare.com > Workers & Pages > Create > Pages > Upload assets.
Upload the three files from the `site` folder. You get an address like townhall.pages.dev.
(Netlify Drop at app.netlify.com/drop works the same way: drag the `site` folder in.)

## 2. Tell Supabase where the site lives
Supabase dashboard > project "aitownhall" > Authentication > URL Configuration:
- Site URL: your address, e.g. https://townhall.pages.dev
- Redirect URLs: add the same address followed by /**
Without this, confirmation and password-reset emails point to the wrong place.

## 3. Join as yourself
Open the site, press Join and sign up with ahmadismailcv@gmail.com. That address is made an admin automatically once you confirm the email. Anyone else can join with any email address.

## 4. The security self-test
Supabase dashboard > SQL Editor > New query: paste sql/security_tests.sql and Run. You'll see an error starting "RESULTS:". That's expected; it rolls everything back. It should contain no "FAIL". (sql/seed_samples.sql is obsolete since the pivot. Don't run it.)

## Before opening to the public
- Email: Supabase's built-in email sender only allows a few emails an hour. Connect your own (e.g. Resend) under Authentication > SMTP Settings. This also lets the weekly digest work later.
- Free-plan Supabase projects pause after a week with no traffic. Upgrade to Pro ($25/month) once real people use it.
- Complete Ofcom's illegal-content risk assessment and put its summary in the Terms page (search app.js for "TODO before launch"). Check whether you need to pay the ICO data protection fee.
- Custom domain: register a domain of your choice or similar and attach it in Cloudflare Pages > Custom domains, then update the Supabase URLs in step 2.

## Not built yet
- Weekly email digest (needs the SMTP step above plus a scheduled function).
- RSS feeds (links are in place; the feed function still needs deploying).
- Private boards for organisations (the database supports them; no screens yet).


## History: the higher education version (7 Nov 2026)
The notes below describe the Townhall version. Where they differ from section 0, section 0 wins.

## Spaces, screenshots and knowledge sources (added 7 Nov 2026)
- Already applied to the live database: boards replaced by task spaces (/marking-feedback and so on), new post columns (tool_key, screenshots, knowledge_sources), and a public "shots" storage bucket. Members can only upload into their own folder; files are capped at 1.5 MB and must be WebP, PNG or JPEG.
- Screenshots are public by URL as soon as they are uploaded, including on a first post that is waiting for approval. Moderators should check images as well as text.
- Known gap: uploads have no rate limit yet. A signed-in member could upload many files into their own folder. Watch storage use in the Supabase dashboard; add a quota (Edge Function or scheduled clean-up of files not referenced by any post) before a wide launch.
- Deleting a post does not delete its screenshot files yet. The same clean-up job would cover this.
- sql/seed_samples.sql has been updated for the new spaces. Run it once if you want the sample posts.

## My library (added 7 Nov 2026)
- Already applied to the live database: a library_items table. Only the owner can read, add, change or delete their items; anonymous visitors get nothing.
- Personal-data checks run on library items too (emails, phone numbers, National Insurance numbers are blocked), so "private" does not become a place for real data.
- Each member can hold up to 300 items. Deleting an account deletes its library.
- Run sql/library_tests.sql in the SQL Editor once. Expect an error starting "RESULTS:" with no "FAIL" in it.

## Open sign-up and approval rules (applied to the live database, 7 Nov 2026)
- Anyone can join with any email address. Accounts using a .ac.uk email get the "ac.uk" badge, and it switches off if a member changes to a non-.ac.uk email. Members cannot award themselves the badge.
- Posts from .ac.uk accounts go live straight away, with no approval queue.
- Posts from other accounts wait for a moderator until three have been approved; after that they go live straight away.
- For everyone: the personal-data checks, the 5-posts-an-hour limit and the link block below 5 reputation still apply, and anyone can report a post.
- Verified by a rolled-back test on the live database: all checks passed.

## HE AI news (applied to the live database, 7 Nov 2026)
- Every 6 hours the database fetches public news feeds and keeps headlines that mention AI. The site shows title, source and date; each title opens the publisher's own page. No article text is stored.
- Sources switched on: Jisc National Centre for AI (every item), Wonkhe, HEPI, Inside Higher Ed, The PIE News (AI headlines), The Conversation UK education and GOV.UK Department for Education (AI and higher-education headlines).
- Switched off because they blocked automated requests (403) or the feed address wasn't found (404): Jisc main news, Times Higher Education, EDUCAUSE, Advance HE, FE Week, Office for Students, QAA, University World News.
- To see source health: select id, active, last_status, last_items, last_error from private.news_sources;
- To add a source: insert into private.news_sources (id, name, feed_url, filter) values ('id','Name','https://.../feed/','ai');  filter is 'none' (keep all), 'ai' or 'ai_he'.
- Headlines older than 180 days are deleted automatically.
- Optional: run sql/move_pg_net.sql to clear the "Extension in Public" warning in the security scan.

## Launch-readiness round (applied to the live database, 7 Nov 2026)
- Notifications: replies, tries and forks on your posts, and approvals, appear under the bell. Created only by the database; members can only read, mark read or delete their own. Kept 120 days.
- Profile privacy: the public can no longer read members' display settings or raw institution; members can hide their institution (Settings). Each member reads their own full profile through my_profile().
- Cookie-free visit counts: one number per page type per day, no identifiers. Weekly figures (tries per week first) show on the Moderation page for admins only.
- Housekeeping job (Sundays 03:23 UTC) deletes notifications older than 120 days and visit counts older than about 13 months.
- Expected security-scan warnings, all intentional and each checking permissions inside: delete_my_account, set_ban, set_board_mod, my_profile, admin_metrics, track_view. "Extension in Public" clears if you run sql/move_pg_net.sql.
- Operator details are filled in: Ahmad Ismail, ahmadismailcv@gmail.com. To change them, search index.html for const OPERATOR. The terms, privacy notice, About page and accessibility statement all use it.
- Accessibility: test/a11y.py runs axe-core on 25 pages in desktop, phone, large-text and logged-out modes. Last run: no violations.
