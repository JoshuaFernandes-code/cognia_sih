-- 06_add_last_switched_at_to_relations.sql

ALTER TABLE public.patient_caregiver_relations
ADD COLUMN IF NOT EXISTS last_switched_at timestamp with time zone DEFAULT now() NOT NULL;
