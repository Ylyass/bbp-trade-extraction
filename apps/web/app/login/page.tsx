import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Icon} from '@/components/Icon';
import {PasswordField} from '@/components/PasswordField';
import {authenticateStudent, resendConfirmation} from './actions';
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
  const awaitingEmail = query.message === 'check-email' || query.message === 'resent';
  const deliveryProblem = query.error === 'email';
  const modeHref = signup ? '/login' : '/login?mode=signup';

  return <main className="access-shell">
    <header className="access-header"><Link className="brand" href="/"><span className="brand-mark">BBP</span><b>BBP Desk</b></Link><div><span>Are you a mentor?</span><Link className="minor-link" href="/mentor">Mentor sign in</Link></div></header>
    <section className="access-layout">
      <aside className="access-intro"><span className="eyebrow">STUDENT ACCESS</span><h1>Understand your<br /><em>trading account.</em></h1><p>One private place for your account health. Your mentor can guide you; BBP cannot trade on your behalf.</p><div className="access-points"><span><Icon name="shield" size={17}/>No trading password required</span><span><Icon name="activity" size={17}/>Updates from your MT5 terminal</span></div></aside>
      <section className="access-card">
        {awaitingEmail ? <EmailConfirmation resent={query.message === 'resent'} /> : <>
          <div className="access-switch"><Link className={!signup ? 'selected' : ''} href="/login">Student sign in</Link><Link className={signup ? 'selected' : ''} href="/login?mode=signup">Create student account</Link></div>
          <div className="access-title"><span>{signup ? 'NEW STUDENT' : 'STUDENT ACCESS'}</span><h2>{signup ? 'Create your student account' : 'Welcome back'}</h2><p>{signup ? 'Your mentor issues the MT5 connection token after your account is ready.' : 'Use the student email address and password you created for BBP.'}</p></div>
          {deliveryProblem && <div className="access-alert error"><Icon name="shield" size={17}/><div><b>We could not send the confirmation link.</b><span>This project needs an approved test email or a configured email sender. Ask the mentor to complete email setup first.</span></div></div>}
          {query.error && !deliveryProblem && <div className="access-alert error"><Icon name="shield" size={17}/><div><b>We could not sign you in.</b><span>Check your email and password, then try again.</span></div></div>}
          <form action={authenticateStudent} className="access-form"><input type="hidden" name="mode" value={signup ? 'signup' : 'signin'} />{signup && <label>Your name<input name="name" placeholder="Your preferred name" autoComplete="name" required /></label>}<label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label><label>Password<PasswordField autoComplete={signup ? 'new-password' : 'current-password'} /></label><button className="primary-button" type="submit">{signup ? 'Create student account' : 'Sign in'}</button></form>
          <p className="access-switch-copy">{signup ? 'Already have a student account?' : 'New student?'} <Link href={modeHref}>{signup ? 'Sign in' : 'Create your account'}</Link></p>
        </>}
      </section>
    </section>
  </main>;
}

function EmailConfirmation({resent}: {resent: boolean}) {
  return <div className="confirmation-card"><div className="confirmation-icon"><Icon name="check" size={25}/></div><span className="eyebrow">ONE MORE STEP</span><h1>{resent ? 'A fresh link is on its way.' : 'Open the confirmation link in your email.'}</h1><p>This is a confirmation <b>link</b>, not a Gmail code. Check Inbox, Spam and Promotions before requesting another one.</p><form action={resendConfirmation} className="resend-form"><label>Email address<input name="email" type="email" placeholder="The email you just used" autoComplete="email" required /></label><button className="secondary-button" type="submit">Send another confirmation link</button></form><Link className="back-link" href="/login">Return to student sign in</Link></div>;
}