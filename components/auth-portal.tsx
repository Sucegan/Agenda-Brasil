'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  ArrowLeft, BadgeCheck, Building2, CalendarDays, CheckCircle2, Eye, EyeOff,
  Lock, Mail, MailCheck, Phone, RefreshCw, Scissors, ShieldCheck, Sparkles, User,
} from 'lucide-react';
import { Captcha } from '@/components/captcha';
import { SiteRights } from '@/components/site-rights';
import { signupErrorMessage, signupLooksLikeExistingAccount, validateSignupFields } from '@/lib/signup-validation';
import type { PlatformPublicSettings } from '@/lib/database.types';

export type AuthMode = 'login' | 'cliente' | 'proprietario' | 'barbeiro';

type AuthPortalProps = {
  mode: AuthMode;
  inviteToken?: string | null;
  sessionExpired?: boolean;
};

const getSupabase = async () => (await import('@/lib/supabase')).supabase;

const modeContent: Record<Exclude<AuthMode, 'login'>, { title: string; subtitle: string; submit: string }> = {
  cliente: {
    title: 'Criar conta de cliente',
    subtitle: 'Uma conta gratuita para marcar e acompanhar seus horários',
    submit: 'Criar conta de cliente',
  },
  proprietario: {
    title: 'Comece seu teste grátis',
    subtitle: 'Crie a conta responsável pelo seu estabelecimento',
    submit: 'Criar conta do estabelecimento',
  },
  barbeiro: {
    title: 'Convite para profissional',
    subtitle: 'Complete seu cadastro para entrar na equipe',
    submit: 'Aceitar convite e criar conta',
  },
};

