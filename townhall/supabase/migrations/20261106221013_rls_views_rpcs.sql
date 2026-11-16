
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb
  check (pg_column_size(prefs) < 2000);

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_mods enable row level security;
alter table public.posts enable row level security;
alter table public.replies enable row level security;
alter table public.likes enable row level security;
alter table public.tries enable row level security;
alter table public.motion_votes enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;

create policy profiles_read on public.profiles for select using (true);
create policy profiles_update on public.profiles for update
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

create policy boards_read on public.boards for select using (not is_private or public.is_admin());
create policy board_mods_read on public.board_mods for select using (true);

create policy posts_read on public.posts for select using (
  status = 'published' or author = (select auth.uid()) or public.is_board_mod(board_id));
create policy posts_insert on public.posts for insert to authenticated
  with check (author = (select auth.uid()) and public.is_active());
create policy posts_update on public.posts for update to authenticated
  using ((author = (select auth.uid()) and public.is_active()) or public.is_board_mod(board_id))
  with check ((author = (select auth.uid()) and public.is_active()) or public.is_board_mod(board_id));
create policy posts_delete on public.posts for delete to authenticated
  using (author = (select auth.uid()) or public.is_admin());

create policy replies_read on public.replies for select using (
  status = 'published' or author = (select auth.uid()) or public.is_board_mod(public.post_board(post_id)));
create policy replies_insert on public.replies for insert to authenticated
  with check (author = (select auth.uid()) and public.is_active());
create policy replies_update on public.replies for update to authenticated
  using ((author = (select auth.uid()) and public.is_active()) or public.is_board_mod(public.post_board(post_id)))
  with check ((author = (select auth.uid()) and public.is_active()) or public.is_board_mod(public.post_board(post_id)));
create policy replies_delete on public.replies for delete to authenticated
  using (author = (select auth.uid()) or public.is_admin());

create policy likes_read on public.likes for select using (true);
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active());
create policy likes_delete on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy tries_read on public.tries for select using (true);
create policy tries_insert on public.tries for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active());
create policy tries_update on public.tries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_active());
create policy tries_delete on public.tries for delete to authenticated
  using (user_id = (select auth.uid()));

create policy votes_read on public.motion_votes for select using (true);
create policy votes_insert on public.motion_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active());
create policy votes_update on public.motion_votes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_active());
create policy votes_delete on public.motion_votes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy follows_read on public.follows for select to authenticated using (user_id = (select auth.uid()));
create policy follows_insert on public.follows for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy follows_delete on public.follows for delete to authenticated
  using (user_id = (select auth.uid()));

create policy reports_insert on public.reports for insert to authenticated
  with check (reporter = (select auth.uid()) and public.is_active());
create policy reports_read on public.reports for select to authenticated using (
  reporter = (select auth.uid())
  or (post_id is not null and public.is_board_mod(public.post_board(post_id)))
  or (reply_id is not null and public.is_board_mod(public.post_board((select r.post_id from public.replies r where r.id = reply_id)))));
create policy reports_update on public.reports for update to authenticated using (
  (post_id is not null and public.is_board_mod(public.post_board(post_id)))
  or (reply_id is not null and public.is_board_mod(public.post_board((select r.post_id from public.replies r where r.id = reply_id)))))
  with check (true);

create view public.post_feed with (security_invoker = true) as
select p.*,
  pr.handle as author_handle, pr.profession as author_profession,
  (select count(*) from public.likes l where l.post_id = p.id)::int as likes,
  (select count(*) from public.tries t where t.post_id = p.id and t.result = 'worked')::int as tries_worked,
  (select count(*) from public.tries t where t.post_id = p.id and t.result = 'partly')::int as tries_partly,
  (select count(*) from public.tries t where t.post_id = p.id and t.result = 'failed')::int as tries_failed,
  (select count(*) from public.replies r where r.post_id = p.id and r.status = 'published')::int as replies,
  (select count(*) from public.posts f where f.forked_from = p.id and f.status = 'published')::int as forks,
  (select coalesce(sum(v.vote), 0) from public.motion_votes v where v.post_id = p.id)::int as vote_score,
  (select count(*) from public.motion_votes v where v.post_id = p.id)::int as vote_count
