import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Icon} from '@/components/Icon';
import {PasswordField} from '@/components/PasswordField';
import {authenticate, resendConfirmation} from './actions';
import {createClient} from '@/lib/supabase/server';

type Query = {mode?: string; error?: string; message?: string};

export default async function Login({searchParams}: {searchParams: Promise<Query>}) {
  const query = await searchParams;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const supabase = await createClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (user) redirect('/dashboard');
  }

  const signup = query.mode === 'signup';
  const expiredConfirmation = query.error === 'confirmation';
  const modeHref = signup ? '/login' : '/login?mode=signup';
  const switchLabel = signup ? 'I already have an account' : 'Create a student account';

  return <main className="auth-shell">
    <header className="auth-header">
      <Link className="brand" href="/" aria-label="BBP Mentor Desk home"><span className="brand-mark">BBP</span><b>Mentor Desk</b></Link>
      <div className="auth-header-actions"><span>{signup ? 'Already registered?' : 'New to BBP?'}</span><Link className="compact-button" href={modeHref}>{signup ? 'Sign in' : 'Create account'}</Link></div>
    </header>

    <section className="auth-layout">
      <div className="auth-story">
        <div className="auth-story-copy">
          <span className="story-chip"><i />PRIVATE · READ-ONLY</span>
          <h1>Your trading<br /><em>picture, clearer.</em></h1>
          <p>Keep account health, progress and mentorship in one calm workspace — while your MT5 terminal continues to do the trading.</p>
        </div>
        <div className="auth-preview" aria-hidden="true">
          <div className="auth-preview-top"><span>Account health</span><b><i /> Live connection</b></div>
          <strong>$100,000<span>.00</span></strong>
          <small>Current equity</small>
          <svg viewBox="0 0 500 150" preserveAspectRatio="none"><defs><linearGradient id="authLine" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d8ff67" stopOpacity=".32"/><stop offset="100%" stopColor="#d8ff67" stopOpacity="0"/></linearGradient></defs><path className="auth-chart-area" d="M0 120 L42 107 L78 111 L117 82 L153 91 L190 72 L231 83 L270 48 L310 57 L354 33 L390 45 L440 19 L500 27 V150 H0Z"/><path className="auth-chart-line" d="M0 120 L42 107 L78 111 L117 82 L153 91 L190 72 L231 83 L270 48 L310 57 L354 33 L390 45 L440 19 L500 27"/></svg>
        </div>
        <div className="auth-points"><span><Icon name="check" size={15}/>Account information is private</span><span><Icon name="check" size={15}/>BBP cannot place a trade</span></div>
      </div>

      <div className="auth-form-side">
        <section className="auth-card">
          <div className="auth-mode"><Link className={!signup ? 'selected' : ''} href="/login">Sign in</Link><Link className={signup ? 'selected' : ''} href="/login?mode=signup">Create account</Link></div>
          <div className="auth-title"><p>{signup ? 'Get started' : 'Welcome back'}</p><h2>{signup ? 'Set up your BBP access' : 'Sign in to your workspace'}</h2><span>{signup ? 'Your mentor can connect a trading account after your account is confirmed.' : 'Use the email address and password you chose for BBP.'}</span></div>

          {expiredConfirmation && <div className="auth-alert warning"><Icon name="clock" size={17}/><div><b>Your confirmation link has expired.</b><span>Enter your email below and we will send a new one.</span></div></div>}
          {query.error && !expiredConfirmation && <div className="auth-alert error"><Icon name="shield" size={17}/><div><b>We could not sign you in.</b><span>Please check your email and password, then try again.</span></div></div>}
          {query.message && <div className="auth-alert success"><Icon name="check" size={17}/><div><b>Check your inbox.</b><span>{query.message}</span></div></div>}

          {expiredConfirmation ? <form action={resendConfirmation} className="auth-form resend-form"><label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label><button className="auth-submit" type="submit">Send a new confirmation email</button><Link className="text-action" href="/login">Return to sign in</Link></form> : <form action={authenticate} className="auth-form"><input type="hidden" name="mode" value={signup ? 'signup' : 'signin'} />{signup && <label>Your name<input name="name" placeholder="Your preferred name" autoComplete="name" required /></label>}<label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label><label>Password<PasswordField autoComplete={signup ? 'new-password' : 'current-password'} /></label><button className="auth-submit" type="submit">{signup ? 'Create account' : 'Sign in'}</button></form>}

          {!expiredConfirmation && <p className="auth-switch">{signup ? 'Already have access?' : 'Need an account?'} <Link href={modeHref}>{switchLabel}</Link></p>}
        </section>
        <p className="auth-note"><Icon name="shield" size={14}/> Secure, read-only account monitoring</p>
      </div>
    </section>
  </main>;
}
