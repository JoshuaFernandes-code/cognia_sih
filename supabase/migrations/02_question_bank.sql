-- 02_question_bank.sql
-- Run this in your Supabase SQL Editor

CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  physical_instruction text NOT NULL,
  cognitive_question text NOT NULL UNIQUE, -- UNIQUE constraint to prevent exact duplicates
  correct_answer text NOT NULL,
  choices jsonb NOT NULL,
  gesture text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated/anon for hackathon speed
CREATE POLICY "Enable read access for all" ON public.question_bank FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all" ON public.question_bank FOR INSERT WITH CHECK (true);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_bank TO anon, authenticated;
