'use client';

import Link from 'next/link';
import { SiteRights } from '@/components/site-rights';
import { useSyncExternalStore, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CalendarDays, Mail, Lock, User, Phone, Eye, EyeOff, Scissors, Sparkles } from 'lucide-react';
import { Captcha } from '@/components/captcha';

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
        if (!nome || !telefone) throw new Error('Preencha todos os campos.');
        if (senha.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres.');
        if (!termsAccepted) throw new Error('Aceite os termos de uso e a política de privacidade.');
        if (isConviteBarbeiro && !conviteBarbeiro) throw new Error('Este convite de barbeiro é inválido. Peça um novo link ao responsável.');

        // O Supabase Auth vai criar o usuário e a Trigger vai preencher a tabela usuarios sozinha
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email, 
          password: senha,
          options: { 
            emailRedirectTo: `${window.location.origin}/dashboard`,
            captchaToken: captchaToken || undefined,
            data: { 
              nome,
              telefone,
              full_name: nome,
              display_name: nome,
              tipo: isConviteBarbeiro ? 'barbeiro' : 'cliente',
              convite_barbeiro: conviteBarbeiro,
              termos_aceitos: true,
            } 
          }
        });
        
        if (authError) {
          if (authError.message.includes('already registered')) {
            throw new Error('Este e-mail já está cadastrado. Faça login.');
          }
          if (/(confirmation email|email.*(?:send|authorized)|rate limit)/i.test(authError.message)) {
            throw new Error('Não foi possível enviar o e-mail de confirmação. O serviço de e-mail da barbearia precisa ser configurado.');
          }
          throw new Error(authError.message);
        }

        if (authData.session) {
          toast.success('Conta criada!', { id: toastId });
          window.location.replace('/dashboard');
          return;
        }

        toast.success('Conta criada! Verifique a caixa de entrada, Spam e Promoções.', { id: toastId });
        window.setTimeout(() => {
          setPreferirLogin(true);
          setSenha('');
          setNome('');
          setTelefone('');
        }, 2000);
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
    if (!email.trim()) return toast.error('Informe o e-mail da conta.');
    const toastId = toast.loading('Reenviando confirmação...');
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) return toast.error('Não foi possível reenviar agora. Aguarde alguns minutos e tente novamente.', { id: toastId });
    toast.success('E-mail reenviado. Confira também Spam e Promoções.', { id: toastId });
  };

  return (
    <div className="z-10 w-full max-w-md rounded-3xl border border-zinc-800/80 bg-zinc-900/90 p-6 shadow-2xl sm:p-8">
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
          <Scissors className="text-emerald-400" size={32} />
        </div>
        <h1 className="text-2xl font-black text-white">{isConviteBarbeiro ? 'Convite Barbeiro' : 'Agenda Brasil'}</h1>
        {isConviteBarbeiro ? (
          <p className="text-emerald-400 text-xs font-bold mt-2 flex items-center justify-center gap-1">
            <Sparkles size={14}/> VOCÊ FOI CONVIDADO PARA A EQUIPE
          </p>
        ) : (
          <p className="text-zinc-400 mt-2 text-sm font-medium">
            {isLogin ? 'Acesse sua conta para continuar' : 'Crie sua conta para agendar'}
          </p>
        )}
      </div>

      {sessaoExpirada && (
        <p role="status" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm text-amber-200">
          Sua sessão anterior expirou. Entre novamente para continuar com segurança.
        </p>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">Site<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
        {!isLogin && (
          <div className="signup-fields space-y-4">
            <div className="relative">
              <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Nome Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500"><User size={18} /></div>
                <input type="text" id="nome" name="nome" autoComplete="name" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex: João da Silva" className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" />
              </div>
            </div>
            <div className="relative">
              <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">WhatsApp</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500"><Phone size={18} /></div>
                <input type="tel" id="telefone" name="telefone" autoComplete="tel" value={telefone} onChange={handleTelefoneChange} placeholder="(00) 00000-0000" maxLength={15} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" />
              </div>
            </div>
          </div>
        )}

        <div className="relative">
          <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">E-mail</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500"><Mail size={18} /></div>
            <input type="email" id="email" name="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" />
          </div>
        </div>

        {!isLogin && <>
          <label className="flex items-start gap-2 text-xs text-zinc-400"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 h-4 w-4" /><span>Aceito os <Link href="/termos" className="text-emerald-400 underline">termos de uso</Link> e a <Link href="/privacidade" className="text-emerald-400 underline">política de privacidade</Link>.</span></label>
          <Captcha onToken={setCaptchaToken} />
        </>}

        <div className="relative">
          <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Senha</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500"><Lock size={18} /></div>
            <input type={showPassword ? "text" : "password"} id="senha" name="senha" autoComplete={isLogin ? "current-password" : "new-password"} value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••••" required className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 pr-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" />
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
      </form>

      {!isConviteBarbeiro && (
        <div className="mt-6 space-y-3 text-center">
          <Link href="/agendar" className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"><CalendarDays size={17} /> Agendar sem senha</Link>
          <button onClick={() => { setPreferirLogin(!isLogin); setEmail(''); setSenha(''); setNome(''); setTelefone(''); }} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
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
