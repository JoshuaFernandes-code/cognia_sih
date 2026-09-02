create table public.session_results (
  id uuid not null default gen_random_uuid (),
  session_id uuid not null,
  round_id integer not null,
  domain text not null,
  chosen_answer text not null,
  correct_answer text not null,
  is_correct boolean not null,
  reaction_time_ms integer not null,
  physical_gesture_confirmed boolean not null,
  created_at timestamp with time zone not null default now(),
  constraint session_results_pkey primary key (id),
  constraint session_results_session_id_fkey foreign KEY (session_id) references game_sessions (id) on delete CASCADE
) TABLESPACE pg_default;