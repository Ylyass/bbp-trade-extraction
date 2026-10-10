import type {ReactNode} from 'react';

type IconName =
  | 'activity'
  | 'barChart'
  | 'book'
  | 'check'
  | 'chevronDown'
  | 'clock'
  | 'copy'
  | 'home'
  | 'logout'
  | 'menu'
  | 'shield'
  | 'spark'
  | 'trendingUp'
  | 'user'
  | 'users'
  | 'wallet';

type IconProps = {name: IconName; size?: number; className?: string};

const paths: Record<IconName, ReactNode> = {
  activity: <><path d="M3 12h3l2.2-6 4.2 12L15 12h6" /></>,
  barChart: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></>,
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-7h6v7" /></>,
  logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 3v18" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  spark: <path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z" />,
  trendingUp: <><path d="m4 16 5-5 3 3 7-8" /><path d="M14 6h5v5" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /></>,
  users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7" r="3.5" /><path d="M17 11a3 3 0 0 0 0-6" /><path d="M21 20v-1.5a4 4 0 0 0-2.7-3.8" /></>,
  wallet: <><path d="M4 7.5V6a2 2 0 0 1 2-2h12" /><path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M17 13h.01" /></>,
};

export function Icon({name, size = 18, className}: IconProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
