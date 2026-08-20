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
    // Função inteligente que verifica se o usuário já tem perfil no banco 
    // quando ele logar (seja pelo botão ou clicando no link do e-mail)
    const verificarECriarPerfil = async (session: any) => {
      const userId = session.user.id;
      
      // 1. Checa se o usuário já existe na tabela 'usuarios'
      const { data: usuarioExistente } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', userId)
        .single();

      // 2. Se não existir, é o primeiro login dele após confirmar o e-mail!
      if (!usuarioExistente) {
        // Pegamos os dados que guardamos nos "metadados" na hora do cadastro
        const { nome, telefone, tipo } = session.user.user_metadata;

        if (nome && tipo) {
          // Salva na tabela principal
          await supabase.from('usuarios').insert([
            { id: userId, nome, telefone, tipo }
          ]);

          // Salva na tabela específica
          if (tipo === 'cliente') {
            await supabase.from('clientes').insert([
              { nome, telefone, email: session.user.email, usuario_id: userId }
            ]);
          } else if (tipo === 'barbeiro') {
            await supabase.from('barbeiros').insert([
              { nome, telefone, usuario_id: userId }
            ]);
          }
        }
      }

      // Tudo certo? Vai pro painel!
      router.push('/dashboard');
    };

    // Fica "escutando" se o usuário logou com sucesso
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        verificarECriarPerfil(session);
      }
    });

    // Também checa assim que a página carrega (caso já esteja logado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        verificarECriarPerfil(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Função para formatar o telefone automaticamente enquanto digita
  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, ''); 

    if (valor.length > 11) valor = valor.slice(0, 11); 

    if (valor.length > 10) {
      valor = valor.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (valor.length > 6) {
      valor = valor.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    } else if (valor.length > 2) {
      valor = valor.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    } else if (valor.length > 0) {
      valor = valor.replace(/^(\d*)/, '($1');
    }

    setTelefone(valor);
  };

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

    const numerosApenas = telefone.replace(/\D/g, '');
    if (isSignUp && (numerosApenas.length < 10 || numerosApenas.length > 11)) {
      setMensagem('Por favor, insira um número de telefone com DDD válido.');
      setLoading(false);
      return;
    }

    if (isSignUp) {
      // 1. Criar usuário e guardar os dados em "options.data"
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome,
            telefone,
            tipo
          }
        }
      });

      if (signUpError) {
        setMensagem(traduzirErro(signUpError.message));
        setLoading(false);
        return;
      }

      // Mensagem de sucesso
      setMensagem('✅ Conta criada! Verifique sua caixa de entrada (e o Spam) e clique no link para ativar seu acesso.');
      
      // Reseta os campos para o usuário focar apenas na mensagem
      setEmail('');
      setPassword('');
      setNome('');
      setTelefone('');
      setIsSignUp(false); 
      setLoading(false);

    } else {
      // 2. Lógica de login
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMensagem(traduzirErro(error.message));
        setLoading(false);
      }
      // O redirect para o dashboard não fica mais aqui! O useEffect lá em cima fará a mágica ao detectar o SIGNED_IN.
    }
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
                <label className="mb-1 block text-sm font-medium text-zinc-300">
                  Telefone / WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  value={telefone}
                  onChange={handleTelefoneChange}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="(11) 99999-9999"
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  Usado para receber lembretes e avisos do agendamento.
                </span>
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