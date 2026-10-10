-- Version 0.210 adds bounded read-only trade data. Existing snapshot-only collectors remain valid.
begin;

alter table public.positions_current
 add column if not exists source_position_ticket text,
 add column if not exists captured_at timestamptz,
 add column if not exists updated_at timestamptz;

alter table public.execution_events
 add column if not exists fee numeric;

-- Position data can arrive over several pages. Keep pages private until the full frame is present,
-- then replace the visible current-position set in one transaction.
create table public.collector_position_frame_pages (
 account_id uuid not null references public.trading_accounts on delete cascade,
 frame_id text not null check(char_length(frame_id) between 1 and 64),
 captured_at timestamptz not null,
 page_index integer not null,
 page_count integer not null check(page_count between 1 and 128),
 items jsonb not null check(jsonb_typeof(items)='array'),
 received_at timestamptz not null default now(),
 primary key(account_id,frame_id,page_index),
 check(page_index>=0 and page_index<page_count)
);
alter table public.collector_position_frame_pages enable row level security;
revoke all on public.collector_position_frame_pages from public,anon,authenticated;
grant all on public.collector_position_frame_pages to service_role;
create index collector_position_frame_pages_received_idx on public.collector_position_frame_pages(account_id,received_at);

create or replace function public.collector_ingest(p_token_hash text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 t public.connection_tokens%rowtype;
 a public.trading_accounts%rowtype;
 aid uuid;
 reported_equity numeric;
 next_peak numeric;
 current_drawdown numeric;
 position_frame jsonb;
 position_frame_id text;
 position_page_count integer;
 position_pages_received integer;
 position_frame_applied boolean:=false;
 latest_history_cursor text;
begin
 if p_action not in ('handshake','sync','heartbeat') or p_payload->>'platform' is distinct from 'MT5' then return jsonb_build_object('error','invalid_payload'); end if;
 if p_action='sync' and p_payload ? 'positions' and p_payload ? 'deals' then return jsonb_build_object('error','invalid_payload'); end if;
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

  if p_payload ? 'positions' then
   position_frame:=p_payload->'positions';
   position_frame_id:=position_frame->>'frameId';
   position_page_count:=(position_frame->>'pageCount')::integer;

   -- A reused frame ID with a different page count starts a clean staging frame.
   delete from public.collector_position_frame_pages
    where account_id=aid and frame_id=position_frame_id and page_count<>position_page_count;
   insert into public.collector_position_frame_pages(account_id,frame_id,captured_at,page_index,page_count,items)
   values(aid,position_frame_id,(position_frame->>'capturedAt')::timestamptz,(position_frame->>'pageIndex')::integer,position_page_count,position_frame->'items')
   on conflict(account_id,frame_id,page_index) do update set
    captured_at=excluded.captured_at,page_count=excluded.page_count,items=excluded.items,received_at=now();

   select count(*) into position_pages_received from public.collector_position_frame_pages
    where account_id=aid and frame_id=position_frame_id and page_count=position_page_count;
   if position_pages_received=position_page_count then
    -- Deletion and repopulation occur in this one transaction, so readers never see a partial frame.
    delete from public.positions_current where account_id=aid;
    insert into public.positions_current(account_id,source_position_id,source_position_ticket,symbol_raw,symbol_normalized,direction,volume,open_price,current_price,sl,tp,open_time,floating_pl,swap,captured_at,updated_at)
    select aid,source.item->>'positionId',source.item->>'ticket',source.item->>'symbol',null,
      source.item->>'side',(source.item->>'volume')::numeric,(source.item->>'openPrice')::numeric,(source.item->>'currentPrice')::numeric,
      (source.item->>'stopLoss')::numeric,(source.item->>'takeProfit')::numeric,
      to_timestamp((source.item->>'openedAtMsc')::double precision/1000.0),
      (source.item->>'profit')::numeric,(source.item->>'swap')::numeric,
      (position_frame->>'capturedAt')::timestamptz,
      to_timestamp((source.item->>'updatedAtMsc')::double precision/1000.0)
    from (
      select distinct on (item->>'positionId') item
      from public.collector_position_frame_pages page
      cross join lateral jsonb_array_elements(page.items) as row(item)
      where page.account_id=aid and page.frame_id=position_frame_id and page.page_count=position_page_count
      order by item->>'positionId',page.page_index desc
    ) as source;
    delete from public.collector_position_frame_pages where account_id=aid and frame_id=position_frame_id;
    position_frame_applied:=true;
   end if;
   delete from public.collector_position_frame_pages where account_id=aid and received_at<now()-interval '15 minutes';
  elsif p_payload ? 'deals' then
   insert into public.execution_events(account_id,platform,source_event_id,source_order_id,source_position_id,event_type,symbol_raw,direction,volume,price,profit,commission,swap,fee,source_time,raw_payload)
   select aid,'MT5',item->>'dealId',item->>'orderId',item->>'positionId',
    'deal:'||lower(item->>'dealType')||':'||case item->>'entry' when 'outBy' then 'out_by' else lower(item->>'entry') end,
    nullif(item->>'symbol',''),case item->>'dealType' when 'buy' then 'buy' when 'sell' then 'sell' else null end,
    (item->>'volume')::numeric,(item->>'price')::numeric,(item->>'profit')::numeric,(item->>'commission')::numeric,(item->>'swap')::numeric,(item->>'fee')::numeric,
    to_timestamp((item->>'timeMsc')::double precision/1000.0),jsonb_build_object('deal',item,'mode',p_payload->'deals'->>'mode','reason',item->>'reason','fee',item->>'fee')
   from jsonb_array_elements(p_payload->'deals'->'items') as row(item)
   on conflict(account_id,source_event_id) do update set
    source_order_id=excluded.source_order_id,
    source_position_id=excluded.source_position_id,
    event_type=excluded.event_type,
    symbol_raw=excluded.symbol_raw,
    direction=excluded.direction,
    volume=excluded.volume,
    price=excluded.price,
    profit=excluded.profit,
    commission=excluded.commission,
    swap=excluded.swap,
    fee=excluded.fee,
    source_time=excluded.source_time,
    received_at=now(),
    raw_payload=excluded.raw_payload;

   if (p_payload#>>'{deals,complete}')::boolean then
    select jsonb_build_object('timeMsc',item->>'timeMsc','ticket',item->>'dealId')::text into latest_history_cursor
    from jsonb_array_elements(p_payload->'deals'->'items') as row(item)
    order by (item->>'timeMsc')::numeric desc,(item->>'dealId')::numeric desc
    limit 1;
   end if;
  end if;

  insert into public.collector_state(account_id,last_sync,last_history_cursor,collector_version,equity_peak,max_drawdown)
  values(aid,now(),latest_history_cursor,p_payload->>'collectorVersion',next_peak,current_drawdown)
  on conflict(account_id) do update set
   last_sync=excluded.last_sync,
   last_history_cursor=coalesce(excluded.last_history_cursor,public.collector_state.last_history_cursor),
   collector_version=excluded.collector_version,
   equity_peak=greatest(coalesce(public.collector_state.equity_peak,excluded.equity_peak),excluded.equity_peak),
   max_drawdown=greatest(coalesce(public.collector_state.max_drawdown,0),excluded.max_drawdown);
 end if;

 update public.connection_tokens set last_request_at=now() where id=t.id;
 update public.trading_accounts set last_seen_at=now(),status='online',collector_version=p_payload->>'collectorVersion' where id=aid;
 return jsonb_build_object('ok',true,'accountId',aid,'serverTime',now(),'positionsApplied',position_frame_applied);
end $$;
revoke all on function public.collector_ingest(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.collector_ingest(text,text,jsonb) to service_role;
commit;
