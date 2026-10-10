import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Icon} from '@/components/Icon';
import {PasswordField} from '@/components/PasswordField';
import {authenticateMentor} from '@/app/login/actions';
import {createClient} from '@/lib/supabase/server';

type Query = {error?: string};

export default async function MentorLogin({searchParams}: {searchParams: Promise<Query>}) {
  const query = await searchParams;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const supabase = await createClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (user) redirect('/dashboard');
  }
  const copy = query.error === 'not-mentor' ? 'This email has a student account. Ask the workspace owner to grant mentor access if that is what you need.' : query.error === 'mentor' ? 'This email is a mentor account. Use this mentor sign-in screen.' : query.error === 'credentials' ? 'We could not verify that mentor email and password.' : '';
  return <main className="access-shell mentor-access-shell">
    <header className="access-header"><Link className="brand" href="/"><span className="brand-mark">BBP</span><b>BBP Desk</b></Link><div><span>Are you a student?</span><Link className="minor-link" href="/login">Student sign in</Link></div></header>
    <section className="access-layout mentor-access-layout"><aside className="access-intro"><span className="eyebrow">MENTOR ACCESS</span><h1>Guide the group<br /><em>with context.</em></h1><p>Mentor accounts are assigned by the workspace owner. Student sign-up never gives mentor access.</p><div className="access-points"><span><Icon name="users" size={17}/>Student accounts stay private</span><span><Icon name="shield" size={17}/>Read-only monitoring</span></div></aside><section className="access-card"><div className="access-title"><span>MENTOR SIGN IN</span><h2>Open your mentor desk</h2><p>Use the email address that already has mentor access.</p></div>{copy && <div className="access-alert error"><Icon name="shield" size={17}/><div><b>Access check</b><span>{copy}</span></div></div>}<form action={authenticateMentor} className="access-form"><label>Email address<input name="email" type="email" placeholder="mentor@example.com" autoComplete="email" required /></label><label>Password<PasswordField autoComplete="current-password" /></label><button className="primary-button" type="submit">Sign in as mentor</button></form><p className="access-switch-copy">Need a student account? <Link href="/login?mode=signup">Create a student account</Link></p></section></section>
  </main>;
}