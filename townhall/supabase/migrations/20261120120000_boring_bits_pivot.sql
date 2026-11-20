-- The Boring Bits pivot (approved 19 Nov 2026, see PIVOT_PLAN.md).
-- NOT YET APPLIED TO THE LIVE PROJECT. Apply only with Ahmad's go-ahead.
-- Nothing is dropped: old spaces are archived, old columns and tables stay.
-- Live check on 20 Nov 2026 (read-only): 0 users, 0 posts, 0 tries.
-- Runs as one transaction. If there are any posts of an old type, step 2 stops it with a clear error.

begin;

-- 1. Spaces: archive the higher education ones, add the everyday-life ones
alter table public.boards add column if not exists archived boolean not null default false;
update public.boards set archived = true;
insert into public.boards (id, cat, name, descr, sort, is_private, archived) values
 ('money','space','money','Bills, budgets, benefits, refunds and dealing with banks',10,false,false),
 ('home','space','home','Renting, repairs, moving, utilities and neighbours',20,false,false),
 ('complaints','space','complaints','Complaining to companies and councils, and taking it further',30,false,false),
 ('letters','space','letters','Understanding official letters and writing replies',40,false,false),
 ('work','space','work','Job applications, CVs, workplace letters and rights at work',50,false,false),
 ('health-admin','space','health-admin','Appointments, forms and NHS paperwork. No diagnosis or treatment advice',60,false,false),
 ('family','space','family','School, childcare, caring for someone and family paperwork',70,false,false),
 ('getting-started','space','getting-started','First steps with free AI tools, and good habits',80,false,false),
 ('staying-safe','space','staying-safe','Scams, privacy and what not to paste into AI',90,false,false)
on conflict (id) do update set descr = excluded.descr, sort = excluded.sort, archived = false;

drop policy if exists boards_read on public.boards;
create policy boards_read on public.boards for select using (not archived and (not is_private or private.is_admin()));

-- 2. Posts: Story and Recipe types, draft status, recipe fields
do $$ begin
  if exists (select 1 from public.posts where type not in ('STORY','RECIPE')) then
    raise exception 'There are posts of an old type. Archive or delete them before applying this migration.';
  end if;
end $$;
alter table public.posts drop constraint if exists posts_type_check;
alter table public.posts add constraint posts_type_check check (type in ('STORY','RECIPE'));
alter table public.posts alter column type set default 'STORY';
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add constraint posts_status_check check (status in ('published','pending','removed','draft'));

alter table public.posts
  add column if not exists checks text not null default '' check (char_length(checks) <= 2000),
  add column if not exists tools text[] not null default '{}' check (cardinality(tools) <= 6),
  add column if not exists prompts jsonb not null default '[]'::jsonb,
  add column if not exists never_paste text not null default '' check (char_length(never_paste) <= 2000),
  add column if not exists how_to_check jsonb not null default '[]'::jsonb,
  add column if not exists failure_points text not null default '' check (char_length(failure_points) <= 3000),
  add column if not exists deadline_warning text not null default '' check (char_length(deadline_warning) <= 400),
  add column if not exists tested_tools text[] not null default '{}' check (cardinality(tested_tools) <= 6),
  add column if not exists retest_due date;
alter table public.posts add constraint posts_prompts_check check (jsonb_typeof(prompts) = 'array' and jsonb_array_length(prompts) <= 12 and pg_column_size(prompts) <= 24000);
alter table public.posts add constraint posts_how_to_check_check check (jsonb_typeof(how_to_check) = 'array' and jsonb_array_length(how_to_check) <= 12 and pg_column_size(how_to_check) <= 6000);

alter table public.posts drop constraint if exists posts_tool_key_check;
alter table public.posts add constraint posts_tool_key_check check (tool_key in ('','chatgpt','copilot','gemini','claude','other'));
alter table public.posts add constraint posts_tool_lists_check check (tools <@ array['chatgpt','copilot','gemini','claude','other']::text[] and tested_tools <@ array['chatgpt','copilot','gemini','claude','other']::text[]);

