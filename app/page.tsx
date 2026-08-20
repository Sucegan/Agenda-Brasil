'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipo, setTipo] = useState<'cliente' | 'barbeiro'>('cliente');
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    checkSession();
  }, [router]);

  // Tratamento de mensagens de erro totalmente em português
  const traduzirErro = (mensagemIngles: string) => {
    const msg = mensagemIngles.toLowerCase();

    if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
      return 'Muitas tentativas em pouco tempo. Por favor, aguarde alguns instantes e tente novamente.';
    }
    if (msg.includes('invalid login credentials')) {
      return 'E-mail ou senha incorretos.';
    }
    if (msg.includes('user already registered')) {
      return 'Este e-mail já está cadastrado em nosso sistema.';
    }
    if (msg.includes('password should be at least')) {
      return 'A senha deve ter pelo menos 6 caracteres.';
    }
    return 'Ocorreu um erro ao processar sua solicitação. Tente novamente em instantes.';
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensagem('');

    if (isSignUp) {
      // 1. Criar usuário no Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setMensagem(traduzirErro(signUpError.message));
        setLoading(false);
        return;
      }

      if (data.user) {
        const userId = data.user.id;

        // 2. Inserir na tabela 'usuarios'
        const { error: userError } = await supabase.from('usuarios').insert([
          {
            id: userId,
            nome,
            telefone,
            tipo,
          },
        ]);

        if (userError) {
          setMensagem('Não foi possível concluir o registro. Tente novamente.');
          setLoading(false);
          return;
        }

        // 3. Inserir na tabela de cliente ou barbeiro
        if (tipo === 'cliente') {
          await supabase.from('clientes').insert([
            {
              nome,
              telefone,
              email,
              usuario_id: userId,
            },
          ]);
        } else if (tipo === 'barbeiro') {
          await supabase.from('barbeiros').insert([
            {
              nome,
              telefone,
              usuario_id: userId,
            },
          ]);
        }
      }

      setMensagem('Cadastro realizado com sucesso! Você já pode fazer login.');
      setIsSignUp(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMensagem(traduzirErro(error.message));
      } else {
        router.push('/dashboard');
      }
    }

    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-white">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h1 className="mb-2 text-center text-3xl font-bold tracking-tight">Agenda Brasil</h1>
        <p className="mb-6 text-center text-sm text-zinc-400">
          {isSignUp ? 'Crie sua conta para agendar ou gerenciar' : 'Acesse sua conta para continuar'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-300">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Digite seu nome completo"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-300">Telefone</label>
                <input
                  type="text"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-300">Tipo de Conta</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as 'cliente' | 'barbeiro')}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="cliente">Cliente (Quero agendar horários)</option>
                  <option value="barbeiro">Barbeiro / Barbearia</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              placeholder="seuemail@exemplo.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Carregando...' : isSignUp ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        {mensagem && (
          <p className="mt-4 rounded border border-zinc-700 bg-zinc-800/50 p-3 text-center text-sm text-zinc-200">
            {mensagem}
          </p>
        )}

        <div className="mt-6 text-center text-sm">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMensagem('');
            }}
            className="text-emerald-400 hover:underline"
          >
            {isSignUp ? 'Já tem uma conta? Faça login' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </main>
  );
}