-- 05_add_level_to_question_bank.sql
-- Add numeric level column to question_bank (Level 1 = Easy, Level 2 = Medium, Level 3 = Hard)

ALTER TABLE public.question_bank
ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;

-- Backfill existing questions
UPDATE public.question_bank SET level = 1 WHERE difficulty = 'easy';
UPDATE public.question_bank SET level = 2 WHERE difficulty = 'medium';
UPDATE public.question_bank SET level = 3 WHERE difficulty = 'hard';
