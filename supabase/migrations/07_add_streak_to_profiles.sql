-- 07_add_streak_to_profiles.sql

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_session_date date;
