begin;

-- Profiles are created automatically whenever a student confirms a Supabase Auth account.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,name,email,role)
 values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(coalesce(new.email,''),'@',1),'Student'),new.email,'student')
 on conflict(id) do nothing;
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Admin accounts can view the mentorship roster; students remain restricted to their own records.
create or replace function public.is_bbp_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
revoke all on function public.is_bbp_admin() from public;
grant execute on function public.is_bbp_admin() to authenticated;

drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_bbp_admin());
drop policy if exists account_read on public.trading_accounts;
create policy account_read on public.trading_accounts for select to authenticated using(student_id=auth.uid() or public.is_bbp_admin());
drop policy if exists snapshot_read on public.account_snapshots;
create policy snapshot_read on public.account_snapshots for select to authenticated using(exists(select 1 from public.trading_accounts a where a.id=account_id and (a.student_id=auth.uid() or public.is_bbp_admin())));
create policy position_read on public.positions_current for select to authenticated using(exists(select 1 from public.trading_accounts a where a.id=account_id and (a.student_id=auth.uid() or public.is_bbp_admin())));
create policy execution_read on public.execution_events for select to authenticated using(exists(select 1 from public.trading_accounts a where a.id=account_id and (a.student_id=auth.uid() or public.is_bbp_admin())));
create policy cash_flow_read on public.cash_flows for select to authenticated using(exists(select 1 from public.trading_accounts a where a.id=account_id and (a.student_id=auth.uid() or public.is_bbp_admin())));
grant select on public.positions_current,public.execution_events,public.cash_flows to authenticated;

-- Version 0.2 adds risk data without rejecting existing 0.1 collectors.
create or replace function public.collector_ingest(p_token_hash text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 t public.connection_tokens%rowtype;
 a public.trading_accounts%rowtype;
 aid uuid;
 reported_equity numeric;
 next_peak numeric;
 current_drawdown numeric;
begin
 if p_action not in ('handshake','sync','heartbeat') or p_payload->>'platform' is distinct from 'MT5' then return jsonb_build_object('error','invalid_payload'); end if;
 select * into t from public.connection_tokens where token_hash=p_token_hash for update;
 if not found or t.revoked_at is not null or t.expires_at<=now() then return jsonb_build_object('error','unauthorized'); end if;
 if t.last_request_at > now()-interval '1 second' then return jsonb_build_object('error','rate_limited'); end if;
 aid:=t.bound_account_id;
 if aid is null then
  if p_action<>'handshake' then return jsonb_build_object('error','handshake_required'); end if;
  perform 1 from public.profiles where id=t.student_id for update;
  select * into a from public.trading_accounts where student_id=t.student_id and status<>'revoked';
  if found then
   if a.platform<>p_payload->>'platform' or a.broker_server<>p_payload->>'brokerServer' or a.broker_login<>p_payload->>'accountLogin' then return jsonb_build_object('error','account_mismatch'); end if;
   aid:=a.id;
  else
   begin
    insert into public.trading_accounts(student_id,platform,broker_server,broker_login,currency,collector_version)
    values(t.student_id,p_payload->>'platform',p_payload->>'brokerServer',p_payload->>'accountLogin',p_payload->>'currency',p_payload->>'collectorVersion') returning id into aid;
   exception when unique_violation then return jsonb_build_object('error','account_unavailable'); end;
  end if;
  update public.connection_tokens set bound_account_id=aid,used_at=now() where id=t.id;
  insert into public.audit_log(student_id,account_id,action) values(t.student_id,aid,'token_bound');
 end if;
 select * into a from public.trading_accounts where id=aid for update;
 if a.status='revoked' or a.student_id<>t.student_id then return jsonb_build_object('error','unauthorized'); end if;
 if a.platform<>p_payload->>'platform' or a.broker_server<>p_payload->>'brokerServer' or a.broker_login<>p_payload->>'accountLogin' or a.currency<>p_payload->>'currency' then return jsonb_build_object('error','account_mismatch'); end if;
 if p_action='sync' then
  reported_equity:=(p_payload#>>'{snapshot,equity}')::numeric;
  select greatest(coalesce(equity_peak,reported_equity),reported_equity) into next_peak from public.collector_state where account_id=aid;
  next_peak:=coalesce(next_peak,reported_equity);
  current_drawdown:=greatest(next_peak-reported_equity,0);
  insert into public.account_snapshots(account_id,captured_at,balance,equity,floating_pl,margin,free_margin,margin_level,equity_peak,drawdown_money,drawdown_percent)
  values(aid,(p_payload#>>'{snapshot,capturedAt}')::timestamptz,(p_payload#>>'{snapshot,balance}')::numeric,reported_equity,
   nullif(p_payload#>>'{snapshot,floatingPl}','')::numeric,nullif(p_payload#>>'{snapshot,margin}','')::numeric,nullif(p_payload#>>'{snapshot,freeMargin}','')::numeric,nullif(p_payload#>>'{snapshot,marginLevel}','')::numeric,
   next_peak,current_drawdown,case when next_peak>0 then current_drawdown*100/next_peak else 0 end)
  on conflict(account_id,captured_at) do nothing;
  insert into public.collector_state(account_id,last_sync,collector_version,equity_peak,max_drawdown)
  values(aid,now(),p_payload->>'collectorVersion',next_peak,current_drawdown)
  on conflict(account_id) do update set last_sync=excluded.last_sync,collector_version=excluded.collector_version,equity_peak=greatest(coalesce(public.collector_state.equity_peak,excluded.equity_peak),excluded.equity_peak),max_drawdown=greatest(coalesce(public.collector_state.max_drawdown,0),excluded.max_drawdown);
 end if;
 update public.connection_tokens set last_request_at=now() where id=t.id;
 update public.trading_accounts set last_seen_at=now(),status='online',collector_version=p_payload->>'collectorVersion' where id=aid;
 return jsonb_build_object('ok',true,'accountId',aid,'serverTime',now());
end $$;
revoke all on function public.collector_ingest(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.collector_ingest(text,text,jsonb) to service_role;
commit;
