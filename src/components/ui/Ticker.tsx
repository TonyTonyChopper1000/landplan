import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

/** Rolling number: animates from the previous value to the new one in under 400 ms. */
export function Ticker({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      if (ref.current) ref.current.textContent = format(value);
      return;
    }
    const c = animate(mv, value, {
      duration: 0.35,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => c.stop();
  }, [value, format, mv, reduce]);
  return (
    <span ref={ref} className="num">
      {format(value)}
    </span>
  );
}