-- prompts: [{"label": "...", "text": "..."}]; how_to_check: [{"label": "...", "url": "https://..."}]
create or replace function private.prompts_ok(k jsonb) returns boolean language sql immutable set search_path to '' as $$
  select coalesce(bool_and(jsonb_typeof(e) = 'object' and char_length(coalesce(e->>'label','')) <= 120
    and char_length(coalesce(e->>'text','')) between 1 and 4000), true) from jsonb_array_elements(k) e
$$;
create or replace function private.checks_ok(k jsonb) returns boolean language sql immutable set search_path to '' as $$
  select coalesce(bool_and(jsonb_typeof(e) = 'object' and char_length(coalesce(e->>'label','')) between 1 and 160
    and coalesce(e->>'url','') ~ '^https://[^\s<>"]+$' and char_length(e->>'url') <= 400), true) from jsonb_array_elements(k) e
$$;
create or replace function private.prompts_text(k jsonb) returns text language sql immutable set search_path to '' as $$
  select coalesce(string_agg(coalesce(e->>'label','') || ' ' || coalesce(e->>'text',''), ' '), '') from jsonb_array_elements(k) e
$$;

-- 3. Personal-data scan (stories, replies, tries and library). Recipes only warn, in the app.
create or replace function private.pii_problem(txt text) returns text language sql immutable set search_path = '' as $$
  select case
    when txt ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then 'Remove email addresses before posting.'
    when txt ~ '(\+44\s?7\d{3}|\m07\d{3})\s?\d{3}\s?\d{3}' or txt ~ '(\+44\s?[123]\d{2,3}|\m0[123]\d{2,3})\s?\d{3}\s?\d{3,4}\M' then 'Remove phone numbers before posting.'
    when txt ~* '\m[a-z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[a-d]\M' then 'Remove National Insurance numbers before posting.'
    -- postcodes: only the real UK postcode areas, so "mp3 4th" is fine but "AB1 2CD" is not
    when txt ~* '\m(ab|al|b|ba|bb|bd|bh|bl|bn|br|bs|bt|ca|cb|cf|ch|cm|co|cr|ct|cv|cw|da|dd|de|dg|dh|dl|dn|dt|dy|e|ec|eh|en|ex|fk|fy|g|gl|gu|gy|ha|hd|hg|hp|hr|hs|hu|hx|ig|im|ip|iv|je|ka|kt|kw|ky|l|la|ld|le|ll|ln|ls|lu|m|me|mk|ml|n|ne|ng|nn|np|nr|nw|ol|ox|pa|pe|ph|pl|po|pr|rg|rh|rm|s|sa|se|sg|sk|sl|sm|sn|so|sp|sr|ss|st|sw|sy|ta|td|tf|tn|tq|tr|ts|tw|ub|w|wa|wc|wd|wf|wn|wr|ws|wv|yo|ze)\d[a-z\d]?\s?\d[a-z]{2}\M' then 'Remove postcodes before posting.'
    when txt ~ '\m\d{2}-\d{2}-\d{2}\M' then 'Remove sort codes before posting.'
    when txt ~ '\m(\d[ -]?){12,18}\d\M' then 'Remove card numbers before posting.'
    when txt ~ '\m\d{8}\M' then 'Remove account numbers before posting.'
    else null end
$$;

