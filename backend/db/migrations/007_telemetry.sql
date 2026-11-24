-- Additive: three new tables for the operations dashboard (#278). No existing
-- table changes. Rows hold timings, counts and codes only: no document text,
-- SQL, user IDs or personal data. The backend deletes rows older than 14 days.

-- One row per HTTP request (from the http_request log line).
CREATE TABLE public.request_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at timestamptz NOT NULL,
  request_id text,
  method text NOT NULL,
  route text NOT NULL,
  status smallint,
  aborted boolean NOT NULL DEFAULT false,
  duration_ms double precision NOT NULL CHECK (duration_ms >= 0),
  spans jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX request_metrics_recorded_at_idx ON public.request_metrics (recorded_at);

-- One row per OpenAI attempt (from the ai_call log line).
CREATE TABLE public.ai_call_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at timestamptz NOT NULL,
  request_id text,
  prompt_version text,
  model text,
  attempt smallint,
  http_status smallint,
  result text,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(14, 8),
  latency_ms double precision
);
CREATE INDEX ai_call_metrics_recorded_at_idx ON public.ai_call_metrics (recorded_at);

-- One row per document analysis (from the ai_result log line).
CREATE TABLE public.ai_result_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at timestamptz NOT NULL,
  request_id text,
  prompt_version text,
  model text,
  outcome text,
  code text,
  validation text,
  evidence_checked integer,
  evidence_matched integer,
  attempts smallint,
  retries smallint,
  cost_usd numeric(14, 8),
  fallback text,
  latency_ms double precision
);
CREATE INDEX ai_result_metrics_recorded_at_idx ON public.ai_result_metrics (recorded_at);
