CREATE TABLE public.notification_preferences (
  owner_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  verified_email text,
  CHECK (NOT enabled OR verified_email IS NOT NULL)
);
CREATE TABLE public.decision_email_outbox (
  review_id uuid PRIMARY KEY REFERENCES public.application_reviews(id) ON DELETE RESTRICT,
  recipient text NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'processing', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  locked_at timestamptz
);
CREATE TABLE public.email_daily_budget (day date PRIMARY KEY, attempts integer NOT NULL DEFAULT 0);
CREATE FUNCTION public.queue_decision_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.decision_email_outbox(review_id, recipient)
    SELECT NEW.id, p.verified_email FROM public.applications a
      JOIN public.notification_preferences p ON p.owner_id = a.owner_id
    WHERE a.id = NEW.application_id AND p.enabled AND p.verified_email IS NOT NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER decision_email_queue AFTER INSERT ON public.application_reviews
  FOR EACH ROW EXECUTE FUNCTION public.queue_decision_email();
