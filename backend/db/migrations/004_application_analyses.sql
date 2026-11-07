CREATE TABLE public.application_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  file_id uuid NOT NULL,
  document_type_id uuid NOT NULL REFERENCES public.document_types(id),
  status text NOT NULL CHECK (status IN ('completed', 'failed')),
  result jsonb,
  normalized_result jsonb,
  error_code text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (application_id, owner_id)
    REFERENCES public.applications(id, owner_id) ON DELETE CASCADE,
  FOREIGN KEY (file_id, application_id)
    REFERENCES public.application_files(id, application_id) ON DELETE CASCADE,
  CHECK ((status = 'completed' AND result IS NOT NULL AND normalized_result IS NOT NULL AND error_code IS NULL)
    OR (status = 'failed' AND result IS NULL AND normalized_result IS NULL AND error_code IS NOT NULL))
);

CREATE INDEX application_analyses_latest_idx
  ON public.application_analyses(owner_id, application_id, file_id, created_at DESC, id DESC);
