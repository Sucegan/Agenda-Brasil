-- Make administrator a first-class account type and enforce the access matrix
-- at the database boundary. Public reads continue through narrowly scoped RPCs.

begin;

alter table public.usuarios drop constraint if exists usuarios_tipo_check;
alter table public.usuarios add constraint usuarios_tipo_check
  check (tipo in ('cliente', 'barbeiro', 'admin'));

-- Existing owners were previously represented as barbers and inferred as admins.
update public.usuarios u
set tipo = 'admin'
where exists (
  select 1 from public.barbearias x where x.proprietario_id = u.id
);

create or replace function public.eh_admin_barbearia(p_barbearia_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.usuarios u
    join public.barbearias x on x.proprietario_id = u.id
    where u.id = (select auth.uid()) and u.tipo = 'admin' and x.id = p_barbearia_id and x.ativa
  );
$$;

create or replace function public.eh_proprietario_barbearia(p_barbearia_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.eh_admin_barbearia(p_barbearia_id); $$;

create or replace function public.eh_membro_barbearia(p_barbearia_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.eh_admin_barbearia(p_barbearia_id) or exists (
    select 1
    from public.barbeiros b
    join public.usuarios u on u.id = b.usuario_id
    where b.barbearia_id = p_barbearia_id
      and b.usuario_id = (select auth.uid())
      and u.tipo = 'barbeiro'
  );
$$;

create or replace function public.pode_gerenciar_barbeiro(p_barbeiro_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.barbeiros b
    join public.usuarios u on u.id = (select auth.uid())
    where b.id = p_barbeiro_id and (
      (u.tipo = 'barbeiro' and b.usuario_id = u.id)
      or (u.tipo = 'admin' and exists (
        select 1 from public.barbearias x
        where x.id = b.barbearia_id and x.proprietario_id = u.id and x.ativa
      ))
    )
  );
$$;

drop policy if exists barbearias_select_member on public.barbearias;
drop policy if exists barbearias_update_owner on public.barbearias;
drop policy if exists barbearias_select_role_scope on public.barbearias;
drop policy if exists barbearias_update_admin on public.barbearias;
create policy barbearias_select_role_scope on public.barbearias for select to authenticated
  using (public.eh_membro_barbearia(id));
create policy barbearias_update_admin on public.barbearias for update to authenticated
  using (public.eh_admin_barbearia(id))
  with check (public.eh_admin_barbearia(id));

drop policy if exists barbeiros_select_members on public.barbeiros;
drop policy if exists barbeiros_update_own on public.barbeiros;
drop policy if exists barbeiros_select_role_scope on public.barbeiros;
drop policy if exists barbeiros_update_role_scope on public.barbeiros;
create policy barbeiros_select_role_scope on public.barbeiros for select to authenticated
  using (public.pode_gerenciar_barbeiro(id));
create policy barbeiros_update_role_scope on public.barbeiros for update to authenticated
  using (public.pode_gerenciar_barbeiro(id))
  with check (public.pode_gerenciar_barbeiro(id));

drop policy if exists servicos_select_authenticated on public.servicos;
drop policy if exists servicos_insert_own on public.servicos;
drop policy if exists servicos_update_own on public.servicos;
drop policy if exists servicos_delete_own on public.servicos;
drop policy if exists servicos_select_role_scope on public.servicos;
drop policy if exists servicos_insert_role_scope on public.servicos;
drop policy if exists servicos_update_role_scope on public.servicos;
drop policy if exists servicos_delete_role_scope on public.servicos;
create policy servicos_select_role_scope on public.servicos for select to authenticated
  using (public.pode_gerenciar_barbeiro(barbeiro_id));
create policy servicos_insert_role_scope on public.servicos for insert to authenticated
  with check (public.pode_gerenciar_barbeiro(barbeiro_id));
create policy servicos_update_role_scope on public.servicos for update to authenticated
  using (public.pode_gerenciar_barbeiro(barbeiro_id))
  with check (public.pode_gerenciar_barbeiro(barbeiro_id));
create policy servicos_delete_role_scope on public.servicos for delete to authenticated
  using (public.pode_gerenciar_barbeiro(barbeiro_id));

drop policy if exists agendamentos_select_participants on public.agendamentos;
drop policy if exists agendamentos_select_role_scope on public.agendamentos;
create policy agendamentos_select_role_scope on public.agendamentos for select to authenticated
  using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.usuario_id = (select auth.uid())
    )
    or public.pode_gerenciar_barbeiro(barbeiro_id)
  );

