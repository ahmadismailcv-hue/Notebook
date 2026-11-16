# Townhall (working name)

A public forum where UK university and college staff share what they built with AI. Each post records the task, the tool, the time before and after, the data used and what went wrong. Colleagues report whether they tried it and whether it worked.

Product decisions and writing rules are in CLAUDE.md. Read that before changing anything.

## Layout

- `src/shell.html`: page layout, CSS and design tokens.
- `src/app.js`: every view and the hash router.
- `build.py`: inlines the fonts, supabase-js and app.js into `dist/index.html`.
- `supabase/migrations/`: the database history, one file per migration applied to the live project.
- `supabase/schema_snapshot.md`, `advisors.md`, `live_check.md`: read-only reports on the live database.
- `sql/`: scripts the owner runs by hand in the Supabase SQL editor.
- `test/`: Playwright tests against a mock Supabase client (`test/mock.js`).
- `logo/`: one-off image scripts. Not part of the build.

## Set up

Needs Node 18 or later and Python 3.10 or later.

```
npm install
pip install playwright
playwright install chromium
```

## Build

```
npm run build
```

This writes `dist/index.html`. It prints the file size and the number of em dashes in the source, which must be 0.

## Test

```
npm test          # flow tests: expect "ERRORS: []" twice
npm run a11y      # axe-core on every page in 4 display modes: expect "NO VIOLATIONS"
```

Both rebuild first. The scripts always exit with code 0, so read the output.

## Deploy

The site is static. Upload the contents of `dist/` to any static host, for example Cloudflare Pages. It needs `index.html`, `badge.png`, `badge-icon.png` and `favicon.svg`. Only `index.html` is built here. The three images are not in the repo yet.

After the first deploy, add the site address to Supabase under Authentication, URL Configuration: set it as the Site URL, and add it followed by `/**` to the Redirect URLs. Otherwise confirmation and password reset emails point to the wrong place. DEPLOY.md has the full checklist.

## Database

The live project is `dlqltqsojkjygzzehvjk` (London). Change it with a new file in `supabase/migrations/`. Test risky SQL inside a `DO` block that raises at the end, so it rolls back.
