-- Existing analyses remain current until a new request or replacement is accepted.
ALTER TABLE public.application_files
  ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  ADD COLUMN analysis_generation integer NOT NULL DEFAULT 0 CHECK (analysis_generation >= 0);
ALTER TABLE public.application_analyses
  ADD COLUMN file_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN analysis_generation integer NOT NULL DEFAULT 0;
