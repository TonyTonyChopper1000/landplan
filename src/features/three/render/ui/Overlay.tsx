// Sales-viewer overlay: editorial title, light panel, cameras, Find-a-plot, Refine sheet,
// plot card, mobile-first toolbar, sheets, WhatsApp, compass, legend and attributions.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { runChecks, tally } from '@/engine/checks';
import { plotPrice } from '@/engine/finance';
import { DIRS, type Dir8, type PlotStatus } from '@/engine/types';
import { area as fmtArea, money } from '@/lib/format';
import { TYPE_INFO, type ProjectDetails } from '@/features/projects/types';
import { useUi } from '@/state/ui';
import { useWorkspace } from '@/state/workspace';
import { istDate, sunPosition } from '../../sun';
import type { Built } from '../build';
import { defaultRoadName } from '../kit/ctx';
import { filterActive, matches, statusOf } from '../Plots';
import { useSun } from '../Stage';
import { walkInput } from '../Cameras';
import type { RenderProps } from '../RenderView';
import { EMPTY_FILTER, presetMinutes, STATUS_COLOURS, STATUS_LABEL, todayDoy, useRender, type CameraMode, type Filter, type LightPreset, type Sheet } from '../store';
import { ESRI_ATTRIBUTION } from '../context/Ground';
import { googleAttribution } from '../context/GoogleTiles';
import { brochure, captureStill, download, recordFilm, stampLine, type StampInfo } from './exports';

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const compassWord = (az: number) => COMPASS[Math.round(az / 45) % 8];
const fmtTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const STATUSES: PlotStatus[] = ['Available', 'Booked', 'Sold', 'Held', 'Mortgaged'];

