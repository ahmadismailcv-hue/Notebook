-- Townhall "My library" privacy self-test. Paste into Supabase > SQL Editor > Run.
-- It creates two fake users, checks that each can only see and change their own library, then ROLLS BACK.
-- Expected: an error whose message starts "RESULTS:" and contains no "FAIL".
do $test$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); out text := ''; p1 uuid; i1 uuid; i2 uuid; n int;
begin
  insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
   (a,'lib-a@test.ac.uk', now(), '{"handle":"lib_a"}','authenticated','authenticated'),
   (b,'lib-b@test.ac.uk', now(), '{"handle":"lib_b"}','authenticated','authenticated');
  update public.profiles set role='admin' where id=a;
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.posts(board_id,type,title,body,tags) values ('other','QUESTION','Lib test post','body text here',array['x']) returning id into p1;
  insert into public.library_items(kind,title,prompt) values ('draft','My draft','Summarise this dummy text') returning id into i1;
  out := out || '[ok draft saved] ';
  insert into public.library_items(kind,title,source_post) values ('saved','Saved one',p1) returning id into i2;
  out := out || '[ok post saved] ';
  begin insert into public.library_items(kind,title,source_post) values ('saved','Again',p1); out := out || '[FAIL saved twice] '; exception when others then out := out || '[ok no duplicate save] '; end;
  begin insert into public.library_items(kind,title,notes) values ('draft','PII','email jo@example.com'); out := out || '[FAIL pii in private draft] '; exception when others then out := out || '[ok pii blocked in library] '; end;
  begin insert into public.library_items(kind,title,owner) values ('draft','Spoof',b); out := out || case when (select owner from public.library_items where title='Spoof')=a then '[ok owner forced to self] ' else '[FAIL owner spoofed] ' end; exception when others then out := out || '[ok spoof rejected] '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.library_items; out := out || case when n=0 then '[ok others cannot read] ' else '[FAIL others read '||n||'] ' end;
  update public.library_items set title='hacked' where id=i1; get diagnostics n = row_count; out := out || case when n=0 then '[ok others cannot edit] ' else '[FAIL others edit] ' end;
  delete from public.library_items where id=i1; get diagnostics n = row_count; out := out || case when n=0 then '[ok others cannot delete] ' else '[FAIL others delete] ' end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin select count(*) into n from public.library_items; out := out || case when n=0 then '[ok anon sees nothing] ' else '[FAIL anon reads] ' end; exception when others then out := out || '[ok anon denied] '; end;
  execute 'reset role';
  raise exception 'RESULTS: %', out;
end $test$;
