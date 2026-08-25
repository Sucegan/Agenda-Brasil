-- Expand the administrator profile into a platform-wide control plane.
-- Authorization continues to be derived from public.usuarios, which cannot be
-- edited directly by browser users, and every exposed table remains protected
-- by RLS.

begin;

create index if not exists usuarios_tipo_idx on public.usuarios (tipo, created_at desc);
create index if not exists agendamentos_admin_data_status_idx
  on public.agendamentos (data, status) include (servico_preco);
create index if not exists agendamentos_sinal_status_idx
  on public.agendamentos (sinal_status) include (sinal_valor);
create index if not exists solicitacoes_exclusao_status_idx
  on public.solicitacoes_exclusao (status, solicitada_em);

create or replace function public.eh_admin_global()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid()) and u.tipo = 'admin'
  );
$$;

create or replace function public.eh_admin_barbearia(p_barbearia_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_barbearia_id is not null and public.eh_admin_global();
$$;

create or replace function public.eh_proprietario_barbearia(p_barbearia_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.eh_admin_barbearia(p_barbearia_id); $$;

create or replace function public.eh_membro_barbearia(p_barbearia_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.eh_admin_global() or exists (
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
  select public.eh_admin_global() or exists (
    select 1
    from public.barbeiros b
    join public.usuarios u on u.id = b.usuario_id
    where b.id = p_barbeiro_id
      and b.usuario_id = (select auth.uid())
      and u.tipo = 'barbeiro'
  );
$$;

drop policy if exists usuarios_select_admin_global on public.usuarios;
create policy usuarios_select_admin_global on public.usuarios for select to authenticated
  using ((select public.eh_admin_global()));

drop policy if exists clientes_select_admin_global on public.clientes;
create policy clientes_select_admin_global on public.clientes for select to authenticated
  using ((select public.eh_admin_global()));

drop policy if exists notificacoes_select_admin_global on public.notificacoes;
create policy notificacoes_select_admin_global on public.notificacoes for select to authenticated
  using ((select public.eh_admin_global()));

drop policy if exists telemetria_select_admin_global on public.telemetria_eventos;
create policy telemetria_select_admin_global on public.telemetria_eventos for select to authenticated
  using ((select public.eh_admin_global()));

drop policy if exists exclusoes_select_admin_global on public.solicitacoes_exclusao;
create policy exclusoes_select_admin_global on public.solicitacoes_exclusao for select to authenticated
  using ((select public.eh_admin_global()));

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.usuarios(id) on delete restrict,
  acao varchar(80) not null,
  entidade varchar(80) not null,
  entidade_id text,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_admin_idx
  on public.admin_audit_logs (admin_id, created_at desc);

alter table public.admin_audit_logs enable row level security;
drop policy if exists admin_audit_logs_select_admin on public.admin_audit_logs;
create policy admin_audit_logs_select_admin on public.admin_audit_logs for select to authenticated
  using ((select public.eh_admin_global()));

create or replace function public.listar_minhas_barbearias()
returns setof public.barbearias
language sql stable security definer set search_path = ''
as $$
  select x.*
  from public.barbearias x
  join public.usuarios u on u.id = (select auth.uid())
  where
    u.tipo = 'admin'
    or (
      u.tipo = 'barbeiro'
      and x.ativa
      and exists (
        select 1 from public.barbeiros b
        where b.barbearia_id = x.id and b.usuario_id = u.id
      )
    )
  order by x.ativa desc, x.created_at, x.nome;
$$;

create or replace function public.obter_barbearia_autenticada(p_barbearia_id uuid)
returns public.barbearias
language sql stable security definer set search_path = ''
as $$
  select x.*
  from public.barbearias x
  where x.id = p_barbearia_id
    and (select auth.uid()) is not null
    and (
      public.eh_membro_barbearia(x.id)
      or (x.ativa and x.agendamento_publico)
    );
$$;

create or replace function public.obter_resumo_admin()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
  v_inicio_mes date := date_trunc('month', timezone('America/Sao_Paulo', now()))::date;
  v_resultado jsonb;
begin
  if not public.eh_admin_global() then
    raise exception 'Acesso exclusivo de administrador' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'metricas', jsonb_build_object(
      'unidades_total', (select count(*) from public.barbearias),
      'unidades_ativas', (select count(*) from public.barbearias where ativa),
      'profissionais', (select count(*) from public.barbeiros),
      'clientes', (select count(*) from public.clientes),
      'usuarios', (select count(*) from public.usuarios),
      'agendamentos_hoje', (select count(*) from public.agendamentos where data = v_hoje and status not in ('cancelado', 'nao_compareceu')),
      'receita_mes', coalesce((
        select sum(coalesce(a.servico_preco, 0)) from public.agendamentos a
        where a.data >= v_inicio_mes and a.status = 'concluido'
      ), 0),
      'sinais_pendentes', coalesce((
        select sum(a.sinal_valor) from public.agendamentos a
        where a.sinal_status in ('pendente', 'informado') and a.status not in ('cancelado', 'nao_compareceu')
      ), 0),
      'avaliacao_media', coalesce((select round(avg(nota)::numeric, 2) from public.avaliacoes), 0),
      'avaliacoes_total', (select count(*) from public.avaliacoes),
      'erros_24h', (select count(*) from public.telemetria_eventos where created_at >= now() - interval '24 hours' and tipo in ('erro_cliente', 'erro_servidor')),
      'exclusoes_pendentes', (select count(*) from public.solicitacoes_exclusao where status = 'pendente')
    ),
    'unidades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'nome', x.nome,
        'slug', x.slug,
        'ativa', x.ativa,
        'agendamento_publico', x.agendamento_publico,
        'profissionais', (select count(*) from public.barbeiros b where b.barbearia_id = x.id),
        'agendamentos', (
          select count(*) from public.agendamentos a
          join public.barbeiros b on b.id = a.barbeiro_id
          where b.barbearia_id = x.id
        ),
        'receita_mes', coalesce((
          select sum(coalesce(a.servico_preco, 0)) from public.agendamentos a
          join public.barbeiros b on b.id = a.barbeiro_id
          where b.barbearia_id = x.id and a.data >= v_inicio_mes and a.status = 'concluido'
        ), 0),
        'avaliacao_media', coalesce((
          select round(avg(av.nota)::numeric, 2) from public.avaliacoes av
          join public.barbeiros b on b.id = av.barbeiro_id
          where b.barbearia_id = x.id
        ), 0)
      ) order by x.ativa desc, x.nome)
      from public.barbearias x
    ), '[]'::jsonb),
    'gerado_em', now()
  ) into v_resultado;

  return v_resultado;
