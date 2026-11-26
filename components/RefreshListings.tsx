'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RefreshListings({ fetchedAt, interval }: { fetchedAt: number; interval: number }) {
  const router = useRouter();

  useEffect(() => {
    const retryDelay = fetchedAt ? 60000 : 30000;
    let nextCheck = fetchedAt + interval;
    if (nextCheck <= Date.now()) nextCheck = Date.now() + retryDelay;
    const nextUtcDay = () => (Math.floor(Date.now() / 86400000) + 1) * 86400000;
    nextCheck = Math.min(nextCheck, nextUtcDay());
    let timer: ReturnType<typeof setTimeout>;

    function check() {
      clearTimeout(timer);
      if (document.visibilityState !== 'visible') return;
      if (Date.now() >= nextCheck) {
        nextCheck = Math.min(Date.now() + retryDelay, nextUtcDay());
        router.refresh();
      }
      timer = setTimeout(check, Math.max(0, nextCheck - Date.now()));
    }

    check();
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [fetchedAt, interval, router]);

  return null;
}
