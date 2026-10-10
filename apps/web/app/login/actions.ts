'use server';

import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

function destination(value:FormDataEntryValue|null){return value==='signup'?'/login?mode=signup':'/login?error=Please%20check%20your%20email%20and%20password.';}

export async function authenticate(formData:FormData){
 const email=String(formData.get('email')||'').trim();
 const password=String(formData.get('password')||'');
 const mode=formData.get('mode');
 if(!email||password.length<8) redirect('/login?error=Use%20a%20valid%20email%20and%20a%20password%20with%20at%20least%208%20characters.');
 const supabase=await createClient();
 if(mode==='signup'){
  const name=String(formData.get('name')||'').trim();
  const {error}=await supabase.auth.signUp({email,password,options:{data:{name},emailRedirectTo:`${process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000'}/auth/confirm`}});
  if(error) redirect('/login?mode=signup&error='+encodeURIComponent(error.message));
  redirect('/login?message=Check%20your%20email%20to%20confirm%20your%20account.');
 }
 const {error}=await supabase.auth.signInWithPassword({email,password});
 if(error) redirect(destination(mode));
 redirect('/dashboard');
}

export async function signOut(){
 const supabase=await createClient();
 await supabase.auth.signOut();
 redirect('/');
}
