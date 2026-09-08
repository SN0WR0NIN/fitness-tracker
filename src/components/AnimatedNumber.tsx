'use client';

import { useEffect, useRef, useState } from 'react';

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

export default function AnimatedNumber({
  value,
  decimals = 1,
  duration = 650,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedNumberProps) {
  const previousValue = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const from = previousValue.current;
    previousValue.current = value;

    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === value) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const delta = value - from;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + delta * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return <span className={className}>{prefix}{displayValue.toFixed(decimals)}{suffix}</span>;
}
