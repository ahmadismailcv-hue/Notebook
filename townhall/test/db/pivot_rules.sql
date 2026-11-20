-- Behaviour checks for the pivot migration. Local stub database only (see replay.sh), never live.
-- Expected BLOCK: fake postcode, archived space, member recipe, member old type, recipe bad link, admin rates own recipe,
--   member links recipe, member partly, member try on story, member like recipe, member draft with postcode.
-- Expected OK: everything else. "member edits recipe" is OK but changes 0 rows (RLS hides it), checked by the "Hacked" query.
-- Expected after: anon sees 9 boards and only published posts; member never sees the draft recipe.
\set ON_ERROR_STOP 0
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','admin@x.test','{"handle":"boss"}'),
 ('00000000-0000-0000-0000-00000000000b','jo@x.test','{"handle":"jo_new"}');
update public.profiles set role='admin' where handle='boss';
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('test.uid', u, false) $$;
create function pg_temp.try(label text, q text) returns void language plpgsql as $$
begin execute q; raise notice 'OK    %', label; exception when others then raise notice 'BLOCK % -> %', label, sqlerrm; end $$;
-- member
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.try('member story with fake postcode', $q$insert into posts(board_id,type,title,task,tool_key,body) values ('letters','STORY','Council letter help','Understand a letter','chatgpt','My postcode is AB1 2CD and it helped')$q$);
select pg_temp.try('member story clean', $q$insert into posts(board_id,type,title,task,tool_key,body) values ('letters','STORY','Council letter help','Understand a letter','chatgpt','It explained the letter in plain words')$q$);
select pg_temp.try('member story archived space', $q$insert into posts(board_id,type,title,task,tool_key,body) values ('marking-feedback','STORY','Old space','x','chatgpt','body')$q$);
select pg_temp.try('member recipe', $q$insert into posts(board_id,type,title,task,status) values ('money','RECIPE','Recipe by member','x','published')$q$);
select pg_temp.try('member old type', $q$insert into posts(board_id,type,title,task,tool_key,body) values ('money','MOTION','A motion','x','chatgpt','b')$q$);
-- admin
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.try('admin story letters', $q$insert into posts(board_id,type,title,task,tool_key,body) values ('letters','STORY','Admin story letters','Reply to council','claude','Worked well')$q$);
select pg_temp.try('admin story money', $q$insert into posts(board_id,type,title,task,tool_key,body) values ('money','STORY','Admin story money','Budget','claude','Worked well')$q$);
select pg_temp.try('admin recipe draft with postcode (warn only)', $q$insert into posts(board_id,type,title,task,status,prompts,how_to_check,tools) values ('complaints','RECIPE','DRAFT, NOT TESTED: Energy bill','Complain about a bill','draft','[{"label":"Draft the complaint","text":"Write to PO Box, AB1 2CD"}]','[{"label":"Energy Ombudsman","url":"https://www.energyombudsman.org/"}]','{chatgpt,copilot}')$q$);
select pg_temp.try('admin recipe bad link', $q$insert into posts(board_id,type,title,task,how_to_check) values ('complaints','RECIPE','Bad link recipe','x','[{"label":"x","url":"http://insecure"}]')$q$);
select pg_temp.try('admin recipe published', $q$insert into posts(board_id,type,title,task,status) values ('letters','RECIPE','Published recipe','Read a letter','published')$q$);
select pg_temp.try('admin links recipe to story', $q$insert into recipe_sources select r.id, s.id from posts r, posts s where r.title='Published recipe' and s.title='Admin story letters'$q$);
select pg_temp.try('admin rates own recipe', $q$insert into tries(post_id,result) select id,'worked' from posts where title='Published recipe'$q$);
reset role; select title, type, status from posts order by created_at;
-- member again
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select 'member sees' as who, title, status from posts order by title;
select pg_temp.try('member links recipe', $q$insert into recipe_sources select r.id, s.id from posts r, posts s where r.title='Published recipe' and s.title='Council letter help'$q$);
select pg_temp.try('member worked for me + tool', $q$insert into tries(post_id,result,tool_key) select id,'worked','gemini' from posts where title='Published recipe'$q$);
select pg_temp.try('member partly (no longer allowed)', $q$update tries set result='partly'$q$);
select pg_temp.try('member try on story', $q$insert into tries(post_id,result) select id,'worked' from posts where title='Admin story letters'$q$);
select pg_temp.try('member like recipe', $q$insert into likes(post_id) select id from posts where title='Published recipe'$q$);
select pg_temp.try('member like story', $q$insert into likes(post_id) select id from posts where title='Admin story letters'$q$);
select pg_temp.try('member edits recipe', $q$update posts set title='Hacked' where title='Published recipe'$q$);
select pg_temp.try('member saves recipe w/ postcode prompt', $q$insert into library_items(kind,source_post,type,title,prompt) select 'saved',id,'RECIPE',title,'Write to AB1 2CD' from posts where title='Published recipe'$q$);
select pg_temp.try('member draft with postcode', $q$insert into library_items(kind,type,title,prompt) values ('draft','STORY','Mine','Send to AB1 2CD')$q$);
select pg_temp.try('member report', $q$insert into reports(post_id,reason) select id,'Looks wrong' from posts where title='Admin story letters'$q$);
reset role; select title from posts where title='Hacked';
-- anon
set role anon; select pg_temp.as_user('');
select 'anon boards' as k, count(*) from boards;
select 'anon sees' as who, title, status from posts order by title;
select pg_temp.try('anon log share', $q$select log_entry('share')$q$);
select pg_temp.try('anon log junk', $q$select log_entry('junk')$q$);
reset role; select kind, count(*) from private.entry_events group by 1;
select v, private.pii_problem(v) from (values ('Call 0121 496 0000'),('Sort code 12-34-56'),('Card 4111 1111 1111 1111'),('Account 12345678'),('On 2026-11-20 I paid £12.50'),('NI QQ 12 34 56 C'),('Letter dated 3 May 2026, ref 1234567'),('mp3 4th'),('07700 900123')) t(v);
