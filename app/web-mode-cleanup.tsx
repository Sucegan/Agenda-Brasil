'use client';

import { useEffect } from 'react';

const LEGACY_CACHE_PREFIX = 'agenda-brasil-offline-';

export function WebModeCleanup() {
  useEffect(() => {
    localStorage.removeItem('agenda-install-dismissed');

    const cleanup = async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => name.startsWith(LEGACY_CACHE_PREFIX))
            .map((name) => caches.delete(name)),
        );
      }
    };

    void cleanup().catch(() => {
      // A limpeza é progressiva e nunca deve impedir o uso do site.
    });
  }, []);

  return null;
}
