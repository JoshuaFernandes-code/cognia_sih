create table public.profiles (
  id uuid not null default gen_random_uuid (),
  full_name text not null,
  role text not null,
  created_at timestamp with time zone not null default now(),
  email text null,
  current_streak integer null default 0,
  longest_streak integer null default 0,
  last_session_date date null,
  preferences jsonb null default '{}'::jsonb,
  constraint profiles_pkey primary key (id),
  constraint profiles_email_role_key unique (email, role),
  constraint profiles_role_check check (
    (
      role = any (array['patient'::text, 'caregiver'::text])
    )
  )
) TABLESPACE pg_default;

-- Add this policy to allow updates from the client since the app uses the anon key:
-- CREATE POLICY "Enable update for all users" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO public USING (true) WITH CHECK (true);