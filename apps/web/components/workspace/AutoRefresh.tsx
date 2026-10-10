'use client';

import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

export function AutoRefresh({everyMs = 30000}: {everyMs?: number}) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, everyMs);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [everyMs, router]);
  return null;
}