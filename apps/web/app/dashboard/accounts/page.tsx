import {ConnectionStatus, MetricCard} from '@/components/workspace/DashboardWidgets';
import {accountProfile, age, getWorkspace, isLive, money, percent} from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const workspace = await getWorkspace();
  const title = workspace.role === 'admin' ? 'All connected accounts' : 'My MT5 account';
  const subtitle = workspace.role === 'admin' ? 'Every row is a real account that this mentor is allowed to view.' : 'These values come from your MT5 terminal, not from BBP trading access.';
  return <section className="dashboard-page">
    <header className="page-heading"><div><p>{workspace.role === 'admin' ? 'Mentor desk' : 'Student desk'}</p><h1>{title}</h1><span>{subtitle}</span></div></header>
    {!workspace.accounts.length ? <section className="empty-state"><div className="empty-state-icon">—</div><div><p>No accounts</p><h2>No MT5 account has connected yet.</h2><span>{workspace.role === 'admin' ? 'Create a student account and issue a connection token from Students.' : 'Your mentor needs to issue a private connection token.'}</span></div></section> : <section className="account-list">{workspace.accounts.map((account) => {
      const snapshot = workspace.latest.get(account.id);
      const linked = accountProfile(account);
      const owner = account.student_id === workspace.userId ? 'Your mentor test account' : linked?.name || 'Student';
      return <article className="account-row" key={account.id}><div className="account-row-main"><div className="account-avatar">{owner.slice(0, 1).toUpperCase()}</div><div><p>{workspace.role === 'admin' ? owner : account.broker_server}</p><h2>{workspace.role === 'admin' ? `${account.broker_server} · ${account.broker_login}` : `Account ${account.broker_login}`}</h2><span>{account.platform} · {account.currency} · {snapshot ? age(snapshot.captured_at) : 'Waiting for first update'}</span></div></div><div className="account-stat"><span>Balance</span><b>{money(snapshot?.balance, account.currency)}</b></div><div className="account-stat"><span>Equity</span><b>{money(snapshot?.equity, account.currency)}</b></div><div className="account-stat"><span>Open P/L</span><b className={Number(snapshot?.floating_pl) < 0 ? 'negative-text' : Number(snapshot?.floating_pl) > 0 ? 'positive-text' : ''}>{money(snapshot?.floating_pl, account.currency)}</b></div><ConnectionStatus live={isLive(account)} text={isLive(account) ? 'Reporting' : account.last_seen_at ? 'Paused' : 'Awaiting setup'} /></article>;
    })}</section>}
    {workspace.accounts.length > 0 && <section className="account-detail-grid">{workspace.accounts.slice(0, 1).map((account) => {const snapshot = workspace.latest.get(account.id); return <><MetricCard key="margin" label="Margin used" value={money(snapshot?.margin, account.currency)} hint={snapshot?.margin === null || snapshot?.margin === undefined ? 'Available after collector 0.2 update' : 'Live MT5 figure'} icon="wallet" /><MetricCard key="free-margin" label="Free margin" value={money(snapshot?.free_margin, account.currency)} hint="Funds available for open positions" icon="barChart" /><MetricCard key="margin-level" label="Margin level" value={percent(snapshot?.margin_level)} hint={snapshot?.margin_level === null || snapshot?.margin_level === undefined ? 'No open positions yet' : 'Live MT5 figure'} icon="shield" /></>;})}</section>}
  </section>;
}