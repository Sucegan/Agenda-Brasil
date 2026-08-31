begin;

-- Cover foreign keys used by deletion checks, joins and dashboard filters.
-- Names are explicit and stable so the migration remains idempotent.
create index if not exists agendamentos_cliente_id_idx
  on public.agendamentos (cliente_id);
create index if not exists agendamentos_servico_id_idx
  on public.agendamentos (servico_id);
create index if not exists avaliacoes_usuario_id_idx
  on public.avaliacoes (usuario_id);
create index if not exists barbearias_proprietario_id_idx
  on public.barbearias (proprietario_id);
create index if not exists barbeiros_usuario_id_idx
  on public.barbeiros (usuario_id);
create index if not exists booking_intents_barber_id_idx
  on public.booking_intents (barber_id);
create index if not exists booking_intents_service_id_idx
  on public.booking_intents (service_id);
create index if not exists checkouts_pagamento_plano_id_idx
  on public.checkouts_pagamento (plano_id);
create index if not exists clientes_barbearias_cliente_id_idx
  on public.clientes_barbearias (cliente_id);
create index if not exists configuracoes_plataforma_updated_by_idx
  on public.configuracoes_plataforma (updated_by);
create index if not exists feriados_negocio_criado_por_idx
  on public.feriados_negocio (criado_por);
create index if not exists fila_espera_servico_id_idx
  on public.fila_espera (servico_id);
create index if not exists movimentacoes_financeiras_criado_por_idx
  on public.movimentacoes_financeiras (criado_por);
create index if not exists notificacoes_agendamento_id_idx
  on public.notificacoes (agendamento_id);
create index if not exists servicos_barbeiro_id_idx
  on public.servicos (barbeiro_id);
create index if not exists telemetria_eventos_usuario_id_idx
  on public.telemetria_eventos (usuario_id);

-- Evaluate auth.uid() once per statement instead of once per candidate row.
drop policy if exists clientes_barbearias_select_own on public.clientes_barbearias;
create policy clientes_barbearias_select_own on public.clientes_barbearias
  for select to authenticated
  using (exists (
    select 1 from public.clientes c
    where c.id = clientes_barbearias.cliente_id
      and c.usuario_id = (select auth.uid())
  ));

drop policy if exists fila_cliente_select on public.fila_espera;
create policy fila_cliente_select on public.fila_espera
  for select to authenticated
  using (exists (
    select 1 from public.clientes c
    where c.id = fila_espera.cliente_id
      and c.usuario_id = (select auth.uid())
  ));

commit;
