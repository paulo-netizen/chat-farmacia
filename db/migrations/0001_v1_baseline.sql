-- ChatUSAL-FarmaBot v1 historical schema baseline.
--
-- This file represents the application-owned v1 schema observed in the
-- deployed Supabase production database. It is intended only to construct a
-- clean, reproducible database from scratch.
--
-- DO NOT execute this file as an incremental migration against the existing
-- v1 production database. That database already contains these objects.
--
-- Supabase platform roles, ACLs, default privileges, owners, platform
-- extensions, data, seeds, backfills, and v2 changes are intentionally absent.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE public.cases_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1
  NO CYCLE;

CREATE SEQUENCE public.evaluations_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1
  NO CYCLE;

CREATE SEQUENCE public.messages_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1
  NO CYCLE;

CREATE SEQUENCE public.users_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 9223372036854775807
  CACHE 1
  NO CYCLE;

CREATE TABLE public.users (
  id bigint NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  email text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check
    CHECK ((role = ANY (ARRAY['student'::text, 'teacher'::text, 'admin'::text]))),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email)
);

CREATE TABLE public.cases (
  id bigint NOT NULL DEFAULT nextval('cases_id_seq'::regclass),
  title text NOT NULL,
  description text NOT NULL,
  spec jsonb NOT NULL,
  ground_truth jsonb NOT NULL,
  difficulty integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'approved'::text,
  created_by bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  service_type text NOT NULL DEFAULT 'SAT'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cases_status_check
    CHECK ((status = ANY (ARRAY['approved'::text, 'rejected'::text]))),
  CONSTRAINT cases_pkey PRIMARY KEY (id),
  CONSTRAINT cases_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id)
);

CREATE TABLE public.case_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id integer NOT NULL,
  case_id integer NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT case_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT case_assignments_student_id_case_id_key
    UNIQUE (student_id, case_id),
  CONSTRAINT case_assignments_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT case_assignments_case_id_fkey
    FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE
);

CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  case_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  cost_eur numeric NOT NULL DEFAULT 0,
  CONSTRAINT sessions_status_check
    CHECK ((status = ANY (ARRAY['active'::text, 'finished'::text]))),
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT sessions_case_id_fkey
    FOREIGN KEY (case_id) REFERENCES public.cases(id)
);

CREATE TABLE public.messages (
  id bigint NOT NULL DEFAULT nextval('messages_id_seq'::regclass),
  session_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_role_check
    CHECK ((role = ANY (ARRAY['student'::text, 'patient'::text]))),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE
);

CREATE TABLE public.evaluations (
  id bigint NOT NULL DEFAULT nextval('evaluations_id_seq'::regclass),
  session_id uuid NOT NULL,
  tipo_no_adherencia text NOT NULL,
  barrera text NOT NULL,
  intervenciones text[] NOT NULL,
  is_tipo_ok boolean NOT NULL,
  is_barrera_ok boolean NOT NULL,
  is_intervencion_ok boolean NOT NULL,
  score smallint NOT NULL,
  feedback text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT evaluations_pkey PRIMARY KEY (id),
  CONSTRAINT evaluations_session_id_key UNIQUE (session_id),
  CONSTRAINT evaluations_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE
);

ALTER SEQUENCE public.cases_id_seq OWNED BY public.cases.id;
ALTER SEQUENCE public.evaluations_id_seq OWNED BY public.evaluations.id;
ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
