create extension if not exists pgcrypto;

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  session_code text not null unique,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  score integer check (score between 0 and 45),
  qualified boolean generated always as (score >= 34) stored,
  status text not null default 'active' check (status in ('active', 'submitted', 'expired'))
);

alter table public.test_attempts add column if not exists access_token_hash text;

-- API routes must set deadline_at = started_at + 40 minutes and reject late writes.

create table if not exists public.technical_questions (
  id integer primary key,
  topic text not null,
  prompt text not null,
  options jsonb not null,
  answer_index smallint not null check (answer_index between 0 and 3),
  explanation text not null,
  difficulty text not null default 'moderate',
  source_file text,
  source_location text,
  source text not null check (source in ('actual_pyq', 'provided_resource', 'ai_generated'))
);

alter table public.technical_questions add column if not exists difficulty text not null default 'moderate';
alter table public.technical_questions add column if not exists source_file text;
alter table public.technical_questions add column if not exists source_location text;

create table if not exists public.technical_answers (
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id integer not null references public.technical_questions(id),
  selected_index smallint check (selected_index between 0 and 3),
  saved_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create table if not exists public.coding_submissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  task_id text not null,
  language text,
  source_code text,
  submitted_at timestamptz not null default now(),
  passed boolean,
  tests_passed integer not null default 0,
  tests_failed integer not null default 0,
  error_message text,
  unique (attempt_id, task_id)
);

create table if not exists public.sql_submissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  query_text text not null,
  submitted_at timestamptz not null default now(),
  passed boolean,
  tests_passed integer not null default 0,
  tests_failed integer not null default 0,
  error_message text,
  unique (attempt_id)
);

create table if not exists public.web_submissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  html text not null,
  css text not null,
  javascript text not null,
  submitted_at timestamptz not null default now(),
  passed boolean,
  tests_passed integer not null default 0,
  tests_failed integer not null default 0,
  error_message text,
  unique (attempt_id)
);

create table if not exists public.topic_scores (
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  topic text not null,
  correct integer not null default 0,
  total integer not null,
  primary key (attempt_id, topic)
);

create index if not exists test_attempts_candidate_idx on public.test_attempts(candidate_id);
create index if not exists technical_answers_attempt_idx on public.technical_answers(attempt_id);

alter table public.candidates enable row level security;
alter table public.test_attempts enable row level security;
alter table public.technical_questions enable row level security;
alter table public.technical_answers enable row level security;
alter table public.coding_submissions enable row level security;
alter table public.sql_submissions enable row level security;
alter table public.web_submissions enable row level security;
alter table public.topic_scores enable row level security;

-- The browser must use server routes or Supabase Auth to access these tables.
-- No anonymous policy exposes answer_index or hidden coding tests.
create policy "authenticated candidates read own profile" on public.candidates for select to authenticated using (auth.uid() = id);
create policy "authenticated candidates read own attempts" on public.test_attempts for select to authenticated using (candidate_id = auth.uid());
create policy "authenticated candidates write own answers" on public.technical_answers for all to authenticated using (exists (select 1 from public.test_attempts a where a.id = attempt_id and a.candidate_id = auth.uid())) with check (exists (select 1 from public.test_attempts a where a.id = attempt_id and a.candidate_id = auth.uid()));
create policy "authenticated candidates read own submissions" on public.coding_submissions for select to authenticated using (exists (select 1 from public.test_attempts a where a.id = attempt_id and a.candidate_id = auth.uid()));

-- Public leaderboard projection: names and summary scores only. Never expose answers,
-- source code, explanations, or hidden-test inputs through this projection.
create or replace view public.public_leaderboard as
select
  c.display_name as candidate,
  a.score as technical_score,
  count(cs.task_id) filter (where cs.passed = true)::integer as coding_tasks_passed,
  round((((coalesce(a.score, 0)::numeric / 45) + (count(cs.task_id) filter (where cs.passed = true)::numeric / 4)) * 50))::integer as overall_percentage
from public.test_attempts a
join public.candidates c on c.id = a.candidate_id
left join public.coding_submissions cs on cs.attempt_id = a.id
where a.status = 'submitted'
group by c.display_name, a.score, a.submitted_at
order by overall_percentage desc, technical_score desc, a.submitted_at asc;

grant select on public.public_leaderboard to anon, authenticated;
