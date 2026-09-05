'use client';

import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';

export default function WebVitalsReporter() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    const payload = JSON.stringify({
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      rating: metric.rating,
      id: metric.id,
      navigationType: metric.navigationType,
      pathname,
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/telemetry/vitals', new Blob([payload], { type: 'application/json' }));
        return;
      }
      void fetch('/api/telemetry/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    } catch {
      // Performance reporting must never interfere with the app experience.
    }
  });

  return null;
}
