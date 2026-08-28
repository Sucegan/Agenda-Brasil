-- Keep every review attached to the professional who actually completed the
-- appointment. Also consolidate read access so PostgreSQL evaluates one RLS
-- policy instead of two permissive policies for every row.

begin;

drop policy if exists "avaliacoes_cliente_select" on public.avaliacoes;
drop policy if exists "avaliacoes_profissional_select" on public.avaliacoes;
drop policy if exists "avaliacoes_profissional_select_role_scope" on public.avaliacoes;
drop policy if exists "avaliacoes_cliente_insert" on public.avaliacoes;
drop policy if exists "avaliacoes_cliente_update" on public.avaliacoes;

create policy "avaliacoes_select_participants"
on public.avaliacoes
for select to authenticated
using (
  usuario_id = (select auth.uid())
  or (select public.pode_gerenciar_barbeiro(avaliacoes.barbeiro_id))
);

create policy "avaliacoes_cliente_insert"
on public.avaliacoes
for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and exists (
    select 1
    from public.agendamentos a
    join public.clientes c on c.id = a.cliente_id
    where a.id = avaliacoes.agendamento_id
      and a.barbeiro_id = avaliacoes.barbeiro_id
      and a.status = 'concluido'
      and c.usuario_id = (select auth.uid())
  )
);

create policy "avaliacoes_cliente_update"
on public.avaliacoes
for update to authenticated
using (usuario_id = (select auth.uid()))
with check (
  usuario_id = (select auth.uid())
  and exists (
    select 1
    from public.agendamentos a
    join public.clientes c on c.id = a.cliente_id
    where a.id = avaliacoes.agendamento_id
      and a.barbeiro_id = avaliacoes.barbeiro_id
      and a.status = 'concluido'
      and c.usuario_id = (select auth.uid())
  )
);

-- The previous single-business settings table is no longer used. Leaving its
-- old UPDATE policy enabled would let any professional change global legacy
-- data, so keep it read-only until it can be removed in a future data cleanup.
drop policy if exists "barbeiro atualiza configuracoes" on public.configuracoes_negocio;
revoke update on table public.configuracoes_negocio from authenticated;

-- Push subscriptions belong to the retired installable-app version. The web
-- product does not expose a push registration flow.
drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
revoke all on table public.push_subscriptions from anon, authenticated;

revoke update on table public.avaliacoes from authenticated;
grant update (
  nota, comentario, qualidade, atendimento, pontualidade, recomendaria, updated_at
) on table public.avaliacoes to authenticated;

commit;
