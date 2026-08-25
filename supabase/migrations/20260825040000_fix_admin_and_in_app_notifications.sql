-- Keep multi-unit administration with owners and provide a reliable in-app
-- notification channel that does not depend on an external e-mail provider.

begin;

create or replace function public.listar_minhas_barbearias()
returns setof public.barbearias
language sql stable security definer set search_path = ''
as $$
  select x.*
  from public.barbearias x
  where x.ativa and (
    (
      exists (select 1 from public.barbearias owned where owned.proprietario_id = auth.uid())
      and x.proprietario_id = auth.uid()
    )
    or (
      not exists (select 1 from public.barbearias owned where owned.proprietario_id = auth.uid())
      and exists (select 1 from public.barbeiros b where b.barbearia_id = x.id and b.usuario_id = auth.uid())
    )
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
  select * into v_perfil from public.usuarios where id = auth.uid() and tipo = 'barbeiro';
  if not found or not exists (select 1 from public.barbearias x where x.proprietario_id = auth.uid()) then
    raise exception 'Apenas administradores podem criar barbearias';
  end if;
  if (select count(*) from public.barbearias x where x.proprietario_id = auth.uid() and x.ativa) >= 20 then
    raise exception 'Limite de barbearias atingido';
  end if;
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then raise exception 'Nome inválido'; end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 80 then raise exception 'Identificador inválido'; end if;
  if exists (select 1 from public.barbearias x where x.slug = v_slug) then raise exception 'Este identificador já está em uso'; end if;

  insert into public.barbearias (
    proprietario_id, nome, slug, telefone, responsavel_legal, agendamento_publico
  ) values (
    auth.uid(), trim(p_nome), v_slug, v_perfil.telefone, v_perfil.nome, false
  ) returning * into v_result;
  insert into public.barbeiros (nome, telefone, usuario_id, barbearia_id)
  values (v_perfil.nome, v_perfil.telefone, auth.uid(), v_result.id);
  return v_result;
end;
$$;

drop policy if exists feriados_manage_members on public.feriados_negocio;
create policy feriados_manage_owner on public.feriados_negocio for all to authenticated
  using (public.eh_proprietario_barbearia(barbearia_id))
  with check (public.eh_proprietario_barbearia(barbearia_id) and criado_por = auth.uid());

alter table public.notificacoes drop constraint if exists notificacoes_canal_check;
alter table public.notificacoes add constraint notificacoes_canal_check
  check (canal in ('email', 'whatsapp', 'push', 'in_app'));
alter table public.notificacoes add column if not exists lida_em timestamptz;
create index if not exists notificacoes_usuario_lida_idx
  on public.notificacoes (usuario_id, lida_em, created_at desc)
  where canal = 'in_app';

create or replace function public.registrar_notificacao_interna_agendamento()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_usuario_id uuid;
  v_barbearia_id uuid;
  v_barbearia_nome varchar;
  v_tipo varchar;
  v_payload jsonb;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select c.usuario_id into v_usuario_id from public.clientes c where c.id = new.cliente_id;
  select x.id, x.nome into v_barbearia_id, v_barbearia_nome
  from public.barbearias x join public.barbeiros b on b.barbearia_id = x.id
  where b.id = new.barbeiro_id;
  if v_usuario_id is null or v_barbearia_id is null then return new; end if;

  v_tipo := case when tg_op = 'INSERT' then 'confirmacao' else 'status' end;
  v_payload := jsonb_build_object(
    'agendamento_id', new.id,
    'barbearia_id', v_barbearia_id,
    'barbearia_nome', v_barbearia_nome,
    'barbeiro_nome', new.barbeiro_nome,
    'servico_nome', new.servico_nome,
    'data', new.data,
    'horario', new.horario,
    'status', new.status,
    'sinal_status', new.sinal_status
  );
  insert into public.notificacoes (
    usuario_id, agendamento_id, canal, tipo, status, agendado_para, payload, enviada_em
  ) values (
    v_usuario_id, new.id, 'in_app', v_tipo, 'enviada', now(), v_payload, now()
  );
  return new;
end;
$$;

drop trigger if exists registrar_notificacao_interna_agendamento on public.agendamentos;
create trigger registrar_notificacao_interna_agendamento
after insert or update of status on public.agendamentos
for each row execute function public.registrar_notificacao_interna_agendamento();

insert into public.notificacoes (
  usuario_id, agendamento_id, canal, tipo, status, agendado_para, payload, enviada_em, created_at
)
select
  c.usuario_id,
  a.id,
  'in_app',
  'confirmacao',
  'enviada',
  a.created_at,
  jsonb_build_object(
    'agendamento_id', a.id,
    'barbearia_id', x.id,
    'barbearia_nome', x.nome,
    'barbeiro_nome', a.barbeiro_nome,
    'servico_nome', a.servico_nome,
    'data', a.data,
    'horario', a.horario,
    'status', a.status,
    'sinal_status', a.sinal_status
  ),
  a.created_at,
  a.created_at
from public.agendamentos a
join public.clientes c on c.id = a.cliente_id
join public.barbeiros b on b.id = a.barbeiro_id
join public.barbearias x on x.id = b.barbearia_id
where a.created_at >= now() - interval '90 days'
  and not exists (
    select 1 from public.notificacoes n
    where n.usuario_id = c.usuario_id and n.agendamento_id = a.id and n.canal = 'in_app'
  );

create or replace function public.marcar_notificacoes_lidas(p_ids bigint[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_total integer;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if coalesce(array_length(p_ids, 1), 0) > 100 then raise exception 'Muitas notificações'; end if;
  update public.notificacoes n set lida_em = now()
  where n.id = any(coalesce(p_ids, '{}'::bigint[]))
    and n.usuario_id = auth.uid() and n.canal = 'in_app' and n.lida_em is null;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public.listar_minhas_barbearias() from public;
revoke all on function public.criar_barbearia(text, text) from public;
revoke all on function public.registrar_notificacao_interna_agendamento() from public;
revoke all on function public.marcar_notificacoes_lidas(bigint[]) from public;
grant execute on function public.listar_minhas_barbearias(), public.criar_barbearia(text, text), public.marcar_notificacoes_lidas(bigint[]) to authenticated;

commit;
