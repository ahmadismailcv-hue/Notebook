
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Public list of headlines (title + link only)
create table public.news_items (
  id bigint generated always as identity primary key,
  source_id text not null,
  source text not null,
  title text not null check (char_length(title) between 3 and 300),
  url text not null unique check (url ~ '^https?://'),
  published_at timestamptz not null,
  fetched_at timestamptz not null default now()
);
create index news_items_pub_idx on public.news_items (published_at desc);
alter table public.news_items enable row level security;
create policy "news: anyone can read" on public.news_items for select to anon, authenticated using (true);
revoke insert, update, delete on public.news_items from anon, authenticated;

-- Sources and pending requests live in the private schema (not exposed to the API)
create table private.news_sources (
  id text primary key,
  name text not null,
  feed_url text not null,
  filter text not null default 'ai' check (filter in ('none','ai','ai_he')),
  active boolean not null default true,
  last_status int, last_items int, last_error text, last_fetched timestamptz
);
create table private.news_requests (request_id bigint primary key, source_id text not null, created_at timestamptz not null default now());

insert into private.news_sources (id, name, feed_url, filter) values
 ('wonkhe','Wonkhe','https://wonkhe.com/feed/','ai'),
 ('hepi','HEPI','https://www.hepi.ac.uk/feed/','ai'),
 ('jisc-ai','Jisc National Centre for AI','https://nationalcentreforai.jiscinvolve.org/wp/feed/','none'),
 ('jisc','Jisc','https://www.jisc.ac.uk/rss/news','ai'),
 ('ihe','Inside Higher Ed','https://www.insidehighered.com/rss.xml','ai'),
 ('educause','EDUCAUSE Review','https://er.educause.edu/rss','ai'),
 ('ofs','Office for Students','https://www.officeforstudents.org.uk/rss/news-blog-and-events/','ai'),
 ('qaa','QAA','https://www.qaa.ac.uk/news-events/news/rss','ai'),
 ('advancehe','Advance HE','https://www.advance-he.ac.uk/news-and-views/rss.xml','ai'),
 ('uwn','University World News','https://www.universityworldnews.com/rss.php','ai'),
 ('conversation','The Conversation UK (education)','https://theconversation.com/uk/education/articles.atom','ai_he'),
 ('govuk-dfe','GOV.UK (Department for Education)','https://www.gov.uk/search/news-and-communications.atom?keywords=artificial+intelligence&organisations%5B%5D=department-for-education','ai_he'),
 ('the','Times Higher Education','https://www.timeshighereducation.com/rss.xml','ai');

