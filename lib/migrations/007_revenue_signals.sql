-- Add revenue_signals table to store revenue alerts and leak signals
create table if not exists revenue_signals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  type text not null,
  severity text not null,
  value numeric,
  detected_at timestamptz not null default now(),
  meta jsonb
);

create index if not exists revenue_signals_user_id_idx on revenue_signals(user_id);