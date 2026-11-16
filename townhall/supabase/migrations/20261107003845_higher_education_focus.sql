
-- profiles: ac.uk verification, area of work, optional institution
alter table public.profiles
  add column if not exists ac_verified boolean not null default false,
  add column if not exists staff_area text not null default '' check (char_length(staff_area) <= 40),
  add column if not exists institution text not null default '' check (char_length(institution) <= 80);
update public.profiles p set ac_verified = (lower(u.email) like '%.ac.uk') from auth.users u where u.id = p.id;

-- posts: data classification + Copilot agent type
alter table public.posts add column if not exists data_class text not null default ''
  check (data_class in ('', 'none', 'internal', 'personal'));
alter table public.posts drop constraint if exists posts_type_check;
alter table public.posts add constraint posts_type_check
  check (type in ('WORKFLOW','FAIL','TOOL','AGENT','QUESTION','MOTION','MEETING'));

-- sign-up: .ac.uk addresses only (plus the site owner)
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text; h text;
  owner_email boolean := lower(new.email) = 'ahmadismailcv@gmail.com';
  is_ac boolean := lower(new.email) like '%.ac.uk';
begin
  if not is_ac and not owner_email then
    raise exception 'Townhall is for UK university and college staff. Sign up with your .ac.uk email address.';
  end if;
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'handle', ''), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := 'member' || base; end if;
  base := left(base, 15);
  h := base;
  while exists(select 1 from public.profiles where handle = h) loop
    h := base || (floor(random() * 90000) + 10000)::int::text;
  end loop;
  insert into public.profiles(id, handle, profession, role, ac_verified, staff_area, institution)
  values (new.id, h,
          left(coalesce(new.raw_user_meta_data->>'profession', ''), 60),
          case when owner_email then 'admin' else 'member' end,
          is_ac,
          left(coalesce(new.raw_user_meta_data->>'staff_area', ''), 40),
          left(coalesce(new.raw_user_meta_data->>'institution', ''), 80));
  return new;
end $$;

create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  new.id := old.id; new.created_at := old.created_at;
  if not private.is_admin() then
    new.role := old.role; new.banned := old.banned; new.ac_verified := old.ac_verified;
  end if;
  return new;
end $$;

create or replace function private.posts_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); alltext text; problem text; recent int;
begin
  if uid is null then return new; end if;
  new.author := uid; new.pinned := false; new.is_sample := false;
  new.created_at := now(); new.updated_at := now(); new.tested_on := current_date;
  new.tags := private.clean_tags(new.tags);
  if cardinality(new.tags) = 0 then raise exception 'Add at least one hashtag.'; end if;
  if exists(select 1 from public.boards where id = new.board_id and is_private) and not private.is_admin() then
    raise exception 'That board is private.'; end if;
  if new.type = 'MEETING' and not private.is_admin() then raise exception 'Only admins can open a town meeting.'; end if;
  if new.type in ('MOTION','MEETING') then new.board_id := 'townhall';
  elsif new.board_id = 'townhall' then raise exception 'The Town Hall board is for motions and meetings.'; end if;
  if new.type in ('WORKFLOW','TOOL','AGENT','FAIL') then
    if btrim(new.task) = '' or btrim(new.tool) = '' or new.minutes_before is null or new.minutes_after is null or btrim(new.what_wrong) = '' then
      raise exception 'Build posts need the task, tool, time before, time after and what went wrong.'; end if;
    if new.data_class = '' then raise exception 'Say what kind of data went into the tool.'; end if;
  end if;
  if new.forked_from is not null and not exists(select 1 from public.posts where id = new.forked_from and status = 'published') then
    new.forked_from := null; end if;
  alltext := concat_ws(' ', new.title, new.body, new.prompt, new.task, new.tool, new.what_wrong);
  problem := private.pii_problem(alltext);
  if problem is not null then raise exception '%', problem; end if;
  if private.reputation(uid) < 5 and alltext ~* '(https?://|www\.)' then
    raise exception 'Links unlock at 5 reputation. Remove the link for now.'; end if;
  select count(*) into recent from public.posts where author = uid and created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'Posting limit reached (5 an hour). Try again later.'; end if;
  if private.is_admin() or exists(select 1 from public.posts where author = uid and status = 'published') then
    new.status := 'published'; else new.status := 'pending'; end if;
  return new;
end $$;

