-- 03_add_email_to_profiles.sql
-- Add an email column to the profiles table for passwordless login

ALTER TABLE public.profiles
ADD COLUMN email text UNIQUE;
