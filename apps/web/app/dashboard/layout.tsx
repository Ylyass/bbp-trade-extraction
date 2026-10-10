import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {WorkspaceChrome} from '@/components/workspace/WorkspaceChrome';
import {AutoRefresh} from '@/components/workspace/AutoRefresh';

export default async function DashboardLayout({children}: Readonly<{children: React.ReactNode}>) {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const {data: profile} = await supabase.from('profiles').select('name,role').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/login?error=profile');
  const role = profile.role === 'admin' ? 'admin' : 'student';
  const name = profile.name || user.email?.split('@')[0] || 'Trader';
  return <WorkspaceChrome role={role} name={name}><AutoRefresh />{children}</WorkspaceChrome>;
}