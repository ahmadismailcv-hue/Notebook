# Supabase advisors

Project `dlqltqsojkjygzzehvjk` ("aitownhall"). Run on 16 Nov 2026 at 21:34 UTC through the Supabase MCP. Read only.

## Summary

Nothing unexpected. Every security warning is one of the expected ones listed in DEPLOY.md. "Leaked password protection disabled" was not reported.

## Security (all WARN)

| Lint | Object | Expected | Note |
|---|---|---|---|
| extension_in_public | pg_net in schema `public` | yes | `sql/move_pg_net.sql` clears it. Not run. |
| anon_security_definer_function_executable | public.track_view(p text) | yes | Cookie-free visit counter. Stores one count per page type per day. |
| authenticated_security_definer_function_executable | public.track_view(p text) | yes | As above. |
| authenticated_security_definer_function_executable | public.admin_metrics() | yes | Raises "Admins only." unless `private.is_admin()`. |
| authenticated_security_definer_function_executable | public.delete_my_account() | yes | Deletes only the caller's own `auth.users` row. |
| authenticated_security_definer_function_executable | public.my_profile() | yes | Returns only the caller's own profile row. |
| authenticated_security_definer_function_executable | public.set_ban(target_handle text, ban boolean) | yes | Raises "Admins only." unless `private.is_admin()`. Cannot ban admins. |
| authenticated_security_definer_function_executable | public.set_board_mod(target_handle text, board text, make boolean) | yes | Raises "Admins only." unless `private.is_admin()`. |

Remediation pages:
- https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Performance (all INFO)

`unused_index`: 16 indexes have not been used yet. The site has no real traffic, so this is expected. Do not drop them on this evidence.

| Table | Index |
|---|---|
| public.board_mods | board_mods_user_idx |
| public.library_items | library_owner_idx |
| public.library_items | library_source_idx |
| public.library_items | library_published_idx |
| public.likes | likes_user_idx |
| public.motion_votes | motion_votes_user_idx |
| public.notifications | notifications_post_idx |
| public.notifications | notifications_actor_idx |
| public.posts | posts_fork_idx |
| public.posts | posts_tags_gin |
| public.replies | replies_post_idx |
| public.reports | reports_post_idx |
| public.reports | reports_reply_idx |
| public.reports | reports_reporter_idx |
| public.reports | reports_handler_idx |
| public.tries | tries_user_idx |

Remediation page: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
