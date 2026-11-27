-- Existing submissions have no historical snapshot and keep a NULL value.
ALTER TABLE public.applications ADD COLUMN submission_checklist jsonb;
