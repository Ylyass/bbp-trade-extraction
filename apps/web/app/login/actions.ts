'use server';

import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

function loginUrl(mode: 'signin' | 'signup', key?: string, value?: string) {
  const params = new URLSearchParams();
  if (mode === 'signup') params.set('mode', 'signup');
  if (key && value) params.set(key, value);
  return `/login${params.size ? `?${params.toString()}` : ''}`;
}

function confirmationUrl() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/auth/confirm`;
}

export async function authenticate(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const mode = formData.get('mode') === 'signup' ? 'signup' : 'signin';

  if (!email || password.length < 8) redirect(loginUrl(mode, 'error', 'details'));

  const supabase = await createClient();
  if (mode === 'signup') {
    const name = String(formData.get('name') || '').trim();
    const {error} = await supabase.auth.signUp({email, password, options: {data: {name}, emailRedirectTo: confirmationUrl()}});
    if (error) redirect(loginUrl('signup', 'error', 'signup'));
    redirect(loginUrl('signup', 'message', 'We sent a confirmation email. Open it to finish creating your account.'));
  }

  const {error} = await supabase.auth.signInWithPassword({email, password});
  if (error) redirect(loginUrl('signin', 'error', 'credentials'));
  redirect('/dashboard');
}

export async function resendConfirmation(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  if (!email) redirect('/login?error=confirmation');
  const supabase = await createClient();
  await supabase.auth.resend({type: 'signup', email, options: {emailRedirectTo: confirmationUrl()}});
  redirect(loginUrl('signup', 'message', 'If that email is waiting for confirmation, we sent a fresh link.'));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
