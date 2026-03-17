import { useEffect, useRef } from 'react';
import { getCached, setCache } from '../utils/api';

export function useAutoFetch(key, fetchFn, interval, ttl) {
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const doFetch = async () => {
      const cached = getCached(key, ttl);
      if (cached) return cached;

      try {
        const data = await fetchFn();
        if (data && mounted.current) {
          setCache(key, data);
        }
        return data;
      } catch (e) {
        console.warn(`Fetch failed for ${key}:`, e.message);
        const fallback = getCached(key, Infinity);
        return fallback;
      }
    };

    doFetch();
    const id = setInterval(doFetch, interval);

    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [key, interval, ttl]);
}
