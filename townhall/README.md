# The Boring Bits

AI help for everyday life, shared by the people who use it.

A forum where UK adults share how a free AI tool helped them with a boring job: a bill, a letter, a complaint, a form. Tips are sorted by category and by AI tool, and members can like, comment on and save them. (In the database, tips are STORY posts. The old guide type, RECIPE, is no longer shown.) Formerly "Townhall", a forum for university staff.

Product decisions and writing rules are in CLAUDE.md. Read that before changing anything.

## Layout

- `src/shell.html`: page layout, CSS and design tokens.
- `src/app.js`: every view and the hash router. The product name is the `APP_NAME` constant at the top.
- `build.py`: inlines the fonts, supabase-js and app.js into `dist/index.html`, copies `APP_NAME` into the shell, and copies `static/` into `dist/`.
- `supabase/migrations/`: the database history, one file per migration applied to the live project.
- `supabase/schema_snapshot.md`, `advisors.md`, `live_check.md`: read-only reports on the live database.
- `sql/`: scripts the owner runs by hand in the Supabase SQL editor.
- `test/`: Playwright tests against a mock Supabase client (`test/mock.js`). `test/db/` replays the migrations on a local Postgres.
- `logo/`: the logo files (`logo/brand/`) and the badge source (`badge.html`, rendered by `badge.py`).
- `preview/`: builds a self-contained preview that runs on the mock instead of Supabase.

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

The site is static and lives on GitHub Pages at https://ahmadismailcv-hue.github.io/Notebook/boring-bits/. `.github/workflows/deploy.yml` builds it into `dist/boring-bits/` on every push to `claude/notebook-connection-8j2v8w`. To change the badge text, edit `logo/badge.html` and run `python3 logo/badge.py`.

After the first deploy, add the site address to Supabase under Authentication, URL Configuration: set it as the Site URL, and add it followed by `/**` to the Redirect URLs. Otherwise confirmation and password reset emails point to the wrong place. DEPLOY.md has the full checklist.

## Database

The live project is `dlqltqsojkjygzzehvjk` (London). Change it with a new file in `supabase/migrations/`. Every migration in that folder has been applied. Test risky SQL inside a `DO` block that raises at the end, so it rolls back.