end;
$$;

create or replace function public.listar_usuarios_admin(
  p_busca text default null,
  p_tipo text default null,
  p_limite integer default 100
)
returns table (
  id uuid,
  nome varchar,
  telefone varchar,
  email varchar,
  tipo varchar,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.eh_admin_global() then
    raise exception 'Acesso exclusivo de administrador' using errcode = '42501';
  end if;
  if p_tipo is not null and p_tipo not in ('admin', 'barbeiro', 'cliente') then
    raise exception 'Tipo de perfil inválido';
  end if;

  return query
  select u.id, u.nome, u.telefone, au.email::varchar, u.tipo, u.created_at
  from public.usuarios u
  join auth.users au on au.id = u.id
  where (p_tipo is null or u.tipo = p_tipo)
    and (
      nullif(trim(coalesce(p_busca, '')), '') is null
      or u.nome ilike '%' || trim(p_busca) || '%'
      or coalesce(au.email, '') ilike '%' || trim(p_busca) || '%'
      or coalesce(u.telefone, '') ilike '%' || trim(p_busca) || '%'
    )
  order by case u.tipo when 'admin' then 1 when 'barbeiro' then 2 else 3 end, u.nome
  limit least(greatest(coalesce(p_limite, 100), 1), 250);
end;
$$;

create or replace function public.listar_clientes_admin(
  p_barbearia_id uuid,
  p_busca text default null,
  p_limite integer default 100
)
returns table (
  id bigint,
  nome varchar,
  telefone varchar,
  email varchar,
  agendamentos bigint,
  ultimo_atendimento date,
  total_gasto numeric,
  faltas integer,
  pontos_fidelidade integer
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.eh_admin_global() then
    raise exception 'Acesso exclusivo de administrador' using errcode = '42501';
  end if;
  if not exists (select 1 from public.barbearias x where x.id = p_barbearia_id) then
    raise exception 'Barbearia não encontrada';
  end if;

  return query
  select
    c.id,
    c.nome,
    c.telefone,
    c.email,
    count(distinct a.id)::bigint as agendamentos,
    max(a.data) filter (where a.status = 'concluido') as ultimo_atendimento,
    coalesce(sum(coalesce(a.servico_preco, 0)) filter (where a.status = 'concluido'), 0)::numeric as total_gasto,
    coalesce(cb.faltas, 0)::integer,
    coalesce(cb.pontos_fidelidade, 0)::integer
  from public.clientes c
  left join public.clientes_barbearias cb
    on cb.cliente_id = c.id and cb.barbearia_id = p_barbearia_id
  left join public.agendamentos a
    on a.cliente_id = c.id
    and exists (
      select 1 from public.barbeiros b
      where b.id = a.barbeiro_id and b.barbearia_id = p_barbearia_id
    )
  where (cb.cliente_id is not null or a.id is not null)
    and (
      nullif(trim(coalesce(p_busca, '')), '') is null
      or c.nome ilike '%' || trim(p_busca) || '%'
      or coalesce(c.email, '') ilike '%' || trim(p_busca) || '%'
      or c.telefone ilike '%' || trim(p_busca) || '%'
    )
  group by c.id, c.nome, c.telefone, c.email, cb.faltas, cb.pontos_fidelidade
  order by max(a.data) desc nulls last, c.nome
  limit least(greatest(coalesce(p_limite, 100), 1), 250);
end;
$$;

create or replace function public.admin_alterar_status_barbearia(
  p_barbearia_id uuid,
  p_ativa boolean
)
returns public.barbearias
language plpgsql security definer set search_path = ''
as $$
declare
  v_anterior public.barbearias;
  v_resultado public.barbearias;
begin
  if not public.eh_admin_global() then
    raise exception 'Acesso exclusivo de administrador' using errcode = '42501';
  end if;

  select * into v_anterior from public.barbearias where id = p_barbearia_id for update;
  if not found then raise exception 'Barbearia não encontrada'; end if;

  update public.barbearias
  set ativa = p_ativa,
      agendamento_publico = case when p_ativa then agendamento_publico else false end,
      updated_at = now()
  where id = p_barbearia_id
  returning * into v_resultado;

  insert into public.admin_audit_logs (admin_id, acao, entidade, entidade_id, detalhes)
  values (
    (select auth.uid()),
    case when p_ativa then 'reativar' else 'desativar' end,
    'barbearia',
    p_barbearia_id::text,
    jsonb_build_object('nome', v_anterior.nome, 'ativa_anterior', v_anterior.ativa, 'ativa_atual', p_ativa)
  );

  return v_resultado;
end;
$$;

grant select on public.telemetria_eventos, public.solicitacoes_exclusao,
  public.admin_audit_logs to authenticated;

revoke all on function public.eh_admin_global() from public, anon, authenticated;
revoke all on function public.obter_resumo_admin() from public, anon, authenticated;
revoke all on function public.listar_usuarios_admin(text, text, integer) from public, anon, authenticated;
revoke all on function public.listar_clientes_admin(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.admin_alterar_status_barbearia(uuid, boolean) from public, anon, authenticated;

grant execute on function public.eh_admin_global(),
  public.obter_resumo_admin(),
  public.listar_usuarios_admin(text, text, integer),
  public.listar_clientes_admin(uuid, text, integer),
  public.admin_alterar_status_barbearia(uuid, boolean)
to authenticated;

commit;
