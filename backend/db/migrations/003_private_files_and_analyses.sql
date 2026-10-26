ALTER TABLE public.applications
  ADD CONSTRAINT applications_id_owner_unique UNIQUE (id, owner_id);

CREATE TABLE public.application_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  original_name text NOT NULL CHECK (length(original_name) BETWEEN 1 AND 128),
  media_type text NOT NULL CHECK (media_type IN ('text/plain', 'application/pdf', 'image/jpeg', 'image/png')),
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 2097152),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, application_id),
  FOREIGN KEY (application_id, owner_id)
    REFERENCES public.applications(id, owner_id) ON DELETE CASCADE
);

CREATE INDEX application_files_application_idx
  ON public.application_files(owner_id, application_id, created_at, id);

CREATE TABLE public.application_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  file_id uuid NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  result text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (application_id, owner_id)
    REFERENCES public.applications(id, owner_id) ON DELETE CASCADE,
  FOREIGN KEY (file_id, application_id)
    REFERENCES public.application_files(id, application_id) ON DELETE CASCADE,
  CHECK ((status = 'completed' AND result IS NOT NULL AND completed_at IS NOT NULL)
    OR (status = 'failed' AND result IS NULL AND error_code IS NOT NULL AND completed_at IS NOT NULL)
    OR (status = 'pending' AND result IS NULL AND error_code IS NULL AND completed_at IS NULL))
);

CREATE INDEX application_analyses_owner_created_idx
  ON public.application_analyses(owner_id, created_at DESC);
