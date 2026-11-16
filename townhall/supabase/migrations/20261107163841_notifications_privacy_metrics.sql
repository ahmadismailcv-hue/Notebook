
-- A. Profile privacy: hide-institution option, and stop exposing prefs/institution columns directly
alter table public.profiles add column if not exists hide_institution boolean not null default false;
revoke select on public.profiles from anon, authenticated;
grant select (id, handle, profession, role, banned, created_at, ac_verified, staff_area) on public.profiles to anon, authenticated;

create or replace function private.public_institution(uid uuid) returns text language sql stable security definer set search_path to '' as $$
  select case when p.hide_institution then '' else p.institution end from public.profiles p where p.id = uid
$$;
grant execute on function private.public_institution(uuid) to anon, authenticated;

create or replace function public.my_profile() returns public.profiles language sql stable security definer set search_path to '' as $$
  select * from public.profiles where id = (select auth.uid())
$$;
revoke execute on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

create or replace view public.member_directory with (security_invoker = true) as
 SELECT id, handle, profession, role, created_at, ac_verified, staff_area,
    private.public_institution(id) AS institution,
    private.reputation(id) AS rep
   FROM profiles WHERE NOT banned;

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
    p.tool_key, p.screenshots, p.knowledge_sources
   FROM posts p LEFT JOIN profiles pr ON pr.id = p.author;

-- B. Notifications
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('reply','try','fork','approved')),
  post_id uuid references public.posts(id) on delete cascade,
  actor uuid references public.profiles(id) on delete set null,
  detail text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_post_idx on public.notifications(post_id);
create index notifications_actor_idx on public.notifications(actor);
alter table public.notifications enable row level security;
create policy "notifications: own read" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: own mark read" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: own delete" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function private.notify(target uuid, k text, pid uuid, who uuid, d text) returns void language sql security definer set search_path to '' as $$
  insert into public.notifications(user_id, kind, post_id, actor, detail)
  select target, k, pid, who, left(coalesce(d, ''), 140)
  where target is not null and target is distinct from who
$$;

create or replace function private.on_reply_notify() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.status = 'published' then
    perform private.notify((select author from public.posts where id = new.post_id), 'reply', new.post_id, new.author, new.body);
  end if;
  return new;
end $$;
create trigger replies_notify after insert on public.replies for each row execute function private.on_reply_notify();

create or replace function private.on_try_notify() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'INSERT' or new.result is distinct from old.result then
    perform private.notify((select author from public.posts where id = new.post_id), 'try', new.post_id, new.user_id, new.result);
  end if;
  return new;
end $$;
create trigger tries_notify after insert or update on public.tries for each row execute function private.on_try_notify();

create or replace function private.on_post_notify() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'published' then
    insert into public.notifications(user_id, kind, post_id, actor, detail) select new.author, 'approved', new.id, null, left(new.title, 140) where new.author is not null;
  end if;
  if new.forked_from is not null and new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform private.notify((select author from public.posts where id = new.forked_from), 'fork', new.forked_from, new.author, new.title);
  end if;
  return new;
end $$;
create trigger posts_notify after insert or update of status on public.posts for each row execute function private.on_post_notify();

-- C. Cookie-free visit counter (no identifiers stored: one number per page type per day)
create table private.page_views (day date not null default current_date, path text not null, views int not null default 0, primary key (day, path));
create or replace function public.track_view(p text) returns void language plpgsql security definer set search_path to '' as $$
declare k text := lower(coalesce(p, ''));
begin
  k := regexp_replace(k, '^#?', '');
  k := case
    when k = '' then 'index'
    when k ~ '^t-' then 'post'
    when k ~ '^lib-' then 'library-item'
    when k ~ '^u-' then 'profile'
    when k ~ '^tag-' then 'tag'
    when k ~ '^/' then 'category'
    when k ~ '^(post|fork)-' then 'post-form'
    else left(regexp_replace(k, '[^a-z0-9-]', '', 'g'), 30) end;
  insert into private.page_views(day, path, views) values (current_date, k, 1)
  on conflict (day, path) do update set views = private.page_views.views + 1;
end $$;
grant execute on function public.track_view(text) to anon, authenticated;

-- D. Admin metrics (weekly, last 12 weeks)
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
      (select coalesce(sum(v.views), 0) from private.page_views v where v.day >= wk::date and v.day < (wk + interval '7 days')::date) as views
    from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') wk) w;
  return json_build_object('weeks', r,
    'top_pages', (select json_agg(x) from (select path, sum(views) as views from private.page_views where day > current_date - 28 group by path order by 2 desc limit 10) x));
end $$;
revoke execute on function public.admin_metrics() from public, anon;
grant execute on function public.admin_metrics() to authenticated;

-- E. Housekeeping: drop old notifications and visit rows
select cron.schedule('housekeeping', '23 3 * * 0', $$delete from public.notifications where created_at < now() - interval '120 days'; delete from private.page_views where day < current_date - 400$$);
