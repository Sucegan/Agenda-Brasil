-- Reviews may edit only their rating text/score and must remain attached to the
-- customer's own completed appointment and original professional.

begin;

drop policy if exists "avaliacoes_cliente_update" on public.avaliacoes;
create policy "avaliacoes_cliente_update" on public.avaliacoes
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.agendamentos a
      join public.clientes c on c.id = a.cliente_id
      where a.id = agendamento_id
        and a.barbeiro_id = barbeiro_id
        and a.status = 'concluido'
        and c.usuario_id = auth.uid()
    )
  );

revoke update on table public.avaliacoes from authenticated;
grant update (nota, comentario, updated_at) on table public.avaliacoes to authenticated;

commit;