-- 4. Insert rules
create or replace function private.posts_before_insert() returns trigger language plpgsql security definer set search_path to '' as $function$
declare uid uuid := (select auth.uid()); alltext text; problem text; recent int; s text; admin boolean;
begin
  if uid is null then return new; end if;
  admin := private.is_admin();
  new.author := uid; new.pinned := false; new.is_sample := false; new.forked_from := null;
  new.created_at := now(); new.updated_at := now();
  new.tags := private.clean_tags(new.tags);
  new.knowledge_sources := '[]'::jsonb; new.data_class := ''; new.minutes_before := null; new.minutes_after := null;
  if not exists (select 1 from public.boards where id = new.board_id and not archived) then
    raise exception 'Choose a space.'; end if;
  if exists (select 1 from public.boards where id = new.board_id and is_private) and not admin then
    raise exception 'That space is private.'; end if;
  if new.type not in ('STORY','RECIPE') then raise exception 'Posts are stories or recipes.'; end if;
  if btrim(new.task) = '' then raise exception 'Say what you needed to do.'; end if;
  foreach s in array new.screenshots loop
    if s !~ ('^' || uid::text || '/[A-Za-z0-9_-]{6,40}\.(webp|png|jpg)$') then raise exception 'Screenshot upload not recognised. Try adding it again.'; end if;
  end loop;
  select count(*) into recent from public.posts where author = uid and created_at > now() - interval '1 hour';
  if recent >= 5 and not admin then raise exception 'Posting limit reached (5 an hour). Try again later.'; end if;

  if new.type = 'RECIPE' then
    if not admin then raise exception 'Only admins can write recipes.'; end if;
    if not private.prompts_ok(new.prompts) then raise exception 'One of the prompts is not valid.'; end if;
    if not private.checks_ok(new.how_to_check) then raise exception 'Links in "How to check the answer" must start with https://.'; end if;
    if new.tested_on > current_date then new.tested_on := current_date; end if;
    if new.status not in ('draft','published') then new.status := 'draft'; end if;
    return new;
  end if;

  -- Story
  new.tested_on := current_date;
  new.tools := '{}'; new.prompts := '[]'::jsonb; new.never_paste := ''; new.how_to_check := '[]'::jsonb;
  new.failure_points := ''; new.deadline_warning := ''; new.tested_tools := '{}'; new.retest_due := null;
  if new.tool_key = '' or btrim(new.body) = '' then raise exception 'Stories need the AI tool and what happened.'; end if;
  alltext := concat_ws(' ', new.title, new.body, new.prompt, new.task, new.tool, new.checks);
  problem := private.pii_problem(alltext);
  if problem is not null then raise exception '%', problem; end if;
  if not admin and private.reputation(uid) < 5 and alltext ~* '(https?://|www\.)' then
    raise exception 'Links unlock at 5 reputation. Describe the source in words for now.'; end if;
  if new.board_id in ('money','health-admin','complaints') then new.status := 'pending';
  elsif admin or (select count(*) from public.posts where author = uid and type = 'STORY' and status = 'published') >= 3 then new.status := 'published';
  else new.status := 'pending'; end if;
  return new;
end $function$;

