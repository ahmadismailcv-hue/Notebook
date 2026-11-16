
create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path to '' as $function$
declare base text; h text;
  owner_email boolean := lower(new.email) = 'ahmadismailcv@gmail.com';
  is_ac boolean := lower(new.email) like '%.ac.uk';
begin
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
end $function$;

create or replace function private.sync_ac_verified() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set ac_verified = (lower(coalesce(new.email, '')) like '%.ac.uk') where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_email_change on auth.users;
create trigger on_auth_email_change after update of email on auth.users for each row execute function private.sync_ac_verified();

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
  elsif new.board_id = 'townhall' then raise exception 'Motions & meetings is for motions and meetings.'; end if;
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
  if private.is_admin()
     or exists(select 1 from public.profiles where id = uid and ac_verified)
     or (select count(*) from public.posts where author = uid and status = 'published') >= 3 then
    new.status := 'published'; else new.status := 'pending'; end if;
  return new;
end $function$;
