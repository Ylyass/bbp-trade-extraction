begin;
-- One transaction authenticates, locks the token, binds identity and persists data.
-- Only service_role can call this RPC; never expose the credential to the collector.
create function public.collector_ingest(p_token_hash text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 t public.connection_tokens%rowtype;
 a public.trading_accounts%rowtype;
 aid uuid;
begin
 if p_action not in ('handshake','sync','heartbeat') or p_payload->>'platform' is distinct from 'MT5' then
  return jsonb_build_object('error','invalid_payload');
 end if;
 select * into t from public.connection_tokens where token_hash=p_token_hash for update;
 if not found or t.revoked_at is not null or t.expires_at<=now() then return jsonb_build_object('error','unauthorized'); end if;
 if t.last_request_at > now()-interval '1 second' then return jsonb_build_object('error','rate_limited'); end if;
 aid:=t.bound_account_id;
 if aid is null then
  if p_action<>'handshake' then return jsonb_build_object('error','handshake_required'); end if;
  -- Serialize token rotation / concurrent tokens for the same student.
  perform 1 from public.profiles where id=t.student_id for update;
  select * into a from public.trading_accounts where student_id=t.student_id and status<>'revoked';
  if found then
   if a.platform<>p_payload->>'platform' or a.broker_server<>p_payload->>'brokerServer' or a.broker_login<>p_payload->>'accountLogin' then
    return jsonb_build_object('error','account_mismatch');
   end if;
   aid:=a.id;
  else
   begin
    insert into public.trading_accounts(student_id,platform,broker_server,broker_login,currency,collector_version)
    values(t.student_id,p_payload->>'platform',p_payload->>'brokerServer',p_payload->>'accountLogin',p_payload->>'currency',p_payload->>'collectorVersion') returning id into aid;
   exception when unique_violation then return jsonb_build_object('error','account_unavailable');
   end;
  end if;
  update public.connection_tokens set bound_account_id=aid,used_at=now() where id=t.id;
  insert into public.audit_log(student_id,account_id,action) values(t.student_id,aid,'token_bound');
 end if;
 select * into a from public.trading_accounts where id=aid for update;
 if a.status='revoked' or a.student_id<>t.student_id then return jsonb_build_object('error','unauthorized'); end if;
 if a.platform<>p_payload->>'platform' or a.broker_server<>p_payload->>'brokerServer' or a.broker_login<>p_payload->>'accountLogin' or a.currency<>p_payload->>'currency' then
  return jsonb_build_object('error','account_mismatch');
 end if;
 if p_action='sync' then
  insert into public.account_snapshots(account_id,captured_at,balance,equity)
  values(aid,(p_payload#>>'{snapshot,capturedAt}')::timestamptz,(p_payload#>>'{snapshot,balance}')::numeric,(p_payload#>>'{snapshot,equity}')::numeric)
  on conflict(account_id,captured_at) do nothing;
  insert into public.collector_state(account_id,last_sync,collector_version) values(aid,now(),p_payload->>'collectorVersion')
  on conflict(account_id) do update set last_sync=excluded.last_sync,collector_version=excluded.collector_version;
 end if;
 update public.connection_tokens set last_request_at=now() where id=t.id;
 update public.trading_accounts set last_seen_at=now(),status='online',collector_version=p_payload->>'collectorVersion' where id=aid;
 return jsonb_build_object('ok',true,'accountId',aid,'serverTime',now());
end $$;
revoke all on function public.collector_ingest(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.collector_ingest(text,text,jsonb) to service_role;
commit;
