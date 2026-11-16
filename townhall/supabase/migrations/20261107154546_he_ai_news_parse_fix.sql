
insert into private.news_sources (id, name, feed_url, filter) values
 ('feweek','FE Week','https://feweek.co.uk/feed/','ai'),
 ('pie','The PIE News','https://thepienews.com/feed/','ai')
on conflict (id) do nothing;

create or replace function private.news_collect() returns void language plpgsql security definer set search_path to '' as $$
declare q record; s record; doc xml; it xml; ttl text; lnk text; pub text; ts timestamptz; n int; body text;
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
      body := regexp_replace(q.content, '^\s*<\?xml[^>]*\?>', '');
      body := replace(replace(replace(replace(replace(replace(replace(replace(body,
        '&nbsp;','&#160;'),'&rsquo;','&#8217;'),'&lsquo;','&#8216;'),'&ldquo;','&#8220;'),'&rdquo;','&#8221;'),'&ndash;','&#8211;'),'&mdash;','&#8212;'),'&hellip;','&#8230;');
      doc := xmlparse(document body);
      foreach it in array xpath('//item', doc) loop
        ttl := private.news_decode((xpath('/item/title/text()', it))[1]::text);
        lnk := btrim(private.news_decode((xpath('/item/link/text()', it))[1]::text));
        pub := coalesce((xpath('/item/pubDate/text()', it))[1]::text, (xpath('/item/*[local-name()="date"]/text()', it))[1]::text);
        begin ts := pub::timestamptz; exception when others then ts := now(); end;
        if ts is null or ts > now() then ts := now(); end if;
        if ttl is not null and lnk ~ '^https?://' and char_length(ttl) between 3 and 300 and ts > now() - interval '90 days'
           and (s.filter = 'none' or (private.news_is_ai(ttl) and (s.filter = 'ai' or private.news_is_he(ttl)))) then
          insert into public.news_items(source_id, source, title, url, published_at) values (s.id, s.name, ttl, lnk, ts) on conflict (url) do nothing;
          n := n + 1;
        end if;
      end loop;
      foreach it in array xpath('//a:entry', doc, ns) loop
        ttl := private.news_decode((xpath('/a:entry/a:title/text()', it, ns))[1]::text);
        lnk := replace(coalesce((xpath('/a:entry/a:link[not(@rel) or @rel="alternate"]/@href', it, ns))[1]::text, ''), '&amp;', '&');
        pub := coalesce((xpath('/a:entry/a:published/text()', it, ns))[1]::text, (xpath('/a:entry/a:updated/text()', it, ns))[1]::text);
        begin ts := pub::timestamptz; exception when others then ts := now(); end;
        if ts is null or ts > now() then ts := now(); end if;
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
revoke all on function private.news_collect() from public, anon, authenticated;

select private.news_request();
