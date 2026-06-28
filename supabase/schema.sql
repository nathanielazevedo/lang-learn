-- Shared global high score for the Falling Words game.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).

-- One row per scope, e.g. "word:L1", "audio:L3".
create table if not exists high_scores (
  scope      text primary key,
  score      integer not null default 0,
  name       text not null default '',
  updated_at timestamptz not null default now()
);

-- Atomic submit: only overwrites when the new score is strictly higher,
-- then returns the current record.
create or replace function submit_score(p_scope text, p_score integer, p_name text)
returns table(score integer, name text)
language plpgsql
as $$
begin
  insert into high_scores (scope, score, name, updated_at)
  values (p_scope, p_score, coalesce(p_name, ''), now())
  on conflict (scope) do update
    set score = excluded.score,
        name = excluded.name,
        updated_at = now()
    where excluded.score > high_scores.score;

  return query
    select hs.score, hs.name from high_scores hs where hs.scope = p_scope;
end;
$$;

-- Note: the server uses the service_role key, which bypasses RLS, so no
-- row-level-security policies are required. Keep that key server-side only.
