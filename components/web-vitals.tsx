'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (navigator.webdriver) return;
    const body = JSON.stringify({
      tipo: 'web_vital',
      rota: window.location.pathname,
      mensagem: metric.name,
      contexto: { id: metric.id, value: metric.value, rating: metric.rating, navigationType: metric.navigationType },
    });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/observability', body);
    else void fetch('/api/observability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  });
  return null;
}
