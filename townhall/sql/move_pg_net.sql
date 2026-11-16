-- Optional tidy-up flagged by Supabase's security scan ("Extension in Public").
-- Moves the web-fetch extension used by the news job out of the public schema. Paste into SQL Editor > Run.
delete from private.news_requests;
drop extension if exists pg_net;
create extension pg_net with schema extensions;
