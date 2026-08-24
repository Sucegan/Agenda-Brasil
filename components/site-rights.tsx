export const RIGHTS_HOLDER = 'Sucegan Tech';
export const COPYRIGHT_NOTICE = `© 2026 ${RIGHTS_HOLDER}. Todos os direitos reservados.`;

export function SiteRights({ className = '' }: { className?: string }) {
  return (
    <footer className={`text-center text-[11px] leading-5 text-zinc-600 ${className}`.trim()}>
      <p>{COPYRIGHT_NOTICE}</p>
      <p>Agenda Brasil é uma plataforma desenvolvida e mantida pela Sucegan Tech.</p>
    </footer>
  );
}
