create table public.xrefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  a_page uuid not null references public.pages(id) on delete cascade,
  a_ref text not null,
  a_quote text not null default '',
  b_page uuid not null references public.pages(id) on delete cascade,
  b_ref text not null,
  b_quote text not null default '',
  created_at timestamptz not null default now()
);
create index xrefs_a_ref_idx on public.xrefs(a_ref);
create index xrefs_b_ref_idx on public.xrefs(b_ref);
create index xrefs_a_page_idx on public.xrefs(a_page);
create index xrefs_b_page_idx on public.xrefs(b_page);
create index xrefs_user_idx on public.xrefs(user_id);
alter table public.xrefs enable row level security;
create policy "own xrefs" on public.xrefs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and
    exists (select 1 from public.pages p where p.id = a_page and p.user_id = (select auth.uid())) and
    exists (select 1 from public.pages p where p.id = b_page and p.user_id = (select auth.uid())));