create or replace function private.tries_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return new; end if;
  new.user_id := uid;
  if tg_op = 'UPDATE' then new.post_id := old.post_id; new.created_at := old.created_at; end if;
  new.updated_at := now();
  if not exists(select 1 from public.posts where id = new.post_id and status = 'published' and type in ('WORKFLOW','TOOL','AGENT')) then
    raise exception 'You can only record tries on published workflow, tool or agent posts.'; end if;
  if exists(select 1 from public.posts where id = new.post_id and author = uid) then
    raise exception 'You can''t record a try on your own post.'; end if;
  if private.pii_problem(new.note) is not null then raise exception '%', private.pii_problem(new.note); end if;
  return new;
end $$;

-- views
drop view if exists public.post_feed;
create view public.post_feed with (security_invoker = true) as
select p.*,
  pr.handle as author_handle, pr.profession as author_profession,
  pr.ac_verified as author_ac, pr.staff_area as author_area, pr.institution as author_institution,
  (select count(*) from public.likes l where l.post_id = p.id)::int as likes,
  (select count(*) from public.tries t where t.post_id = p.id and t.result = 'worked')::int as tries_worked,
  (select count(*) from public.tries t where t.post_id = p.id and t.result = 'partly')::int as tries_partly,
  (select count(*) from public.tries t where t.post_id = p.id and t.result = 'failed')::int as tries_failed,
  (select count(*) from public.replies r where r.post_id = p.id and r.status = 'published')::int as replies,
  (select count(*) from public.posts f where f.forked_from = p.id and f.status = 'published')::int as forks,
  (select coalesce(sum(v.vote), 0) from public.motion_votes v where v.post_id = p.id)::int as vote_score,
  (select count(*) from public.motion_votes v where v.post_id = p.id)::int as vote_count
from public.posts p left join public.profiles pr on pr.id = p.author;

drop view if exists public.tag_savings;
create view public.tag_savings with (security_invoker = true) as
select tag, count(*)::int as posts,
  round((percentile_cont(0.5) within group (order by (p.minutes_before - p.minutes_after)::numeric / p.minutes_before))::numeric * 100)::int as median_saving_pct,
  sum(greatest(p.minutes_before - p.minutes_after, 0))::int as minutes_saved_total
from public.posts p, unnest(p.tags) as tag
where p.status = 'published' and p.type in ('WORKFLOW','TOOL','AGENT') and p.minutes_before > 0 and p.minutes_after is not null
group by tag;

drop view if exists public.member_directory;
create view public.member_directory with (security_invoker = true) as
select id, handle, profession, role, created_at, ac_verified, staff_area, institution, private.reputation(id) as rep
from public.profiles where not banned;

-- boards for higher education
delete from public.boards b where b.cat in ('stack','prof') and not exists (select 1 from public.posts p where p.board_id = b.id);
update public.boards set descr = 'Ask other staff before you build.' where id = 'questions';
update public.boards set descr = 'AI literacy, checking output, and knowing when not to use AI.' where id = 'skills';
insert into public.boards(id, cat, name, descr, sort) values
 ('teaching','work','Teaching & learning','Lesson design, materials, accessibility, teaching with AI.',20),
 ('assessment','work','Assessment & feedback','Marking support, feedback, rubrics, academic integrity.',21),
 ('research','work','Research & research support','Literature, data, bids, ethics, research admin.',22),
 ('student-support','work','Student support & wellbeing','Advising, enquiries, wellbeing, disability services.',23),
 ('admissions','work','Admissions & recruitment','Applications, offers, course information, outreach.',24),
 ('registry','work','Registry, timetabling & exams','Records, timetabling, exam boards, regulations.',25),
 ('library','work','Library & archives','Search, cataloguing, information literacy, archives.',26),
 ('it-digital','work','IT & digital','Service desk, rollout, licensing, integrations.',27),
 ('hr-finance','work','HR, finance & procurement','Recruitment, policies, budgets, contracts.',28),
 ('marketing-comms','work','Marketing & communications','Web, social, internal comms, events.',29),
 ('leadership','work','Leadership & governance','Strategy, committees, papers, minutes.',30),
 ('copilot-agents','tools','Copilot & agents','Microsoft 365 Copilot and Copilot Studio agent setups that worked.',40),
 ('other-tools','tools','Other AI tools','ChatGPT Edu, Claude, Gemini, NotebookLM and the rest.',41),
 ('policy','tools','AI policy & governance','Institutional policies, guidance, approved tools, DPIAs.',42)
on conflict (id) do nothing;
