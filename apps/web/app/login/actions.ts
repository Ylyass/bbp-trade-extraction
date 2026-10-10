'use server';

import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';

function loginUrl(mode: 'signin' | 'signup', key?: string, value?: string) {
  const params = new URLSearchParams();
  if (mode === 'signup') params.set('mode', 'signup');
  if (key && value) params.set(key, value);
  return `/login${params.size ? `?${params.toString()}` : ''}`;
}

async function confirmationUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') || 'https';
  const base = (configured || (host ? `${protocol}://${host}` : 'http://localhost:3000')).replace(/\/$/, '');
  return `${base}/auth/confirm`;
}

function isEmailDeliveryError(message: string) {
  return /email.*(authorized|rate|limit|smtp|send)|mailer/i.test(message);
}

export async function authenticateStudent(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const mode = formData.get('mode') === 'signup' ? 'signup' : 'signin';
  if (!email || password.length < 8) redirect(loginUrl(mode, 'error', 'details'));

  const supabase = await createClient();
  if (mode === 'signup') {
    const name = String(formData.get('name') || '').trim();
    const {error} = await supabase.auth.signUp({email, password, options: {data: {name}, emailRedirectTo: await confirmationUrl()}});
    if (error) redirect(loginUrl('signup', 'error', isEmailDeliveryError(error.message) ? 'email' : 'signup'));
    redirect('/login?mode=signup&message=check-email');
  }

  const {data, error} = await supabase.auth.signInWithPassword({email, password});
  if (error || !data.user) redirect(loginUrl('signin', 'error', 'credentials'));
  const {data: profile} = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (profile?.role === 'admin') {
    await supabase.auth.signOut();
    redirect('/mentor?error=mentor');
  }
  redirect('/dashboard');
}

export async function authenticateMentor(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (!email || !password) redirect('/mentor?error=credentials');
  const supabase = await createClient();
  const {data, error} = await supabase.auth.signInWithPassword({email, password});
  if (error || !data.user) redirect('/mentor?error=credentials');
  const {data: profile} = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    redirect('/mentor?error=not-mentor');
  }
  redirect('/dashboard');
}

export async function resendConfirmation(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  if (!email) redirect('/login?mode=signup&message=check-email');
  const supabase = await createClient();
  const {error} = await supabase.auth.resend({type: 'signup', email, options: {emailRedirectTo: await confirmationUrl()}});
  if (error) redirect(`/login?mode=signup&error=${isEmailDeliveryError(error.message) ? 'email' : 'confirmation'}`);
  redirect('/login?mode=signup&message=resent');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