function I({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  filter: 'M4 5h16M7 12h10M10 19h4',
  recenter: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  share: 'M16 6l-4-4-4 4M12 2v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  gallery: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  close: 'M6 6l12 12M18 6L6 18',
  play: 'M7 4l13 8-13 8z',
};

export function Overlay({
  built,
  props,
  lat,
  lon,
  context,
  geo,
  googleAvailable,
  onRenameRoad,
}: {
  built: Built;
  props: RenderProps;
  lat: number;
  lon: number;
  context: 'satellite' | '3d' | 'off';
  geo: boolean;
  googleAvailable: boolean;
  onRenameRoad: (id: string, t: string) => void;
}) {
  const s = useRender();
  const units = useUi((u) => u.units);
  const sun = useSun(lat, lon);
  const { ctx } = built;
  const params = ctx.layout.params;
  const d = props.details;
  const plots = ctx.layout.plots;
  const farmUnits = ctx.type === 'farm' ? 'acre' : units;
  const sel = plots.find((p) => p.no === s.selected) ?? null;
  const [gAttr, setGAttr] = useState(googleAttribution.text);
  useEffect(() => {
    const f = () => setGAttr(googleAttribution.text);
    googleAttribution.listeners.add(f);
    return () => void googleAttribution.listeners.delete(f);
  }, []);
  const attribution = context === '3d' && googleAvailable ? `Google${gAttr ? ` · ${gAttr}` : ''}` : context === 'satellite' && geo ? ESRI_ATTRIBUTION : '';
  const stamp: StampInfo = { name: props.name || 'LandPlan project', lpNumber: d.lpNumber, authority: d.authority, attribution };
  const subtitle = [TYPE_INFO[ctx.type].title, d.village || d.location, d.authority].filter(Boolean).join(' · ');
  const brand = d.brandColour && /^#[0-9a-f]{6}$/i.test(d.brandColour) ? d.brandColour : undefined;
  const shareBase = props.projectId ? `${window.location.origin}/view/${props.projectId}` : '';
  const wa = (no?: number) => {
    const text = no ? `Hi, I'm interested in plot ${no} at ${props.name}.${shareBase ? ` ${shareBase}?plot=${no}` : ''}` : `Hi, I'd like to know more about ${props.name}.${shareBase ? ` ${shareBase}` : ''}`;
    return `https://wa.me/${(d.developerWhatsApp ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  };
  const [toast, setToast] = useState<string | null>(null);
  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  };
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (label: string, f: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await f();
    } catch (e) {
      say((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const setPreset = (p: Exclude<LightPreset, 'custom'>) => s.set({ preset: p, minutes: presetMinutes(p, s.day, (dd, mm) => sunPosition(istDate(dd, mm), lat, lon).elevation) });
  const sheet = (x: Sheet) => s.set({ sheet: s.sheet === x ? null : x });
  const find = (raw: string) => {
    const no = Number(raw.replace(/\D/g, ''));
    if (!plots.some((p) => p.no === no)) return say(`No plot № ${raw}`);
    s.set({ selected: no, focus: { no, k: Date.now() }, sheet: null });
  };

  if (s.filming)
    return (
      <div className="rv-film-ui">
        <button className="rv-chip" onClick={() => s.set({ filming: false })}>
          Stop film
        </button>
      </div>
    );

  const nightLabel = sun.elevation < -0.5 ? `Sun ${Math.abs(sun.elevation).toFixed(0)}° below the horizon · Lights on` : `Sun ${sun.elevation.toFixed(0)}° up · ${compassWord(sun.azimuth)}`;

  return (
    <div className="rv-ui" style={brand ? ({ '--rv-brand': brand } as React.CSSProperties) : undefined}>
      {/* Editorial title */}
      <header className="rv-title">
        <h1 className="rv-serif">{props.name || 'Untitled project'}</h1>
        <div className="rv-sub">{subtitle}</div>
      </header>

      {/* Left menu */}
      <nav className="rv-menu" aria-label="Viewer sections">
        {(['plots', 'amenities', 'film'] as const).map((m) => (
          <button
            key={m}
            className={s.menu === m ? 'on' : ''}
            onClick={() => {
              if (m === 'film') s.set({ filming: true, menu: null, selected: null });
              else s.set({ menu: s.menu === m ? null : m });
            }}
          >
            {m === 'plots' ? 'Plots' : m === 'amenities' ? 'Amenities' : 'Film'}
          </button>
        ))}
        {s.menu === 'amenities' && (
          <ul className="rv-menu-list">
            {ctx.gardens.map((g, i) => (
              <li key={i}>
                <b>{g.name}</b>
                <span>{g.items.map((x) => x.toLowerCase()).join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
        {s.menu === 'plots' && <PlotsSummary built={built} />}
      </nav>

      {/* Find + Refine */}
      <div className="rv-find">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            find(new FormData(e.currentTarget).get('no') as string);
          }}
        >
          <input name="no" inputMode="numeric" placeholder="Find a plot №" aria-label="Find a plot number" />
        </form>
        <button className={`rv-chip ${filterActive(s.filter) ? 'on' : ''}`} onClick={() => sheet('filter')}>
          Refine
        </button>
      </div>

      {/* Light panel */}
      <section className="rv-light" aria-label="Light">
        <div className="rv-seg">
          {(['morning', 'noon', 'golden', 'night'] as const).map((p) => (
            <button key={p} className={s.preset === p ? 'on' : ''} onClick={() => setPreset(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <label className="rv-slider">
          <span>
            {s.day === todayDoy() ? 'Today' : istDate(s.day, 720).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} · {fmtTime(s.minutes)}
          </span>
          <input type="range" min={300} max={1260} step={5} value={s.minutes} onChange={(e) => s.set({ minutes: Number(e.target.value), preset: 'custom' })} aria-label="Time of day" />
          <input type="range" min={1} max={365} step={1} value={s.day} onChange={(e) => s.set({ day: Number(e.target.value), preset: 'custom' })} aria-label="Day of year" className="rv-day" />
        </label>
        <div className="rv-readout">{nightLabel}</div>
      </section>

      {/* Legend */}
      {s.layers.status && (
        <div className="rv-legend">
          {(['Available', 'Booked', 'Sold', 'Held'] as PlotStatus[]).map((k) => (
            <span key={k}>
              <i style={{ background: STATUS_COLOURS[k] }} />
              {STATUS_LABEL[k]}
            </span>
          ))}
        </div>
      )}

      {/* Cameras */}
      <div className="rv-cams" role="group" aria-label="Camera">
        {(['aerial', 'arrival', 'plan', 'walk'] as CameraMode[]).map((c) => (
          <button key={c} className={s.camera === c ? 'on' : ''} onClick={() => s.set({ camera: c })}>
            {c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="rv-toolbar" role="toolbar" aria-label="Viewer tools">
        {(
          [
            ['search', 'Find a plot', () => sheet('search')],
            ['layers', 'Layers', () => sheet('layers')],
            ['filter', 'Filter', () => sheet('filter')],
            ['recenter', 'Recenter', () => s.set({ camera: 'aerial', selected: null, focus: null, recenter: Date.now() })],
            ['share', 'Share', () => sheet('share')],
            ['gallery', 'Gallery', () => sheet('gallery')],
            ['download', 'Download', () => sheet('download')],
            ['info', 'Info', () => sheet('info')],
          ] as [keyof typeof ICONS, string, () => void][]
        ).map(([k, label, f]) => (
          <button key={k} onClick={f} aria-label={label} title={label} className={s.sheet === k ? 'on' : ''}>
            <I d={ICONS[k]} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Compass */}
      <div className="rv-compass" aria-label={`Heading ${Math.round(((s.heading % 360) + 360) % 360)}°`}>
        <div style={{ transform: `rotate(${-s.heading}deg)` }}>
          <span className="n">N</span>
          <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
            <path d="M20 4 L25 20 L20 17 L15 20 Z" fill="#e5484d" />
            <path d="M20 36 L25 20 L20 23 L15 20 Z" fill="#f2f2ee" />
          </svg>
        </div>
      </div>

      {/* WhatsApp */}
      <a className="rv-wa" href={wa(sel?.no)} target="_blank" rel="noreferrer" aria-label="Enquire on WhatsApp">
        <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
          <path fill="#fff" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 1.9.8 2.7.9 3.6.7.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.3.2-1.5l-.4-.4z" />
        </svg>
      </a>

      {/* Attribution */}
      {attribution && (
        <div className="rv-attr">
          {context === '3d' && <b className="rv-glogo">Google</b>}
          {context === '3d' ? gAttr : attribution}
        </div>
      )}

      {/* Walk joystick */}
      {s.camera === 'walk' && <WalkPad />}

      {/* Plot card */}
      {sel && (
        <article className="rv-card" aria-label={`Plot ${sel.no}`}>
          <button className="rv-x" onClick={() => s.set({ selected: null })} aria-label="Close">
            <I d={ICONS.close} size={16} />
          </button>
          {(() => {
            const st = statusOf(sel, params.inventory);
            return (
              <>
                <div className="rv-pill" style={{ background: STATUS_COLOURS[st] }}>
                  {STATUS_LABEL[st].toUpperCase()}
                </div>
                <div className="rv-card-no">
                  <span>Plot</span> {sel.no}
                </div>
                <dl>
                  <div>
                    <dt>Size</dt>
                    <dd>
                      {sel.width.toFixed(1)} × {sel.depth.toFixed(1)} m
                    </dd>
                  </div>
                  <div>
                    <dt>Area</dt>
                    <dd>
                      {fmtArea(sel.area, farmUnits)}
                      {farmUnits !== 'm2' && <small> · {Math.round(sel.area)} m²</small>}
                    </dd>
                  </div>
                  <div>
                    <dt>Facing</dt>
                    <dd>
                      {sel.facing}
                      {sel.corner ? ' · Corner' : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Price</dt>
                    <dd>{money(plotPrice(sel, params))}</dd>
                  </div>
                </dl>
                <div className="rv-card-actions">
                  <a className="rv-cta wa" href={wa(sel.no)} target="_blank" rel="noreferrer">
                    Enquire on WhatsApp
                  </a>
                  <button
                    className="rv-chip"
                    onClick={() => {
                      const url = shareBase ? `${shareBase}?plot=${sel.no}` : window.location.href;
                      if (navigator.share) navigator.share({ title: `${props.name} · Plot ${sel.no}`, url }).catch(() => undefined);
                      else navigator.clipboard?.writeText(url).then(() => say('Link copied'));
                    }}
                  >
                    Share this plot
                  </button>
                </div>
              </>
            );
          })()}
        </article>
      )}

      {/* Sheets */}
      {s.sheet && (
        <div className="rv-sheet" role="dialog" aria-label={s.sheet}>
          <div className="rv-sheet-head">
            <b>{{ filter: 'Refine', layers: 'Layers', info: 'Project info', gallery: 'Gallery', share: 'Share', download: 'Download', search: 'Find a plot' }[s.sheet]}</b>
            <button className="rv-x" onClick={() => s.set({ sheet: null })} aria-label="Close">
              <I d={ICONS.close} size={16} />
            </button>
          </div>
          {s.sheet === 'filter' && <FilterSheet built={built} />}
          {s.sheet === 'search' && (
            <form
              className="rv-search"
              onSubmit={(e) => {
                e.preventDefault();
                find(new FormData(e.currentTarget).get('no') as string);
              }}
            >
              <input name="no" autoFocus inputMode="numeric" placeholder="Plot number" aria-label="Plot number" />
              <button className="rv-cta">Go</button>
            </form>
          )}
          {s.sheet === 'layers' && <LayersSheet built={built} geo={geo} googleAvailable={googleAvailable} editable={!props.publicView} onRenameRoad={onRenameRoad} />}
          {s.sheet === 'info' && <InfoSheet built={built} props={props} />}
          {s.sheet === 'gallery' && (
            <div className="rv-gallery">
              {s.gallery.length === 0 && <p className="rv-muted">Stills and films you export appear here.</p>}
              {s.gallery.map((g) => (
                <button key={g.url} onClick={() => download(g.url, g.name)} title={`Download ${g.name}`}>
                  {g.name.endsWith('.webm') ? <video src={g.url} muted /> : <img src={g.url} alt={g.name} />}
                </button>
              ))}
            </div>
          )}
          {s.sheet === 'share' && (
            <div className="rv-share">
              {shareBase ? (
                <>
                  <Row label="Viewer link" value={shareBase + (sel ? `?plot=${sel.no}` : '')} onCopy={say} />
                  <Row label="Embed code" value={`<iframe src="${shareBase}" width="100%" height="560" style="border:0" allow="fullscreen" loading="lazy" title="${props.name}"></iframe>`} onCopy={say} area />
                </>
              ) : (
                <p className="rv-muted">Save this layout as a project to get a public viewer link and embed code.</p>
              )}
            </div>
          )}
          {s.sheet === 'download' && (
            <div className="rv-dl">
              <div className="rv-muted">Stamp: {stampLine(stamp)}</div>
              <div className="rv-row">
                {([1, 2, '4k'] as const).map((k) => (
                  <button key={k} className="rv-chip" disabled={!!busy} onClick={() => run('Rendering still', async () => {
                      const r = await captureStill(k, stamp);
                      download(r.url, r.name);
                    })}>
                    PNG {k === '4k' ? '4K' : `${k}×`}
                  </button>
                ))}
              </div>
              <button className="rv-chip" disabled={!!busy} onClick={() => run('Recording film', async () => {
                const r = await recordFilm(stamp);
                if (r) download(r.url, r.name);
              })}>
                Record film (28 s, 1080p WebM)
              </button>
              <button className="rv-chip" disabled={!!busy} onClick={() => run('Building brochure', () => brochure(built, stamp, subtitle))}>
                PDF brochure (view + schedule)
              </button>
              {busy && <div className="rv-muted">{busy}…</div>}
            </div>
          )}
        </div>
      )}
      {toast && <div className="rv-toast">{toast}</div>}
    </div>
  );
}

function Row({ label, value, onCopy, area }: { label: string; value: string; onCopy: (t: string) => void; area?: boolean }) {
  return (
    <label className="rv-copy">
      <span>{label}</span>
      {area ? <textarea readOnly value={value} rows={3} /> : <input readOnly value={value} />}
      <button className="rv-chip" onClick={(e) => (e.preventDefault(), navigator.clipboard?.writeText(value).then(() => onCopy('Copied')))}>
        Copy
      </button>
    </label>
  );
}

function PlotsSummary({ built }: { built: Built }) {
  const params = built.ctx.layout.params;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of built.ctx.layout.plots) {
      const st = statusOf(p, params.inventory);
      c[st] = (c[st] ?? 0) + 1;
    }
    return c;
  }, [built, params]);
  return (
    <ul className="rv-menu-list">
      {STATUSES.filter((k) => counts[k]).map((k) => (
        <li key={k}>
          <b style={{ color: STATUS_COLOURS[k] }}>{counts[k]}</b> <span>{STATUS_LABEL[k].toLowerCase()}</span>
        </li>
      ))}
    </ul>
  );
}

function FilterSheet({ built }: { built: Built }) {
  const current = useRender((s) => s.filter);
  const set = useRender((s) => s.set);
  const [f, setF] = useState<Filter>(current);
  const plots = built.ctx.layout.plots;
  const params = built.ctx.layout.params;
  const prices = useMemo(() => plots.map((p) => plotPrice(p, params)), [plots, params]);
  const lo = Math.floor(Math.min(...prices) / 1e5);
  const hi = Math.ceil(Math.max(...prices) / 1e5);
  const n = plots.filter((p) => matches(f, p, built)).length;
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const budget = f.budget ?? [lo * 1e5, hi * 1e5];
  return (
    <div className="rv-filter">
      <Group label="Status">
        {STATUSES.map((k) => (
          <label key={k} className="rv-check">
            <input type="checkbox" checked={f.status.includes(k)} onChange={() => setF({ ...f, status: toggle(f.status, k) })} />
            <i style={{ background: STATUS_COLOURS[k] }} />
            {STATUS_LABEL[k]}
          </label>
        ))}
      </Group>
      <Group label="Budget (₹ lakh)">
        <div className="rv-range">
          <input type="number" aria-label="Minimum budget in lakh" value={Math.round(budget[0] / 1e5)} min={lo} max={hi} onChange={(e) => setF({ ...f, budget: [Number(e.target.value) * 1e5, budget[1]] })} />
          <span>–</span>
          <input type="number" aria-label="Maximum budget in lakh" value={Math.round(budget[1] / 1e5)} min={lo} max={hi} onChange={(e) => setF({ ...f, budget: [budget[0], Number(e.target.value) * 1e5] })} />
        </div>
      </Group>
      <Group label="Size">
        {(['all', 'small', 'medium', 'large', 'custom'] as const).map((k) => (
          <button key={k} className={`rv-chip ${f.size === k ? 'on' : ''}`} onClick={() => setF({ ...f, size: k })}>
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
        {f.size === 'custom' && (
          <div className="rv-range">
            <input type="number" aria-label="Minimum area m²" placeholder="min m²" value={f.custom[0] || ''} onChange={(e) => setF({ ...f, custom: [Number(e.target.value), f.custom[1]] })} />
            <span>–</span>
            <input type="number" aria-label="Maximum area m²" placeholder="max m²" value={f.custom[1] || ''} onChange={(e) => setF({ ...f, custom: [f.custom[0], Number(e.target.value)] })} />
          </div>
        )}
      </Group>
      <Group label="Facing">
        {DIRS.map((k: Dir8) => (
          <button key={k} className={`rv-chip sm ${f.facing.includes(k) ? 'on' : ''}`} onClick={() => setF({ ...f, facing: toggle(f.facing, k) })}>
            {k}
          </button>
        ))}
      </Group>
      <Group label={`Road frontage ≥ ${f.frontage} m`}>
        <input type="range" min={0} max={Math.ceil(Math.max(...plots.map((p) => p.width)))} step={0.5} value={f.frontage} onChange={(e) => setF({ ...f, frontage: Number(e.target.value) })} aria-label="Minimum road frontage" />
      </Group>
      <label className="rv-check">
        <input type="checkbox" checked={f.cornerOnly} onChange={(e) => setF({ ...f, cornerOnly: e.target.checked })} /> Corner plots only
      </label>
      <div className="rv-sheet-foot">
        <button className="rv-chip" onClick={() => (setF(EMPTY_FILTER), set({ filter: EMPTY_FILTER }))}>
          Reset
        </button>
        <button className="rv-cta" onClick={() => set({ filter: { ...f, budget: f.budget }, sheet: null })}>
          Apply · {n} plots
        </button>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="rv-group">
      <legend>{label}</legend>
      <div>{children}</div>
    </fieldset>
  );
}

function LayersSheet({ built, geo, googleAvailable, editable, onRenameRoad }: { built: Built; geo: boolean; googleAvailable: boolean; editable: boolean; onRenameRoad: (id: string, t: string) => void }) {
  const layers = useRender((s) => s.layers);
  const quality = useRender((s) => s.quality);
  const blocked = useRender((s) => s.ultraBlocked);
  const set = useRender((s) => s.set);
  const L = (k: keyof typeof layers, v: boolean | string) => set({ layers: { ...layers, [k]: v } });
  return (
    <div className="rv-layers">
      {(
        [
          ['status', 'Status colours'],
          ['labels', 'Labels'],
          ['amenities', 'Amenities'],
          ...(built.type.ghosts ? [['future', 'Show future homes']] : []),
        ] as [keyof typeof layers, string][]
      ).map(([k, label]) => (
        <label key={k} className="rv-check">
          <input type="checkbox" checked={!!layers[k]} onChange={(e) => L(k, e.target.checked)} /> {label}
        </label>
      ))}
      <Group label="Surroundings">
        {(
          [
            ['satellite', 'Satellite'],
            ['3d', '3D surroundings'],
            ['off', 'Off'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`rv-chip ${layers.context === k ? 'on' : ''}`} disabled={(k === '3d' && !googleAvailable) || (k === 'satellite' && !geo)} onClick={() => L('context', k)}>
            {label}
          </button>
        ))}
        {!geo && <p className="rv-muted">Imagery needs a georeferenced parcel (traced on the map or imported). Showing procedural fields.</p>}
        {geo && !googleAvailable && <p className="rv-muted">3D surroundings need a Google Maps key (VITE_GOOGLE_MAPS_KEY).</p>}
      </Group>
      <Group label="Quality">
        {(['mobile', 'high', 'ultra'] as const).map((k) => (
          <button key={k} className={`rv-chip ${quality === k ? 'on' : ''}`} disabled={k === 'ultra' && !!blocked} onClick={() => set({ quality: k })}>
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
        {blocked && <p className="rv-muted">{blocked}</p>}
        {quality === 'ultra' && !blocked && <p className="rv-muted">Ultra path-traces a still whenever the view rests.</p>}
      </Group>
      {editable && built.ctx.layout.roadRuns.length > 0 && (
        <Group label="Road names">
          <div className="rv-roads">
            {built.ctx.layout.roadRuns.map((r, i) => (
              <input key={r.id} aria-label={`Name of road ${r.id}`} defaultValue={built.ctx.roadNames[r.id] ?? defaultRoadName(r, i)} onBlur={(e) => e.target.value !== (built.ctx.roadNames[r.id] ?? defaultRoadName(r, i)) && onRenameRoad(r.id, e.target.value)} />
            ))}
          </div>
        </Group>
      )}
    </div>
  );
}

function InfoSheet({ built, props }: { built: Built; props: RenderProps }) {
  const L = built.ctx.layout;
  const d = props.details;
  const t = useMemo(() => tally(runChecks(L)), [L]);
  const meta = useWorkspace((s) => s.meta);
  const editable = !props.publicView && !!meta;
  const patch = (p: Partial<ProjectDetails>) => meta && useWorkspace.setState({ meta: { ...meta, details: { ...meta.details, ...p } } });
  const rows: [string, string][] = [
    ['Type', TYPE_INFO[built.ctx.type].title],
    ['Location', [d.village, d.location].filter(Boolean).join(', ') || '—'],
    ['Authority', d.authority ?? L.params.site.authority],
    ['Survey nos.', d.surveyNos || L.params.site.surveyNos || '—'],
    ['LP number', d.lpNumber || 'Not yet approved'],
    ['Gross area', fmtArea(L.gross, 'acre')],
    ['Plots', `${L.plots.length} · ${((L.plotted / L.gross) * 100).toFixed(1)}% saleable`],
    ['Open space', `${((L.openArea / L.gross) * 100).toFixed(1)}%`],
  ];
  return (
    <div className="rv-info">
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="rv-compliance">
        <b>Compliance summary</b>
        <span className="ok">{t.verified} verified</span>
        <span className={t.failing ? 'bad' : ''}>{t.failing} failing</span>
        <span>{t.conflict} need a rule choice</span>
        <span>{t.notChecked} not checked</span>
        <p className="rv-muted">Automated checks against {L.params.site.authority} / GO Ms 105 rules. A yield study, not a submission drawing.</p>
      </div>
      {editable && (
        <Group label="Sales viewer settings">
          <label className="rv-copy">
            <span>Developer WhatsApp</span>
            <input defaultValue={d.developerWhatsApp ?? ''} placeholder="919876543210" inputMode="tel" onBlur={(e) => patch({ developerWhatsApp: e.target.value.replace(/\D/g, '').slice(0, 15) })} />
          </label>
          <label className="rv-copy">
            <span>LP number</span>
            <input defaultValue={d.lpNumber ?? ''} onBlur={(e) => patch({ lpNumber: e.target.value.slice(0, 60) })} />
          </label>
          <label className="rv-copy">
            <span>Brand colour</span>
            <input type="color" defaultValue={d.brandColour ?? '#c8553d'} onChange={(e) => patch({ brandColour: e.target.value })} />
          </label>
        </Group>
      )}
    </div>
  );
}

function WalkPad() {
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  useEffect(() => {
    // Drag anywhere (outside the pad) to look around.
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.rv-ui button, .rv-ui input, .rv-pad, .rv-sheet')) return;
      last = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      walkInput.yaw -= (e.clientX - last.x) * 0.004;
      walkInput.pitch = Math.max(-0.9, Math.min(0.9, walkInput.pitch - (e.clientY - last.y) * 0.003));
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => (last = null);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      walkInput.x = walkInput.y = 0;
    };
  }, []);
  const onMove = (e: React.PointerEvent) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const r = ref.current!.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / (r.width / 2)));
    const y = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / (r.height / 2)));
    walkInput.x = x;
    walkInput.y = -y;
    setKnob({ x, y });
  };
  const stop = () => {
    walkInput.x = walkInput.y = 0;
    setKnob({ x: 0, y: 0 });
  };
  return (
    <div className="rv-pad" ref={ref} onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), onMove(e))} onPointerMove={onMove} onPointerUp={stop} onPointerCancel={stop} aria-label="Walk joystick">
      <i style={{ transform: `translate(${knob.x * 28}px, ${knob.y * 28}px)` }} />
      <span className="rv-pad-hint">WASD / drag to look</span>
    </div>
  );
}
