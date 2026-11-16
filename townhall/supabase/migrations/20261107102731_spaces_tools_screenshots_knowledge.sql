
-- 1. Spaces replace boards (no posts exist yet)
delete from public.board_mods where board_id <> 'townhall';
delete from public.boards where id <> 'townhall';
insert into public.boards (id, cat, name, descr, sort, is_private) values
 ('marking-feedback','space','marking-feedback','Marking, moderation and feedback to students',10,false),
 ('teaching-prep','space','teaching-prep','Lesson and module materials, slides, activities, reading lists',20,false),
 ('admissions','space','admissions','Applications, offers, enquiries and recruitment',30,false),
 ('exams-timetabling','space','exams-timetabling','Exam boards, timetables, rooms and scheduling',40,false),
 ('student-support','space','student-support','Advice, wellbeing and student-facing help',50,false),
 ('research-admin','space','research-admin','Bids, ethics, literature searches and research reporting',60,false),
 ('meetings-minutes','space','meetings-minutes','Agendas, minutes, actions and summaries',70,false),
 ('writing-comms','space','writing-comms','Emails, web copy, newsletters and reports',80,false),
 ('data-reporting','space','data-reporting','Spreadsheets, dashboards and returns',90,false),
 ('policy-governance','space','policy-governance','AI policy, risk, procurement and governance',100,false),
 ('other','space','other','Anything that does not fit a space yet',110,false);
update public.boards set sort = 0 where id = 'townhall';

-- 2. New post fields
alter table public.posts add column if not exists tool_key text not null default '';
alter table public.posts add column if not exists screenshots text[] not null default '{}';
alter table public.posts add column if not exists knowledge_sources jsonb not null default '[]'::jsonb;
alter table public.posts drop constraint if exists posts_prompt_check;
alter table public.posts add constraint posts_prompt_check check (char_length(prompt) <= 8000);
alter table public.posts add constraint posts_tool_key_check check (tool_key in ('','copilot','copilot-studio','chatgpt-edu','chatgpt','claude','gemini','notebooklm','other'));
alter table public.posts add constraint posts_screenshots_check check (cardinality(screenshots) <= 3);
alter table public.posts add constraint posts_knowledge_check check (jsonb_typeof(knowledge_sources) = 'array' and jsonb_array_length(knowledge_sources) <= 10 and pg_column_size(knowledge_sources) <= 6000);

create or replace function private.knowledge_text(k jsonb) returns text language sql immutable set search_path to '' as $$
  select coalesce(string_agg(coalesce(e->>'kind','')||' '||coalesce(e->>'note',''), ' '), '') from jsonb_array_elements(k) e
$$;
create or replace function private.knowledge_ok(k jsonb) returns boolean language sql immutable set search_path to '' as $$
  select coalesce(bool_and(jsonb_typeof(e) = 'object'
    and (e->>'kind') in ('sharepoint','files','website','dataverse','connector','instructions-only','other')
    and char_length(coalesce(e->>'note','')) <= 300), true) from jsonb_array_elements(k) e
$$;

-- 3. Insert trigger: tool, screenshots, knowledge sources
create or replace function private.posts_before_insert() returns trigger language plpgsql security definer set search_path to '' as $function$
declare uid uuid := (select auth.uid()); alltext text; problem text; recent int; s text;
begin
  if uid is null then return new; end if;
  new.author := uid; new.pinned := false; new.is_sample := false;
  new.created_at := now(); new.updated_at := now(); new.tested_on := current_date;
  new.tags := private.clean_tags(new.tags);
  if exists(select 1 from public.boards where id = new.board_id and is_private) and not private.is_admin() then
    raise exception 'That space is private.'; end if;
  if new.type = 'MEETING' and not private.is_admin() then raise exception 'Only admins can open a town meeting.'; end if;
  if new.type in ('MOTION','MEETING') then new.board_id := 'townhall';
  elsif new.board_id = 'townhall' then raise exception 'The Town Hall is for motions and meetings.'; end if;
  if new.type in ('WORKFLOW','TOOL','AGENT','FAIL') then
    if btrim(new.task) = '' or new.tool_key = '' or new.minutes_before is null or new.minutes_after is null or btrim(new.what_wrong) = '' then
      raise exception 'Build posts need the task, tool, time before, time after and what went wrong.'; end if;
    if new.data_class = '' then raise exception 'Say what kind of data went into the tool.'; end if;
  end if;
  if new.type = 'AGENT' and jsonb_array_length(new.knowledge_sources) = 0 then
    raise exception 'Agent posts need at least one knowledge source (or "Instructions only").'; end if;
  if not private.knowledge_ok(new.knowledge_sources) then raise exception 'One of the knowledge sources is not valid.'; end if;
  foreach s in array new.screenshots loop
    if s !~ ('^' || uid::text || '/[A-Za-z0-9_-]{6,40}\.(webp|png|jpg)$') then raise exception 'Screenshot upload not recognised. Try adding it again.'; end if;
  end loop;
  if new.forked_from is not null and not exists(select 1 from public.posts where id = new.forked_from and status = 'published') then
    new.forked_from := null; end if;
  alltext := concat_ws(' ', new.title, new.body, new.prompt, new.task, new.tool, new.what_wrong, private.knowledge_text(new.knowledge_sources));
  problem := private.pii_problem(alltext);
  if problem is not null then raise exception '%', problem; end if;
  if private.reputation(uid) < 5 and alltext ~* '(https?://|www\.)' then
    raise exception 'Links unlock at 5 reputation. Describe the source in words for now.'; end if;
  select count(*) into recent from public.posts where author = uid and created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'Posting limit reached (5 an hour). Try again later.'; end if;
  if private.is_admin() or exists(select 1 from public.posts where author = uid and status = 'published') then
    new.status := 'published'; else new.status := 'pending'; end if;
  return new;
