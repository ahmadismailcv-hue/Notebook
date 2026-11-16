-- Townhall security self-test. Paste into Supabase > SQL Editor > Run.
-- It creates three fake users, tries things they shouldn't be able to do, then ROLLS BACK.
-- Expected: an error whose message starts "RESULTS:" and contains no "FAIL".
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); c2 uuid := gen_random_uuid();
  out text := ''; p1 uuid; p2 uuid; n int; s text;
begin
  insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, aud, role)
  values (a,'test-admin@test.ac.uk', now(), '{"handle":"t_admin"}','authenticated','authenticated'),
         (b,'b@example.org', now(), '{"handle":"builder_b","profession":"Teacher"}','authenticated','authenticated'),
         (c,'c@test.ac.uk', now(), '{"handle":"builder_b"}','authenticated','authenticated');
  update public.profiles set role = 'admin' where id = a;
  begin insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, aud, role)
    values (c2,'outsider@gmail.com', now(), '{"handle":"outsider"}','authenticated','authenticated');
    out := out || case when (select ac_verified from public.profiles where id=c2) then '[FAIL gmail got ac.uk badge] ' else '[ok any email can join, no badge] ' end;
    exception when others then out := out || '[FAIL non-ac.uk sign-up still blocked: run open_signup.sql] '; end;
  out := out || format('[badge: ac.uk=%s, other email=%s] ', (select ac_verified from public.profiles where id=c), (select ac_verified from public.profiles where id=b));
  out := out || format('[C handle de-duplicated=%s] ', (select handle from public.profiles where id=c) <> 'builder_b');

  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.posts(board_id,type,title,body,task,tool,tool_key,minutes_before,minutes_after,what_wrong,data_class,tags)
    values ('other','WORKFLOW','First build','body','t','tool','claude',120,30,'x','none',array['#Claude','Excel!','bad tag']) returning id, status into p1, s;
  out := out || format('[first post pending=%s] ', s = 'pending');
  begin insert into public.posts(board_id,type,title,body,tags) values ('other','QUESTION','Email me','reach me at joe@example.com',array['x']);
    out := out || '[FAIL email allowed] '; exception when others then out := out || '[ok email blocked] '; end;
  begin insert into public.posts(board_id,type,title,body,tags) values ('other','QUESTION','Link','see https://spam.example',array['x']);
    out := out || '[FAIL link allowed] '; exception when others then out := out || '[ok link blocked] '; end;
  begin insert into public.posts(board_id,type,title,body,tags) values ('townhall','MEETING','Meeting','x',array['x']);
    out := out || '[FAIL meeting allowed] '; exception when others then out := out || '[ok meeting blocked] '; end;
  begin insert into public.posts(board_id,type,title,tags) values ('other','WORKFLOW','No template',array['x']);
    out := out || '[FAIL template skipped] '; exception when others then out := out || '[ok template enforced] '; end;
  begin insert into public.posts(board_id,type,title,task,tool_key,minutes_before,minutes_after,what_wrong,data_class,tags) values ('other','AGENT','Agent no sources','t','copilot-studio',10,5,'x','none',array['x']);
    out := out || '[FAIL agent without knowledge sources] '; exception when others then out := out || '[ok agent needs knowledge sources] '; end;
  begin insert into public.posts(board_id,type,title,tags,screenshots) values ('other','QUESTION','Steal shot',array['x'],array[a::text || '/abcdefgh.webp']);
    out := out || '[FAIL other user screenshot path] '; exception when others then out := out || '[ok screenshot path checked] '; end;
  begin insert into storage.objects(bucket_id,name,owner) values ('shots', a::text || '/zzzzzzzz.webp', b);
    out := out || '[FAIL upload into another folder] '; exception when others then out := out || '[ok upload folder enforced] '; end;
  begin insert into public.posts(board_id,type,title,tags,knowledge_sources) values ('other','QUESTION','KS pii',array['x'],'[{"kind":"files","note":"ask jo@example.com"}]');
    out := out || '[FAIL pii in knowledge sources] '; exception when others then out := out || '[ok knowledge sources checked for pii] '; end;
  update public.profiles set role='admin' where id=b;
  out := out || case when (select role from public.profiles where id=b)='admin' then '[FAIL self-promote] ' else '[ok self-promote blocked] ' end;
  execute 'reset role';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into n from public.posts where id = p1;
  out := out || case when n=0 then '[ok anon cannot see pending] ' else '[FAIL anon sees pending] ' end;
  select count(*) into n from public.member_directory; out := out || format('[anon member list rows=%s] ', n);
  begin insert into public.likes(post_id,user_id) values (p1,b); out := out || '[FAIL anon like] '; exception when others then out := out || '[ok anon cannot write] '; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update public.posts set status='published' where id = p1;
  out := out || case when (select status from public.posts where id=p1)='published' then '[ok admin approved] ' else '[FAIL admin approve] ' end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.posts(board_id,type,title,tags) values ('other','QUESTION','Second',array['claude']) returning id, status into p2, s;
  out := out || case when s='pending' then '[ok non-ac.uk still held until 3 approved] ' else '[FAIL non-ac.uk second post skipped approval] ' end;
  update public.posts set status='removed', pinned=true where id = p1;
  out := out || case when (select status from public.posts where id=p1)='published' and not (select pinned from public.posts where id=p1) then '[ok author cannot moderate] ' else '[FAIL author moderated] ' end;
  begin insert into public.tries(post_id,result) values (p1,'worked'); out := out || '[FAIL self-try] ';
    exception when others then out := out || '[ok self-try blocked] '; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub',c,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.tries(post_id,result,note) values (p1,'worked','did it');
  insert into public.likes(post_id) values (p1);
  insert into public.replies(post_id,body) values (p1,'nice one');
  insert into public.reports(post_id,reason) values (p2,'off topic');
  begin insert into public.likes(post_id,user_id) values (p2,b);
    out := out || case when exists(select 1 from public.likes where post_id=p2 and user_id=b) then '[FAIL spoofed like] ' else '[ok like forced to self] ' end;
    exception when others then out := out || '[ok spoofed like rejected] '; end;
  insert into public.posts(board_id,type,title,body,tags) values ('other','QUESTION','From an ac.uk account','body text',array['x']) returning status into s;
  out := out || case when s='published' then '[ok ac.uk posts publish straight away] ' else '[FAIL ac.uk post held] ' end;
  delete from public.posts where id = p1; get diagnostics n = row_count; out := out || case when n=0 then '[ok cannot delete others] ' else '[FAIL deleted others] ' end;
  update public.posts set title='hacked' where id = p1; get diagnostics n = row_count; out := out || case when n=0 then '[ok cannot edit others] ' else '[FAIL edited others] ' end;
  begin perform public.set_ban('builder_b', true); out := out || '[FAIL member banned someone] '; exception when others then out := out || '[ok ban is admin-only] '; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.reports; out := out || case when n=0 then '[ok reports private] ' else '[FAIL sees others reports] ' end;
  execute 'reset role';

  out := out || format('[B reputation=%s (expect 5)] ', private.reputation(b));
  select row_to_json(f)::text into s from (select likes, tries_worked, replies from public.post_feed where id=p1) f; out := out || '[feed counts '||s||'] ';
  raise exception 'RESULTS: %', out;
end $test$;
