CREATE TABLE public.requirement_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE RESTRICT,
  requirement_id uuid NOT NULL REFERENCES public.document_requirements(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL,
  ai_status text NOT NULL CHECK (ai_status IN ('complete', 'incomplete', 'uncertain')),
  staff_status text NOT NULL CHECK (staff_status IN ('complete', 'incomplete', 'uncertain')),
  reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 1000 AND (ai_status = staff_status OR length(btrim(reason)) > 0)),
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(application_id, requirement_id)
);
CREATE INDEX requirement_reviews_week_idx ON public.requirement_reviews(created_at);
ALTER TABLE public.application_history DROP CONSTRAINT application_history_event_check;
ALTER TABLE public.application_history ADD CONSTRAINT application_history_event_check
  CHECK (event IN ('snapshot', 'draft', 'submitted', 'analysed', 'analysis_failed', 'approved', 'rejected', 'requirement_reviewed'));
CREATE FUNCTION public.record_requirement_review_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.application_history(application_id, event, actor_id, prompt_version)
    VALUES (NEW.application_id, 'requirement_reviewed', NEW.reviewer_id, NEW.prompt_version);
  RETURN NEW;
END $$;
CREATE TRIGGER requirement_review_history AFTER INSERT ON public.requirement_reviews
  FOR EACH ROW EXECUTE FUNCTION public.record_requirement_review_history();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tsek_app') THEN
    REVOKE ALL ON public.requirement_reviews FROM tsek_app;
    GRANT SELECT, INSERT ON public.requirement_reviews TO tsek_app;
  END IF;
END $$;
