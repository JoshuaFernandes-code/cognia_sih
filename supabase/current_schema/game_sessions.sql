create table public.game_sessions (
  id uuid not null default gen_random_uuid (),
  patient_id uuid not null,
  completed_at timestamp with time zone not null default now(),
  total_score integer null,
  results_jsonb jsonb null,
  mood_reported text null,
  did_breathing_exercise boolean null default false,
  loops_completed integer null default 1,
  constraint game_sessions_pkey primary key (id),
  constraint game_sessions_patient_id_fkey foreign KEY (patient_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;