drop policy if exists "barbeiro ve proprios bloqueios" on public.bloqueios_agenda;
drop policy if exists "barbeiro gerencia proprios bloqueios" on public.bloqueios_agenda;
drop policy if exists bloqueios_select_role_scope on public.bloqueios_agenda;
drop policy if exists bloqueios_insert_role_scope on public.bloqueios_agenda;
drop policy if exists bloqueios_update_role_scope on public.bloqueios_agenda;
drop policy if exists bloqueios_delete_role_scope on public.bloqueios_agenda;
create policy bloqueios_select_role_scope on public.bloqueios_agenda for select to authenticated
  using (public.pode_gerenciar_barbeiro(barbeiro_id));
create policy bloqueios_insert_role_scope on public.bloqueios_agenda for insert to authenticated
  with check (public.pode_gerenciar_barbeiro(barbeiro_id));
create policy bloqueios_update_role_scope on public.bloqueios_agenda for update to authenticated
  using (public.pode_gerenciar_barbeiro(barbeiro_id))
  with check (public.pode_gerenciar_barbeiro(barbeiro_id));
create policy bloqueios_delete_role_scope on public.bloqueios_agenda for delete to authenticated
  using (public.pode_gerenciar_barbeiro(barbeiro_id));

drop policy if exists fila_barbeiro_select on public.fila_espera;
drop policy if exists fila_profissional_select_role_scope on public.fila_espera;
create policy fila_profissional_select_role_scope on public.fila_espera for select to authenticated
  using (public.pode_gerenciar_barbeiro(barbeiro_id));

drop policy if exists avaliacoes_profissional_select on public.avaliacoes;
drop policy if exists avaliacoes_profissional_select_role_scope on public.avaliacoes;
create policy avaliacoes_profissional_select_role_scope on public.avaliacoes for select to authenticated
  using (public.pode_gerenciar_barbeiro(barbeiro_id));

drop policy if exists convites_select_owner on public.convites_barbeiro;
drop policy if exists convites_select_admin on public.convites_barbeiro;
create policy convites_select_admin on public.convites_barbeiro for select to authenticated
  using (public.eh_admin_barbearia(barbearia_id));

drop policy if exists feriados_manage_owner on public.feriados_negocio;
drop policy if exists feriados_manage_admin on public.feriados_negocio;
create policy feriados_manage_admin on public.feriados_negocio for all to authenticated
  using (public.eh_admin_barbearia(barbearia_id))
  with check (public.eh_admin_barbearia(barbearia_id) and criado_por = (select auth.uid()));

create or replace function public.listar_minhas_barbearias()
returns setof public.barbearias
language sql stable security definer set search_path = ''
as $$
  select x.*
  from public.barbearias x
  join public.usuarios u on u.id = (select auth.uid())
  where x.ativa and (
    (u.tipo = 'admin' and x.proprietario_id = u.id)
    or (u.tipo = 'barbeiro' and exists (
      select 1 from public.barbeiros b
      where b.barbearia_id = x.id and b.usuario_id = u.id
    ))
  )
  order by x.created_at, x.nome;
$$;

create or replace function public.criar_barbearia(p_nome text, p_slug text)
returns public.barbearias
language plpgsql security definer set search_path = ''
as $$
declare
  v_perfil public.usuarios;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_result public.barbearias;
begin
  select * into v_perfil
  from public.usuarios
  where id = (select auth.uid()) and tipo = 'admin';
  if not found then raise exception 'Apenas administradores podem criar barbearias'; end if;
  if (select count(*) from public.barbearias x where x.proprietario_id = v_perfil.id and x.ativa) >= 20 then
    raise exception 'Limite de barbearias atingido';
  end if;
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then raise exception 'Nome inválido'; end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 80 then raise exception 'Identificador inválido'; end if;
  if exists (select 1 from public.barbearias x where x.slug = v_slug) then raise exception 'Este identificador já está em uso'; end if;

  insert into public.barbearias (
    proprietario_id, nome, slug, telefone, responsavel_legal, agendamento_publico
  ) values (
    v_perfil.id, trim(p_nome), v_slug, v_perfil.telefone, v_perfil.nome, false
  ) returning * into v_result;
  insert into public.barbeiros (nome, telefone, usuario_id, barbearia_id)
  values (v_perfil.nome, v_perfil.telefone, v_perfil.id, v_result.id);
  return v_result;
end;
$$;

