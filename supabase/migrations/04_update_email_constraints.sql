-- 04_update_email_constraints.sql
-- Allow a caregiver and a patient to share the same email address.

-- 1. Drop the old UNIQUE constraint on email alone
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_email_key;

-- 2. Add a composite UNIQUE constraint so (email + role) is unique
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_email_role_key UNIQUE (email, role);
