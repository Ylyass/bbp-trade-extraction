import Link from 'next/link';
import {Icon} from '@/components/Icon';
import {ConnectionStatus, EquityChart, MetricCard} from '@/components/workspace/DashboardWidgets';
import {accountProfile, age, getWorkspace, isLive, money, percent} from '@/lib/workspace';
import {createClient} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const workspace = await getWorkspace();
  const ownAccounts = workspace.accounts.filter((account) => account.student_id === workspace.userId);
  const studentAccounts = workspace.accounts.filter((account) => account.student_id !== workspace.userId);
  const selected = workspace.role === 'admin' ? studentAccounts[0] || ownAccounts[0] : ownAccounts[0];
  const snapshot = selected ? workspace.latest.get(selected.id) : undefined;
  const history = selected ? workspace.snapshots.filter((item) => item.account_id === selected.id).reverse() : [];
  const onlineStudents = studentAccounts.filter(isLive).length;
  const offlineStudents = studentAccounts.filter((account) => !isLive(account)).length;

  if (workspace.role === 'admin') {
    const supabase = await createClient();
    const {count: registeredStudents} = await supabase.from('profiles').select('*', {count: 'exact', head: true}).eq('role', 'student');
    return <section className="dashboard-page">
      <header className="page-heading mentor-heading"><div><p>Mentor overview</p><h1>See the group clearly.</h1><span>Student accounts, connection health and the latest account data in one place.</span></div><Link className="primary-link" href="/dashboard/students"><Icon name="users" size={17}/>Manage students</Link></header>
      <section className="metric-grid mentor-metric-grid">
        <MetricCard label="Students" value={String(registeredStudents ?? 0)} hint={`${studentAccounts.length} MT5 account${studentAccounts.length === 1 ? '' : 's'} connected to BBP`} icon="users" />
        <MetricCard label="Reporting now" value={String(onlineStudents)} hint="Updated within the last 2 minutes" icon="activity" tone="positive" />
        <MetricCard label="Need attention" value={String(offlineStudents)} hint={offlineStudents ? 'Collector is not currently reporting' : 'All student collectors are reporting'} icon="shield" tone={offlineStudents ? 'warning' : undefined} />
      </section>
      {studentAccounts.length === 0 ? <MentorTestAccount ownAccounts={ownAccounts} /> : <MentorAccountPreview account={selected!} snapshot={snapshot} history={history} owner={accountProfile(selected!)?.name || 'Student'} />}
    </section>;
  }

  if (!selected) return <StudentConnectEmpty />;
  return <section className="dashboard-page">
    <header className="page-heading"><div><p>My account</p><h1>Good to see you, {workspace.name}.</h1><span>Your dashboard refreshes automatically every 30 seconds while MT5 is open.</span></div><ConnectionStatus live={isLive(selected)} text={isLive(selected) ? 'MT5 reporting' : selected.last_seen_at ? 'Collector paused' : 'Waiting for MT5'} /></header>
    <section className="metric-grid">
      <MetricCard label="Balance" value={money(snapshot?.balance, selected.currency)} hint={`${selected.broker_server} · ${selected.broker_login}`} icon="wallet" />
      <MetricCard label="Equity" value={money(snapshot?.equity, selected.currency)} hint={snapshot ? age(snapshot.captured_at) : 'Waiting for first update'} icon="barChart" />
      <MetricCard label="Open P/L" value={money(snapshot?.floating_pl, selected.currency)} hint={snapshot?.floating_pl === null || snapshot?.floating_pl === undefined ? 'Collector update needed' : Number(snapshot.floating_pl) === 0 ? 'No open positions' : 'Across your open positions'} icon="activity" tone={Number(snapshot?.floating_pl) < 0 ? 'negative' : Number(snapshot?.floating_pl) > 0 ? 'positive' : undefined} />
      <MetricCard label="Drawdown" value={percent(snapshot?.drawdown_percent)} hint={snapshot?.drawdown_money === null || snapshot?.drawdown_money === undefined ? 'Collector update needed' : money(snapshot.drawdown_money, selected.currency)} icon="shield" tone={Number(snapshot?.drawdown_percent) > 0 ? 'warning' : undefined} />
    </section>
    <section className="overview-split">
      <article className="chart-panel"><div className="panel-title"><div><p>Account value</p><h2>Balance and equity</h2></div><ConnectionStatus live={isLive(selected)} text={snapshot ? age(snapshot.captured_at) : 'Waiting for data'} /></div><strong className="chart-value">{money(snapshot?.equity, selected.currency)}</strong><span className="chart-subtitle">Current equity</span><EquityChart history={history} /><div className="chart-foot"><span><i />MT5 account snapshots</span><span>{history.length ? `${history.length} recorded updates` : 'No updates yet'}</span></div></article>
      <article className="connection-card"><div className="panel-title"><div><p>Connection</p><h2>MT5 collector</h2></div><Icon name="shield" size={20}/></div><div className={`connection-orb ${isLive(selected) ? 'live' : ''}`}><i /></div><h3>{isLive(selected) ? 'Connected and reporting' : 'Not reporting right now'}</h3><p>{isLive(selected) ? 'Keep MT5 and the BBP collector open. New figures arrive every 30 seconds.' : 'Open MT5 and make sure the BBP collector is attached to one chart.'}</p><Link href="/dashboard/accounts" className="secondary-link">View account details</Link></article>
    </section>
  </section>;
}

