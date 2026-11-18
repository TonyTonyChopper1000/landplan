import type { ReactNode } from 'react';
import { link } from '@/router';
import { useUi } from '@/state/ui';
import { toggleTheme } from '@/state/actions';
import { Icon } from '@/components/ui/Icon';

export function Wordmark() {
  return (
    <a {...link('/')} className="flex items-center gap-2" aria-label="LandPlan Studio home">
      <svg width="24" height="24" viewBox="0 0 22 22" aria-hidden>
        <rect x="1" y="1" width="20" height="20" rx="3" fill="none" stroke="var(--blueprint)" />
        <path d="M5 16 9 6l4 3 4-3v10z" fill="none" stroke="var(--blueprint)" />
        <circle cx="17" cy="6" r="1.8" fill="var(--signal)" />
      </svg>
      <span className="text-[14px] font-semibold tracking-tight">
        LandPlan <span className="text-lane-dim">Studio</span>
      </span>
    </a>
  );
}

export function PageChrome({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const theme = useUi((s) => s.theme);
  return (
    <div className="min-h-full overflow-y-auto bg-asphalt">
      <header className="sticky top-0 z-30 border-b border-line bg-asphalt/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 md:px-6">
          <Wordmark />
          <div className="flex-1" />
          {right}
          <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className="rounded-[4px] p-2 text-lane-dim hover:bg-asphalt-3 hover:text-lane">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
