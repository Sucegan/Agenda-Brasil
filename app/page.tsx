'use client';

import { useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Mail, Lock, User, Phone, Eye, EyeOff, Scissors, Sparkles } from 'lucide-react';

// Componente interno que consome os parâmetros de busca
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isConviteBarbeiro = searchParams.get('tipo') === 'barbeiro';
  
  const [isLogin, setIsLogin] = useState(!isConviteBarbeiro);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error('E-mail ou senha incorretos.');
        router.push('/dashboard');
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email, password: senha,
          options: { data: { display_name: nome, phone: telefone } }
        });
        if (authError) throw new Error(authError.message);

        if (authData.user) {
          const { error: dbError } = await supabase.from('usuarios').insert([{
            id: authData.user.id, nome, telefone,
            tipo: isConviteBarbeiro ? 'barbeiro' : 'cliente'
          }]);
          if (dbError) throw new Error('Erro ao salvar no banco.');
          toast.success('Conta criada!', { id: toastId });
          router.push('/dashboard');
        }
      }
    } catch (err: any) { 
      toast.error(err.message, { id: toastId }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="w-full max-w-md z-10 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-8 rounded-3xl shadow-2xl">
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
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">
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

        <div className="relative">
          <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Senha</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-500"><Lock size={18} /></div>
            <input type={showPassword ? "text" : "password"} id="senha" name="senha" autoComplete={isLogin ? "current-password" : "new-password"} value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••••" required className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 pr-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-emerald-500 hover:text-emerald-400 transition-colors">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-emerald-900/20">
          {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
        </button>
      </form>

      {!isConviteBarbeiro && (
        <div className="mt-6 text-center">
          <button onClick={() => { setIsLogin(!isLogin); setEmail(''); setSenha(''); setNome(''); setTelefone(''); }} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            {isLogin ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
            <span className="text-emerald-400 font-bold hover:underline">{isLogin ? 'Cadastre-se' : 'Faça Login'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Componente principal que engloba tudo com o Suspense exigido pelo Next.js
export default function LoginPage() {
  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative selection:bg-emerald-500/30">
      <Toaster position="top-center" toastOptions={{ style: { background: '#27272a', color: '#fff', border: '1px solid #3f3f46' } }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <Suspense fallback={<div className="text-zinc-500 text-sm">Carregando...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}