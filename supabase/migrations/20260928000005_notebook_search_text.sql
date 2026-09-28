alter table public.pages add column body_text text not null default '';

-- Plain text of the page (including margin-note text, which is stored as a "text" attribute),
-- kept in step by the database so search never depends on the client.
create or replace function public.pages_set_body_text() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.body_text := coalesce((
    select string_agg(t #>> '{}', ' ')
    from jsonb_path_query(new.content, 'strict $.**.text') as t
    where jsonb_typeof(t) = 'string'
  ), '');
  return new;
end;
$$;

create trigger pages_body_text before insert or update of content on public.pages
  for each row execute function public.pages_set_body_text();

update public.pages set content = content;
