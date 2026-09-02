create table public.patient_caregiver_relations (
  patient_id uuid not null,
  caregiver_id uuid not null,
  created_at timestamp with time zone not null default now(),
  last_switched_at timestamp with time zone not null default now(),
  constraint patient_caregiver_relations_pkey primary key (patient_id, caregiver_id),
  constraint patient_caregiver_relations_caregiver_id_fkey foreign KEY (caregiver_id) references profiles (id) on delete CASCADE,
  constraint patient_caregiver_relations_patient_id_fkey foreign KEY (patient_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;