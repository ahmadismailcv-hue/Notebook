-- Single-user app: only the owner account can touch any data, even if someone else manages to sign up.
create table public.app_owner (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.app_owner enable row level security; -- no policies: unreadable through the API
-- The owner's auth user id (set once, after the owner account was created).
insert into public.app_owner values ('08a33c50-dfec-4154-ae0a-987b51b96ad7');

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_owner where user_id = auth.uid())
$$;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

create policy "owner only" on public.notebooks as restrictive for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "owner only" on public.modules as restrictive for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "owner only" on public.pages as restrictive for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "owner only" on public.comments as restrictive for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "owner only" on public.xrefs as restrictive for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "owner only images" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'images' or (select public.is_owner()))
  with check (bucket_id <> 'images' or (select public.is_owner()));
