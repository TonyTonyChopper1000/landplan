import { useSyncExternalStore } from 'react';

export function useMedia(q: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(q).matches,
    () => false,
  );
}
export const useWide = () => useMedia('(min-width: 1280px)');
export const useMobile = () => useMedia('(max-width: 767px)');
