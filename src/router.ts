import { useSyncExternalStore } from 'react';

/** Tiny history router: '/', '/projects', '/projects/new', '/projects/:id'. The hash stays free for share links. */
export type Route = { name: 'landing' } | { name: 'projects' } | { name: 'new' } | { name: 'workspace'; id: string } | { name: 'scratch' } | { name: 'docs'; section?: string };

export function parse(path: string): Route {
  const p = path.replace(/\/+$/, '') || '/';
  if (p === '/') return { name: 'landing' };
  if (p === '/projects') return { name: 'projects' };
  if (p === '/projects/new') return { name: 'new' };
  if (p === '/studio') return { name: 'scratch' };
  if (p === '/docs') return { name: 'docs' };
  const d = /^\/docs\/([\w-]+)$/.exec(p);
  if (d) return { name: 'docs', section: d[1] };
  const m = /^\/projects\/([\w-]+)$/.exec(p);
  if (m) return { name: 'workspace', id: m[1] };
  return { name: 'landing' };
}

const listeners = new Set<() => void>();
window.addEventListener('popstate', () => listeners.forEach((l) => l()));

export function navigate(to: string, opts: { replace?: boolean; keepHash?: boolean } = {}): void {
  const url = to + (opts.keepHash ? window.location.hash : '');
  if (opts.replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

export function useRoute(): Route {
  const path = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => window.location.pathname,
  );
  return parse(path);
}

/** Anchor props that route without a full reload. */
export function link(to: string) {
  return {
    href: to,
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(to);
    },
  };
}
