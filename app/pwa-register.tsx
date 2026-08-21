'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Safari can keep an older worker for longer than desktop browsers. Do
      // not reuse the HTTP cache when checking the small offline-only worker.
      void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => undefined);
    }
  }, []);

  return null;
}
