-- Additive audit trail. Existing records start with a snapshot, not invented events.
CREATE TABLE public.application_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('snapshot', 'draft', 'submitted', 'analysed', 'analysis_failed', 'approved', 'rejected')),
  actor_id uuid,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX application_history_timeline_idx ON public.application_history(application_id, created_at, id);
INSERT INTO public.application_history(application_id, event) SELECT id, 'snapshot' FROM public.applications;

CREATE FUNCTION public.record_application_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'applications' THEN
    IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'submitted') THEN
      INSERT INTO public.application_history(application_id, event, actor_id)
        VALUES (NEW.id, NEW.status, NEW.owner_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'application_reviews' THEN
    INSERT INTO public.application_history(application_id, event, actor_id)
      VALUES (NEW.application_id, NEW.decision, NEW.reviewer_id);
  ELSE
    INSERT INTO public.application_history(application_id, event, actor_id, prompt_version)
      VALUES (NEW.application_id, CASE WHEN NEW.status = 'completed' THEN 'analysed' ELSE 'analysis_failed' END,
        NEW.owner_id, NEW.metadata->>'promptVersion');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER application_history_status AFTER INSERT OR UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.record_application_history();
CREATE TRIGGER application_history_review AFTER INSERT ON public.application_reviews
  FOR EACH ROW EXECUTE FUNCTION public.record_application_history();
CREATE TRIGGER application_history_analysis AFTER INSERT ON public.application_analyses
  FOR EACH ROW EXECUTE FUNCTION public.record_application_history();
-- Default API grants may already exist; narrow them in the migration itself.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tsek_app') THEN
    REVOKE ALL ON public.application_history FROM tsek_app;
    GRANT SELECT, INSERT ON public.application_history TO tsek_app;
  END IF;
END $$;
