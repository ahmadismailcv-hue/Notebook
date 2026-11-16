# Schema snapshot

Project `dlqltqsojkjygzzehvjk` ("aitownhall", eu-west-2). Taken 16 Nov 2026 with read-only queries on `information_schema` and `pg_catalog`. 10 migrations applied, the latest `20261107163841_notifications_privacy_metrics`.

## Tables and columns

RLS column: whether row-level security is on.

| Table | RLS | Columns |
|---|---|---|
| public.board_mods | on | board_id text not null; user_id uuid not null |
| public.boards | on | id text not null; cat text not null; name text not null; descr text not null; sort integer not null; is_private boolean not null |
| public.follows | on | user_id uuid not null; kind text not null; target text not null; created_at timestamptz not null |
| public.library_items | on | id uuid not null; owner uuid not null; kind text not null; source_post uuid; published_post uuid; type text not null; title text not null; body text not null; prompt text not null; notes text not null; tool_key text not null; knowledge_sources jsonb not null; tags text[] not null; snapshot_at timestamptz not null; created_at timestamptz not null; updated_at timestamptz not null |
| public.likes | on | post_id uuid not null; user_id uuid not null; created_at timestamptz not null |
| public.motion_votes | on | post_id uuid not null; user_id uuid not null; vote smallint not null; created_at timestamptz not null |
| public.news_items | on | id bigint not null; source_id text not null; source text not null; title text not null; url text not null; published_at timestamptz not null; fetched_at timestamptz not null |
| public.notifications | on | id bigint not null; user_id uuid not null; kind text not null; post_id uuid; actor uuid; detail text not null; read_at timestamptz; created_at timestamptz not null |
| public.posts | on | id uuid not null; author uuid; board_id text not null; type text not null; title text not null; body text not null; prompt text not null; task text not null; tool text not null; model_version text not null; minutes_before integer; minutes_after integer; what_wrong text not null; tags text[] not null; forked_from uuid; status text not null; pinned boolean not null; is_sample boolean not null; tested_on date not null; created_at timestamptz not null; updated_at timestamptz not null; data_class text not null; tool_key text not null; screenshots text[] not null; knowledge_sources jsonb not null |
| public.profiles | on | id uuid not null; handle text not null; profession text not null; role text not null; banned boolean not null; created_at timestamptz not null; prefs jsonb not null; ac_verified boolean not null; staff_area text not null; institution text not null; hide_institution boolean not null |
| public.replies | on | id uuid not null; post_id uuid not null; author uuid; body text not null; status text not null; created_at timestamptz not null |
| public.reports | on | id uuid not null; reporter uuid; post_id uuid; reply_id uuid; reason text not null; status text not null; handled_by uuid; created_at timestamptz not null |
| public.tries | on | post_id uuid not null; user_id uuid not null; result text not null; note text not null; created_at timestamptz not null; updated_at timestamptz not null |
| private.news_requests | off | request_id bigint not null; source_id text not null; created_at timestamptz not null |
| private.news_sources | off | id text not null; name text not null; feed_url text not null; filter text not null; active boolean not null; last_status integer; last_items integer; last_error text; last_fetched timestamptz |
| private.page_views | off | day date not null; path text not null; views integer not null |

## RLS policies

All policies are permissive. "public" in the roles column means the Postgres `public` role, which covers `anon` and `authenticated`.

| Table | Policy | Command | Roles |
|---|---|---|---|
| public.board_mods | board_mods_read | SELECT | public |
| public.boards | boards_read | SELECT | public |
| public.follows | follows_read | SELECT | authenticated |
| public.follows | follows_insert | INSERT | authenticated |
| public.follows | follows_delete | DELETE | authenticated |
| public.library_items | library: owner reads | SELECT | authenticated |
| public.library_items | library: owner adds | INSERT | authenticated |
| public.library_items | library: owner edits | UPDATE | authenticated |
| public.library_items | library: owner deletes | DELETE | authenticated |
| public.likes | likes_read | SELECT | public |
| public.likes | likes_insert | INSERT | authenticated |
| public.likes | likes_delete | DELETE | authenticated |
| public.motion_votes | votes_read | SELECT | public |
| public.motion_votes | votes_insert | INSERT | authenticated |
| public.motion_votes | votes_update | UPDATE | authenticated |
| public.motion_votes | votes_delete | DELETE | authenticated |
| public.news_items | news: anyone can read | SELECT | anon, authenticated |
| public.notifications | notifications: own read | SELECT | authenticated |
| public.notifications | notifications: own mark read | UPDATE | authenticated |
| public.notifications | notifications: own delete | DELETE | authenticated |
| public.posts | posts_read | SELECT | public |
| public.posts | posts_insert | INSERT | authenticated |
| public.posts | posts_update | UPDATE | authenticated |
| public.posts | posts_delete | DELETE | authenticated |
| public.profiles | profiles_read | SELECT | public |
| public.profiles | profiles_update | UPDATE | public |
| public.replies | replies_read | SELECT | public |
| public.replies | replies_insert | INSERT | authenticated |
| public.replies | replies_update | UPDATE | authenticated |
| public.replies | replies_delete | DELETE | authenticated |
| public.reports | reports_read | SELECT | authenticated |
| public.reports | reports_insert | INSERT | authenticated |
| public.reports | reports_update | UPDATE | authenticated |
| public.tries | tries_read | SELECT | public |
| public.tries | tries_insert | INSERT | authenticated |
| public.tries | tries_update | UPDATE | authenticated |
| public.tries | tries_delete | DELETE | authenticated |
| storage.objects | shots: members upload to own folder | INSERT | authenticated |
| storage.objects | shots: owners delete own | DELETE | authenticated |

