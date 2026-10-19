CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  document_type_id uuid NOT NULL
    REFERENCES public.document_types(id) ON DELETE RESTRICT,
  purpose text NOT NULL DEFAULT '' CHECK (length(purpose) <= 200),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX applications_owner_updated_idx
  ON public.applications(owner_id, updated_at DESC, id);
