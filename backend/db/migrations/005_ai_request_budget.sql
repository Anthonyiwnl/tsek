CREATE TABLE public.ai_request_hourly_budget (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  hour_start timestamptz NOT NULL DEFAULT 'epoch',
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

INSERT INTO public.ai_request_hourly_budget DEFAULT VALUES;

CREATE TABLE public.ai_request_user_budgets (
  user_id uuid PRIMARY KEY,
  minute_start timestamptz NOT NULL,
  minute_count integer NOT NULL CHECK (minute_count > 0),
  day_start timestamptz NOT NULL,
  day_count integer NOT NULL CHECK (day_count > 0)
);