create or replace function public.listar_meus_agendamentos_barbearia(p_barbearia_id uuid, p_barbeiro_id bigint)
returns setof public.agendamentos
language sql stable security definer set search_path = ''
as $$
  select a.*
  from public.agendamentos a
  join public.barbeiros selected_barber on selected_barber.id = a.barbeiro_id
  where selected_barber.barbearia_id = p_barbearia_id and (
    exists (
      select 1 from public.clientes c
      join public.usuarios u on u.id = c.usuario_id and u.tipo = 'cliente'
      where c.id = a.cliente_id and c.usuario_id = (select auth.uid())
    )
    or public.eh_admin_barbearia(p_barbearia_id)
    or (
      a.barbeiro_id = p_barbeiro_id
      and exists (
        select 1 from public.barbeiros b
        join public.usuarios u on u.id = b.usuario_id and u.tipo = 'barbeiro'
        where b.id = p_barbeiro_id and b.usuario_id = (select auth.uid())
          and b.barbearia_id = p_barbearia_id
      )
    )
  )
  order by a.data desc, a.horario desc;
$$;

create or replace function public.listar_fila_profissional(p_barbeiro_id bigint)
returns table (
  id bigint, data date, periodo varchar, status varchar,
  cliente_nome varchar, cliente_telefone varchar, servico_nome varchar, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.data, f.periodo, f.status, c.nome, c.telefone, s.nome, f.created_at
  from public.fila_espera f
  join public.clientes c on c.id = f.cliente_id
  join public.servicos s on s.id = f.servico_id
  join public.barbeiros b on b.id = f.barbeiro_id
  join public.barbeiros requested on requested.id = p_barbeiro_id
  where f.status in ('aguardando', 'notificado')
    and b.barbearia_id = requested.barbearia_id
    and (
      public.eh_admin_barbearia(b.barbearia_id)
      or (b.id = p_barbeiro_id and b.usuario_id = (select auth.uid()) and exists (
        select 1 from public.usuarios u where u.id = (select auth.uid()) and u.tipo = 'barbeiro'
      ))
    )
  order by f.data, f.created_at;
$$;

create or replace function public.criar_convite_barbeiro(p_barbearia_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.eh_admin_barbearia(p_barbearia_id) then
    raise exception 'Apenas administradores podem criar convites';
  end if;
  insert into public.convites_barbeiro (token, criado_por, barbearia_id)
  values (v_token, (select auth.uid()), p_barbearia_id);
  return v_token;
end;
$$;

create or replace function public.criar_bloqueio_agenda(
  p_barbeiro_id bigint, p_data_inicio date, p_data_fim date,
  p_hora_inicio time, p_hora_fim time, p_tipo text, p_motivo text
)
returns public.bloqueios_agenda
language plpgsql security definer set search_path = ''
as $$
declare
  v_bloqueio public.bloqueios_agenda;
  v_tipo text := coalesce(p_tipo, 'pausa');
  v_motivo text := trim(coalesce(p_motivo, 'Indisponível'));
begin
  if not public.pode_gerenciar_barbeiro(p_barbeiro_id) then raise exception 'Profissional inválido ou não autorizado'; end if;
  if p_data_inicio is null or p_data_fim is null or p_data_fim < p_data_inicio then raise exception 'Informe um período válido'; end if;
  if v_tipo not in ('pausa', 'folga', 'ferias') then raise exception 'Tipo de bloqueio inválido'; end if;
  if char_length(v_motivo) not between 2 and 120 then raise exception 'Informe um motivo entre 2 e 120 caracteres'; end if;
  if (p_hora_inicio is null) <> (p_hora_fim is null) or (p_hora_inicio is not null and p_hora_fim <= p_hora_inicio) then
    raise exception 'Informe início e fim válidos para a pausa';
  end if;
  if exists (
    select 1 from public.agendamentos a
    where a.barbeiro_id = p_barbeiro_id
      and a.data between p_data_inicio and p_data_fim
      and a.status not in ('cancelado', 'nao_compareceu')
      and (p_hora_inicio is null or (a.horario < p_hora_fim and a.horario + make_interval(mins => a.servico_duracao) > p_hora_inicio))
  ) then raise exception 'Há agendamentos ativos neste período. Cancele ou reagende-os antes de bloquear.'; end if;

  insert into public.bloqueios_agenda (barbeiro_id, data_inicio, data_fim, hora_inicio, hora_fim, tipo, motivo)
  values (p_barbeiro_id, p_data_inicio, p_data_fim, p_hora_inicio, p_hora_fim, v_tipo, v_motivo)
  returning * into v_bloqueio;
  return v_bloqueio;
end;
$$;

create or replace function public.atualizar_status_agendamento(p_agendamento_id bigint, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_status not in ('agendado', 'confirmado', 'concluido', 'cancelado', 'nao_compareceu') then raise exception 'Status inválido'; end if;
  update public.agendamentos a
  set status = p_status,
      cancelado_at = case when p_status = 'cancelado' then now() else null end
  where a.id = p_agendamento_id and public.pode_gerenciar_barbeiro(a.barbeiro_id);
  if not found then raise exception 'Agendamento não encontrado ou não autorizado'; end if;
end;
$$;

create or replace function public.atualizar_sinal_agendamento(p_agendamento_id bigint, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_status not in ('pendente', 'informado', 'pago', 'dispensado') then raise exception 'Status de sinal inválido'; end if;
  update public.agendamentos a set sinal_status = p_status
  where a.id = p_agendamento_id and public.pode_gerenciar_barbeiro(a.barbeiro_id);
  if not found then raise exception 'Agendamento não encontrado ou não autorizado'; end if;
end;
$$;

-- Remove broad default table/sequence privileges and grant only what the web
-- client actually needs. Anonymous visitors use the public RPCs below.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

grant select on public.usuarios, public.barbearias, public.barbeiros,
  public.servicos, public.agendamentos, public.clientes, public.clientes_barbearias,
  public.feriados_negocio, public.bloqueios_agenda, public.avaliacoes,
  public.fila_espera, public.notificacoes to authenticated;

grant update (nome, slug, endereco, telefone, logo_url, agendamento_publico,
  cancelamento_horas, sinal_percentual, pix_chave, pix_beneficiario,
  lembrete_email, lembrete_whatsapp, lembrete_push, bloquear_apos_faltas,
  dias_bloqueio, responsavel_legal, documento_legal, email_privacidade,
  prazo_retencao_meses, ativa, updated_at) on public.barbearias to authenticated;
grant update (nome, telefone, horario_inicio, horario_fim, horario_almoco_inicio,
  horario_almoco_fim, dias_trabalho) on public.barbeiros to authenticated;
grant insert, update, delete on public.servicos to authenticated;
grant insert, update, delete on public.feriados_negocio to authenticated;
grant delete on public.bloqueios_agenda to authenticated;
grant insert, update on public.avaliacoes to authenticated;
grant usage, select on sequence public.servicos_id_seq, public.avaliacoes_id_seq to authenticated;

-- SECURITY DEFINER routines are private by default; only the intended RPC
-- surface is granted back to browser roles.
do $privileges$
declare v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all privileges on function %s from public, anon, authenticated', v_function);
  end loop;
end;
$privileges$;

grant execute on function public.listar_barbearias_publicas(),
  public.obter_catalogo_publico(text),
  public.listar_barbeiros_publicos(uuid),
  public.buscar_horarios_disponiveis(bigint, bigint, date),
  public.obter_informacoes_legais_barbearia(text)
to anon, authenticated;

grant execute on function public.eh_admin_barbearia(uuid),
  public.eh_proprietario_barbearia(uuid),
  public.eh_membro_barbearia(uuid),
  public.pode_gerenciar_barbeiro(bigint),
  public.listar_minhas_barbearias(),
  public.obter_barbearia_autenticada(uuid),
  public.criar_barbearia(text, text),
  public.listar_meus_agendamentos_barbearia(uuid, bigint),
  public.listar_fila_profissional(bigint),
  public.criar_convite_barbeiro(uuid),
  public.criar_agendamento_com_origem(bigint, bigint, date, time, text),
  public.entrar_fila_espera(bigint, bigint, date, text),
  public.cancelar_fila_espera(bigint),
  public.atualizar_meu_perfil(text, text),
  public.confirmar_meu_agendamento(bigint),
  public.cancelar_meu_agendamento(bigint),
  public.atualizar_status_agendamento(bigint, text),
  public.informar_pagamento_sinal(bigint),
  public.atualizar_sinal_agendamento(bigint, text),
  public.criar_bloqueio_agenda(bigint, date, date, time, time, text, text),
  public.obter_status_cliente_barbearia(uuid),
  public.atualizar_preferencias_comunicacao(boolean, boolean, boolean, boolean),
  public.solicitar_exclusao_conta(),
  public.marcar_notificacoes_lidas(bigint[])
to authenticated;

grant execute on function public.consume_api_rate_limit(text, integer, integer),
  public.claim_due_notifications(integer, uuid, integer),
  public.cleanup_operational_data()
to service_role;

commit;
