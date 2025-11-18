create extension if not exists "pgcrypto";

create table if not exists users (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists cases (
  id bigserial primary key,
  title text not null,
  description text not null,
  spec jsonb not null,
  ground_truth jsonb not null,
  difficulty int not null default 1,
  status text not null check (status in ('proposed', 'approved', 'archived')) default 'approved',
  created_by bigint references users(id),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id),
  case_id bigint not null references cases(id),
  status text not null check (status in ('active', 'finished')) default 'active',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  cost_eur numeric(10,6) not null default 0
);

create table if not exists messages (
  id bigserial primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('student', 'patient')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists evaluations (
  id bigserial primary key,
  session_id uuid not null unique references sessions(id) on delete cascade,
  tipo_no_adherencia text not null,
  barrera text not null,
  intervenciones text[] not null,
  is_tipo_ok boolean not null,
  is_barrera_ok boolean not null,
  is_intervencion_ok boolean not null,
  score smallint not null,
  feedback text not null,
  created_at timestamptz not null default now()
);
