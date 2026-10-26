ALTER TABLE public.application_analyses
  ADD COLUMN normalized_result jsonb;

CREATE INDEX application_analyses_file_latest_idx
  ON public.application_analyses(owner_id, application_id, file_id, created_at DESC, id)
  WHERE status = 'completed' AND normalized_result IS NOT NULL;
