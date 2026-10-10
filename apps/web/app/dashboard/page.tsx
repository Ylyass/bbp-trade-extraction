import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Icon} from '@/components/Icon';
import {createClient} from '@/lib/supabase/server';
import {signOut} from '@/app/login/actions';

type LinkedProfile = {name: string | null; email: string | null};
type Account = {id: string; student_id: string; platform: string; broker_server: string; broker_login: string; currency: string; status: string; last_seen_at: string | null; profiles: LinkedProfile[] | LinkedProfile | null};
type Snapshot = {account_id: string; captured_at: string; balance: number | string; equity: number | string; floating_pl: number | string | null; margin: number | string | null; free_margin: number | string | null; margin_level: number | string | null; drawdown_money: number | string | null; drawdown_percent: number | string | null};

const money = (value: number | string | null | undefined, currency = 'USD') => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US', {style: 'currency', currency, maximumFractionDigits: 2}).format(Number(value));
const percent = (value: number | string | null | undefined) => value === null || value === undefined ? '—' : `${new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(Number(value))}%`;
const number = (value: number | string | null | undefined) => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(Number(value));
const age = (value: string | null) => {
  if (!value) return 'No reports yet';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Updated just now';
  if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `Updated ${Math.floor(seconds / 3600)} hr ago`;
  return `Updated ${Math.floor(seconds / 86400)} days ago`;
};
const accountProfile = (account: Account) => Array.isArray(account.profiles) ? account.profiles[0] : account.profiles;
const isLive = (account: Account | undefined) => Boolean(account?.status === 'online' && account.last_seen_at && Date.now() - new Date(account.last_seen_at).getTime() < 120000);

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const {data: profile} = await supabase.from('profiles').select('name,email,role').eq('id', user.id).maybeSingle();
  const role = profile?.role || 'student';
  const {data: rawAccounts} = await supabase.from('trading_accounts').select('id,student_id,platform,broker_server,broker_login,currency,status,last_seen_at,profiles(name,email)').order('last_seen_at', {ascending: false});
  const accounts = (rawAccounts || []) as unknown as Account[];
  const ids = accounts.map((account) => account.id);
  const {data: rawSnapshots} = ids.length ? await supabase.from('account_snapshots').select('account_id,captured_at,balance,equity,floating_pl,margin,free_margin,margin_level,drawdown_money,drawdown_percent').in('account_id', ids).order('captured_at', {ascending: false}).limit(240) : {data: []};
  const snapshots = (rawSnapshots || []) as Snapshot[];
  const latest = new Map<string, Snapshot>();
  for (const snapshot of snapshots) if (!latest.has(snapshot.account_id)) latest.set(snapshot.account_id, snapshot);

  const selected = accounts[0];
  const selectedSnapshot = selected ? latest.get(selected.id) : undefined;
  const history = selected ? snapshots.filter((snapshot) => snapshot.account_id === selected.id).reverse() : [];
  const traderName = profile?.name || user.email?.split('@')[0] || 'Trader';
  const liveAccounts = accounts.filter((account) => isLive(account)).length;
  const workspaceLabel = role === 'admin' ? 'Mentor workspace' : 'Student workspace';
  const statusLabel = selected ? isLive(selected) ? 'Live connection' : selected.last_seen_at ? 'Collector paused' : 'Waiting for MT5' : 'No account linked';
  const availableRiskData = selectedSnapshot?.margin !== null && selectedSnapshot?.margin !== undefined;
  const hasOpenPositions = availableRiskData && Number(selectedSnapshot?.margin) > 0;

  return <main className="product-shell">
    <aside className="product-sidebar">
      <Link className="brand sidebar-brand" href="/dashboard" aria-label="BBP Mentor Desk dashboard"><span className="brand-mark">BBP</span><b>Mentor Desk</b></Link>
      <div className="workspace-card"><span className="user-initial">{traderName.slice(0, 1).toUpperCase()}</span><div><b>{traderName}</b><span>{workspaceLabel}</span></div><Icon name="chevronDown" size={15}/></div>
      <nav className="product-nav" aria-label="Workspace navigation">
        <a className="active" href="#overview"><Icon name="home"/>Overview</a>
        <a href="#account"><Icon name="wallet"/>Account</a>
        <a href="#activity"><Icon name="activity"/>Activity</a>
        {role === 'admin' && <a href="#students"><Icon name="users"/>Students</a>}
      </nav>
      <div className="sidebar-foot">
        <div className="read-only-note"><Icon name="shield" size={16}/><div><b>Read-only monitoring</b><span>BBP never opens or closes trades.</span></div></div>
        <form action={signOut}><button className="signout-button" type="submit"><Icon name="logout" size={17}/>Sign out</button></form>
      </div>
    </aside>

    <div className="product-main">
      <header className="product-topbar">
        <div className="topbar-context"><span className="topbar-eyebrow">{role === 'admin' ? 'MENTOR DESK' : 'MY WORKSPACE'}</span><b>{selected ? `${selected.broker_server} · ${selected.broker_login}` : 'No account selected'}</b></div>
        <div className="topbar-actions"><span className={`connection-pill ${isLive(selected) ? 'live' : ''}`}><i />{statusLabel}</span><div className="topbar-user"><span>{traderName.slice(0, 1).toUpperCase()}</span><b>{traderName}</b></div><form action={signOut}><button className="topbar-signout" type="submit" aria-label="Sign out"><Icon name="logout" size={18}/></button></form></div>
      </header>

      <section className="dashboard-content" id="overview">
        <header className="overview-heading"><div><p>{role === 'admin' ? 'Mentor overview' : 'Account overview'}</p><h1>{role === 'admin' ? 'Your students, at a glance.' : `Welcome back, ${traderName}.`}</h1><span>{role === 'admin' ? `${liveAccounts} of ${accounts.length} connected account${accounts.length === 1 ? '' : 's'} reporting now.` : selected ? `${selected.platform} reports every 30 seconds while the terminal is open.` : 'Connect your MT5 terminal to start seeing account data.'}</span></div>{selected && <div className="last-sync"><Icon name="clock" size={17}/><div><b>{isLive(selected) ? 'Reporting normally' : 'Connection status'}</b><span>{age(selected.last_seen_at)}</span></div></div>}</header>

        {!profile ? <ProfilePending /> : accounts.length === 0 ? <ConnectEmpty /> : <>
          <section className="metric-grid">
            <Metric label="Balance" value={money(selectedSnapshot?.balance, selected.currency)} hint={`Account ${selected.broker_login}`} icon="wallet" />
            <Metric label="Equity" value={money(selectedSnapshot?.equity, selected.currency)} hint={selectedSnapshot ? age(selectedSnapshot.captured_at) : 'Waiting for first snapshot'} icon="barChart" />
            <Metric label="Open P/L" value={money(selectedSnapshot?.floating_pl, selected.currency)} hint={selectedSnapshot?.floating_pl === null || selectedSnapshot?.floating_pl === undefined ? 'Available after collector update' : hasOpenPositions ? 'Across open positions' : 'No open positions'} icon="activity" tone={Number(selectedSnapshot?.floating_pl) < 0 ? 'negative' : Number(selectedSnapshot?.floating_pl) > 0 ? 'positive' : undefined} />
            <Metric label="Drawdown" value={percent(selectedSnapshot?.drawdown_percent)} hint={selectedSnapshot?.drawdown_money === null || selectedSnapshot?.drawdown_money === undefined ? 'Available after collector update' : money(selectedSnapshot.drawdown_money, selected.currency)} icon="shield" tone={Number(selectedSnapshot?.drawdown_percent) > 0 ? 'negative' : undefined} />
          </section>

          <section className="dashboard-layout">
            <article className="equity-panel"><div className="panel-heading"><div><p>Account value</p><h2>Balance &amp; equity</h2></div><span className="panel-live"><i />{isLive(selected) ? 'LIVE' : 'LAST REPORTED'}</span></div><div className="equity-value"><strong>{money(selectedSnapshot?.equity, selected.currency)}</strong><span>Current equity</span></div><EquityChart history={history} currency={selected.currency} /><div className="chart-caption"><span><i />Equity from MT5 snapshots</span><span>{history.length > 1 ? `${history.length} recorded updates` : 'Waiting for history'}</span></div></article>
            <article className="risk-panel"><div className="panel-heading"><div><p>Risk snapshot</p><h2>Margin health</h2></div><Icon name="shield" size={20}/></div><MarginGauge level={selectedSnapshot?.margin_level} available={availableRiskData} /><dl className="risk-list"><div><dt>Margin used</dt><dd>{availableRiskData ? money(selectedSnapshot?.margin, selected.currency) : 'Collector update needed'}</dd></div><div><dt>Free margin</dt><dd>{availableRiskData ? money(selectedSnapshot?.free_margin, selected.currency) : 'Collector update needed'}</dd></div></dl><p className="risk-hint">{availableRiskData ? hasOpenPositions ? 'Live values from your open positions.' : 'No open positions are using margin right now.' : 'These metrics appear after MT5 collector version 0.2 is connected.'}</p></article>
          </section>

          <section className="account-panel" id="account"><div className="panel-heading"><div><p>{role === 'admin' ? 'Connected students' : 'Connected account'}</p><h2>{role === 'admin' ? 'Account pulse' : 'Your MT5 connection'}</h2></div><span className="account-count">{accounts.length}</span></div><div className="account-table"><div className="account-table-row account-table-labels"><span>{role === 'admin' ? 'Student / account' : 'Broker account'}</span><span>Platform</span><span>Equity</span><span>Status</span></div>{accounts.map((account) => {const item = latest.get(account.id); const linked = accountProfile(account); return <div className="account-table-row" key={account.id}><div><b>{role === 'admin' ? linked?.name || 'Student account' : `${account.broker_server} · ${account.broker_login}`}</b><small>{role === 'admin' ? `${account.broker_server} · ${account.broker_login}` : account.currency}</small></div><span>{account.platform}</span><span>{money(item?.equity, account.currency)}</span><span className={isLive(account) ? 'table-status online' : 'table-status'}><i />{isLive(account) ? 'Online' : account.last_seen_at ? 'Offline' : 'Awaiting setup'}</span></div>;})}</div></section>

          <section className="activity-panel" id="activity"><div className="activity-icon"><Icon name="spark" size={23}/></div><div><p>What comes next</p><h2>Trade history will appear here when the collector is extended.</h2><span>Right now, BBP is receiving account connection, balance and equity data. Position, win/loss and profit analytics are the next layer.</span></div><div className="activity-status"><Icon name="check" size={17}/><span>Account connection is ready</span></div></section>

          {role === 'admin' && <section className="students-anchor" id="students"><p>Student workspace</p><span>The accounts above are visible only to you as the mentor. Each student sees only their own account.</span></section>}
        </>}
      </section>
      <nav className="mobile-dock" aria-label="Mobile workspace navigation"><a href="#overview"><Icon name="home"/>Overview</a><a href="#account"><Icon name="wallet"/>Account</a><a href="#activity"><Icon name="activity"/>Activity</a>{role === 'admin' && <a href="#students"><Icon name="users"/>Students</a>}</nav>
    </div>
  </main>;
}

