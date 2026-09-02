-- 08_add_preferences_to_profiles.sql

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;
