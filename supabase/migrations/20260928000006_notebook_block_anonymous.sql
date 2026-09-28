-- Restrictive policies are ANDed with the owner policies: anonymous sessions get nothing.
create policy "no anonymous" on public.notebooks as restrictive for all to authenticated
  using (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false)
  with check (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false);
create policy "no anonymous" on public.modules as restrictive for all to authenticated
  using (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false)
  with check (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false);
create policy "no anonymous" on public.pages as restrictive for all to authenticated
  using (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false)
  with check (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false);
create policy "no anonymous" on public.comments as restrictive for all to authenticated
  using (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false)
  with check (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false);
create policy "no anonymous" on public.xrefs as restrictive for all to authenticated
  using (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false)
  with check (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false);
create policy "no anonymous images" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'images' or coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false)
  with check (bucket_id <> 'images' or coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) = false);
