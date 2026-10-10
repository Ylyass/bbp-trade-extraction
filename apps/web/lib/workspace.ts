import 'server-only';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export type Role = 'admin' | 'student';
export type LinkedProfile = {name: string | null; email: string | null};
export type Account = {
  id: string;
  student_id: string;
  platform: string;
  broker_server: string;
  broker_login: string;
  currency: string;
  collector_version: string;
  status: string;
  last_seen_at: string | null;
  profiles: LinkedProfile[] | LinkedProfile | null;
};
export type Position = {
  account_id: string;
  source_position_id: string;
  symbol_raw: string;
  symbol_normalized: string | null;
  direction: string | null;
  volume: number | string | null;
  open_price: number | string | null;
  current_price: number | string | null;
  sl: number | string | null;
  tp: number | string | null;
  open_time: string | null;
  floating_pl: number | string | null;
  swap: number | string | null;
};
export type ExecutionEvent = {
  id: number;
  account_id: string;
  platform: string;
  source_event_id: string;
  source_order_id: string | null;
  source_position_id: string | null;
  event_type: string;
  symbol_raw: string | null;
  direction: string | null;
  volume: number | string | null;
  price: number | string | null;
  profit: number | string | null;
  commission: number | string | null;
  swap: number | string | null;
  fee: number | string | null;
  source_time: string | null;
  received_at: string;
};
export type Snapshot = {
  account_id: string;
  captured_at: string;
  balance: number | string;
  equity: number | string;
  floating_pl: number | string | null;
  margin: number | string | null;
  free_margin: number | string | null;
  margin_level: number | string | null;
  drawdown_money: number | string | null;
  drawdown_percent: number | string | null;
};
export type Workspace = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  accounts: Account[];
  snapshots: Snapshot[];
  positions: Position[];
  executionEvents: ExecutionEvent[];
  latest: Map<string, Snapshot>;
};

export const money = (value: number | string | null | undefined, currency = 'USD') => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US', {style: 'currency', currency, maximumFractionDigits: 2}).format(Number(value));
export const percent = (value: number | string | null | undefined) => value === null || value === undefined ? '—' : `${new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(Number(value))}%`;
export const accountProfile = (account: Account) => Array.isArray(account.profiles) ? account.profiles[0] : account.profiles;
export const numeric = (value: number | string | null | undefined) => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export const closingDeal = (event: ExecutionEvent) => /:(out|inout|out_by)$/i.test(event.event_type);
export const realizedNet = (event: ExecutionEvent) => {
  const values = [event.profit, event.commission, event.swap, event.fee].map(numeric).filter((value): value is number => value !== null);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
};
export const isLive = (account: Account | undefined) => Boolean(account?.status === 'online' && account.last_seen_at && Date.now() - new Date(account.last_seen_at).getTime() < 120000);
export const age = (value: string | null) => {
  if (!value) return 'No reports yet';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Updated just now';
  if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `Updated ${Math.floor(seconds / 3600)} hr ago`;
  return `Updated ${Math.floor(seconds / 86400)} days ago`;
};

export async function getWorkspace(): Promise<Workspace> {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const {data: profile} = await supabase.from('profiles').select('name,email,role').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/login?error=profile');

  const {data: rawAccounts} = await supabase
    .from('trading_accounts')
    .select('id,student_id,platform,broker_server,broker_login,currency,status,last_seen_at,collector_version,profiles(name,email)')
    .order('last_seen_at', {ascending: false});
  const accounts = (rawAccounts || []) as unknown as Account[];
  const ids = accounts.map((account) => account.id);
  const {data: rawSnapshots} = ids.length
    ? await supabase.from('account_snapshots').select('account_id,captured_at,balance,equity,floating_pl,margin,free_margin,margin_level,drawdown_money,drawdown_percent').in('account_id', ids).order('captured_at', {ascending: false}).limit(360)
    : {data: []};
  const snapshots = (rawSnapshots || []) as Snapshot[];
  const [{data: rawPositions}, {data: rawExecutionEvents}] = ids.length ? await Promise.all([
    supabase.from('positions_current').select('account_id,source_position_id,symbol_raw,symbol_normalized,direction,volume,open_price,current_price,sl,tp,open_time,floating_pl,swap').in('account_id', ids).order('open_time', {ascending: false}).limit(100),
    supabase.from('execution_events').select('id,account_id,platform,source_event_id,source_order_id,source_position_id,event_type,symbol_raw,direction,volume,price,profit,commission,swap,fee,source_time,received_at').in('account_id', ids).order('source_time', {ascending: false}).limit(120),
  ]) : [{data: []}, {data: []}];
  const positions = (rawPositions || []) as Position[];
  const executionEvents = (rawExecutionEvents || []) as ExecutionEvent[];
  const latest = new Map<string, Snapshot>();
  for (const snapshot of snapshots) if (!latest.has(snapshot.account_id)) latest.set(snapshot.account_id, snapshot);

  return {
    userId: user.id,
    email: user.email || profile.email || '',
    name: profile.name || user.email?.split('@')[0] || 'Trader',
    role: profile.role === 'admin' ? 'admin' : 'student',
    accounts,
    snapshots,
    positions,
    executionEvents,
    latest,
  };
}
