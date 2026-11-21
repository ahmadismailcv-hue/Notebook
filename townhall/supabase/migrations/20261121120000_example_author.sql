-- Example tips show a display name without creating a fake account.
-- sample_author is only shown when is_sample is true; normal posts ignore it.
alter table public.posts add column if not exists sample_author text not null default '' check (char_length(sample_author) <= 30);

create or replace view public.post_feed with (security_invoker = true) as
 SELECT p.id, p.author, p.board_id, p.type, p.title, p.body, p.prompt, p.task, p.tool, p.model_version,
    p.minutes_before, p.minutes_after, p.what_wrong, p.tags, p.forked_from, p.status, p.pinned, p.is_sample,
    p.tested_on, p.created_at, p.updated_at, p.data_class,
    pr.handle AS author_handle, pr.profession AS author_profession, pr.ac_verified AS author_ac,
    pr.staff_area AS author_area, private.public_institution(pr.id) AS author_institution,
    ((SELECT count(*) FROM likes l WHERE l.post_id = p.id))::integer AS likes,
    ((SELECT count(*) FROM tries t WHERE t.post_id = p.id AND t.result = 'worked'))::integer AS tries_worked,
    ((SELECT count(*) FROM tries t WHERE t.post_id = p.id AND t.result = 'partly'))::integer AS tries_partly,
    ((SELECT count(*) FROM tries t WHERE t.post_id = p.id AND t.result = 'failed'))::integer AS tries_failed,
    ((SELECT count(*) FROM replies r WHERE r.post_id = p.id AND r.status = 'published'))::integer AS replies,
    ((SELECT count(*) FROM posts f WHERE f.forked_from = p.id AND f.status = 'published'))::integer AS forks,
    ((SELECT COALESCE(sum(v.vote), 0::bigint) FROM motion_votes v WHERE v.post_id = p.id))::integer AS vote_score,
    ((SELECT count(*) FROM motion_votes v WHERE v.post_id = p.id))::integer AS vote_count,
    p.tool_key, p.screenshots, p.knowledge_sources,
    p.checks, p.tools, p.prompts, p.never_paste, p.how_to_check, p.failure_points, p.deadline_warning, p.tested_tools, p.retest_due,
    p.outcome_before, p.outcome_after,
    p.sample_author
   FROM posts p LEFT JOIN profiles pr ON pr.id = p.author;
