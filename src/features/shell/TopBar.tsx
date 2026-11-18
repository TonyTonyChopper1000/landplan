import { useStore } from 'zustand';
import { useProject, undo, redo, setSection } from '@/state/project';
import { useUi } from '@/state/ui';
import { copyShare, go105, optimize, regenerate, toggleTheme } from '@/state/actions';
import { PROFILES } from '@/rules/profiles';
import type { Authority } from '@/engine/types';
import { Button } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { useMedia } from '@/lib/useMedia';
import { t } from '@/i18n';
import { ComplianceRing } from './ComplianceRing';
import { ScenarioSwitcher } from './ScenarioSwitcher';

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect x="1" y="1" width="20" height="20" rx="3" fill="none" stroke="var(--blueprint)" />
      <path d="M5 16 9 6l4 3 4-3v10z" fill="none" stroke="var(--blueprint)" />
      <circle cx="17" cy="6" r="1.8" fill="var(--signal)" />
    </svg>
  );
}

export function TopBar({ savedAt }: { savedAt: number | null }) {
  const name = useProject((s) => s.params.site.projectName);
  const authority = useProject((s) => s.params.site.authority);
  const mode = useProject((s) => s.params.mode);
  const theme = useUi((s) => s.theme);
  const canUndo = useStore(useProject.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProject.temporal, (s) => s.futureStates.length > 0);
  const md = useMedia('(min-width: 768px)');
  return (
    <header className="flex h-12 items-center gap-2 border-b border-line bg-asphalt-2 px-3">
      <span className="hidden sm:block"><Logo /></span>
      <div className="flex min-w-0 flex-col leading-tight">
        <input
          aria-label="Project name"
          value={name}
          onChange={(e) => setSection('site', { projectName: e.target.value })}
          className="w-[7.5rem] min-w-0 truncate rounded-[3px] bg-transparent px-1 text-[13px] font-medium outline-none hover:bg-asphalt-3 focus:bg-asphalt-3 md:w-[14rem]"
        />
        <span className="caps hidden px-1 text-[10px] text-lane-dim md:block">
          {mode === 'rules' ? 'Rule-aware · GO 105' : 'v1 parity engine'}
          {savedAt && <span className="ml-1 normal-case">· saved</span>}
        </span>
      </div>
      {md && (
        <label className="relative" title={PROFILES[authority].label}>
          <span className="sr-only">Authority profile</span>
          <select
            value={authority}
            onChange={(e) => setSection('site', { authority: e.target.value as Authority })}
            className="mono h-6 appearance-none rounded-[3px] border border-blueprint/50 bg-blueprint/10 px-2 text-[11px] font-semibold text-blueprint outline-none"
          >
            {Object.values(PROFILES).map((p) => (
              <option key={p.id} value={p.id} className="bg-asphalt-2 text-lane">
                {p.short}
              </option>
            ))}
          </select>
        </label>
      )}
      {md && <ScenarioSwitcher />}
      <div className="flex-1" />
      <ComplianceRing />
      <div className="hidden items-center lg:flex">
        <Button title={t('top.undo')} onClick={undo} disabled={!canUndo} size="sm">
          <Icon name="undo" />
        </Button>
        <Button title={t('top.redo')} onClick={redo} disabled={!canRedo} size="sm">
          <Icon name="redo" />
        </Button>
      </div>
      {md && (
        <span className="hidden xl:contents">
          <Button variant="outline" onClick={go105} title={t('top.go105')}>
            <Icon name="shield" size={14} /> GO 105
          </Button>
        </span>
      )}
      <Button variant="outline" onClick={regenerate} title={`${t('top.generate')} (G)`}>
        <Icon name="play" size={13} />
        <span className="hidden sm:inline">{t('top.generate')}</span>
      </Button>
      <Button variant="signal" onClick={optimize} title={`${t('top.optimize')} (O)`}>
        <Icon name="bolt" size={14} />
        <span className="hidden sm:inline">{t('top.optimize')}</span>
      </Button>
      <span className="hidden md:contents"><Button variant="ghost" onClick={() => useUi.setState({ drawer: 'export' })} title={t('top.export')}>
        <Icon name="download" />
        <span className="hidden lg:inline">{t('top.export')}</span>
      </Button></span>
      <span className="hidden md:contents"><Button variant="ghost" onClick={copyShare} title={t('top.share')}>
        <Icon name="link" />
      </Button></span>
      <span className="hidden md:contents"><Button variant="ghost" onClick={() => useUi.setState({ palette: true })} title="Command palette (⌘K)">
        <span className="mono text-[11px]">⌘K</span>
      </Button></span>
      <Button variant="ghost" onClick={() => useUi.setState({ drawer: 'assistant' })} title={t('top.assistant')}>
        <Icon name="chat" />
      </Button>
      <Button variant="ghost" onClick={toggleTheme} title={t('top.theme')}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </Button>
    </header>
  );
}
