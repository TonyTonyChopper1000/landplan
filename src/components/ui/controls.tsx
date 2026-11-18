import * as Slider from '@radix-ui/react-slider';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

export function Button({
  children,
  onClick,
  variant = 'ghost',
  size = 'md',
  title,
  disabled,
  className,
  type = 'button',
  'aria-pressed': pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'ghost' | 'signal' | 'outline' | 'blue';
  size?: 'sm' | 'md';
  title?: string;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  'aria-pressed'?: boolean;
}) {
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-[4px] whitespace-nowrap transition-colors disabled:opacity-40',
        size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-[13px]',
        variant === 'ghost' && 'text-lane-dim hover:bg-asphalt-3 hover:text-lane',
        variant === 'outline' && 'border border-line text-lane hover:border-lane-dim',
        variant === 'signal' && 'bg-signal font-medium text-[#140800] shadow-[var(--glow-signal)] hover:brightness-110',
        variant === 'blue' && 'border border-blueprint/50 text-blueprint shadow-[var(--glow-blue)] hover:bg-blueprint/10',
        pressed && 'bg-asphalt-3 text-lane',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Caps({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('caps text-[11px] text-lane-dim', className)}>{children}</div>;
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  unit,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  label: string;
  className?: string;
}) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(Math.round(value * 1000) / 1000)), [value]);
  const commit = () => {
    const v = Number(txt);
    if (Number.isFinite(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
    else setTxt(String(value));
  };
  return (
    <label className={cx('flex h-7 items-center rounded-[4px] border border-line bg-asphalt focus-within:border-signal', className)}>
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        className="num w-full min-w-0 bg-transparent px-2 text-right text-[12px] text-lane outline-none"
        value={txt}
        step={step}
        min={min}
        max={max}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      {unit && <span className="num pr-2 text-[11px] text-lane-dim">{unit}</span>}
    </label>
  );
}

/** Slider + number input pair; updates live (layout is debounced downstream). */
export function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[1fr_92px] items-center gap-x-3 gap-y-1.5 py-1.5">
      <label htmlFor={id} className="text-[12px] text-lane">
        {label}
        {hint && <span className="ml-1 text-[11px] text-lane-dim">{hint}</span>}
      </label>
      <NumberInput label={label} value={value} onChange={onChange} step={step} min={min} max={max} unit={unit} />
      <Slider.Root
        id={id}
        className="relative col-span-2 flex h-4 touch-none items-center select-none"
        value={[Math.min(max, Math.max(min, value))]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
      >
        <Slider.Track className="relative h-[2px] grow bg-line">
          <Slider.Range className="absolute h-full bg-blueprint" />
        </Slider.Track>
        <Slider.Thumb className="block h-3 w-3 rotate-45 border border-blueprint bg-asphalt shadow-[var(--glow-blue)] outline-none focus-visible:border-signal focus-visible:outline-2 focus-visible:outline-signal" />
      </Slider.Root>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-[12px]">
      <span>
        {label}
        {hint && <span className="block text-[11px] text-lane-dim">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-4 w-7 shrink-0 rounded-full border transition-colors',
          checked ? 'border-signal bg-signal/25' : 'border-line bg-asphalt',
        )}
      >
        <span
          className={cx(
            'absolute top-[2px] h-2.5 w-2.5 rounded-full transition-all',
            checked ? 'left-[13px] bg-signal' : 'left-[2px] bg-lane-dim',
          )}
        />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[4px] border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-6 flex-1 rounded-[3px] px-2 text-[11px] whitespace-nowrap transition-colors',
            value === o.value ? 'bg-asphalt-3 text-lane' : 'text-lane-dim hover:text-lane',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <label className="relative flex h-7 items-center rounded-[4px] border border-line bg-asphalt focus-within:border-signal">
      <span className="sr-only">{label}</span>
      <select
        className="h-full w-full appearance-none bg-transparent pr-6 pl-2 text-[12px] text-lane outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-asphalt-2">
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron" size={12} className="pointer-events-none absolute right-2 rotate-90 text-lane-dim" />
    </label>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-1.5 text-[12px]">
      <span>{label}</span>
      <div className="min-w-[92px]">{children}</div>
    </div>
  );
}

export function Badge({ children, tone = 'dim', className }: { children: ReactNode; tone?: 'dim' | 'green' | 'red' | 'blue' | 'signal' | 'unk'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-5 items-center gap-1 rounded-[3px] border px-1.5 text-[10.5px] leading-none whitespace-nowrap',
        tone === 'dim' && 'border-line text-lane-dim',
        tone === 'green' && 'border-sign-green/60 text-green-ink',
        tone === 'red' && 'border-brake/60 text-brake-ink',
        tone === 'blue' && 'border-blueprint/50 text-blueprint',
        tone === 'signal' && 'border-signal/60 text-signal-ink',
        tone === 'unk' && 'border-unk text-lane-dim',
        className,
      )}
    >
      {children}
    </span>
  );
}