end $function$;

create or replace function private.posts_before_update() returns trigger language plpgsql security definer set search_path to '' as $function$
declare uid uuid := (select auth.uid()); problem text; alltext text; s text;
begin
  if uid is null then new.updated_at := now(); return new; end if;
  new.id := old.id; new.author := old.author; new.created_at := old.created_at;
  new.is_sample := old.is_sample; new.forked_from := old.forked_from; new.type := old.type;
  new.updated_at := now();
  if new.tested_on > current_date then new.tested_on := current_date; end if;
  if not private.is_board_mod(old.board_id) then
    new.status := old.status; new.pinned := old.pinned; new.board_id := old.board_id;
  elsif new.board_id <> old.board_id and not private.is_board_mod(new.board_id) then
    new.board_id := old.board_id;
  end if;
  if new.pinned and not private.is_admin() and not old.pinned then new.pinned := false; end if;
  new.tags := private.clean_tags(new.tags);
  if not private.knowledge_ok(new.knowledge_sources) then new.knowledge_sources := old.knowledge_sources; end if;
  foreach s in array new.screenshots loop
    if not (s = any(old.screenshots)) and (old.author is null or s !~ ('^' || old.author::text || '/[A-Za-z0-9_-]{6,40}\.(webp|png|jpg)$')) then
      new.screenshots := old.screenshots; exit; end if;
  end loop;
  alltext := concat_ws(' ', new.title, new.body, new.prompt, new.task, new.tool, new.what_wrong, private.knowledge_text(new.knowledge_sources));
  if alltext is distinct from concat_ws(' ', old.title, old.body, old.prompt, old.task, old.tool, old.what_wrong, private.knowledge_text(old.knowledge_sources)) then
    problem := private.pii_problem(alltext);
    if problem is not null then raise exception '%', problem; end if;
    if private.reputation(old.author) < 5 and alltext ~* '(https?://|www\.)' then
      raise exception 'Links unlock at 5 reputation. Remove the link for now.'; end if;
  end if;
  return new;
end $function$;

-- 4. Feed view gets the new columns (appended)
create or replace view public.post_feed with (security_invoker = true) as
 SELECT p.id, p.author, p.board_id, p.type, p.title, p.body, p.prompt, p.task, p.tool, p.model_version,
    p.minutes_before, p.minutes_after, p.what_wrong, p.tags, p.forked_from, p.status, p.pinned, p.is_sample,
    p.tested_on, p.created_at, p.updated_at, p.data_class,
    pr.handle AS author_handle, pr.profession AS author_profession, pr.ac_verified AS author_ac,
    pr.staff_area AS author_area, pr.institution AS author_institution,
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

-- 5. Screenshot storage: public read by URL, members upload only into their own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shots','shots', true, 1500000, array['image/webp','image/png','image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 1500000, allowed_mime_types = array['image/webp','image/png','image/jpeg'];

create policy "shots: members upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'shots' and (storage.foldername(name))[1] = (select auth.uid())::text
              and not exists (select 1 from public.profiles where id = (select auth.uid()) and banned));
create policy "shots: owners delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'shots' and (storage.foldername(name))[1] = (select auth.uid())::text);
