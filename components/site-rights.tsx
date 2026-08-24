export const RIGHTS_HOLDER = 'Sucegan Tech';
export const COPYRIGHT_YEAR = new Date().getFullYear();
export const COPYRIGHT_NOTICE = `© ${COPYRIGHT_YEAR} ${RIGHTS_HOLDER}. Todos os direitos reservados.`;

export function SiteRights({ className = '' }: { className?: string }) {
  return (
    <footer className={`text-center text-[11px] leading-5 text-zinc-600 ${className}`.trim()}>
      <p>{COPYRIGHT_NOTICE}</p>
      <p>Agenda Brasil é uma plataforma desenvolvida e mantida pela {RIGHTS_HOLDER}.</p>
    </footer>
  );
}
