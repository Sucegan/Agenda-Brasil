'use client';

import Link from 'next/link';
import { SiteRights } from '@/components/site-rights';
import { useEffect, useSyncExternalStore, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CalendarDays, Mail, MailCheck, Lock, User, Phone, Eye, EyeOff, Scissors, Sparkles, RefreshCw } from 'lucide-react';
import { Captcha } from '@/components/captcha';
import { signupErrorMessage, validateSignupFields } from '@/lib/signup-validation';
import type { PlatformPublicSettings } from '@/lib/database.types';

const subscribeToNothing = () => () => undefined;
const getSupabase = async () => (await import('@/lib/supabase')).supabase;

function useInviteParams() {
  const search = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.search,
    () => '',
  );
  const params = new URLSearchParams(search);
  return {
    isConviteBarbeiro: params.get('tipo') === 'barbeiro',
    conviteBarbeiro: params.get('convite'),
    sessaoExpirada: params.get('motivo') === 'sessao-expirada',
  };
}

function LoginForm() {
  const { isConviteBarbeiro, conviteBarbeiro, sessaoExpirada } = useInviteParams();
  const [preferirLogin, setPreferirLogin] = useState(true);
  const isLogin = !isConviteBarbeiro && preferirLogin;
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [website, setWebsite] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [confirmationNotice, setConfirmationNotice] = useState('');
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [platform, setPlatform] = useState<PlatformPublicSettings | null>(null);

  useEffect(() => {
    let active = true;
    void getSupabase().then((client) => client.rpc('obter_configuracao_publica')).then(({ data }) => {
      if (active && data) setPlatform(data);
    });
    return () => { active = false; };
  }, []);

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (value.length <= 11) {
      value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
      value = value.replace(/(\d)(\d{4})$/, '$1-$2');
      setTelefone(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Processando...');

    try {
      const supabase = await getSupabase();
      if (isLogin) {
        if (!email.trim() || !senha) throw new Error('Informe seu e-mail e sua senha.');
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error?.message.toLowerCase().includes('email not confirmed')) throw new Error('Seu e-mail ainda não foi confirmado. Use “Reenviar confirmação” abaixo.');
        if (error) throw new Error('E-mail ou senha incorretos.');
        
        toast.success('Login realizado!', { id: toastId });
        // A full navigation waits for the browser to persist the auth cookie.
        // Client-side navigation could race this write in Safari and require a
        // manual page refresh after every sign-in.
        window.location.replace('/dashboard');
        return;
      } else {
        if (website) throw new Error('Não foi possível concluir o cadastro.');
        const validation = validateSignupFields({ name: nome, phone: telefone, email, password: senha });
        if (validation.error || !validation.data) throw new Error(validation.error ?? 'Revise os dados do cadastro.');
        if (!termsAccepted) throw new Error('Aceite os termos de uso e a política de privacidade.');
        if (isConviteBarbeiro && !conviteBarbeiro) throw new Error('Este convite de barbeiro é inválido. Peça um novo link ao responsável.');
        const normalized = validation.data;

        // O Supabase Auth vai criar o usuário e a Trigger vai preencher a tabela usuarios sozinha
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
              tipo: isConviteBarbeiro ? 'barbeiro' : 'cliente',
              convite_barbeiro: conviteBarbeiro,
              termos_aceitos: true,
            } 
          }
        });
        
        if (authError) {
          console.error('[auth:signup] failed', { code: authError.code, status: authError.status, message: authError.message });
          throw new Error(signupErrorMessage(authError));
        }

        if (authData.session) {
          toast.success('Conta criada!', { id: toastId });
          window.location.replace('/dashboard');
          return;
        }

        const normalizedEmail = normalized.email;
        setConfirmationEmail(normalizedEmail);
        setConfirmationNotice('Solicitação enviada agora. A entrega pode levar alguns minutos.');
        setSenha('');
        setCaptchaToken('');
        toast.success('Cadastro realizado. Confirme seu e-mail para entrar.', { id: toastId });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir a operação.', { id: toastId });
    } finally { 
      setLoading(false); 
    }
  };

  const solicitarRecuperacaoSenha = async () => {
    if (!email) {
      toast.error('Informe seu e-mail para receber o link de recuperação.');
      return;
    }

    const toastId = toast.loading('Enviando link de recuperação...');
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      toast.success('Enviamos um link para você criar uma nova senha.', { id: toastId });
    } catch {
      toast.error('Não foi possível enviar o link. Verifique sua conexão e o e-mail informado.', { id: toastId });
    }
  };

  const reenviarConfirmacao = async () => {
    const targetEmail = (confirmationEmail || email).trim().toLowerCase();
    if (!targetEmail) return toast.error('Informe o e-mail da conta.');
    if (resendingConfirmation) return;
    setResendingConfirmation(true);
    const toastId = toast.loading('Reenviando confirmação...');
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) {
        const message = /rate limit/i.test(error.message)
          ? 'Muitas tentativas. Aguarde alguns minutos antes de reenviar.'
          : 'Não foi possível reenviar agora. Aguarde alguns minutos e tente novamente.';
        setConfirmationNotice(message);
        return toast.error(message, { id: toastId });
      }
      const message = 'Nova solicitação enviada. Confira também Spam e Promoções.';
      setConfirmationNotice(message);
      toast.success(message, { id: toastId });
    } catch {
      const message = 'Não foi possível conectar ao serviço de e-mail. Tente novamente.';
      setConfirmationNotice(message);
      toast.error(message, { id: toastId });
    } finally {
      setResendingConfirmation(false);
    }
  };

  return (
    <div className="z-10 w-full max-w-md rounded-3xl border border-zinc-800/80 bg-zinc-900/90 p-6 shadow-2xl sm:p-8">
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
          <Scissors className="text-emerald-400" size={32} />
        </div>
        <h1 className="text-2xl font-black text-white">{isConviteBarbeiro ? 'Convite para profissional' : platform?.nome_site ?? 'Agenda Brasil'}</h1>
        {isConviteBarbeiro ? (
          <p className="text-emerald-400 text-xs font-bold mt-2 flex items-center justify-center gap-1">
            <Sparkles size={14}/> VOCÊ FOI CONVIDADO PARA A EQUIPE
          </p>
        ) : (
          <p className="text-zinc-400 mt-2 text-sm font-medium">
            {isLogin ? platform?.subtitulo ?? 'Acesse sua conta para continuar' : 'Crie sua conta para agendar'}
          </p>
        )}
      </div>

      {sessaoExpirada && (
        <p role="status" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm text-amber-200">
          Sua sessão anterior expirou. Entre novamente para continuar com segurança.
        </p>
      )}

      {confirmationEmail && (
        <section role="status" aria-live="polite" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
          <MailCheck className="mx-auto text-emerald-400" size={40} />
          <h2 className="mt-3 text-xl font-black text-white">Cadastro realizado</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Solicitamos o envio do e-mail de confirmação para <strong className="break-all text-emerald-300">{confirmationEmail}</strong>.
          </p>
          <div className="mt-4 rounded-xl border border-zinc-700/80 bg-zinc-950/50 p-3 text-left text-xs leading-5 text-zinc-400">
            <p>1. Abra a mensagem da Agenda Brasil e confirme seu e-mail.</p>
            <p>2. Se não aparecer, verifique Spam, Lixo eletrônico e Promoções.</p>
            <p>3. Depois da confirmação, volte e entre com sua senha.</p>
          </div>
          <p className="mt-3 text-xs text-emerald-200">{confirmationNotice}</p>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => { void reenviarConfirmacao(); }} disabled={resendingConfirmation} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
              <RefreshCw size={16} className={resendingConfirmation ? 'animate-spin' : ''} /> {resendingConfirmation ? 'Reenviando...' : 'Reenviar e-mail de confirmação'}
            </button>
            <button type="button" onClick={() => { setPreferirLogin(true); setConfirmationEmail(''); setConfirmationNotice(''); }} className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold text-zinc-200 hover:border-emerald-500/50">
              Ir para o login
            </button>
          </div>
        </section>
      )}
      
      {!confirmationEmail && <form onSubmit={handleSubmit} className="space-y-4">
        <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">Site<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
        {!isLogin && (
          <div className="signup-fields space-y-4">
            <div className="relative">
              <label htmlFor="nome" className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Nome Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500"><User size={18} /></div>
                <input type="text" id="nome" name="nome" autoComplete="name" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex: João da Silva" required minLength={2} maxLength={120} aria-describedby="nome-ajuda" className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" />
              </div>
              <p id="nome-ajuda" className="mt-1 text-[10px] text-zinc-600">Use pelo menos 2 caracteres.</p>
            </div>
            <div className="relative">
              <label htmlFor="telefone" className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">WhatsApp</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500"><Phone size={18} /></div>
                <input type="tel" id="telefone" name="telefone" autoComplete="tel" inputMode="tel" value={telefone} onChange={handleTelefoneChange} placeholder="(00) 00000-0000" required minLength={14} maxLength={15} aria-describedby="telefone-ajuda" className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" />
              </div>
              <p id="telefone-ajuda" className="mt-1 text-[10px] text-zinc-600">Informe DDD e número do WhatsApp.</p>
            </div>
          </div>
        )}

        <div className="relative">
          <label htmlFor="email" className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">E-mail</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500"><Mail size={18} /></div>
            <input type="email" id="email" name="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required maxLength={254} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" />
          </div>
        </div>

        {!isLogin && <>
          <label className="flex items-start gap-2 text-xs text-zinc-400"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 h-4 w-4" /><span>Aceito os <Link href="/termos" className="text-emerald-400 underline">termos de uso</Link> e a <Link href="/privacidade" className="text-emerald-400 underline">política de privacidade</Link>.</span></label>
          <Captcha onToken={setCaptchaToken} />
        </>}

        <div className="relative">
          <label htmlFor="senha" className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Senha</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500"><Lock size={18} /></div>
            <input type={showPassword ? "text" : "password"} id="senha" name="senha" autoComplete={isLogin ? "current-password" : "new-password"} value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••••" required minLength={isLogin ? undefined : 6} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 pr-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex items-center px-3 text-emerald-500 transition-colors hover:text-emerald-400">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-emerald-900/20">
          {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
        </button>

        {isLogin && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-medium text-emerald-400">
            <button type="button" onClick={() => { void solicitarRecuperacaoSenha(); }} className="hover:text-emerald-300 transition-colors">Esqueci minha senha</button>
            <button type="button" onClick={() => { void reenviarConfirmacao(); }} className="hover:text-emerald-300 transition-colors">Reenviar confirmação</button>
          </div>
        )}
      </form>}

      {!confirmationEmail && !isConviteBarbeiro && (
        <div className="mt-6 space-y-3 text-center">
          <Link href="/estabelecimentos" className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"><CalendarDays size={17} /> Escolher estabelecimento e agendar</Link>
          <button onClick={() => { setPreferirLogin(!isLogin); setEmail(''); setSenha(''); setNome(''); setTelefone(''); setConfirmationNotice(''); }} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            {isLogin ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
            <span className="text-emerald-400 font-bold hover:underline">{isLogin ? 'Cadastre-se' : 'Faça Login'}</span>
          </button>
          <p className="text-[11px] text-zinc-600"><Link href="/privacidade" className="hover:text-zinc-400">Privacidade</Link> · <Link href="/termos" className="hover:text-zinc-400">Termos</Link></p>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="app-screen login-background relative flex flex-col items-center justify-center px-4 py-6 selection:bg-emerald-500/30">
      <Toaster position="top-center" containerStyle={{ top: 'calc(16px + env(safe-area-inset-top))' }} toastOptions={{ style: { background: '#27272a', color: '#fff', border: '1px solid #3f3f46' } }} />
      <LoginForm />
      <SiteRights className="mt-6" />
    </main>
  );
}
