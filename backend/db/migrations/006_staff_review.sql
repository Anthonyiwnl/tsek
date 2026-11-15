-- Additive rollout: existing drafts/submissions remain valid. No rows are removed.
CREATE TABLE public.staff_roles (
  user_id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('staff', 'admin')),
  assigned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.applications DROP CONSTRAINT applications_status_check;
ALTER TABLE public.applications ADD CONSTRAINT applications_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));

CREATE TABLE public.application_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  note text NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX applications_staff_queue_idx ON public.applications(status, updated_at, id)
  WHERE status <> 'draft';
CREATE INDEX application_reviews_application_idx ON public.application_reviews(application_id, created_at);
