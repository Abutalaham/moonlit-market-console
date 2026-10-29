
create table public.bot_runs (
  id uuid primary key default gen_random_uuid(),
  run_label text not null,
  stage text not null default 'waiting',
  status text not null default 'waiting' check (status in ('waiting','connecting','ready','running','paused','stopped','error')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  starting_capital numeric(16,2) not null default 1000000,
  ending_wealth numeric(16,2),
  summary jsonb not null default '{}'::jsonb
);
create table public.bot_telemetry (
  id bigint generated always as identity primary key,
  run_id uuid references public.bot_runs(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  kafka_status text not null default 'disconnected',
  gateway_status text not null default 'disconnected',
  engine_status text not null default 'waiting',
  stage text,
  heartbeat_age_ms integer,
  processing_latency_ms numeric(10,3),
  latest_market_event jsonb,
  last_order_at timestamptz,
  error_count integer not null default 0
);
create table public.strategy_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  params jsonb not null default '{}'::jsonb,
  risk_limits jsonb not null default '{}'::jsonb,
  enabled_modules text[] not null default '{}',
  is_active boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create table public.trade_decisions (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.bot_runs(id) on delete cascade,
  ticker text not null,
  action text not null check (action in ('BUY','SELL','SHORT','COVER','HOLD')),
  reason text not null,
  indicators jsonb not null default '{}'::jsonb,
  event_at timestamptz not null,
  decision_latency_ms numeric(10,3)
);
create table public.order_audit (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.bot_runs(id) on delete cascade,
  decision_id bigint references public.trade_decisions(id) on delete set null,
  ticker text not null,
  action text not null check (action in ('BUY','SELL','SHORT','COVER')),
  quantity integer not null check (quantity > 0),
  submitted_at timestamptz not null,
  responded_at timestamptz,
  status text not null default 'submitted' check (status in ('submitted','executed','rejected','error')),
  rejection_code text,
  execution_price numeric(14,4),
  execution_details jsonb
);
create table public.portfolio_snapshots (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.bot_runs(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  available_cash numeric(16,2) not null,
  locked_margin numeric(16,2) not null default 0,
  holdings_value numeric(16,2) not null default 0,
  total_wealth numeric(16,2) not null,
  realized_pnl numeric(16,2) not null default 0,
  unrealized_pnl numeric(16,2) not null default 0
);
create index on public.bot_telemetry (run_id, recorded_at desc);
create index on public.trade_decisions (run_id, event_at desc);
create index on public.trade_decisions (ticker);
create index on public.order_audit (run_id, submitted_at desc);
create index on public.order_audit (ticker);
create index on public.portfolio_snapshots (run_id, recorded_at desc);

grant select on public.bot_runs, public.bot_telemetry, public.trade_decisions, public.order_audit, public.portfolio_snapshots to authenticated;
grant select, insert, update on public.strategy_configs to authenticated;
grant all on public.bot_runs, public.bot_telemetry, public.strategy_configs, public.trade_decisions, public.order_audit, public.portfolio_snapshots to service_role;

alter table public.bot_runs enable row level security;
alter table public.bot_telemetry enable row level security;
alter table public.strategy_configs enable row level security;
alter table public.trade_decisions enable row level security;
alter table public.order_audit enable row level security;
alter table public.portfolio_snapshots enable row level security;

create policy "team reads runs" on public.bot_runs for select to authenticated using (true);
create policy "team reads telemetry" on public.bot_telemetry for select to authenticated using (true);
create policy "team reads decisions" on public.trade_decisions for select to authenticated using (true);
create policy "team reads orders" on public.order_audit for select to authenticated using (true);
create policy "team reads snapshots" on public.portfolio_snapshots for select to authenticated using (true);
create policy "team reads configs" on public.strategy_configs for select to authenticated using (true);
create policy "team inserts configs" on public.strategy_configs for insert to authenticated with check (updated_by = auth.uid());
create policy "team updates configs" on public.strategy_configs for update to authenticated using (true) with check (updated_by = auth.uid());