-- 5. Update rules
create or replace function private.posts_before_update() returns trigger language plpgsql security definer set search_path to '' as $function$
declare uid uuid := (select auth.uid()); problem text; alltext text; s text; admin boolean;
begin
  if uid is null then new.updated_at := now(); return new; end if;
  admin := private.is_admin();
  if old.type = 'RECIPE' and not admin then raise exception 'Only admins can edit recipes.'; end if;
  new.id := old.id; new.author := old.author; new.created_at := old.created_at;
  new.is_sample := old.is_sample; new.forked_from := old.forked_from; new.type := old.type;
  new.knowledge_sources := old.knowledge_sources; new.data_class := old.data_class;
  new.updated_at := now();
  if new.tested_on > current_date then new.tested_on := current_date; end if;
  if not exists (select 1 from public.boards where id = new.board_id and not archived) then new.board_id := old.board_id; end if;
  if not private.is_board_mod(old.board_id) then
    new.status := old.status; new.pinned := old.pinned; new.board_id := old.board_id;
  elsif new.board_id <> old.board_id and not private.is_board_mod(new.board_id) then
    new.board_id := old.board_id;
  end if;
  if new.status = 'draft' and old.status <> 'draft' and not (admin and old.type = 'RECIPE') then new.status := old.status; end if;
  if old.status = 'draft' and new.status <> 'draft' and not admin then new.status := old.status; end if;
  if new.pinned and not admin and not old.pinned then new.pinned := false; end if;
  new.tags := private.clean_tags(new.tags);
  foreach s in array new.screenshots loop
    if not (s = any(old.screenshots)) and (old.author is null or s !~ ('^' || old.author::text || '/[A-Za-z0-9_-]{6,40}\.(webp|png|jpg)$')) then
      new.screenshots := old.screenshots; exit; end if;
  end loop;
  if old.type = 'RECIPE' then
    if not private.prompts_ok(new.prompts) then raise exception 'One of the prompts is not valid.'; end if;
    if not private.checks_ok(new.how_to_check) then raise exception 'Links in "How to check the answer" must start with https://.'; end if;
    return new;
  end if;
  new.tools := old.tools; new.prompts := old.prompts; new.never_paste := old.never_paste; new.how_to_check := old.how_to_check;
  new.failure_points := old.failure_points; new.deadline_warning := old.deadline_warning; new.tested_tools := old.tested_tools; new.retest_due := old.retest_due;
  alltext := concat_ws(' ', new.title, new.body, new.prompt, new.task, new.tool, new.checks);
  if alltext is distinct from concat_ws(' ', old.title, old.body, old.prompt, old.task, old.tool, old.checks) then
    problem := private.pii_problem(alltext);
    if problem is not null then raise exception '%', problem; end if;
    if not admin and private.reputation(old.author) < 5 and alltext ~* '(https?://|www\.)' then
      raise exception 'Links unlock at 5 reputation. Remove the link for now.'; end if;
  end if;
  return new;
end $function$;

-- 6. Row-level security: drafts are for admins; only admins write recipes
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (
  status = 'published' or private.is_admin()
  or (status <> 'draft' and (author = (select auth.uid()) or private.is_board_mod(board_id))));
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated
  with check (author = (select auth.uid()) and private.is_active() and (type <> 'RECIPE' or private.is_admin()));
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using ((author = (select auth.uid()) and private.is_active()) or private.is_board_mod(board_id))
  with check (((author = (select auth.uid()) and private.is_active()) or private.is_board_mod(board_id)) and (type <> 'RECIPE' or private.is_admin()));

-- 7. "Worked for me" and "Didn't work for me" on recipes (reuses tries)
alter table public.tries add column if not exists tool_key text not null default ''
  check (tool_key in ('','chatgpt','copilot','gemini','claude','other'));
alter table public.tries drop constraint if exists tries_result_check;
alter table public.tries add constraint tries_result_check check (result in ('worked','failed'));

create or replace function private.tries_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return new; end if;
  new.user_id := uid;
  if tg_op = 'UPDATE' then new.post_id := old.post_id; new.created_at := old.created_at; end if;
  new.updated_at := now();
  if not exists (select 1 from public.posts where id = new.post_id and status = 'published' and type = 'RECIPE') then
    raise exception 'You can only say whether a published recipe worked for you.'; end if;
  if exists (select 1 from public.posts where id = new.post_id and author = uid) then
    raise exception 'You can''t rate your own recipe.'; end if;
  if private.pii_problem(new.note) is not null then raise exception '%', private.pii_problem(new.note); end if;
  return new;
end $$;

-- likes are for stories
create or replace function private.likes_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  new.user_id := (select auth.uid());
  if not exists (select 1 from public.posts where id = new.post_id and status = 'published' and type = 'STORY') then
    raise exception 'You can only like published stories.'; end if;
  return new;
end $$;

