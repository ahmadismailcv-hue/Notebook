# The Boring Bits

AI help for everyday life. Shared by people, tested by us.

UK adults share how a free AI tool helped them with a boring job: a bill, a letter, a complaint, a form. Admins turn the best stories into step-by-step recipes, test them, and say when they were last tested. Readers say whether a recipe worked for them. Formerly "Townhall"; see PIVOT_PLAN.md.

Product decisions and writing rules are in CLAUDE.md. Read that before changing anything.

## Layout

- `src/shell.html`: page layout, CSS and design tokens.
- `src/app.js`: every view and the hash router. The product name is the `APP_NAME` constant at the top.
- `build.py`: inlines the fonts, supabase-js and app.js into `dist/index.html`, copies `APP_NAME` into the shell, and copies `static/` into `dist/`.
- `supabase/migrations/`: the database history, one file per migration applied to the live project.
- `supabase/schema_snapshot.md`, `advisors.md`, `live_check.md`: read-only reports on the live database.
- `sql/`: scripts the owner runs by hand in the Supabase SQL editor.
- `test/`: Playwright tests against a mock Supabase client (`test/mock.js`). `test/db/` replays the migrations on a local Postgres.
- `logo/`: one-off image scripts. Not part of the build.

## Set up

Needs Node 18 or later and Python 3.10 or later.

```
npm install
pip install playwright==1.63.0
playwright install chromium     # skip if a matching Chromium is already installed
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
PGHOST=<socket dir> PGPORT=<port> bash test/db/replay.sh   # optional: migrations plus rule checks on a local Postgres
```

Both npm scripts rebuild first, and exit 1 on any failure.

## Deploy

The site is static. Upload the contents of `dist/` to any static host, for example Cloudflare Pages. It needs `index.html`, `badge.png`, `badge-icon.png` and `favicon.svg`; the build puts all four in `dist/`. To change the badge text, edit `logo/badge.html` and run `python3 logo/badge.py`.

After the first deploy, add the site address to Supabase under Authentication, URL Configuration: set it as the Site URL, and add it followed by `/**` to the Redirect URLs. Otherwise confirmation and password reset emails point to the wrong place. DEPLOY.md has the full checklist.

## Database

The live project is `dlqltqsojkjygzzehvjk` (London). Change it with a new file in `supabase/migrations/`. The pivot migration `20261120120000_boring_bits_pivot.sql` is written but not yet applied; see DEPLOY.md. Test risky SQL inside a `DO` block that raises at the end, so it rolls back.
