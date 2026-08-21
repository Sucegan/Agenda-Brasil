'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Mail, Lock, User, Phone, Eye, EyeOff, Scissors } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipoConta, setTipoConta] = useState('cliente');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Máscara automática para o telefone: (XX) XXXXX-XXXX
  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número
    if (value.length <= 11) {
      value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
      value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    }
    setTelefone(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('Aguarde...');

    try {
      if (isLogin) {
        // ================= LOGIN =================
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        });

        if (error) throw new Error('E-mail ou senha incorretos.');
        
        toast.success('Login realizado com sucesso!', { id: toastId });
        router.push('/dashboard');
        
      } else {
        // ================= CADASTRO (ATUALIZADO) =================
        if (!nome || !telefone) throw new Error('Preencha todos os campos.');
        if (senha.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres.');

        // O segredo está aqui no options.data para preencher o painel do Supabase!
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: {
              display_name: nome, // Vai para a coluna Display Name
              full_name: nome,    // Garantia extra
              phone: telefone,    // Vai para os metadados do usuário
            }
          }
        });

        if (authError) throw new Error(authError.message);

        // Se a conta for criada no Auth, nós salvamos na NOSSA tabela pública "usuarios"
        if (authData.user) {
          const { error: dbError } = await supabase.from('usuarios').insert([
            {
              id: authData.user.id,
              nome,
              telefone,
              tipo: tipoConta,
            },
          ]);

          if (dbError) throw new Error('Erro ao salvar perfil no banco de dados.');
          
          toast.success('Conta criada com sucesso!', { id: toastId });
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
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative selection:bg-emerald-500/30">
      <Toaster position="top-center" toastOptions={{ style: { background: '#27272a', color: '#fff', border: '1px solid #3f3f46' } }} />
      
      {/* Efeito de brilho no fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        
        {/* LOGO E TÍTULO */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
            <Scissors className="text-emerald-400" size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
            Agenda Brasil
          </h1>
          <p className="text-zinc-400 mt-2 text-sm font-medium">
            {isLogin ? 'Acesse sua conta para continuar' : 'Crie sua conta para agendar ou gerenciar'}
          </p>
        </div>

        {/* CARTÃO DO FORMULÁRIO */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-8 rounded-3xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* CAMPOS DE CADASTRO (Só aparecem se não for login) */}
            {!isLogin && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">
                <div className="relative">
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Nome Completo</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500"><User size={18} /></div>
                    <input 
                      type="text" 
                      id="nome"
                      name="nome"
                      autoComplete="name" 
                      value={nome} 
                      onChange={(e) => setNome(e.target.value)} 
                      placeholder="Ex: João da Silva"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" 
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">WhatsApp</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500"><Phone size={18} /></div>
                    <input 
                      type="tel" 
                      id="telefone"
                      name="telefone"
                      autoComplete="tel" 
                      value={telefone} 
                      onChange={handleTelefoneChange} 
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" 
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Tipo de Conta</label>
                  <select 
                    value={tipoConta} 
                    onChange={(e) => setTipoConta(e.target.value)} 
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-white outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="cliente">👤 Sou Cliente (Quero agendar)</option>
                    <option value="barbeiro">✂️ Sou Barbeiro (Quero gerenciar)</option>
                  </select>
                </div>
              </div>
            )}

            {/* CAMPOS PADRÃO (Email e Senha) */}
            <div className="relative">
              <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500"><Mail size={18} /></div>
                <input 
                  type="email" 
                  id="email"
                  name="email"
                  autoComplete="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="seu@email.com"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" 
                />
              </div>
            </div>

            <div className="relative">
              <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500"><Lock size={18} /></div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="senha"
                  name="senha"
                  autoComplete={isLogin ? "current-password" : "new-password"} 
                  value={senha} 
                  onChange={(e) => setSenha(e.target.value)} 
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/50 pl-10 pr-10 p-3 text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600" 
                />
                {/* BOTÃO OLHINHO */}
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-emerald-900/20"
            >
              {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
            </button>
          </form>

          {/* TROCAR ENTRE LOGIN E CADASTRO */}
          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setEmail(''); setSenha(''); setNome(''); setTelefone(''); // Limpa form ao alternar
              }} 
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              {isLogin ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
              <span className="text-emerald-400 font-bold hover:underline">
                {isLogin ? 'Cadastre-se' : 'Faça Login'}
              </span>
            </button>
          </div>
          
        </div>
      </div>
    </main>
  );
}