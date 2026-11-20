-- The Boring Bits security self-test. Paste into Supabase > SQL Editor > Run, after the pivot migration.
-- It creates four fake users, tries things they shouldn't be able to do, then ROLLS BACK. Nothing is kept.
-- Expected: an error whose message starts "RESULTS:" and contains no "FAIL".
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); c2 uuid := gen_random_uuid();
  out text := ''; p1 uuid; p2 uuid; r1 uuid; r2 uuid; n int; s text;
begin
  insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, aud, role)
  values (a,'test-admin@example.org', now(), '{"handle":"t_admin"}','authenticated','authenticated'),
         (b,'b@example.org', now(), '{"handle":"sharer_b","profession":"Library volunteer"}','authenticated','authenticated'),
         (c,'c@example.org', now(), '{"handle":"sharer_b"}','authenticated','authenticated');
  update public.profiles set role = 'admin' where id = a;
  begin insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, aud, role)
    values (c2,'outsider@gmail.com', now(), '{"handle":"outsider"}','authenticated','authenticated');
    out := out || '[ok any email can join] '; exception when others then out := out || '[FAIL gmail sign-up blocked] '; end;
  out := out || format('[C handle de-duplicated=%s] ', (select handle from public.profiles where id=c) <> 'sharer_b');

  -- B: a new member
  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.posts(board_id,type,title,task,tool_key,body,checks,tags)
    values ('letters','STORY','First story','Read a council letter','chatgpt','It explained the letter clearly.','Checked the date',array['#Letters','Council Tax!','bad tag']) returning id, status into p1, s;
  out := out || case when s='pending' then '[ok first story held] ' else '[FAIL first story not held] ' end;
  begin insert into public.posts(board_id,type,title,task,tool_key,body) values ('letters','STORY','Email me','x','chatgpt','reach me at joe@example.com');
    out := out || '[FAIL email allowed] '; exception when others then out := out || '[ok email blocked] '; end;
  begin insert into public.posts(board_id,type,title,task,tool_key,body) values ('letters','STORY','Postcode','x','chatgpt','I live at AB1 2CD');
    out := out || '[FAIL postcode allowed] '; exception when others then out := out || '[ok postcode blocked] '; end;
  begin insert into public.posts(board_id,type,title,task,tool_key,body) values ('money','STORY','Sort code','x','chatgpt','sort code 12-34-56');
    out := out || '[FAIL sort code allowed] '; exception when others then out := out || '[ok sort code blocked] '; end;
  begin insert into public.posts(board_id,type,title,task,tool_key,body) values ('money','STORY','Card','x','chatgpt','card 4111 1111 1111 1111');
    out := out || '[FAIL card number allowed] '; exception when others then out := out || '[ok card number blocked] '; end;
  begin insert into public.posts(board_id,type,title,task,tool_key,body) values ('money','STORY','Account','x','chatgpt','account 12345678');
    out := out || '[FAIL account number allowed] '; exception when others then out := out || '[ok account number blocked] '; end;
  begin insert into public.posts(board_id,type,title,task,tool_key,body) values ('letters','STORY','Link','x','chatgpt','see https://spam.example');
    out := out || '[FAIL link allowed] '; exception when others then out := out || '[ok link blocked] '; end;
  begin insert into public.posts(board_id,type,title,task,status) values ('letters','RECIPE','My recipe','x','published');
    out := out || '[FAIL member wrote a recipe] '; exception when others then out := out || '[ok recipes admin-only] '; end;
  begin insert into public.posts(board_id,type,title,body,tags) values ('letters','MOTION','A motion','x',array['x']);
    out := out || '[FAIL old post type allowed] '; exception when others then out := out || '[ok old types blocked] '; end;
  begin insert into public.posts(board_id,type,title,task,body) values ('letters','STORY','No tool','x','body');
    out := out || '[FAIL story without tool] '; exception when others then out := out || '[ok story needs a tool] '; end;
  begin insert into public.posts(board_id,type,title,task,tool_key,body) values ('marking-feedback','STORY','Old space','x','chatgpt','body');
    out := out || '[FAIL archived space allowed] '; exception when others then out := out || '[ok archived spaces closed] '; end;
  begin insert into public.posts(board_id,type,title,task,tool_key,body,screenshots) values ('letters','STORY','Steal shot','x','chatgpt','body',array[a::text || '/abcdefgh.webp']);
    out := out || '[FAIL other user screenshot path] '; exception when others then out := out || '[ok screenshot path checked] '; end;
  begin insert into storage.objects(bucket_id,name,owner) values ('shots', a::text || '/zzzzzzzz.webp', b);
    out := out || '[FAIL upload into another folder] '; exception when others then out := out || '[ok upload folder enforced] '; end;
  update public.profiles set role='admin' where id=b;
  out := out || case when (select role from public.profiles where id=b)='admin' then '[FAIL self-promote] ' else '[ok self-promote blocked] ' end;
  execute 'reset role';

  -- anon
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into n from public.posts where id = p1;
  out := out || case when n=0 then '[ok anon cannot see pending] ' else '[FAIL anon sees pending] ' end;
  select count(*) into n from public.boards; out := out || case when n=9 then '[ok 9 spaces visible] ' else '[FAIL '||n||' spaces visible] ' end;
  begin insert into public.likes(post_id,user_id) values (p1,b); out := out || '[FAIL anon like] '; exception when others then out := out || '[ok anon cannot write] '; end;
  perform public.log_entry('share'); perform public.log_entry('junk');
  execute 'reset role';
  out := out || format('[entry clicks logged=%s (expect 1)] ', (select count(*) from private.entry_events where created_at >= now()));

  -- A: admin approves the story, writes a draft recipe and a published one
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update public.posts set status='published' where id = p1;
  out := out || case when (select status from public.posts where id=p1)='published' then '[ok admin approved] ' else '[FAIL admin approve] ' end;
  insert into public.posts(board_id,type,title,task,status) values ('letters','RECIPE','DRAFT, NOT TESTED: Test recipe','x','draft') returning id into r1;
  insert into public.posts(board_id,type,title,task,status,tools,prompts,how_to_check) values ('letters','RECIPE','Published recipe','Read a letter','published',array['chatgpt'],
    '[{"label":"Reply","text":"Write to PO Box 1, AB1 2CD"}]','[{"label":"GOV.UK","url":"https://www.gov.uk/"}]') returning id, status into r2, s;
  out := out || case when s='published' then '[ok admin recipe with an official postcode publishes] ' else '[FAIL admin recipe] ' end;
  begin insert into public.posts(board_id,type,title,task,how_to_check) values ('letters','RECIPE','Bad link','x','[{"label":"x","url":"http://insecure.example"}]');
    out := out || '[FAIL http link allowed] '; exception when others then out := out || '[ok checks need https] '; end;
  insert into public.recipe_sources(recipe_id, story_id) values (r2, p1);
  out := out || '[ok admin links recipe to story] ';
  begin insert into public.tries(post_id,result) values (r2,'worked'); out := out || '[FAIL admin rated own recipe] ';
    exception when others then out := out || '[ok cannot rate own recipe] '; end;
  execute 'reset role';

  -- B again: an ordinary member
  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.posts where id = r1; out := out || case when n=0 then '[ok drafts hidden from members] ' else '[FAIL member sees draft] ' end;
  insert into public.posts(board_id,type,title,task,tool_key,body) values ('home','STORY','Second','Ask for a repair','copilot','It wrote a short email.') returning id, status into p2, s;
  out := out || case when s='pending' then '[ok held until 3 approved] ' else '[FAIL second story skipped approval] ' end;
  update public.posts set status='removed', pinned=true where id = p1;
  out := out || case when (select status from public.posts where id=p1)='published' and not (select pinned from public.posts where id=p1) then '[ok author cannot moderate] ' else '[FAIL author moderated] ' end;
  update public.posts set title='hacked' where id = r2; get diagnostics n = row_count; out := out || case when n=0 then '[ok members cannot edit recipes] ' else '[FAIL member edited recipe] ' end;
  insert into public.tries(post_id,result,tool_key,note) values (r2,'worked','gemini','clear');
  out := out || '[ok worked for me saved with tool] ';
  begin update public.tries set result='partly' where post_id=r2; out := out || '[FAIL partly allowed] '; exception when others then out := out || '[ok only worked or failed] '; end;
  begin insert into public.tries(post_id,result) values (p1,'worked'); out := out || '[FAIL rating on a story] '; exception when others then out := out || '[ok ratings only on recipes] '; end;
  begin insert into public.likes(post_id) values (r2); out := out || '[FAIL like on a recipe] '; exception when others then out := out || '[ok likes only on stories] '; end;
  begin insert into public.recipe_sources(recipe_id, story_id) values (r2, p2); out := out || '[FAIL member linked a story] '; exception when others then out := out || '[ok story links admin-only] '; end;
  begin insert into public.library_items(kind,source_post,type,title,prompt) values ('saved',r2,'RECIPE','Saved recipe','Write to PO Box 1, AB1 2CD');
    out := out || '[ok saved recipe keeps its official address] '; exception when others then out := out || '[FAIL saving a recipe blocked] '; end;
  execute 'reset role';

  -- C: another member
  perform set_config('request.jwt.claims', json_build_object('sub',c,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.likes(post_id) values (p1);
  insert into public.replies(post_id,body) values (p1,'nice one');
  insert into public.reports(post_id,reason) values (p2,'off topic');
  begin insert into public.replies(post_id,body) values (p1,'ring me on 07700 900123'); out := out || '[FAIL phone in reply] '; exception when others then out := out || '[ok phone blocked in replies] '; end;
  begin insert into public.likes(post_id,user_id) values (p1,b);
    out := out || case when exists(select 1 from public.likes where post_id=p1 and user_id=b) then '[FAIL spoofed like] ' else '[ok like forced to self] ' end;
    exception when others then out := out || '[ok spoofed like rejected] '; end;
  delete from public.posts where id = p1; get diagnostics n = row_count; out := out || case when n=0 then '[ok cannot delete others] ' else '[FAIL deleted others] ' end;
  update public.posts set title='hacked' where id = p1; get diagnostics n = row_count; out := out || case when n=0 then '[ok cannot edit others] ' else '[FAIL edited others] ' end;
  begin perform public.set_ban('sharer_b', true); out := out || '[FAIL member banned someone] '; exception when others then out := out || '[ok ban is admin-only] '; end;
  begin perform public.admin_metrics(); out := out || '[FAIL member read metrics] '; exception when others then out := out || '[ok metrics admin-only] '; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.reports; out := out || case when n=0 then '[ok reports private] ' else '[FAIL sees others reports] ' end;
  execute 'reset role';

  out := out || format('[B reputation=%s (expect 1)] ', private.reputation(b));
  select row_to_json(f)::text into s from (select likes, tries_worked, tries_failed, replies from public.post_feed where id=r2) f; out := out || '[recipe counts '||s||'] ';
  raise exception 'RESULTS: %', out;
end $test$;
