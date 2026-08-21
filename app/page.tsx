'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Mail, Lock, User, Phone, Eye, EyeOff, Scissors, Sparkles } from 'lucide-react';

export default function LoginPage() {
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
    } catch (err: any) { toast.error(err.message, { id: toastId }); } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative">
      <Toaster position="top-center" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div className="w-full max-w-md z-10 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <Scissors className="mx-auto text-emerald-400 mb-4" size={32} />
          <h1 className="text-2xl font-black text-white">{isConviteBarbeiro ? 'Convite Barbeiro' : 'Agenda Brasil'}</h1>
          {isConviteBarbeiro && <p className="text-emerald-400 text-xs font-bold mt-2 flex items-center justify-center gap-1"><Sparkles size={14}/> VOCÊ FOI CONVIDADO PARA A EQUIPE</p>}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <input type="text" placeholder="Nome Completo" value={nome} onChange={e=>setNome(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-white outline-none focus:border-emerald-500" />
              <input type="tel" placeholder="(00) 00000-0000" value={telefone} onChange={handleTelefoneChange} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-white outline-none focus:border-emerald-500" />
            </>
          )}
          <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-white outline-none focus:border-emerald-500" />
          <input type={showPassword ? "text" : "password"} placeholder="Senha" value={senha} onChange={e=>setSenha(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-white outline-none focus:border-emerald-500" />
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl">{loading ? '...' : isLogin ? 'Entrar' : 'Cadastrar'}</button>
        </form>
      </div>
    </main>
  );
}