'use client';

import Script from 'next/script';
import { useCallback, useEffect, useId, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

export function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const id = useId();

  const render = useCallback(() => {
    if (!siteKey || !ref.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      theme: 'dark',
      language: 'pt-br',
      callback: onToken,
      'expired-callback': () => onToken(''),
      'error-callback': () => onToken(''),
    });
  }, [onToken, siteKey]);

  useEffect(() => () => {
    if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
  }, []);

  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render} />
      <div id={`captcha-${id}`} ref={ref} className="min-h-[65px] overflow-hidden" aria-label="Verificação de segurança" />
    </>
  );
}
