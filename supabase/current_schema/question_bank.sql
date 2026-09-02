create table public.question_bank (
  id uuid not null default gen_random_uuid (),
  domain text not null,
  physical_instruction text not null,
  cognitive_question text not null,
  correct_answer text not null,
  choices jsonb not null,
  gesture text not null,
  difficulty text not null,
  created_at timestamp with time zone not null default now(),
  level integer null default 1,
  constraint question_bank_pkey primary key (id),
  constraint question_bank_cognitive_question_key unique (cognitive_question),
  constraint question_bank_difficulty_check check (
    (
      difficulty = any (array['easy'::text, 'medium'::text, 'hard'::text])
    )
  )
) TABLESPACE pg_default;