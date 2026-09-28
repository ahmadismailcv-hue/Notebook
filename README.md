# Notebook

A personal notebook app in the style of Notion: **Notebooks → Modules → Pages**, with cloud storage. It is built to be installed on an iPhone home screen.

- A sidebar tree (a slide-out drawer on phone), with gallery views for notebooks, modules and pages
- Pages with emoji icons, cover banners and a block editor:
  - type `/` for headings, to-dos, lists, quotes, callouts, code, dividers and images
  - select text for a formatting toolbar: turn into, bold/italic/underline/strike, code, link, coloured highlights
  - drag handles to move blocks; `+` adds a block
- On phone, a keyboard toolbar replaces the floating selection toolbar

- **Frontend:** React + TypeScript (Vite) with the TipTap editor
- **Backend:** Supabase (Postgres + Auth + Storage), with row-level security so every row is visible only to its owner
- **Hosting:** GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push

## Run locally

```bash
npm install
npm run dev
```

The Supabase URL and publishable key are in `src/lib/supabase.ts`. You can override them with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is designed to be public; access control comes from the RLS policies in `supabase/migrations/`.

## Install on iPhone

Open the site in **Safari**, tap Share, then tap **Add to Home Screen**. The app opens full-screen with its own login, which is separate from Safari's.

## How saving works

- Edits save automatically about 0.8 seconds after you stop typing. The top-right indicator shows Saved, Saving, Unsaved or Failed.
- Every unsaved edit is also written to the device immediately. That local copy is deleted only after the server confirms the save. If the app is closed, loses signal or the save fails, the edit is restored and re-sent the next time the page opens.
- If the same page was changed on another device in the meantime, the app asks which version to keep.
- If you edit the same page on two devices at the same time, the last save wins.
