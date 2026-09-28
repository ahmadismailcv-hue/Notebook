-- Applied to the Supabase project "blobby" (rrphbfegwaggyjesikpm).
create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled notebook',
  color text not null default '#e8e2d6',
  cover_url text,
  position double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  title text not null default 'Untitled module',
  cover_url text,
  position double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null default '',
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  preview_text text not null default '',
  cover_url text,
  position double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  body text not null default '',
  quote text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index modules_notebook_idx on public.modules(notebook_id, position);
create index pages_module_idx on public.pages(module_id, position);
create index comments_page_idx on public.comments(page_id);
create index notebooks_user_idx on public.notebooks(user_id, position);

alter table public.notebooks enable row level security;
alter table public.modules enable row level security;
alter table public.pages enable row level security;
alter table public.comments enable row level security;

create policy "own notebooks" on public.notebooks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own modules" on public.modules for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.notebooks n where n.id = notebook_id and n.user_id = (select auth.uid())));

create policy "own pages" on public.pages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.modules m where m.id = module_id and m.user_id = (select auth.uid())));

create policy "own comments" on public.comments for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.pages p where p.id = page_id and p.user_id = (select auth.uid())));

-- Images: public-read bucket with unguessable per-user paths; only the owner can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif']);

create policy "upload own images" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own images" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);
