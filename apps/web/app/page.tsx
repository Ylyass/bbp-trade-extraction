import Link from 'next/link';
import {Icon} from '@/components/Icon';

const benefits = [
  {icon: 'activity' as const, label: 'Live account health', copy: 'See balance, equity and connection health as your MT5 terminal reports.'},
  {icon: 'users' as const, label: 'Mentor visibility', copy: 'One quiet workspace for the whole student group, without exposing accounts to other students.'},
  {icon: 'shield' as const, label: 'Read-only by design', copy: 'BBP observes account data. It cannot place, change or close a trade.'},
];

export default function Home() {
  return <main className="site-shell">
    <header className="site-header">
      <Link className="brand" href="/" aria-label="BBP Mentor Desk home"><span className="brand-mark">BBP</span><b>Mentor Desk</b></Link>
      <nav className="site-nav" aria-label="Main navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#for-mentors">For mentors</a>
      </nav>
      <div className="site-actions">
        <Link className="quiet-link" href="/login">Sign in</Link>
        <Link className="header-cta" href="/login?mode=signup">Create account</Link>
      </div>
    </header>

    <section className="landing-hero">
      <div className="hero-copy-wrap">
        <div className="hero-status"><span /><span>Read-only MT5 monitoring</span></div>
        <h1>Trade with <em>clarity.</em><br />Coach with confidence.</h1>
        <p>BBP brings the account information that matters into one simple place for students and mentors.</p>
        <div className="hero-ctas">
          <Link className="action-button" href="/login">Open my workspace</Link>
          <a className="ghost-button" href="#how-it-works">See how it works</a>
        </div>
        <div className="hero-trust"><Icon name="shield" size={16}/><span>No execution access. Your broker stays in control.</span></div>
      </div>

      <div className="hero-dashboard" aria-label="Example of BBP account data">
        <div className="hero-dashboard-top">
          <div><span className="micro-label">LIVE DEMO</span><b>MT5 account health</b></div>
          <span className="live-pulse"><i />Connected</span>
        </div>
        <div className="hero-main-value">
          <span>Current equity</span>
          <strong>$100,000<span>.00</span></strong>
          <small>Updated from your MT5 terminal</small>
        </div>
        <div className="market-graph"><svg viewBox="0 0 560 220" preserveAspectRatio="none" role="img" aria-label="Example equity trend"><defs><linearGradient id="heroFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#c9f55f" stopOpacity=".32"/><stop offset="100%" stopColor="#c9f55f" stopOpacity="0"/></linearGradient></defs><path className="graph-grid" d="M0 45H560M0 110H560M0 175H560"/><path className="graph-area" d="M0 172 L42 161 L80 166 L120 144 L164 150 L201 110 L244 119 L280 91 L321 102 L357 66 L395 82 L433 50 L471 60 L512 25 L560 39 V220 H0Z"/><path className="graph-line" d="M0 172 L42 161 L80 166 L120 144 L164 150 L201 110 L244 119 L280 91 L321 102 L357 66 L395 82 L433 50 L471 60 L512 25 L560 39"/><circle cx="512" cy="25" r="6" className="graph-point"/></svg></div>
        <div className="hero-data-row"><div><span>Open P/L</span><b>Live after connection</b></div><div><span>Account risk</span><b>Visible at a glance</b></div></div>
      </div>
    </section>

    <section className="logo-strip" aria-label="BBP advantages"><span>MT5 FIRST</span><i /><span>PRIVATE STUDENT ACCESS</span><i /><span>MENTOR READY</span><i /><span>READ-ONLY</span></section>

    <section id="how-it-works" className="landing-section">
      <div className="section-lead"><p className="micro-label">A CALMER TRADING WORKSPACE</p><h2>Everything important,<br /><em>without the noise.</em></h2></div>
      <div className="benefit-grid">{benefits.map((benefit, index) => <article className="benefit-card" key={benefit.label}><span className="benefit-index">0{index + 1}</span><div className="benefit-icon"><Icon name={benefit.icon} /></div><h3>{benefit.label}</h3><p>{benefit.copy}</p></article>)}</div>
    </section>

    <section id="for-mentors" className="mentor-banner">
      <div><p className="micro-label">FOR MENTORS</p><h2>Spend less time chasing updates.<br />Spend more time coaching.</h2></div>
      <div className="mentor-banner-copy"><p>See which accounts are reporting, where attention may be needed, and how each student is progressing.</p><Link className="action-button" href="/login">Open mentor workspace</Link></div>
    </section>

    <footer className="site-footer"><Link className="brand" href="/"><span className="brand-mark">BBP</span><b>Mentor Desk</b></Link><span>Read-only MT5 monitoring · BBP never opens or closes trades</span></footer>
  </main>;
}