function Metric({label, value, hint, icon, tone}: {label: string; value: string; hint: string; icon: 'wallet' | 'barChart' | 'activity' | 'shield'; tone?: 'positive' | 'negative'}) {
  return <article className={`metric-card ${tone || ''}`}><div className="metric-top"><span>{label}</span><Icon name={icon} size={19}/></div><strong>{value}</strong><small>{hint}</small></article>;
}

function EquityChart({history, currency}: {history: Snapshot[]; currency: string}) {
  const values = history.map((snapshot) => Number(snapshot.equity ?? snapshot.balance)).filter((value) => Number.isFinite(value));
  if (values.length < 2) return <div className="chart-empty"><Icon name="barChart" size={24}/><span>Collecting your first account updates…</span></div>;
  const width = 820;
  const height = 270;
  const padding = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.012, 1);
  const points = values.map((value, index) => {
    const x = padding + ((width - padding * 2) * index) / Math.max(values.length - 1, 1);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `${padding},${height - padding} ${points.join(' ')} ${width - padding},${height - padding}`;
  const [lastX, lastY] = points[points.length - 1].split(',');
  return <div className="equity-chart"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Equity history in ${currency}`}><defs><linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#c9f55f" stopOpacity=".36"/><stop offset="100%" stopColor="#c9f55f" stopOpacity="0"/></linearGradient></defs><path className="chart-grid-line" d={`M${padding} 52H${width - padding}M${padding} 135H${width - padding}M${padding} 218H${width - padding}`} /><polygon className="equity-area" points={area} /><polyline className="equity-line" points={points.join(' ')} /><circle className="equity-dot" cx={lastX} cy={lastY} r="5" /></svg></div>;
}

function MarginGauge({level, available}: {level: number | string | null | undefined; available: boolean}) {
  const raw = Number(level);
  const progress = available && Number.isFinite(raw) ? Math.min(Math.max(raw / 1000, 0.08), 1) : 0;
  const style = {background: available ? `conic-gradient(var(--lime) ${progress * 100}%, rgba(255,255,255,.08) 0)` : 'rgba(255,255,255,.06)'};
  return <div className={`margin-gauge ${available ? 'available' : ''}`} style={style}><div><strong>{available ? percent(level) : '—'}</strong><span>{available ? 'Margin level' : 'No risk data yet'}</span></div></div>;
}

function ProfilePending() {
  return <section className="setup-panel"><Icon name="user" size={28}/><div><p>Almost ready</p><h2>Your sign-in works. Your profile is still being prepared.</h2><span>Your mentor needs to assign your student profile before trading data can appear here.</span></div></section>;
}

function ConnectEmpty() {
  return <section className="setup-panel"><Icon name="wallet" size={28}/><div><p>Ready to connect</p><h2>Your workspace is ready for an MT5 account.</h2><span>Your mentor will issue a private connection token. Add it to the BBP MT5 collector and this page will fill in automatically after its first successful sync.</span></div></section>;
}
