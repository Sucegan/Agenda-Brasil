'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing, CalendarClock, Copy, CreditCard, Link2, Palette, ShieldCheck } from 'lucide-react';
import { brandIconLabels, BusinessBrandIcon, businessBrandStyle } from '@/components/business-brand';
import { supabase } from '@/lib/supabase';
import type { Barbershop, BrandIcon } from '@/lib/database.types';

async function copy(value: string) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return true; } catch { /* Safari fallback below. */ }
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, value.length);
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

function SettingsToggle({ label, checked, update }: { label: string; checked: boolean; update: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => update(event.target.checked)} className="h-5 w-5 accent-emerald-500" /></label>;
}

export function BusinessGrowthSettings({ business, onUpdated }: { business: Barbershop; onUpdated: () => Promise<void> }) {
  const [slug, setSlug] = useState(business.slug);
  const [publicBooking, setPublicBooking] = useState(business.agendamento_publico);
  const [cancellationHours, setCancellationHours] = useState(String(business.cancelamento_horas));
  const [deposit, setDeposit] = useState(String(business.sinal_percentual));
  const [pixKey, setPixKey] = useState(business.pix_chave ?? '');
  const [pixOwner, setPixOwner] = useState(business.pix_beneficiario ?? '');
  const [email, setEmail] = useState(business.lembrete_email);
  const [whatsapp, setWhatsapp] = useState(business.lembrete_whatsapp);
  const [noShows, setNoShows] = useState(String(business.bloquear_apos_faltas));
  const [blockDays, setBlockDays] = useState(String(business.dias_bloqueio));
  const [legalOwner, setLegalOwner] = useState(business.responsavel_legal ?? '');
  const [legalDocument, setLegalDocument] = useState(business.documento_legal ?? '');
  const [privacyEmail, setPrivacyEmail] = useState(business.email_privacidade ?? '');
  const [retentionMonths, setRetentionMonths] = useState(String(business.prazo_retencao_meses));
  const [primaryColor, setPrimaryColor] = useState(business.cor_primaria);
  const [secondaryColor, setSecondaryColor] = useState(business.cor_secundaria);
  const [brandIcon, setBrandIcon] = useState<BrandIcon>(business.icone);
  const [leadMinutes, setLeadMinutes] = useState(String(business.antecedencia_minutos));
  const [gridMinutes, setGridMinutes] = useState(String(business.intervalo_grade_minutos));
  const [bookingHorizon, setBookingHorizon] = useState(String(business.horizonte_agendamento_dias));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSlug(business.slug);
    setPublicBooking(business.agendamento_publico);
    setCancellationHours(String(business.cancelamento_horas));
    setDeposit(String(business.sinal_percentual));
    setPixKey(business.pix_chave ?? '');
    setPixOwner(business.pix_beneficiario ?? '');
    setEmail(business.lembrete_email);
    setWhatsapp(business.lembrete_whatsapp);
    setNoShows(String(business.bloquear_apos_faltas));
    setBlockDays(String(business.dias_bloqueio));
    setLegalOwner(business.responsavel_legal ?? '');
    setLegalDocument(business.documento_legal ?? '');
    setPrivacyEmail(business.email_privacidade ?? '');
    setRetentionMonths(String(business.prazo_retencao_meses));
    setPrimaryColor(business.cor_primaria);
    setSecondaryColor(business.cor_secundaria);
    setBrandIcon(business.icone);
    setLeadMinutes(String(business.antecedencia_minutos));
    setGridMinutes(String(business.intervalo_grade_minutos));
    setBookingHorizon(String(business.horizonte_agendamento_dias));
  }, [business]);
  const publicUrl = typeof window === 'undefined' ? `/agendar?estabelecimento=${slug}` : `${window.location.origin}/agendar?estabelecimento=${slug}`;

  const save = async () => {
    const depositNumber = Number(deposit);
    const cancellationNumber = Number(cancellationHours);
    const noShowsNumber = Number(noShows);
    const blockDaysNumber = Number(blockDays);
    const retentionNumber = Number(retentionMonths);
    const leadNumber = Number(leadMinutes);
    const gridNumber = Number(gridMinutes);
    const horizonNumber = Number(bookingHorizon);
    if (!Number.isFinite(depositNumber) || depositNumber < 0 || depositNumber > 100) return toast.error('Informe um sinal entre 0% e 100%.');
    if (depositNumber > 0 && (!pixKey.trim() || !pixOwner.trim())) return toast.error('Informe a chave e o beneficiário Pix para cobrar sinal.');
    if (!Number.isInteger(cancellationNumber) || cancellationNumber < 0 || cancellationNumber > 168) return toast.error('Informe um prazo de cancelamento entre 0 e 168 horas.');
    if (!Number.isInteger(noShowsNumber) || noShowsNumber < 0 || noShowsNumber > 20) return toast.error('Informe um limite de faltas entre 0 e 20.');
    if (!Number.isInteger(blockDaysNumber) || blockDaysNumber < 1 || blockDaysNumber > 365) return toast.error('Informe um bloqueio entre 1 e 365 dias.');
    if (!Number.isInteger(retentionNumber) || retentionNumber < 1 || retentionNumber > 120) return toast.error('Informe uma retenção entre 1 e 120 meses.');
    if (!/^#[0-9a-f]{6}$/i.test(primaryColor) || !/^#[0-9a-f]{6}$/i.test(secondaryColor)) return toast.error('Escolha cores válidas para a marca.');
    if (!Number.isInteger(leadNumber) || leadNumber < 0 || leadNumber > 1440) return toast.error('A antecedência deve ficar entre 0 e 1.440 minutos.');
    if (!Number.isInteger(gridNumber) || gridNumber < 5 || gridNumber > 60 || gridNumber % 5 !== 0) return toast.error('O intervalo da grade deve ser múltiplo de 5, entre 5 e 60 minutos.');
    if (!Number.isInteger(horizonNumber) || horizonNumber < 7 || horizonNumber > 365) return toast.error('A abertura da agenda deve ficar entre 7 e 365 dias.');
    setSaving(true);
    const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error } = await supabase.from('barbearias').update({
      slug: normalizedSlug,
      agendamento_publico: publicBooking,
      cancelamento_horas: cancellationNumber,
      sinal_percentual: depositNumber,
      pix_chave: pixKey.trim() || null,
      pix_beneficiario: pixOwner.trim() || null,
      lembrete_email: email,
      lembrete_whatsapp: whatsapp,
      lembrete_push: false,
      bloquear_apos_faltas: noShowsNumber,
      dias_bloqueio: blockDaysNumber,
      responsavel_legal: legalOwner.trim() || null,
      documento_legal: legalDocument.trim() || null,
      email_privacidade: privacyEmail.trim().toLowerCase() || null,
      prazo_retencao_meses: retentionNumber,
      cor_primaria: primaryColor,
      cor_secundaria: secondaryColor,
      icone: brandIcon,
      antecedencia_minutos: leadNumber,
      intervalo_grade_minutos: gridNumber,
      horizonte_agendamento_dias: horizonNumber,
      updated_at: new Date().toISOString(),
    }).eq('id', business.id);
    setSaving(false);
    if (error) return toast.error(error.message ?? 'Não foi possível salvar.');
    await onUpdated();
    toast.success('Regras da agenda atualizadas.');
  };

  const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-emerald-500';

  return (
    <section className="panel-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5 text-emerald-300"><ShieldCheck size={20} /></span>
        <div>
          <h2 className="text-lg font-black">Marca, agenda e regras</h2>
          <p className="mt-1 text-sm text-zinc-500">Personalize o estabelecimento e defina como os horários serão oferecidos.</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/55 p-4" style={businessBrandStyle(primaryColor, secondaryColor)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="brand-icon"><BusinessBrandIcon icon={brandIcon} size={24} /></span>
            <div className="min-w-0">
              <p className="truncate font-black text-white">{business.nome}</p>
              <p className="truncate text-xs text-zinc-500">Prévia da identidade visual</p>
            </div>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-zinc-400">COR PRINCIPAL<input aria-label="Cor principal" type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-900 p-1" /></label>
            <label className="text-xs font-bold text-zinc-400">COR DE DESTAQUE<input aria-label="Cor de destaque" type="color" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-900 p-1" /></label>
            <label className="text-xs font-bold text-zinc-400">ÍCONE<select value={brandIcon} onChange={(event) => setBrandIcon(event.target.value as BrandIcon)} className={inputClass}>{(Object.keys(brandIconLabels) as BrandIcon[]).map((icon) => <option key={icon} value={icon}>{brandIconLabels[icon]}</option>)}</select></label>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-zinc-400">IDENTIFICADOR DO LINK<input value={slug} onChange={(event) => setSlug(event.target.value)} className={inputClass} /></label>
        <div className="flex items-end"><button type="button" onClick={async () => { const done = await copy(publicUrl); toast[done ? 'success' : 'error'](done ? 'Link público copiado.' : 'Não foi possível copiar.'); }} className="secondary-button w-full"><Copy size={16} /> Copiar link de agendamento</button></div>
        <SettingsToggle label="Aceitar agendamento público" checked={publicBooking} update={setPublicBooking} />
        <SettingsToggle label="Lembretes por e-mail" checked={email} update={setEmail} />
        <SettingsToggle label="Lembretes por WhatsApp" checked={whatsapp} update={setWhatsapp} />
      </div>

      <div className="mt-6 border-t border-zinc-800 pt-5">
        <h3 className="flex items-center gap-2 font-bold text-white"><CalendarClock size={17} className="text-blue-300" /> Sincronização da agenda</h3>
        <p className="mt-1 text-xs text-zinc-500">A duração do serviço ocupa todo o intervalo, incluindo almoço, bloqueios e o fim do expediente.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-bold text-zinc-400">ANTECEDÊNCIA (MIN)<input type="number" min="0" max="1440" value={leadMinutes} onChange={(event) => setLeadMinutes(event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-bold text-zinc-400">INTERVALO DA GRADE<input type="number" min="5" max="60" step="5" value={gridMinutes} onChange={(event) => setGridMinutes(event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-bold text-zinc-400">ABRIR AGENDA POR (DIAS)<input type="number" min="7" max="365" value={bookingHorizon} onChange={(event) => setBookingHorizon(event.target.value)} className={inputClass} /></label>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-zinc-400">CANCELAMENTO MÍNIMO (H)<input type="number" min="0" max="168" value={cancellationHours} onChange={(event) => setCancellationHours(event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold text-zinc-400">SINAL (%)<input type="number" min="0" max="100" step="0.01" value={deposit} onChange={(event) => setDeposit(event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold text-zinc-400">BLOQUEAR APÓS FALTAS<input type="number" min="0" max="20" value={noShows} onChange={(event) => setNoShows(event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold text-zinc-400">DIAS DE BLOQUEIO<input type="number" min="1" max="365" value={blockDays} onChange={(event) => setBlockDays(event.target.value)} className={inputClass} /></label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-zinc-400"><CreditCard className="mr-1 inline" size={14} /> CHAVE PIX<input value={pixKey} onChange={(event) => setPixKey(event.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold text-zinc-400">BENEFICIÁRIO PIX<input value={pixOwner} onChange={(event) => setPixOwner(event.target.value)} className={inputClass} /></label>
      </div>

      <div className="mt-6 border-t border-zinc-800 pt-5">
        <h3 className="font-bold text-white">Identificação legal e privacidade</h3>
        <p className="mt-1 text-xs text-zinc-500">Esses dados completam automaticamente as páginas de termos e privacidade.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-zinc-400">RESPONSÁVEL LEGAL<input value={legalOwner} onChange={(event) => setLegalOwner(event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-bold text-zinc-400">CNPJ OU DOCUMENTO<input value={legalDocument} onChange={(event) => setLegalDocument(event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-bold text-zinc-400">E-MAIL DE PRIVACIDADE<input type="email" value={privacyEmail} onChange={(event) => setPrivacyEmail(event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-bold text-zinc-400">RETENÇÃO OPERACIONAL (MESES)<input type="number" min="1" max="120" value={retentionMonths} onChange={(event) => setRetentionMonths(event.target.value)} className={inputClass} /></label>
        </div>
      </div>

      <button type="button" onClick={() => { void save(); }} disabled={saving} className="primary-button mt-5 w-full">{saving ? 'Salvando...' : 'Salvar identidade e regras'}</button>
      <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
        <span className="flex items-center gap-1"><Link2 size={13} /> Link seguro entre dispositivos</span>
        <span className="flex items-center gap-1"><BellRing size={13} /> Atualização automática</span>
        <span className="flex items-center gap-1"><Palette size={13} /> Marca por estabelecimento</span>
      </div>
    </section>
  );
}
