
-- ===== tables =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  profession text not null default '' check (char_length(profession) <= 60),
  role text not null default 'member' check (role in ('member','admin')),
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.boards (
  id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  cat text not null,
  name text not null,
  descr text not null default '',
  sort int not null default 0,
  is_private boolean not null default false
);

create table public.board_mods (
  board_id text not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (board_id, user_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author uuid references public.profiles(id) on delete set null default auth.uid(),
  board_id text not null references public.boards(id),
  type text not null check (type in ('WORKFLOW','FAIL','TOOL','QUESTION','MOTION','MEETING')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null default '' check (char_length(body) <= 8000),
  prompt text not null default '' check (char_length(prompt) <= 4000),
  task text not null default '' check (char_length(task) <= 300),
  tool text not null default '' check (char_length(tool) <= 200),
  model_version text not null default '' check (char_length(model_version) <= 80),
  minutes_before int check (minutes_before between 0 and 100000),
  minutes_after int check (minutes_after between 0 and 100000),
  what_wrong text not null default '' check (char_length(what_wrong) <= 400),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  forked_from uuid references public.posts(id) on delete set null,
  status text not null default 'pending' check (status in ('published','pending','removed')),
  pinned boolean not null default false,
  is_sample boolean not null default false,
  tested_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_board_idx on public.posts(board_id);
create index posts_author_idx on public.posts(author);
create index posts_created_idx on public.posts(created_at desc);
create index posts_fork_idx on public.posts(forked_from);
create index posts_tags_gin on public.posts using gin(tags);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author uuid references public.profiles(id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 2 and 4000),
  status text not null default 'published' check (status in ('published','removed')),
  created_at timestamptz not null default now()
);
create index replies_post_idx on public.replies(post_id);
create index replies_author_idx on public.replies(author);

create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index likes_user_idx on public.likes(user_id);

create table public.tries (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  result text not null check (result in ('worked','partly','failed')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index tries_user_idx on public.tries(user_id);

create table public.motion_votes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index motion_votes_user_idx on public.motion_votes(user_id);

create table public.follows (
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('tag','board')),
  target text not null check (target ~ '^[a-z0-9-]{1,30}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, target)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references public.profiles(id) on delete set null default auth.uid(),
  post_id uuid references public.posts(id) on delete cascade,
  reply_id uuid references public.replies(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 300),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((post_id is not null) <> (reply_id is not null))
);
create index reports_post_idx on public.reports(post_id);
create index reports_reply_idx on public.reports(reply_id);
create index reports_reporter_idx on public.reports(reporter);
create index reports_handler_idx on public.reports(handled_by);
create index board_mods_user_idx on public.board_mods(user_id);

-- ===== helper functions =====
create function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and not banned)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = (select auth.uid()) and p.role = 'admin' and not p.banned
      and u.email_confirmed_at is not null)
$$;

create function public.is_board_mod(b text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists(
    select 1 from public.board_mods m join public.profiles p on p.id = m.user_id
    where m.board_id = b and m.user_id = (select auth.uid()) and not p.banned)
$$;

create function public.post_board(pid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select board_id from public.posts where id = pid
$$;

create function public.reputation(uid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select
    coalesce((select count(*)::int from public.posts where author = uid and status = 'published' and not is_sample), 0)
  + coalesce((select sum(case t.result when 'worked' then 3 when 'partly' then 1 else 0 end)::int
              from public.tries t join public.posts p on p.id = t.post_id
              where p.author = uid and t.user_id <> uid and p.status = 'published'), 0)
$$;

create function public.pii_problem(txt text) returns text
language sql immutable set search_path = '' as $$
  select case
    when txt ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then 'Remove email addresses before posting.'
    when txt ~ '(\+44\s?7\d{3}|\m07\d{3})\s?\d{3}\s?\d{3}' then 'Remove phone numbers before posting.'
    when txt ~* '\m[a-z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[a-d]\M' then 'Remove National Insurance numbers before posting.'
    else null end
$$;

-- ===== new user -> profile =====
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text; h text;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'handle', ''), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := 'member' || base; end if;
  base := left(base, 15);
  h := base;
  while exists(select 1 from public.profiles where handle = h) loop
    h := base || (floor(random() * 90000) + 10000)::int::text;
  end loop;
  insert into public.profiles(id, handle, profession, role)
  values (new.id, h,
          left(coalesce(new.raw_user_meta_data->>'profession', ''), 60),
          case when lower(new.email) = 'ahmadismailcv@gmail.com' then 'admin' else 'member' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  new.id := old.id; new.created_at := old.created_at;
  if not public.is_admin() then new.role := old.role; new.banned := old.banned; end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- ===== posts =====
create function public.clean_tags(t text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array(select distinct lower(btrim(x, '# ')) from unnest(t) x
                        where lower(btrim(x, '# ')) ~ '^[a-z0-9-]{1,30}$' limit 8), '{}')
$$;

create function public.posts_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); alltext text; problem text; recent int;
begin
  if uid is null then return new; end if;
  new.author := uid; new.pinned := false; new.is_sample := false;
  new.created_at := now(); new.updated_at := now(); new.tested_on := current_date;
  new.tags := public.clean_tags(new.tags);
  if cardinality(new.tags) = 0 then raise exception 'Add at least one hashtag.'; end if;
  if exists(select 1 from public.boards where id = new.board_id and is_private) and not public.is_admin() then
    raise exception 'That board is private.'; end if;
  if new.type = 'MEETING' and not public.is_admin() then raise exception 'Only admins can open a town meeting.'; end if;
  if new.type in ('MOTION','MEETING') then new.board_id := 'townhall';
  elsif new.board_id = 'townhall' then raise exception 'The Town Hall board is for motions and meetings.'; end if;
  if new.type in ('WORKFLOW','TOOL','FAIL') and (btrim(new.task) = '' or btrim(new.tool) = ''
     or new.minutes_before is null or new.minutes_after is null or btrim(new.what_wrong) = '') then
    raise exception 'Build posts need the task, tool, time before, time after and what went wrong.'; end if;
  if new.forked_from is not null and not exists(select 1 from public.posts where id = new.forked_from and status = 'published') then
    new.forked_from := null; end if;
  alltext := concat_ws(' ', new.title, new.body, new.prompt, new.task, new.tool, new.what_wrong);
  problem := public.pii_problem(alltext);
  if problem is not null then raise exception '%', problem; end if;
  if public.reputation(uid) < 5 and alltext ~* '(https?://|www\.)' then
    raise exception 'Links unlock at 5 reputation. Remove the link for now.'; end if;
  select count(*) into recent from public.posts where author = uid and created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'Posting limit reached (5 an hour). Try again later.'; end if;
  if public.is_admin() or exists(select 1 from public.posts where author = uid and status = 'published') then
    new.status := 'published'; else new.status := 'pending'; end if;
  return new;
end $$;
create trigger posts_before_insert before insert on public.posts
  for each row execute function public.posts_before_insert();

create function public.posts_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); problem text; alltext text;
begin
  if uid is null then new.updated_at := now(); return new; end if;
  new.id := old.id; new.author := old.author; new.created_at := old.created_at;
  new.is_sample := old.is_sample; new.forked_from := old.forked_from; new.type := old.type;
  new.updated_at := now();
  if new.tested_on > current_date then new.tested_on := current_date; end if;
  if not public.is_board_mod(old.board_id) then
    new.status := old.status; new.pinned := old.pinned; new.board_id := old.board_id;
  elsif new.board_id <> old.board_id and not public.is_board_mod(new.board_id) then
    new.board_id := old.board_id;
  end if;
  if new.pinned and not public.is_admin() and not old.pinned then new.pinned := false; end if;
  new.tags := public.clean_tags(new.tags);
  if cardinality(new.tags) = 0 then new.tags := old.tags; end if;
  alltext := concat_ws(' ', new.title, new.body, new.prompt, new.task, new.tool, new.what_wrong);
  if alltext is distinct from concat_ws(' ', old.title, old.body, old.prompt, old.task, old.tool, old.what_wrong) then
    problem := public.pii_problem(alltext);
    if problem is not null then raise exception '%', problem; end if;
    if public.reputation(old.author) < 5 and alltext ~* '(https?://|www\.)' then
      raise exception 'Links unlock at 5 reputation. Remove the link for now.'; end if;
  end if;
  return new;
end $$;
create trigger posts_before_update before update on public.posts
  for each row execute function public.posts_before_update();

-- ===== replies =====
create function public.replies_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); problem text; recent int;
begin
  if uid is null then return new; end if;
  new.author := uid; new.status := 'published'; new.created_at := now();
  if not exists(select 1 from public.posts where id = new.post_id and status = 'published') then
    raise exception 'You can only reply to published posts.'; end if;
  problem := public.pii_problem(new.body);
  if problem is not null then raise exception '%', problem; end if;
  if public.reputation(uid) < 5 and new.body ~* '(https?://|www\.)' then
    raise exception 'Links unlock at 5 reputation. Remove the link for now.'; end if;
  select count(*) into recent from public.replies where author = uid and created_at > now() - interval '1 hour';
  if recent >= 30 then raise exception 'Reply limit reached (30 an hour). Try again later.'; end if;
  return new;
end $$;
create trigger replies_before_insert before insert on public.replies
  for each row execute function public.replies_before_insert();

create function public.replies_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  new.id := old.id; new.post_id := old.post_id; new.author := old.author; new.created_at := old.created_at;
  if not public.is_board_mod(public.post_board(old.post_id)) then new.status := old.status; end if;
  if new.body is distinct from old.body and public.pii_problem(new.body) is not null then
    raise exception '%', public.pii_problem(new.body); end if;
  return new;
end $$;
create trigger replies_before_update before update on public.replies
  for each row execute function public.replies_before_update();

-- ===== tries / votes / reports =====
create function public.tries_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return new; end if;
  new.user_id := uid;
  if tg_op = 'UPDATE' then new.post_id := old.post_id; new.created_at := old.created_at; end if;
  new.updated_at := now();
  if not exists(select 1 from public.posts where id = new.post_id and status = 'published' and type in ('WORKFLOW','TOOL')) then
    raise exception 'You can only record tries on published workflow or tool posts.'; end if;
  if exists(select 1 from public.posts where id = new.post_id and author = uid) then
    raise exception 'You can''t record a try on your own post.'; end if;
  if public.pii_problem(new.note) is not null then raise exception '%', public.pii_problem(new.note); end if;
  return new;
end $$;
create trigger tries_guard before insert or update on public.tries
  for each row execute function public.tries_guard();

create function public.votes_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  new.user_id := (select auth.uid());
  if tg_op = 'UPDATE' then new.post_id := old.post_id; end if;
  if not exists(select 1 from public.posts where id = new.post_id and status = 'published' and type = 'MOTION') then
    raise exception 'Votes are only for motions.'; end if;
  return new;
end $$;
create trigger votes_guard before insert or update on public.motion_votes
  for each row execute function public.votes_guard();

create function public.likes_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  new.user_id := (select auth.uid());
  if not exists(select 1 from public.posts where id = new.post_id and status = 'published') then
    raise exception 'You can only like published posts.'; end if;
  return new;
end $$;
create trigger likes_guard before insert on public.likes
  for each row execute function public.likes_guard();

create function public.follows_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  new.user_id := (select auth.uid());
  if (select count(*) from public.follows where user_id = new.user_id) >= 100 then
    raise exception 'You can follow up to 100 tags and boards.'; end if;
  return new;
end $$;
create trigger follows_guard before insert on public.follows
  for each row execute function public.follows_guard();

create function public.reports_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return new; end if;
  if tg_op = 'INSERT' then
    new.reporter := uid; new.status := 'open'; new.handled_by := null; new.created_at := now();
    if (select count(*) from public.reports where reporter = uid and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'Report limit reached. Try again later.'; end if;
  else
    new.id := old.id; new.reporter := old.reporter; new.post_id := old.post_id; new.reply_id := old.reply_id;
    new.reason := old.reason; new.created_at := old.created_at; new.handled_by := uid;
  end if;
  return new;
end $$;
create trigger reports_guard before insert or update on public.reports
  for each row execute function public.reports_guard();
