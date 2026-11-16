
create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.is_active() set schema private;
alter function public.is_admin() set schema private;
alter function public.is_board_mod(text) set schema private;
alter function public.post_board(uuid) set schema private;
alter function public.reputation(uuid) set schema private;
alter function public.pii_problem(text) set schema private;
alter function public.clean_tags(text[]) set schema private;

-- rewrite every function body that called the helpers by their old names
do $$
declare r record; def text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private') and p.prokind = 'f'
  loop
    def := pg_get_functiondef(r.oid);
    if def ~ 'public\.(is_active|is_admin|is_board_mod|post_board|reputation|pii_problem|clean_tags)\(' then
      def := regexp_replace(def, 'public\.(is_active|is_admin|is_board_mod|post_board|reputation|pii_problem|clean_tags)\(', 'private.\1(', 'g');
      execute def;
    end if;
  end loop;
end $$;

-- trigger functions don't need to live in the API schema either
alter function public.handle_new_user() set schema private;
alter function public.profiles_guard() set schema private;
alter function public.posts_before_insert() set schema private;
alter function public.posts_before_update() set schema private;
alter function public.replies_before_insert() set schema private;
alter function public.replies_before_update() set schema private;
alter function public.tries_guard() set schema private;
alter function public.votes_guard() set schema private;
alter function public.likes_guard() set schema private;
alter function public.follows_guard() set schema private;
alter function public.reports_guard() set schema private;