-- 8. Recipes link to the stories they came from
create table if not exists public.recipe_sources (
  recipe_id uuid not null references public.posts(id) on delete cascade,
  story_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, story_id)
);
alter table public.recipe_sources enable row level security;
create policy "recipe sources: anyone reads" on public.recipe_sources for select using (true);
create policy "recipe sources: admins add" on public.recipe_sources for insert to authenticated with check (private.is_admin());
create policy "recipe sources: admins delete" on public.recipe_sources for delete to authenticated using (private.is_admin());
create or replace function private.recipe_sources_guard() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if not exists (select 1 from public.posts where id = new.recipe_id and type = 'RECIPE') then raise exception 'That is not a recipe.'; end if;
  if not exists (select 1 from public.posts where id = new.story_id and type = 'STORY') then raise exception 'That is not a story.'; end if;
  return new;
end $$;
create trigger recipe_sources_guard before insert on public.recipe_sources for each row execute function private.recipe_sources_guard();
grant select on public.recipe_sources to anon, authenticated;
grant insert, delete on public.recipe_sources to authenticated;

-- 9. Library: Story and Recipe types; saved recipes may quote official addresses
alter table public.library_items drop constraint if exists library_items_type_check;
alter table public.library_items add constraint library_items_type_check check (type in ('STORY','RECIPE','WORKFLOW','AGENT','TOOL','FAIL','QUESTION'));
alter table public.library_items alter column type set default 'STORY';
alter table public.library_items drop constraint if exists library_items_tool_key_check;
alter table public.library_items add constraint library_items_tool_key_check check (tool_key in ('','chatgpt','copilot','gemini','claude','other'));

create or replace function private.library_guard() returns trigger language plpgsql security definer set search_path to '' as $$
declare uid uuid := (select auth.uid()); problem text; n int; from_recipe boolean;
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
  new.knowledge_sources := '[]'::jsonb;
  from_recipe := new.kind = 'saved' and exists (select 1 from public.posts where id = new.source_post and type = 'RECIPE');
  problem := private.pii_problem(case when from_recipe then new.notes else concat_ws(' ', new.title, new.body, new.prompt, new.notes) end);
  if problem is not null then raise exception '% Your library is private, but this site still does not store personal details.', problem; end if;
  return new;
end $$;

-- 10. Feed view: new columns appended (existing columns unchanged, so create or replace works)
create or replace view public.post_feed with (security_invoker = true) as
 SELECT p.id, p.author, p.board_id, p.type, p.title, p.body, p.prompt, p.task, p.tool, p.model_version,
    p.minutes_before, p.minutes_after, p.what_wrong, p.tags, p.forked_from, p.status, p.pinned, p.is_sample,
    p.tested_on, p.created_at, p.updated_at, p.data_class,
    pr.handle AS author_handle, pr.profession AS author_profession, pr.ac_verified AS author_ac,
    pr.staff_area AS author_area, private.public_institution(pr.id) AS author_institution,
    ((SELECT count(*) FROM likes l WHERE l.post_id = p.id))::integer AS likes,
    ((SELECT count(*) FROM tries t WHERE t.post_id = p.id AND t.result = 'worked'))::integer AS tries_worked,
    ((SELECT count(*) FROM tries t WHERE t.post_id = p.id AND t.result = 'partly'))::integer AS tries_partly,
    ((SELECT count(*) FROM tries t WHERE t.post_id = p.id AND t.result = 'failed'))::integer AS tries_failed,
    ((SELECT count(*) FROM replies r WHERE r.post_id = p.id AND r.status = 'published'))::integer AS replies,
    ((SELECT count(*) FROM posts f WHERE f.forked_from = p.id AND f.status = 'published'))::integer AS forks,
    ((SELECT COALESCE(sum(v.vote), 0::bigint) FROM motion_votes v WHERE v.post_id = p.id))::integer AS vote_score,
    ((SELECT count(*) FROM motion_votes v WHERE v.post_id = p.id))::integer AS vote_count,
    p.tool_key, p.screenshots, p.knowledge_sources,
    p.checks, p.tools, p.prompts, p.never_paste, p.how_to_check, p.failure_points, p.deadline_warning, p.tested_tools, p.retest_due
   FROM posts p LEFT JOIN profiles pr ON pr.id = p.author;

