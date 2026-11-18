import { useEffect } from 'react';
import { useUi, TABS } from '@/state/ui';
import { undo, redo } from '@/state/project';
import { optimize, regenerate, rotateGrid } from '@/state/actions';

export function useShortcuts() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest('input, textarea, select, [contenteditable=true], [cmdk-root]');
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useUi.setState((s) => ({ palette: !s.palette }));
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'g') regenerate();
      else if (k === 'o') optimize();
      else if (k === '[') rotateGrid(-5);
      else if (k === ']') rotateGrid(5);
      else if (k === 'l') useUi.setState({ tool: 'lasso' });
      else if (k === 'v') useUi.setState({ tool: 'select' });
      else if (/^[1-8]$/.test(k)) useUi.setState({ tab: TABS[Number(k) - 1] });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}
