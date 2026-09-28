-- Apply to Supabase: auth.users, anon/authenticated/service_role already exist.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '', email text,
 role text not null default 'student' check(role in ('student','admin'))
);
create table public.cohorts(id uuid primary key default gen_random_uuid(), name text not null);
create table public.cohort_members(cohort_id uuid references public.cohorts on delete cascade, student_id uuid references public.profiles on delete cascade, primary key(cohort_id,student_id));
create table public.trading_accounts (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles,
 platform text not null check(platform in ('MT5','MT4')), broker text,
 broker_server text not null, broker_login text not null, currency text not null,
 connected_at timestamptz not null default now(), last_seen_at timestamptz,
 collector_version text not null, status text not null default 'offline' check(status in ('online','offline','revoked')),
 unique(platform,broker_server,broker_login)
);
create unique index one_active_account_per_student on public.trading_accounts(student_id) where status <> 'revoked';
create table public.connection_tokens (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 used_at timestamptz, revoked_at timestamptz, last_request_at timestamptz,
 bound_account_id uuid references public.trading_accounts,
 check(expires_at > created_at)
);
create table public.account_snapshots (
 id bigint generated always as identity primary key, account_id uuid not null references public.trading_accounts,
 captured_at timestamptz not null, received_at timestamptz not null default now(),
 balance numeric(24,8) not null, equity numeric(24,8) not null,
 floating_pl numeric(24,8), margin numeric(24,8), free_margin numeric(24,8), margin_level numeric,
 equity_peak numeric(24,8), drawdown_money numeric(24,8), drawdown_percent numeric,
 unique(account_id,captured_at)
);
create table public.positions_current (
 account_id uuid references public.trading_accounts, source_position_id text,
 symbol_raw text not null, symbol_normalized text, direction text,
 volume numeric, open_price numeric, current_price numeric, sl numeric, tp numeric,
 open_time timestamptz, floating_pl numeric, swap numeric,
 primary key(account_id,source_position_id)
);
create table public.execution_events (
 id bigint generated always as identity primary key, account_id uuid not null references public.trading_accounts,
 platform text not null, source_event_id text not null, source_order_id text, source_position_id text,
 event_type text not null, symbol_raw text, direction text, volume numeric, price numeric,
 profit numeric, commission numeric, swap numeric, source_time timestamptz,
 received_at timestamptz not null default now(), raw_payload jsonb not null,
 unique(account_id,source_event_id)
);
create table public.cash_flows (
 id bigint generated always as identity primary key, account_id uuid not null references public.trading_accounts,
 source_event_id text not null, type text not null check(type in ('deposit','withdrawal','credit','bonus')),
 amount numeric not null, timestamp timestamptz not null, unique(account_id,source_event_id)
);
create table public.collector_state(account_id uuid primary key references public.trading_accounts,last_sync timestamptz,last_history_cursor text,equity_peak numeric,max_drawdown numeric,collector_version text);
create table public.audit_log(id bigint generated always as identity primary key,student_id uuid references public.profiles,account_id uuid references public.trading_accounts,action text not null,created_at timestamptz not null default now(),metadata jsonb not null default '{}');
create table public.instrument_aliases(broker text,raw_symbol text,normalized_symbol text not null,contract_size numeric,tick_size numeric,tick_value numeric,primary key(broker,raw_symbol));

-- Default-deny client writes. Roles and tokens can only be managed server-side.
do $$ declare t text; begin
 foreach t in array array['profiles','cohorts','cohort_members','trading_accounts','connection_tokens','account_snapshots','positions_current','execution_events','cash_flows','collector_state','audit_log','instrument_aliases'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on all sequences in schema public to service_role;
grant select on public.profiles,public.trading_accounts,public.account_snapshots to authenticated;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid());
create policy account_read on public.trading_accounts for select to authenticated using(student_id=auth.uid());
create policy snapshot_read on public.account_snapshots for select to authenticated using(exists(select 1 from public.trading_accounts a where a.id=account_id and a.student_id=auth.uid()));
commit;
