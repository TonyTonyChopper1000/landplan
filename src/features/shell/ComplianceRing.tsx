import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useDerived } from '@/state/derived';
import { useUi } from '@/state/ui';
import { t } from '@/i18n';

const SEGS = [
  { key: 'verified', color: 'var(--sign-green)', label: 'ring.verified' },
  { key: 'failing', color: 'var(--brake)', label: 'ring.failing' },
  { key: 'conflict', color: 'var(--conflict)', label: 'ring.conflict' },
  { key: 'notChecked', color: 'var(--unk)', label: 'ring.notChecked' },
] as const;

export function ComplianceRing({ size = 30 }: { size?: number }) {
  const tally = useDerived((s) => s.tally);
  const reduce = useReducedMotion();
  const prevFailing = useRef(tally.failing);
  const [shake, setShake] = useState(0);
  useEffect(() => {
    if (tally.failing > prevFailing.current) setShake((n) => n + 1);
    prevFailing.current = tally.failing;
  }, [tally.failing]);
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const total = Math.max(1, tally.total);
  const label = SEGS.map((s) => `${tally[s.key]} ${t(s.label).toLowerCase()}`).join(', ');
  return (
    <button
      type="button"
      onClick={() => useUi.setState({ tab: 'feasibility' })}
      className="flex items-center gap-2 rounded-[4px] px-1.5 py-1 hover:bg-asphalt-3"
      aria-label={`Compliance: ${label}. Open Feasibility.`}
      title={label}
    >
      <motion.svg
        key={shake}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        animate={shake && !reduce ? { x: [0, -3, 3, -2, 2, 0] } : undefined}
        transition={{ duration: 0.35 }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} />
        {SEGS.map((s) => {
          const len = (tally[s.key] / total) * c;
          const off = acc;
          acc += len;
          if (!len) return null;
          return (
            <motion.circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={4}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              initial={false}
              animate={{ strokeDasharray: `${Math.max(0, len - 1.2)} ${c}`, strokeDashoffset: -off }}
              transition={{ duration: reduce ? 0 : 0.38, ease: [0.2, 0.8, 0.2, 1] }}
            />
          );
        })}
      </motion.svg>
      <span className="num hidden text-[11px] leading-tight text-lane-dim xl:block">
        <span className="text-green-ink">{tally.verified}</span>·<span className="text-brake-ink">{tally.failing}</span>·
        <span className="text-blueprint">{tally.conflict}</span>·<span>{tally.notChecked}</span>
      </span>
    </button>
  );
}
