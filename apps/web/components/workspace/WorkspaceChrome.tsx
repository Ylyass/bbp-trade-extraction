'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Icon} from '@/components/Icon';
import {signOut} from '@/app/login/actions';
import type {ReactNode} from 'react';
import type {Role} from '@/lib/workspace';

const baseItems = [
  {href: '/dashboard', label: 'Overview', icon: 'home' as const},
  {href: '/dashboard/accounts', label: 'Accounts', icon: 'wallet' as const},
  {href: '/dashboard/activity', label: 'Activity', icon: 'activity' as const},
];

function titleFor(pathname: string, role: Role) {
  if (pathname.startsWith('/dashboard/students')) return 'Students';
  if (pathname.startsWith('/dashboard/activity')) return 'Trade activity';
  if (pathname.startsWith('/dashboard/accounts')) return role === 'admin' ? 'Accounts' : 'My account';
  return role === 'admin' ? 'Mentor overview' : 'My workspace';
}

export function WorkspaceChrome({children, role, name}: {children: ReactNode; role: Role; name: string}) {
  const pathname = usePathname();
  const nav = role === 'admin' ? [...baseItems, {href: '/dashboard/students', label: 'Students', icon: 'users' as const}] : baseItems;
  const title = titleFor(pathname, role);
  return <main className="workspace-shell">
    <aside className="workspace-sidebar">
      <Link className="brand sidebar-brand" href="/dashboard" aria-label="BBP workspace home"><span className="brand-mark">BBP</span><b>BBP Desk</b></Link>
      <div className="workspace-person"><span className="user-initial">{name.slice(0, 1).toUpperCase()}</span><div><b>{name}</b><span>{role === 'admin' ? 'Mentor account' : 'Student account'}</span></div></div>
      <nav className="workspace-nav" aria-label="Workspace navigation">
        {nav.map((item) => <Link className={pathname === item.href ? 'active' : ''} href={item.href} key={item.href}><Icon name={item.icon}/>{item.label}</Link>)}
      </nav>
      <div className="sidebar-foot">
        <div className="read-only-note"><Icon name="shield" size={16}/><div><b>Read-only monitoring</b><span>BBP can never open or close a trade.</span></div></div>
        <form action={signOut}><button className="signout-button" type="submit"><Icon name="logout" size={17}/>Sign out</button></form>
      </div>
    </aside>
    <section className="workspace-stage">
      <header className="workspace-topbar"><div><span>{role === 'admin' ? 'MENTOR DESK' : 'STUDENT DESK'}</span><b>{title}</b></div><div className="topbar-person"><span className={role === 'admin' ? 'role-badge mentor' : 'role-badge'}>{role === 'admin' ? 'Mentor' : 'Student'}</span><span className="topbar-initial">{name.slice(0, 1).toUpperCase()}</span></div></header>
      {children}
    </section>
    <nav className="mobile-dock" aria-label="Workspace navigation">{nav.map((item) => <Link className={pathname === item.href ? 'active' : ''} href={item.href} key={item.href}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
  </main>;
}
