'use client';

import { useEffect, useState } from 'react';

export default function SiteBrandName() {
  const [name, setName] = useState('KG Stay Active Challenge');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.challengeName) setName(data.challengeName); })
      .catch((error) => { if (error instanceof Error && error.name !== 'AbortError') console.error('Unable to load challenge name:', error); });
    return () => controller.abort();
  }, []);
  return <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{name}</span>;
}
