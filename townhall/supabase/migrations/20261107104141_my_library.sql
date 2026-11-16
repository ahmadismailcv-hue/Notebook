
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('saved','draft')),
  source_post uuid references public.posts(id) on delete set null,
  published_post uuid references public.posts(id) on delete set null,
  type text not null default 'WORKFLOW' check (type in ('WORKFLOW','AGENT','TOOL','FAIL','QUESTION')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 8000),
  prompt text not null default '' check (char_length(prompt) <= 8000),
  notes text not null default '' check (char_length(notes) <= 4000),
  tool_key text not null default '' check (tool_key in ('','copilot','copilot-studio','chatgpt-edu','chatgpt','claude','gemini','notebooklm','other')),
  knowledge_sources jsonb not null default '[]'::jsonb check (jsonb_typeof(knowledge_sources) = 'array' and jsonb_array_length(knowledge_sources) <= 10 and pg_column_size(knowledge_sources) <= 6000),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index library_saved_once on public.library_items(owner, source_post) where kind = 'saved' and source_post is not null;
create index library_owner_idx on public.library_items(owner, updated_at desc);
create index library_source_idx on public.library_items(source_post);
create index library_published_idx on public.library_items(published_post);

alter table public.library_items enable row level security;
create policy "library: owner reads" on public.library_items for select to authenticated using (owner = (select auth.uid()));
create policy "library: owner adds" on public.library_items for insert to authenticated with check (owner = (select auth.uid()));
create policy "library: owner edits" on public.library_items for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "library: owner deletes" on public.library_items for delete to authenticated using (owner = (select auth.uid()));
revoke all on public.library_items from anon;
grant select, insert, update, delete on public.library_items to authenticated;

create or replace function private.library_guard() returns trigger language plpgsql security definer set search_path to '' as $$
declare uid uuid := (select auth.uid()); problem text; n int;
begin
  if uid is null then return new; end if;
  if tg_op = 'INSERT' then
    new.owner := uid; new.created_at := now(); new.snapshot_at := now();
    select count(*) into n from public.library_items where owner = uid;
    if n >= 300 then raise exception 'Your library is full (300 items). Delete some to add more.'; end if;
    if new.kind = 'saved' then
      if new.source_post is null or not exists (select 1 from public.posts where id = new.source_post and status = 'published') then
        raise exception 'You can only save published posts.'; end if;
    else new.source_post := null; end if;
  else
    new.id := old.id; new.owner := old.owner; new.kind := old.kind; new.source_post := old.source_post; new.created_at := old.created_at;
    if new.snapshot_at > now() then new.snapshot_at := now(); end if;
  end if;
  if new.published_post is not null and not exists (select 1 from public.posts where id = new.published_post and author = uid) then
    new.published_post := case when tg_op = 'UPDATE' then old.published_post else null end; end if;
  new.updated_at := now();
  new.tags := private.clean_tags(new.tags);
  if not private.knowledge_ok(new.knowledge_sources) then raise exception 'One of the knowledge sources is not valid.'; end if;
  problem := private.pii_problem(concat_ws(' ', new.title, new.body, new.prompt, new.notes, private.knowledge_text(new.knowledge_sources)));
  if problem is not null then raise exception '% Your library is private, but Townhall still does not store personal data. Use dummy data.', problem; end if;
  return new;
end $$;
create trigger library_guard before insert or update on public.library_items for each row execute function private.library_guard();