Column grants on `public.profiles` (from migration 10): `anon` and `authenticated` can select only id, handle, profession, role, banned, created_at, ac_verified and staff_area.

## Functions

| Function | Security definer | Returns |
|---|---|---|
| private.clean_tags(t text[]) | no | text[] |
| private.follows_guard() | yes | trigger |
| private.handle_new_user() | yes | trigger |
| private.is_active() | yes | boolean |
| private.is_admin() | yes | boolean |
| private.is_board_mod(b text) | yes | boolean |
| private.knowledge_ok(k jsonb) | no | boolean |
| private.knowledge_text(k jsonb) | no | text |
| private.library_guard() | yes | trigger |
| private.likes_guard() | yes | trigger |
| private.news_collect() | yes | void |
| private.news_decode(t text) | no | text |
| private.news_is_ai(t text) | no | boolean |
| private.news_is_he(t text) | no | boolean |
| private.news_request() | yes | void |
| private.notify(target uuid, k text, pid uuid, who uuid, d text) | yes | void |
| private.on_post_notify() | yes | trigger |
| private.on_reply_notify() | yes | trigger |
| private.on_try_notify() | yes | trigger |
| private.pii_problem(txt text) | no | text |
| private.post_board(pid uuid) | yes | text |
| private.posts_before_insert() | yes | trigger |
| private.posts_before_update() | yes | trigger |
| private.profiles_guard() | yes | trigger |
| private.public_institution(uid uuid) | yes | text |
| private.replies_before_insert() | yes | trigger |
| private.replies_before_update() | yes | trigger |
| private.reports_guard() | yes | trigger |
| private.reputation(uid uuid) | yes | integer |
| private.sync_ac_verified() | yes | trigger |
| private.tries_guard() | yes | trigger |
| private.votes_guard() | yes | trigger |
| public.admin_metrics() | yes | json |
| public.delete_my_account() | yes | void |
| public.my_profile() | yes | profiles |
| public.set_ban(target_handle text, ban boolean) | yes | void |
| public.set_board_mod(target_handle text, board text, make boolean) | yes | void |
| public.track_view(p text) | yes | void |

## Triggers

| Table | Trigger | Timing and events | Function |
|---|---|---|---|
| auth.users | on_auth_user_created | AFTER INSERT | private.handle_new_user() |
| auth.users | on_auth_email_change | AFTER UPDATE OF email | private.sync_ac_verified() |
| public.follows | follows_guard | BEFORE INSERT | private.follows_guard() |
| public.library_items | library_guard | BEFORE INSERT OR UPDATE | private.library_guard() |
| public.likes | likes_guard | BEFORE INSERT | private.likes_guard() |
| public.motion_votes | votes_guard | BEFORE INSERT OR UPDATE | private.votes_guard() |
| public.posts | posts_before_insert | BEFORE INSERT | private.posts_before_insert() |
| public.posts | posts_before_update | BEFORE UPDATE | private.posts_before_update() |
| public.posts | posts_notify | AFTER INSERT OR UPDATE OF status | private.on_post_notify() |
| public.profiles | profiles_guard | BEFORE UPDATE | private.profiles_guard() |
| public.replies | replies_before_insert | BEFORE INSERT | private.replies_before_insert() |
| public.replies | replies_before_update | BEFORE UPDATE | private.replies_before_update() |
| public.replies | replies_notify | AFTER INSERT | private.on_reply_notify() |
| public.reports | reports_guard | BEFORE INSERT OR UPDATE | private.reports_guard() |
| public.tries | tries_guard | BEFORE INSERT OR UPDATE | private.tries_guard() |
| public.tries | tries_notify | AFTER INSERT OR UPDATE | private.on_try_notify() |

All are row-level triggers.

## Views

| View | Options |
|---|---|
| public.member_directory | security_invoker=true |
| public.post_feed | security_invoker=true |
| public.tag_savings | security_invoker=true |

## Cron jobs

| Job | Schedule (UTC) | Command | Active |
|---|---|---|---|
| news-request | `7 */6 * * *` | `select private.news_request()` | yes |
| news-collect | `12 */6 * * *` | `select private.news_collect()` | yes |
| housekeeping | `23 3 * * 0` | delete notifications older than 120 days; delete page_views older than 400 days | yes |

## Storage buckets

| Bucket | Public | File size limit | Allowed types |
|---|---|---|---|
| shots | yes | 1,500,000 bytes | image/webp, image/png, image/jpeg |

## Extensions

| Extension | Version | Schema |
|---|---|---|
| pg_cron | 1.6.4 | pg_catalog |
| pg_net | 0.20.4 | public |
| pg_stat_statements | 1.11 | extensions |
| pgcrypto | 1.3 | extensions |
| plpgsql | 1.0 | pg_catalog |
| supabase_vault | 0.3.1 | vault |
| uuid-ossp | 1.1 | extensions |