function MentorTestAccount({ownAccounts}: {ownAccounts: Awaited<ReturnType<typeof getWorkspace>>['accounts']}) {
  const account = ownAccounts[0];
  return <section className="empty-state mentor-empty"><div className="empty-state-icon"><Icon name="users" size={24}/></div><div><p>Start with a student</p><h2>Your MT5 demo is connected to your mentor profile.</h2><span>That proves the collector works, but it is not yet a student test. Create a separate student account, issue that student a private token, then connect a second MT5 demo account.</span></div><Link className="primary-link" href="/dashboard/students">Set up a student</Link>{account && <small>Your mentor test account: {account.broker_server} · {account.broker_login}</small>}</section>;
}

function MentorAccountPreview({account, snapshot, history, owner}: {account: Awaited<ReturnType<typeof getWorkspace>>['accounts'][number]; snapshot: ReturnType<Map<string, import('@/lib/workspace').Snapshot>['get']>; history: import('@/lib/workspace').Snapshot[]; owner: string}) {
  return <section className="overview-split mentor-account-preview"><article className="chart-panel"><div className="panel-title"><div><p>Latest student account</p><h2>{owner}</h2></div><ConnectionStatus live={isLive(account)} text={isLive(account) ? 'Reporting now' : 'Collector paused'} /></div><div className="preview-account-row"><div><span>Balance</span><strong>{money(snapshot?.balance, account.currency)}</strong></div><div><span>Equity</span><strong>{money(snapshot?.equity, account.currency)}</strong></div><div><span>Open P/L</span><strong>{money(snapshot?.floating_pl, account.currency)}</strong></div></div><EquityChart history={history} /><Link href="/dashboard/accounts" className="secondary-link">View all student accounts</Link></article><article className="connection-card"><div className="panel-title"><div><p>Live status</p><h2>{account.broker_server}</h2></div><Icon name="activity" size={20}/></div><div className={`connection-orb ${isLive(account) ? 'live' : ''}`}><i /></div><h3>{isLive(account) ? 'Student terminal is reporting' : 'Student terminal is paused'}</h3><p>{snapshot ? age(snapshot.captured_at) : 'Waiting for the first snapshot.'}</p><span className="account-id">Account {account.broker_login}</span></article></section>;
}

function StudentConnectEmpty() {
  return <section className="dashboard-page"><header className="page-heading"><div><p>My account</p><h1>Your workspace is ready.</h1><span>Ask your mentor for a private BBP connection token, then attach the collector to your MT5 terminal.</span></div></header><section className="empty-state"><div className="empty-state-icon"><Icon name="wallet" size={24}/></div><div><p>Step 1 of 2</p><h2>Waiting for your MT5 connection</h2><span>Your mentor issues a private token. BBP never needs your trading password and cannot place trades.</span></div></section></section>;
}