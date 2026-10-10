import {Icon} from '@/components/Icon';
import {MetricCard} from '@/components/workspace/DashboardWidgets';
import {accountProfile, closingDeal, getWorkspace, money, numeric, realizedNet, type Account, type ExecutionEvent} from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const number = (value: number | string | null | undefined, digits = 2) => {
  const parsed = numeric(value);
  return parsed === null ? '—' : new Intl.NumberFormat('en-US', {maximumFractionDigits: digits}).format(parsed);
};

const timestamp = (value: string | null) => {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}).format(date);
};

const ownerLabel = (account: Account | undefined, userId: string) => {
  if (!account) return 'Account';
  if (account.student_id === userId) return 'Your mentor test account';
  return accountProfile(account)?.name || 'Student account';
};

const directionLabel = (direction: string | null | undefined) => direction ? direction.toUpperCase() : '—';

const dealLabel = (event: ExecutionEvent) => {
  const direction = directionLabel(event.direction);
  return direction === '—' ? 'Closed deal' : `Closed ${direction}`;
};

export default async function ActivityPage() {
  const workspace = await getWorkspace();
  const accounts = new Map(workspace.accounts.map((account) => [account.id, account]));
  const closedDeals = workspace.executionEvents.filter(closingDeal);
  const currencies = new Set(closedDeals.map((event) => accounts.get(event.account_id)?.currency).filter((currency): currency is string => Boolean(currency)));
  const netValues = closedDeals.map(realizedNet).filter((value): value is number => value !== null);
  const realizedTotal = currencies.size === 1 && netValues.length ? money(netValues.reduce((total, value) => total + value, 0), [...currencies][0]) : '—';
  const realizedHint = !closedDeals.length ? 'Waiting for a closed deal event' : currencies.size === 1 ? 'Profit + commission + swap + fee' : 'Shown per account below';

  return <section className="dashboard-page trade-page">
    <header className="page-heading"><div><p>{workspace.role === 'admin' ? 'Mentor desk' : 'Student desk'}</p><h1>Positions and closed trades.</h1><span>Open positions come from the latest MT5 sync. Closed trade results appear once the terminal sends its trade history.</span></div></header>
    <section className="trade-summary-grid">
      <MetricCard label="Open positions" value={`${workspace.positions.length}`} hint="Reported by the latest MT5 sync" icon="activity" />
      <MetricCard label="Closed deals" value={`${closedDeals.length}`} hint="Saved closed deal events" icon="wallet" />
      <MetricCard label="Realized net" value={realizedTotal} hint={realizedHint} icon="barChart" tone={netValues.reduce((total, value) => total + value, 0) < 0 ? 'negative' : netValues.length ? 'positive' : undefined} />
    </section>
    <section className="trade-disclosure"><Icon name="shield" size={20}/><div><b>Reading the results</b><span><strong>Open P/L</strong> changes while a trade is open. <strong>Realized net</strong> is the closed deal’s profit plus commission, swap and fee. Deposits and withdrawals are not counted as trading profit.</span></div></section>

    <section className="trade-section">
      <div className="panel-title"><div><p>Live exposure</p><h2>Open positions</h2><span>What is open in MT5 at the last reported moment.</span></div><span className="trade-count">{workspace.positions.length}</span></div>
      {workspace.positions.length ? <div className="trade-list">{workspace.positions.map((position) => {
        const account = accounts.get(position.account_id);
        const floating = numeric(position.floating_pl);
        return <article className="trade-row" key={`${position.account_id}-${position.source_position_id}`}>
          <div className="trade-primary"><span className={`direction-pill ${position.direction?.toLowerCase() === 'sell' ? 'sell' : 'buy'}`}>{directionLabel(position.direction)}</span><div><b>{position.symbol_normalized || position.symbol_raw}</b><span>{ownerLabel(account, workspace.userId)} · Account {account?.broker_login || '—'}</span></div></div>
          <div className="trade-cell"><span>Volume</span><b>{number(position.volume, 2)}</b></div>
          <div className="trade-cell"><span>Open → current</span><b>{number(position.open_price, 5)} → {number(position.current_price, 5)}</b></div>
          <div className="trade-cell"><span>Open P/L</span><b className={floating !== null && floating < 0 ? 'negative-text' : floating !== null && floating > 0 ? 'positive-text' : ''}>{money(position.floating_pl, account?.currency)}</b></div>
          <div className="trade-cell"><span>Opened</span><b>{timestamp(position.open_time)}</b></div>
        </article>;
      })}</div> : <div className="trade-empty"><Icon name="activity" size={24}/><div><h3>No open positions received.</h3><p>This can simply mean the account has no open trades. If a demo trade is open and this stays empty, install the collector update that reports positions, then wait for the next successful sync.</p></div></div>}
    </section>

    <section className="trade-section closed-trades">
      <div className="panel-title"><div><p>Trading history</p><h2>Recent closed deal events</h2><span>Only completed exits are listed here; opening a trade does not create a result yet.</span></div><span className="trade-count">{closedDeals.length}</span></div>
      {closedDeals.length ? <div className="trade-list">{closedDeals.map((event) => {
        const account = accounts.get(event.account_id);
        const net = realizedNet(event);
        return <article className="trade-row deal-row" key={`${event.account_id}-${event.source_event_id}`}>
          <div className="trade-primary"><span className={`direction-pill ${event.direction?.toLowerCase() === 'sell' ? 'sell' : 'buy'}`}>{directionLabel(event.direction)}</span><div><b>{event.symbol_raw || dealLabel(event)}</b><span>{ownerLabel(account, workspace.userId)} · Account {account?.broker_login || '—'}</span></div></div>
          <div className="trade-cell"><span>Closed at</span><b>{timestamp(event.source_time || event.received_at)}</b></div>
          <div className="trade-cell"><span>Volume</span><b>{number(event.volume, 2)}</b></div>
          <div className="trade-cell"><span>Exit price</span><b>{number(event.price, 5)}</b></div>
          <div className="trade-cell"><span>Realized net</span><b className={net !== null && net < 0 ? 'negative-text' : net !== null && net > 0 ? 'positive-text' : ''}>{money(net, account?.currency)}</b></div>
        </article>;
      })}</div> : <div className="trade-empty"><Icon name="book" size={24}/><div><h3>No closed deal events yet.</h3><p>Account balance and risk snapshots can work before trade-history reporting is active. Closed trades appear here only after the collector sends completed deal history.</p></div></div>}
    </section>
  </section>;
}
