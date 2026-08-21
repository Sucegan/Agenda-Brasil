'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { KeyRound, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [validando, setValidando] = useState(true);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const prepararRecuperacao = async () => {
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) toast.error('Este link expirou ou já foi utilizado. Solicite outro.');
      }
      const { data: { session } } = await supabase.auth.getSession();
      setPronto(Boolean(session));
      setValidando(false);
    };
    void prepararRecuperacao();
  }, []);

  const salvarNovaSenha = async (event: React.FormEvent) => {
    event.preventDefault();
    if (senha.length < 6) return toast.error('A nova senha deve ter ao menos 6 caracteres.');
    if (senha !== confirmacao) return toast.error('As senhas não conferem.');

    const toastId = toast.loading('Atualizando senha...');
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) return toast.error('Não foi possível atualizar a senha. Solicite um novo link.', { id: toastId });
    toast.success('Senha atualizada com sucesso!', { id: toastId });
    window.setTimeout(() => router.replace('/dashboard'), 1000);
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white flex items-center justify-center">
      <Toaster position="top-center" toastOptions={{ style: { background: '#27272a', color: '#fff' } }} />
      <section className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/70 p-7 shadow-2xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"><KeyRound size={27} /></div>
          <h1 className="text-2xl font-black">Nova senha</h1>
          <p className="mt-2 text-sm text-zinc-400">Escolha uma senha segura para acessar sua conta.</p>
        </div>
        {validando ? <p className="text-center text-sm text-zinc-400">Validando link...</p> : pronto ? (
          <form onSubmit={salvarNovaSenha} className="space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Nova senha
              <span className="relative mt-2 block"><Lock className="absolute left-3 top-3 text-emerald-500" size={17} /><input type="password" value={senha} onChange={(event) => setSenha(event.target.value)} autoComplete="new-password" required className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 pl-10 outline-none focus:border-emerald-500" /></span>
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Confirmar nova senha
              <span className="relative mt-2 block"><Lock className="absolute left-3 top-3 text-emerald-500" size={17} /><input type="password" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} autoComplete="new-password" required className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 pl-10 outline-none focus:border-emerald-500" /></span>
            </label>
            <button className="w-full rounded-xl bg-emerald-600 py-3.5 font-bold transition-colors hover:bg-emerald-500">Salvar nova senha</button>
          </form>
        ) : (
          <div className="space-y-4 text-center"><p className="text-sm text-zinc-400">Não encontramos uma recuperação válida.</p><button onClick={() => router.replace('/')} className="text-sm font-bold text-emerald-400 hover:text-emerald-300">Voltar para o login</button></div>
        )}
      </section>
    </main>
  );
}