-- 11. Home entry-point clicks: a kind and a timestamp, nothing that identifies anyone
create table if not exists private.entry_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('share','browse')),
  created_at timestamptz not null default now()
);
create or replace function public.log_entry(k text) returns void language plpgsql security definer set search_path to '' as $$
begin
  if k in ('share','browse') then insert into private.entry_events(kind) values (k); end if;
end $$;
revoke all on function public.log_entry(text) from public;
grant execute on function public.log_entry(text) to anon, authenticated;

create or replace function public.admin_metrics() returns json language plpgsql stable security definer set search_path to '' as $$
declare r json;
begin
  if not private.is_admin() then raise exception 'Admins only.'; end if;
  select json_agg(w order by w.week) into r from (
    select to_char(wk, 'YYYY-MM-DD') as week,
      (select count(*) from public.tries t where t.created_at >= wk and t.created_at < wk + interval '7 days') as tries,
      (select count(*) from public.posts p where p.status = 'published' and not p.is_sample and p.created_at >= wk and p.created_at < wk + interval '7 days') as posts,
      (select count(*) from public.replies x where x.status = 'published' and x.created_at >= wk and x.created_at < wk + interval '7 days') as replies,
      (select count(*) from public.profiles m where m.created_at >= wk and m.created_at < wk + interval '7 days') as members,
      (select coalesce(sum(v.views), 0) from private.page_views v where v.day >= wk::date and v.day < (wk + interval '7 days')::date) as views,
      (select count(*) from private.entry_events e where e.kind = 'share' and e.created_at >= wk and e.created_at < wk + interval '7 days') as share_clicks,
      (select count(*) from private.entry_events e where e.kind = 'browse' and e.created_at >= wk and e.created_at < wk + interval '7 days') as browse_clicks
    from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') wk) w;
  return json_build_object('weeks', r,
    'top_pages', (select json_agg(x) from (select path, sum(views) as views from private.page_views where day > current_date - 28 group by path order by 2 desc limit 10) x));
end $$;
revoke execute on function public.admin_metrics() from public, anon;
grant execute on function public.admin_metrics() to authenticated;

-- 12. AI safety news: switch off the higher education feeds, add GOV.UK safety searches
-- Each new URL returned HTTP 200 with entries when checked on 20 Nov 2026.
update private.news_sources set active = false;
alter table private.news_sources drop constraint if exists news_sources_filter_check;
alter table private.news_sources add constraint news_sources_filter_check check (filter in ('none','ai','ai_he','safety'));
insert into private.news_sources (id, name, feed_url, filter) values
 ('govuk-scam','GOV.UK','https://www.gov.uk/search/news-and-communications.atom?keywords=scam','safety'),
 ('govuk-phishing','GOV.UK','https://www.gov.uk/search/news-and-communications.atom?keywords=phishing','safety'),
 ('govuk-deepfake','GOV.UK','https://www.gov.uk/search/news-and-communications.atom?keywords=deepfake','safety')
on conflict (id) do update set feed_url = excluded.feed_url, filter = excluded.filter, active = true;

create or replace function private.news_is_safety(t text) returns boolean language sql immutable set search_path to '' as $$
  select t ~* '(scam|phishing|deepfake|impersonat|identity theft|data breach|cyber ?attack|be alert|warn)'
      or (private.news_is_ai(t) and t ~* '(fraud|privacy|safety|criminal|misuse|harm|personal data)')
$$;
create or replace function private.news_keep(f text, t text) returns boolean language sql immutable set search_path to '' as $$
  select case f when 'none' then true when 'ai' then private.news_is_ai(t)
    when 'ai_he' then private.news_is_ai(t) and private.news_is_he(t)
    when 'safety' then private.news_is_safety(t) else false end
$$;

create or replace function private.news_collect() returns void language plpgsql security definer set search_path to '' as $$
declare q record; s record; doc xml; it xml; ttl text; lnk text; pub text; ts timestamptz; n int; body text;
  ns text[] := array[array['a','http://www.w3.org/2005/Atom']];
begin
  for q in select r.request_id, r.source_id, h.status_code, h.content, h.error_msg
           from private.news_requests r join net._http_response h on h.id = r.request_id loop
    select * into s from private.news_sources where id = q.source_id;
    n := 0;
    begin
      if q.status_code is distinct from 200 then
        raise exception 'HTTP %: %', coalesce(q.status_code::text, 'no response'), coalesce(q.error_msg, '');
      end if;
      body := regexp_replace(q.content, '^\s*<\?xml[^>]*\?>', '');
      body := replace(replace(replace(replace(replace(replace(replace(replace(body,
        '&nbsp;','&#160;'),'&rsquo;','&#8217;'),'&lsquo;','&#8216;'),'&ldquo;','&#8220;'),'&rdquo;','&#8221;'),'&ndash;','&#8211;'),'&mdash;','&#8212;'),'&hellip;','&#8230;');
      doc := xmlparse(document body);
      foreach it in array xpath('//item', doc) loop
        ttl := private.news_decode((xpath('/item/title/text()', it))[1]::text);
        lnk := btrim(private.news_decode((xpath('/item/link/text()', it))[1]::text));
        pub := coalesce((xpath('/item/pubDate/text()', it))[1]::text, (xpath('/item/*[local-name()="date"]/text()', it))[1]::text);
        begin ts := pub::timestamptz; exception when others then ts := now(); end;
        if ts is null or ts > now() then ts := now(); end if;
        if ttl is not null and lnk ~ '^https?://' and char_length(ttl) between 3 and 300 and ts > now() - interval '90 days' and private.news_keep(s.filter, ttl) then
          insert into public.news_items(source_id, source, title, url, published_at) values (s.id, s.name, ttl, lnk, ts) on conflict (url) do nothing;
          n := n + 1;
        end if;
      end loop;
      foreach it in array xpath('//a:entry', doc, ns) loop
        ttl := private.news_decode((xpath('/a:entry/a:title/text()', it, ns))[1]::text);
        lnk := replace(coalesce((xpath('/a:entry/a:link[not(@rel) or @rel="alternate"]/@href', it, ns))[1]::text, ''), '&amp;', '&');
        pub := coalesce((xpath('/a:entry/a:published/text()', it, ns))[1]::text, (xpath('/a:entry/a:updated/text()', it, ns))[1]::text);
        begin ts := pub::timestamptz; exception when others then ts := now(); end;
        if ts is null or ts > now() then ts := now(); end if;
        if ttl is not null and lnk ~ '^https?://' and char_length(ttl) between 3 and 300 and ts > now() - interval '90 days' and private.news_keep(s.filter, ttl) then
          insert into public.news_items(source_id, source, title, url, published_at) values (s.id, s.name, ttl, lnk, ts) on conflict (url) do nothing;
          n := n + 1;
        end if;
      end loop;
      update private.news_sources set last_status = 200, last_items = n, last_error = null, last_fetched = now() where id = s.id;
    exception when others then
      update private.news_sources set last_status = q.status_code, last_items = 0, last_error = left(sqlerrm, 300), last_fetched = now() where id = s.id;
    end;
    delete from private.news_requests where request_id = q.request_id;
  end loop;
  delete from public.news_items where published_at < now() - interval '180 days';
end $$;
revoke all on function private.news_collect() from public, anon, authenticated;

-- Show only headlines from active sources. Old higher education headlines stay in the table and expire after 180 days.
create or replace function private.news_source_active(sid text) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from private.news_sources where id = sid and active)
$$;
grant execute on function private.news_source_active(text) to anon, authenticated;
drop policy if exists "news: anyone can read" on public.news_items;
create policy "news: anyone can read" on public.news_items for select to anon, authenticated
  using (private.news_source_active(source_id));

commit;