export function AuthPortal({ mode, inviteToken = null, sessionExpired = false }: AuthPortalProps) {
  const isLogin = mode === 'login';
  const isOwner = mode === 'proprietario';
  const isProfessionalInvite = mode === 'barbeiro';
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [website, setWebsite] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [confirmationNotice, setConfirmationNotice] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [platform, setPlatform] = useState<PlatformPublicSettings | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    let active = true;
    void getSupabase()
      .then((client) => client.rpc('obter_configuracao_publica'))
      .then(({ data }) => {
        if (active && data) setPlatform(data);
      });
    return () => { active = false; };
  }, []);

  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value = event.target.value.replace(/\D/g, '').slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
    value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    setPhone(value);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const toastId = toast.loading(isLogin ? 'Entrando...' : 'Criando sua conta...');

    try {
      const supabase = await getSupabase();
      if (isLogin) {
        if (!email.trim() || !password) throw new Error('Informe seu e-mail e sua senha.');
        const normalizedEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error?.message.toLowerCase().includes('email not confirmed')) {
          setConfirmationEmail(normalizedEmail);
          setConfirmationNotice('Sua conta existe, mas ainda aguarda a confirmação do e-mail.');
          toast.error('Confirme seu e-mail antes de entrar.', { id: toastId });
          return;
        }
        if (error) throw new Error('E-mail ou senha incorretos.');
        toast.success('Login realizado!', { id: toastId });
        window.location.replace('/dashboard');
        return;
      }

      if (website) throw new Error('Não foi possível concluir o cadastro.');
      const validation = validateSignupFields({ name, phone, email, password });
      if (validation.error || !validation.data) throw new Error(validation.error ?? 'Revise os dados do cadastro.');
      if (password !== passwordConfirmation) throw new Error('As senhas informadas não são iguais.');
      if (!termsAccepted) throw new Error('Aceite os termos de uso e a política de privacidade.');
      if (isProfessionalInvite && !inviteToken) throw new Error('Este convite é inválido. Peça um novo link ao responsável.');

      const normalized = validation.data;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalized.email,
        password: normalized.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          captchaToken: captchaToken || undefined,
          data: {
            nome: normalized.name,
            telefone: normalized.phone,
            full_name: normalized.name,
            display_name: normalized.name,
            tipo: isProfessionalInvite ? 'barbeiro' : mode,
            convite_barbeiro: isProfessionalInvite ? inviteToken : null,
            termos_aceitos: true,
          },
        },
      });
      if (authError) throw new Error(signupErrorMessage(authError));

      if (signupLooksLikeExistingAccount(authData.user)) {
        const message = 'Este e-mail já possui uma conta. Entre com sua senha ou recupere o acesso.';
        setLoginNotice(message);
        setPassword('');
        setPasswordConfirmation('');
        setCaptchaToken('');
        toast.error(message, { id: toastId });
        return;
      }
      if (authData.session) {
        toast.success('Conta criada!', { id: toastId });
        window.location.replace('/dashboard');
        return;
      }

      setConfirmationEmail(normalized.email);
      setConfirmationNotice('Solicitação enviada agora. A entrega pode levar alguns minutos.');
      setPassword('');
      setPasswordConfirmation('');
      setCaptchaToken('');
      toast.success('Cadastro realizado. Confirme seu e-mail para entrar.', { id: toastId });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a operação.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return toast.error('Informe seu e-mail para receber o link de recuperação.');
    const toastId = toast.loading('Enviando link de recuperação...');
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}/redefinir-senha` });
      if (error) throw error;
      const message = 'Solicitamos o envio do link. Confira também Spam e Promoções.';
      setLoginNotice(message);
      toast.success(message, { id: toastId });
    } catch {
      toast.error('Não foi possível enviar o link. Verifique o e-mail e tente novamente.', { id: toastId });
    }
  };

  const resendConfirmation = async () => {
    const targetEmail = (confirmationEmail || email).trim().toLowerCase();
    if (!targetEmail) return toast.error('Informe o e-mail da conta.');
    if (resendingConfirmation) return;
    setResendingConfirmation(true);
    const toastId = toast.loading('Reenviando confirmação...');
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.resend({ type: 'signup', email: targetEmail, options: { emailRedirectTo: `${window.location.origin}/dashboard` } });
      if (error) {
        const message = /rate limit/i.test(error.message) ? 'Muitas tentativas. Aguarde alguns minutos antes de reenviar.' : 'Não foi possível reenviar agora. Aguarde e tente novamente.';
        setConfirmationNotice(message);
        setLoginNotice(message);
        return toast.error(message, { id: toastId });
      }
      const message = 'Nova solicitação enviada. Confira também Spam, Lixo eletrônico e Promoções.';
      setConfirmationNotice(message);
      setLoginNotice(message);
      toast.success(message, { id: toastId });
    } catch {
      const message = 'Não foi possível conectar ao serviço de e-mail. Tente novamente.';
      setConfirmationNotice(message);
      setLoginNotice(message);
      toast.error(message, { id: toastId });
    } finally {
      setResendingConfirmation(false);
    }
  };

  const signupContent = isLogin ? null : modeContent[mode];
  const card = (
    <section className="rounded-3xl border border-zinc-800/80 bg-zinc-900/95 p-6 shadow-2xl sm:p-8">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">{isOwner ? <Building2 className="text-amber-400" size={31} /> : <Scissors className="text-emerald-400" size={31} />}</div>
        <h1 className="text-2xl font-black text-white">{isLogin ? platform?.nome_site ?? 'Agenda Brasil' : signupContent?.title}</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-zinc-400">{isLogin ? platform?.subtitulo ?? 'Acesse sua conta para continuar' : signupContent?.subtitle}</p>
        {isProfessionalInvite && <p className="mt-3 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300"><Sparkles size={13} /> Acesso restrito por convite</p>}
      </div>

      {sessionExpired && <p role="status" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm text-amber-100">Sua sessão anterior expirou. Entre novamente para continuar com segurança.</p>}
      {loginNotice && !confirmationEmail && <p role="status" aria-live="polite" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm leading-6 text-amber-100">{loginNotice} {!isLogin && <Link href="/" className="font-black underline">Ir para o login</Link>}</p>}

      {confirmationEmail ? (
        <section role="status" aria-live="polite" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
          <MailCheck className="mx-auto text-emerald-400" size={40} /><h2 className="mt-3 text-xl font-black text-white">Cadastro realizado</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">Solicitamos o envio da confirmação para <strong className="break-all text-emerald-300">{confirmationEmail}</strong>.</p>
          <div className="mt-4 rounded-xl border border-zinc-700/80 bg-zinc-950/50 p-3 text-left text-xs leading-5 text-zinc-400"><p>1. Abra a mensagem da Agenda Brasil e confirme seu e-mail.</p><p>2. Se não aparecer, verifique Spam, Lixo eletrônico e Promoções.</p><p>3. Depois da confirmação, volte e entre com sua senha.</p></div>
          <p className="mt-3 text-xs text-emerald-200">{confirmationNotice}</p>
          <div className="mt-5 grid gap-2"><button type="button" onClick={() => { void resendConfirmation(); }} disabled={resendingConfirmation} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"><RefreshCw size={16} className={resendingConfirmation ? 'animate-spin' : ''} />{resendingConfirmation ? 'Reenviando...' : 'Reenviar e-mail de confirmação'}</button><Link href="/" className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-200 hover:border-emerald-500/50">Ir para o login</Link></div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">Site<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          <fieldset disabled={!hydrated || loading} className="contents">
          {!isLogin && <><div><label htmlFor={`${mode}-nome`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Nome completo</label><div className="relative"><User className="pointer-events-none absolute left-3 top-3.5 text-emerald-500" size={18} /><input id={`${mode}-nome`} name="nome" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: João da Silva" required minLength={2} maxLength={120} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 pl-10 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500" /></div><p className="mt-1 text-[10px] text-zinc-600">Use pelo menos 2 caracteres.</p></div><div><label htmlFor={`${mode}-telefone`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">WhatsApp</label><div className="relative"><Phone className="pointer-events-none absolute left-3 top-3.5 text-emerald-500" size={18} /><input id={`${mode}-telefone`} name="telefone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={handlePhoneChange} placeholder="(00) 00000-0000" required minLength={14} maxLength={15} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 pl-10 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500" /></div><p className="mt-1 text-[10px] text-zinc-600">Informe DDD e número do WhatsApp.</p></div></>}
          <div><label htmlFor={`${mode}-email`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">E-mail</label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-3.5 text-emerald-500" size={18} /><input id={`${mode}-email`} name="email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setLoginNotice(''); }} placeholder="seu@email.com" required maxLength={254} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 pl-10 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500" /></div></div>
          <div><label htmlFor={`${mode}-senha`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Senha</label><div className="relative"><Lock className="pointer-events-none absolute left-3 top-3.5 text-emerald-500" size={18} /><input id={`${mode}-senha`} name="senha" type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required minLength={isLogin ? undefined : 8} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 pl-10 pr-11 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex items-center px-3 text-emerald-500 hover:text-emerald-300">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{!isLogin && <p className="mt-1 text-[10px] text-zinc-600">Use no mínimo 8 caracteres.</p>}</div>
          {!isLogin && <><div><label htmlFor={`${mode}-confirmar-senha`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Confirmar senha</label><div className="relative"><ShieldCheck className="pointer-events-none absolute left-3 top-3.5 text-emerald-500" size={18} /><input id={`${mode}-confirmar-senha`} name="confirmarSenha" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Repita sua senha" required minLength={8} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 pl-10 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500" /></div></div><label className="flex items-start gap-2 text-xs leading-5 text-zinc-400"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 h-4 w-4" /><span>Aceito os <Link href="/termos" className="text-emerald-400 underline">termos de uso</Link> e a <Link href="/privacidade" className="text-emerald-400 underline">política de privacidade</Link>.</span></label><Captcha onToken={setCaptchaToken} /></>}
          <button type="submit" className="mt-6 flex w-full items-center justify-center rounded-xl bg-emerald-700 py-3.5 font-bold text-white shadow-lg shadow-emerald-950/30 transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Aguarde...' : isLogin ? 'Entrar' : signupContent?.submit}</button>
          {isLogin && <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-medium text-emerald-400"><button type="button" onClick={() => { void requestPasswordReset(); }} className="hover:text-emerald-300">Esqueci minha senha</button><button type="button" onClick={() => { void resendConfirmation(); }} className="hover:text-emerald-300">Reenviar confirmação</button></div>}
          </fieldset>
        </form>
      )}

      {!confirmationEmail && <div className="mt-6 space-y-3 text-center">{isLogin ? <><div className="grid gap-2 sm:grid-cols-2"><Link href="/cadastro/cliente" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-xs font-black text-emerald-300 hover:bg-emerald-500/20"><CalendarDays className="mx-auto mb-1" size={17} />Sou cliente</Link><Link href="/cadastro/estabelecimento" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs font-black text-amber-200 hover:bg-amber-500/20"><Building2 className="mx-auto mb-1" size={17} />Tenho um negócio</Link></div><Link href="/estabelecimentos" className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-200 hover:border-emerald-500/50"><CalendarDays size={17} /> Escolher estabelecimento e agendar</Link></> : <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300"><ArrowLeft size={16} /> Já tenho uma conta</Link>}<p className="text-[11px] text-zinc-600"><Link href="/privacidade" className="hover:text-zinc-400">Privacidade</Link> · <Link href="/termos" className="hover:text-zinc-400">Termos</Link></p></div>}
    </section>
  );

  return <main className="app-screen login-background relative flex flex-col items-center justify-center px-4 py-6 selection:bg-emerald-500/30"><Toaster position="top-center" containerStyle={{ top: 'calc(16px + env(safe-area-inset-top))' }} toastOptions={{ style: { background: '#27272a', color: '#fff', border: '1px solid #3f3f46' } }} />{isOwner ? <div className="z-10 grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-zinc-800/80 bg-zinc-950/55 shadow-2xl lg:grid-cols-[0.9fr_1.1fr]"><aside className="hidden border-r border-zinc-800 bg-gradient-to-br from-amber-500/15 via-zinc-950 to-emerald-500/10 p-10 lg:flex lg:flex-col lg:justify-between"><div><p className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-amber-200"><BadgeCheck size={15} /> 14 dias grátis</p><h2 className="mt-6 text-4xl font-black leading-tight text-white">Sua gestão profissional começa aqui.</h2><p className="mt-4 leading-7 text-zinc-400">Cadastre o responsável agora. Depois você configura a unidade, equipe, serviços, agenda e publicação.</p></div><ol className="mt-10 space-y-4 text-sm text-zinc-300">{['Criar conta responsável', 'Cadastrar estabelecimento', 'Configurar agenda e serviços', 'Publicar e receber agendamentos'].map((step, index) => <li key={step} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 font-black text-emerald-300">{index + 1}</span>{step}</li>)}</ol><p className="mt-10 flex items-center gap-2 text-xs text-zinc-500"><CheckCircle2 size={16} className="text-emerald-400" /> Sem cartão e cancele quando quiser.</p></aside><div className="p-0 lg:p-6">{card}</div></div> : <div className="z-10 w-full max-w-md">{card}</div>}<SiteRights className="mt-6" /></main>;
}
