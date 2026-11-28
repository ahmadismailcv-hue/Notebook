# The Boring Bits: putting it live

The site is one file (`index.html`) plus a few images, built into `dist/` by `npm run build`. The database is the Supabase project "aitownhall" (`dlqltqsojkjygzzehvjk`, London).

## Done
- **Database pivot** (21 Nov 2026): `supabase/migrations/20261120120000_boring_bits_pivot.sql` and `20261121120000_example_author.sql` applied. `sql/security_tests.sql` (41 ok) and `sql/library_tests.sql` (10 ok) passed on live.
- **Hosting**: GitHub Pages, https://ahmadismailcv-hue.github.io/Notebook/boring-bits/ . `.github/workflows/deploy.yml` rebuilds it on every push to `claude/notebook-connection-8j2v8w`.
- **Example tips**: 180, all labelled "Example". Remove with `delete from public.posts where is_sample;`.

## 1. Tell Supabase where the site lives
Supabase dashboard > project "aitownhall" > Authentication > URL Configuration:
- Site URL: https://ahmadismailcv-hue.github.io/Notebook/boring-bits/
- Redirect URLs: add the same address followed by `**`
Without this, confirmation and password-reset emails point to the wrong place. If the Notebook app uses the same project, check its login still works afterwards.

## 2. Join as yourself
Open the site, press Create an account and sign up with the operator email in `src/app.js` (`OPERATOR`). That address becomes an admin automatically once you confirm the email. Anyone else can join with any email address.

## 3. Re-run the self-tests after any database change
Supabase > SQL Editor > paste `sql/security_tests.sql` and Run, then the same with `sql/library_tests.sql`. Each ends with an error starting "RESULTS:". That's expected: it rolls everything back. It must contain no "FAIL".

## Before opening to the public
- Email: Supabase's built-in sender only allows a few emails an hour. Connect your own (for example Resend) under Authentication > SMTP Settings.
- Free-plan Supabase projects pause after a week with no traffic. Upgrade to Pro once real people use it.
- Complete Ofcom's illegal-content risk assessment and put its summary in the Terms page (search `src/app.js` for "TODO"). Check whether you need to pay the ICO data protection fee.
- Appoint moderators: open a member's profile while logged in as admin and press Make moderator. There is no button for a second admin yet; that needs a change to their profile row in the database.
- Custom domain (optional): point it at GitHub Pages, then update the Supabase URLs in step 1.

## Known gaps
- No email notifications. Members see comments and approvals under the bell only. Likes don't notify anyone.
- Uploads have no rate limit, and deleting a post doesn't delete its screenshot files. Watch storage use in the Supabase dashboard.
- Screenshots are public by URL as soon as they're uploaded, even on a tip waiting for approval. Moderators should check images as well as text.
- The database still holds the old guide type (RECIPE), its tables and 5 draft guides. Nothing on the site reads them.
- Optional: run `sql/move_pg_net.sql` to clear the "Extension in Public" warning in the security scan.
