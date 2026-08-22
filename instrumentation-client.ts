function report(tipo: 'erro_cliente', mensagem: string, contexto: Record<string, unknown>) {
  if (navigator.webdriver) return;
  const body = JSON.stringify({ tipo, rota: window.location.pathname, mensagem, contexto });
  if (navigator.sendBeacon) navigator.sendBeacon('/api/observability', body);
  else void fetch('/api/observability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
}

window.addEventListener('error', (event) => {
  report('erro_cliente', event.message || 'Erro não identificado', {
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error instanceof Error ? event.error.stack : undefined,
    userAgent: navigator.userAgent,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  report('erro_cliente', reason.message, { stack: reason.stack, source: 'unhandledrejection', userAgent: navigator.userAgent });
});