-- Decode the HTML entities feeds leave in titles
create or replace function private.news_decode(t text) returns text language plpgsql immutable set search_path to '' as $$
declare m text[]; out text := t;
begin
  out := regexp_replace(out, '<!\[CDATA\[(.*?)\]\]>', '\1', 'g');
  out := regexp_replace(out, '<[^>]+>', '', 'g');
  for m in select regexp_matches(out, '&#([0-9]{2,6});', 'g') loop
    out := replace(out, '&#' || m[1] || ';', chr(m[1]::int));
  end loop;
  for m in select regexp_matches(out, '&#x([0-9a-fA-F]{2,5});', 'g') loop
    out := replace(out, '&#x' || m[1] || ';', chr(('x' || lpad(m[1], 8, '0'))::bit(32)::int));
  end loop;
  out := replace(replace(replace(replace(replace(replace(replace(replace(out,
    '&lt;','<'),'&gt;','>'),'&quot;','"'),'&apos;',''''),'&#039;',''''),'&nbsp;',' '),'&rsquo;',''''),'&lsquo;','''');
  out := replace(replace(replace(out,'&ndash;','-'),'&mdash;','-'),'&hellip;','...');
  out := replace(out, '&amp;', '&');
  return btrim(regexp_replace(out, '\s+', ' ', 'g'));
end $$;

create or replace function private.news_is_ai(t text) returns boolean language sql immutable set search_path to '' as $$
  select t ~ '(^|[^A-Za-z])(AI|GenAI|LLMs?|AGI)([^A-Za-z]|$)'
      or t ~* '(artificial intelligence|generative|chatgpt|copilot|large language model|machine learning|chatbot|openai|anthropic|gemini|claude|agentic|deepfake)'
$$;
create or replace function private.news_is_he(t text) returns boolean language sql immutable set search_path to '' as $$
  select t ~* '(universit|higher education|college|student|academic|lecturer|campus|degree|graduate|research)'
$$;

-- Step 1: ask pg_net to fetch every active feed
create or replace function private.news_request() returns void language plpgsql security definer set search_path to '' as $$
declare s record; rid bigint;
begin
  delete from private.news_requests where created_at < now() - interval '1 day';
  for s in select * from private.news_sources where active loop
    select net.http_get(
      url := s.feed_url,
      headers := jsonb_build_object('User-Agent','TownhallNews/1.0 (headline list that links to the source)','Accept','application/rss+xml, application/atom+xml, application/xml, text/xml'),
      timeout_milliseconds := 20000) into rid;
    insert into private.news_requests(request_id, source_id) values (rid, s.id);
  end loop;
end $$;

-- Step 2: read the responses, keep AI items, store title + link
create or replace function private.news_collect() returns void language plpgsql security definer set search_path to '' as $$
declare q record; s record; doc xml; it xml; ttl text; lnk text; pub text; ts timestamptz; n int;
  ns text[] := array[array['a','http://www.w3.org/2005/Atom']];
begin
  for q in select r.request_id, r.source_id, h.status_code, h.content, h.error_msg
           from private.news_requests r join net._http_response h on h.id = r.request_id loop
    select * into s from private.news_sources where id = q.source_id;
    n := 0;
    begin
      if q.status_code is distinct from 200 then
        raise exception 'HTTP %: %', coalesce(q.status_code::text, 'no response'), coalesce(q.error_msg, '');
      end if;
      doc := xmlparse(document regexp_replace(q.content, '^\s*<\?xml[^>]*\?>', ''));
      -- RSS
      foreach it in array xpath('//item', doc) loop
        ttl := private.news_decode((xpath('title/text()', it))[1]::text);
        lnk := btrim(private.news_decode((xpath('link/text()', it))[1]::text));
        pub := (xpath('pubDate/text()', it))[1]::text;
        if pub is null then pub := (xpath('*[local-name()="date"]/text()', it))[1]::text; end if;
        begin ts := pub::timestamptz; exception when others then ts := now(); end;
        if ts > now() then ts := now(); end if;
        if ttl is not null and lnk ~ '^https?://' and char_length(ttl) between 3 and 300 and ts > now() - interval '90 days'
           and (s.filter = 'none' or (private.news_is_ai(ttl) and (s.filter = 'ai' or private.news_is_he(ttl)))) then
          insert into public.news_items(source_id, source, title, url, published_at) values (s.id, s.name, ttl, lnk, ts) on conflict (url) do nothing;
          n := n + 1;
        end if;
      end loop;
      -- Atom
      foreach it in array xpath('//a:entry', doc, ns) loop
        ttl := private.news_decode((xpath('a:title/text()', it, ns))[1]::text);
        lnk := (xpath('a:link[not(@rel) or @rel="alternate"]/@href', it, ns))[1]::text;
        pub := coalesce((xpath('a:published/text()', it, ns))[1]::text, (xpath('a:updated/text()', it, ns))[1]::text);
        begin ts := pub::timestamptz; exception when others then ts := now(); end;
        if ts > now() then ts := now(); end if;
        lnk := replace(lnk, '&amp;', '&');
        if ttl is not null and lnk ~ '^https?://' and char_length(ttl) between 3 and 300 and ts > now() - interval '90 days'
           and (s.filter = 'none' or (private.news_is_ai(ttl) and (s.filter = 'ai' or private.news_is_he(ttl)))) then
          insert into public.news_items(source_id, source, title, url, published_at) values (s.id, s.name, ttl, lnk, ts) on conflict (url) do nothing;
          n := n + 1;
        end if;
      end loop;
      update private.news_sources set last_status = 200, last_items = n, last_error = null, last_fetched = now() where id = s.id;
    exception when others then
      update private.news_sources set last_status = q.status_code, last_items = 0, last_error = left(sqlerrm, 300), last_fetched = now() where id = s.id;
    end;
    delete from private.news_requests where request_id = q.request_id;
  end loop;
  delete from public.news_items where published_at < now() - interval '180 days';
end $$;

revoke all on function private.news_request(), private.news_collect() from public, anon, authenticated;

select cron.schedule('news-request', '7 */6 * * *', 'select private.news_request()');
select cron.schedule('news-collect', '12 */6 * * *', 'select private.news_collect()');

select private.news_request();
