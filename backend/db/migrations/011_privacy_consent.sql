CREATE TABLE public.privacy_consents (
  owner_id uuid PRIMARY KEY,
  policy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- A citizen's explicit erasure request must remove related review notes too.
ALTER TABLE public.application_reviews DROP CONSTRAINT application_reviews_application_id_fkey;
ALTER TABLE public.application_reviews ADD CONSTRAINT application_reviews_application_id_fkey
  FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
-- Compatible with the separately reviewed notification/override drafts when present.
DO $$ BEGIN
  IF to_regclass('public.requirement_reviews') IS NOT NULL THEN
    ALTER TABLE public.requirement_reviews DROP CONSTRAINT requirement_reviews_application_id_fkey;
    ALTER TABLE public.requirement_reviews ADD CONSTRAINT requirement_reviews_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;
  IF to_regclass('public.decision_email_outbox') IS NOT NULL THEN
    ALTER TABLE public.decision_email_outbox DROP CONSTRAINT decision_email_outbox_review_id_fkey;
    ALTER TABLE public.decision_email_outbox ADD CONSTRAINT decision_email_outbox_review_id_fkey
      FOREIGN KEY (review_id) REFERENCES public.application_reviews(id) ON DELETE CASCADE;
  END IF;
END $$;
