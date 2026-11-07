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
