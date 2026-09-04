'use client';

import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';

type PublicConfig = { maintenanceMode?: boolean; maintenanceMessage?: string };

export default function AppStatusBanner() {
  const [config, setConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setConfig(data))
      .catch((error) => { if (error instanceof Error && error.name !== 'AbortError') console.error('Unable to load app status:', error); });
    return () => controller.abort();
  }, []);

  if (!config?.maintenanceMode) return null;
  return <div role="status" className="border-b border-amber-300/20 bg-amber-300/10 px-4 py-2.5 text-amber-950 dark:text-amber-100"><div className="mx-auto flex max-w-7xl items-start gap-3 text-sm"><Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><p><strong>Maintenance mode:</strong> {config.maintenanceMessage || 'New activity submissions are temporarily paused.'}</p></div></div>;
}