from public.posts p left join public.profiles pr on pr.id = p.author;

create view public.tag_savings with (security_invoker = true) as
select tag,
  count(*)::int as posts,
  round((percentile_cont(0.5) within group (
     order by (p.minutes_before - p.minutes_after)::numeric / p.minutes_before))::numeric * 100)::int as median_saving_pct,
  sum(greatest(p.minutes_before - p.minutes_after, 0))::int as minutes_saved_total
from public.posts p, unnest(p.tags) as tag
where p.status = 'published' and p.type in ('WORKFLOW','TOOL') and p.minutes_before > 0 and p.minutes_after is not null
group by tag;

create view public.member_directory with (security_invoker = true) as
select id, handle, profession, role, created_at, public.reputation(id) as rep
from public.profiles where not banned;

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Not signed in.'; end if;
  delete from auth.users where id = (select auth.uid());
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

create function public.set_ban(target_handle text, ban boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.profiles set banned = ban where handle = target_handle and role <> 'admin';
end $$;
revoke execute on function public.set_ban(text, boolean) from public, anon;
grant execute on function public.set_ban(text, boolean) to authenticated;

create function public.set_board_mod(target_handle text, board text, make boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select id into uid from public.profiles where handle = target_handle;
  if uid is null then raise exception 'No member with that handle.'; end if;
  if make then insert into public.board_mods(board_id, user_id) values (board, uid) on conflict do nothing;
  else delete from public.board_mods where board_id = board and user_id = uid; end if;
end $$;
revoke execute on function public.set_board_mod(text, text, boolean) from public, anon;
grant execute on function public.set_board_mod(text, text, boolean) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.profiles_guard() from public, anon, authenticated;
revoke execute on function public.posts_before_insert() from public, anon, authenticated;
revoke execute on function public.posts_before_update() from public, anon, authenticated;
revoke execute on function public.replies_before_insert() from public, anon, authenticated;
revoke execute on function public.replies_before_update() from public, anon, authenticated;
revoke execute on function public.tries_guard() from public, anon, authenticated;
revoke execute on function public.votes_guard() from public, anon, authenticated;
revoke execute on function public.likes_guard() from public, anon, authenticated;
revoke execute on function public.follows_guard() from public, anon, authenticated;
revoke execute on function public.reports_guard() from public, anon, authenticated;

insert into public.boards(id, cat, name, descr, sort) values
 ('townhall','general','Town Hall','Weekly town meetings and motions. Vote on how this place is run.',0),
 ('showandtell','general','Show & Tell','Finished builds. Structured posts: task, tool, before and after.',1),
 ('fails','general','Fails','Where it went wrong and why. The most useful board here.',2),
 ('questions','general','Questions','Ask before you build.',3),
 ('skills','general','Skills','Checking output, prompting, evaluation, knowing when not to use AI.',4),
 ('hardware','stack','Hardware','GPUs, AI PCs, home servers, Raspberry Pi builds, wearables.',10),
 ('software','stack','Software & apps','Apps built with AI, and AI features inside the apps you already use.',11),
 ('agents','stack','Agents & automation','Scheduled agents, flows, MCP servers, integrations.',12),
 ('education','prof','Education','Teachers, lecturers, learning designers, university staff.',20),
 ('health','prof','Healthcare','Clinical admin, NHS ops, research. No patient data, ever.',21),
 ('legal','prof','Legal','Solicitors, paralegals, compliance.',22),
 ('finance','prof','Finance & accounting','Bookkeeping, analysis, audit, reporting.',23),
 ('marketing','prof','Marketing & comms','Copy, campaigns, social, research.',24),
 ('engineering','prof','Software engineering','Coding assistants, code review, testing, DevOps.',25),
 ('admin','prof','Admin & operations','Office, HR, project management, the paperwork nobody wants.',26),
 ('creative','prof','Creative & design','Design, writing, illustration, video.',27),
 ('trades','prof','Trades & small business','Quotes, invoices, scheduling, customer messages.',28)
on conflict (id) do nothing;
