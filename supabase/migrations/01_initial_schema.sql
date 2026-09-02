-- 01_initial_schema.sql
-- Run this in your Supabase SQL Editor

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Profiles (Extends auth.users, or stands standalone if auth not used)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('patient', 'caregiver')),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Caregiver-Patient Relationships
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.patient_caregiver_relations (
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caregiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (patient_id, caregiver_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Game Sessions (One row per full game playthrough)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at timestamp with time zone DEFAULT now() NOT NULL,
  total_score int, -- e.g., 6 (out of 7)
  -- Optionally store raw JSON of results for quick reads
  results_jsonb jsonb
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Session Results (One row per question/domain answered)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.session_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  round_id int NOT NULL,
  domain text NOT NULL,
  chosen_answer text NOT NULL,
  correct_answer text NOT NULL,
  is_correct boolean NOT NULL,
  reaction_time_ms int NOT NULL,
  physical_gesture_confirmed boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (Row Level Security) - Optional but recommended
-- (For a hackathon, we can leave RLS off or open, but here is a simple open policy)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_caregiver_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_results ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated/anon for hackathon speed (WARNING: Insecure for prod)
CREATE POLICY "Enable read access for all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all" ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all" ON public.patient_caregiver_relations FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all" ON public.patient_caregiver_relations FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all" ON public.game_sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all" ON public.session_results FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all" ON public.session_results FOR INSERT WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLE PRIVILEGES (CRITICAL FOR API ACCESS)
-- ─────────────────────────────────────────────────────────────────────────────

-- Grant access to the tables for the API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
