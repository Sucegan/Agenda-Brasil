-- Separate platform administration from establishment ownership, add visual
-- identity and finance foundations, and make availability explicitly aware of
-- the complete service interval.

begin;

alter table public.usuarios drop constraint if exists usuarios_tipo_check;
alter table public.usuarios add constraint usuarios_tipo_check
  check (tipo in ('cliente', 'barbeiro', 'proprietario', 'admin'));

alter table public.barbearias
  add column if not exists cor_primaria varchar(7) not null default '#10b981',
  add column if not exists cor_secundaria varchar(7) not null default '#f59e0b',
  add column if not exists icone varchar(24) not null default 'tesoura',
  add column if not exists antecedencia_minutos smallint not null default 30,
  add column if not exists intervalo_grade_minutos smallint not null default 15,
  add column if not exists horizonte_agendamento_dias smallint not null default 60;

alter table public.barbeiros
  add column if not exists ativo boolean not null default true;

alter table public.barbearias drop constraint if exists barbearias_cor_primaria_check;
alter table public.barbearias add constraint barbearias_cor_primaria_check
  check (cor_primaria ~ '^#[0-9A-Fa-f]{6}$');
alter table public.barbearias drop constraint if exists barbearias_cor_secundaria_check;
alter table public.barbearias add constraint barbearias_cor_secundaria_check
  check (cor_secundaria ~ '^#[0-9A-Fa-f]{6}$');
alter table public.barbearias drop constraint if exists barbearias_icone_check;
alter table public.barbearias add constraint barbearias_icone_check
  check (icone in ('tesoura', 'coroa', 'barba', 'estrela', 'calendario', 'loja'));
alter table public.barbearias drop constraint if exists barbearias_antecedencia_check;
alter table public.barbearias add constraint barbearias_antecedencia_check
  check (antecedencia_minutos between 0 and 1440);
alter table public.barbearias drop constraint if exists barbearias_intervalo_grade_check;
alter table public.barbearias add constraint barbearias_intervalo_grade_check
  check (intervalo_grade_minutos between 5 and 60 and intervalo_grade_minutos % 5 = 0);
alter table public.barbearias drop constraint if exists barbearias_horizonte_check;
alter table public.barbearias add constraint barbearias_horizonte_check
  check (horizonte_agendamento_dias between 7 and 365);

create table if not exists public.configuracoes_plataforma (
  id boolean primary key default true check (id),
  nome_site varchar(80) not null default 'Agenda Brasil',
  subtitulo varchar(160) not null default 'Agendamentos simples, rápidos e seguros',
  nome_direitos varchar(120) not null default 'Sucegan Tech',
  email_suporte varchar(254),
  aviso_global varchar(240),
  modo_manutencao boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.usuarios(id) on delete set null
);

insert into public.configuracoes_plataforma (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.terminais_pagamento (
  id bigint generated always as identity primary key,
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  apelido varchar(80) not null,
  provedor varchar(80) not null,
  identificador varchar(120),
  aceita_debito boolean not null default true,
  aceita_credito boolean not null default true,
  aceita_aproximacao boolean not null default true,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbearia_id, apelido)
);

create table if not exists public.planos_mensais (
  id bigint generated always as identity primary key,
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  nome varchar(80) not null,
  descricao varchar(240),
  preco numeric(10, 2) not null check (preco >= 0),
  atendimentos_inclusos smallint not null default 1 check (atendimentos_inclusos between 1 and 60),
  desconto_excedente numeric(5, 2) not null default 0 check (desconto_excedente between 0 and 100),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbearia_id, nome)
);

create table if not exists public.assinaturas_clientes (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.planos_mensais(id) on delete restrict,
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  status varchar(24) not null default 'ativa'
    check (status in ('pendente', 'ativa', 'pausada', 'inadimplente', 'cancelada')),
  inicio_em date not null default timezone('America/Sao_Paulo', now())::date,
  proxima_cobranca_em date,
  atendimentos_usados smallint not null default 0 check (atendimentos_usados >= 0),
  referencia_externa varchar(160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assinaturas_cliente_plano_ativa_idx
  on public.assinaturas_clientes (plano_id, cliente_id)
  where status in ('pendente', 'ativa', 'pausada', 'inadimplente');

create table if not exists public.movimentacoes_financeiras (
  id bigint generated always as identity primary key,
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  agendamento_id bigint references public.agendamentos(id) on delete set null,
  tipo varchar(16) not null check (tipo in ('receita', 'despesa', 'estorno')),
  categoria varchar(80) not null,
  metodo varchar(24) not null
    check (metodo in ('dinheiro', 'pix', 'debito', 'credito', 'online', 'outro')),
  status varchar(16) not null default 'pago' check (status in ('pendente', 'pago', 'cancelado')),
  valor_bruto numeric(10, 2) not null check (valor_bruto >= 0),
  taxa numeric(10, 2) not null default 0 check (taxa >= 0 and taxa <= valor_bruto),
  valor_liquido numeric(10, 2) generated always as (valor_bruto - taxa) stored,
  descricao varchar(240),
  referencia_externa varchar(160),
  ocorrido_em timestamptz not null default now(),
  criado_por uuid not null references public.usuarios(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists terminais_pagamento_barbearia_idx
  on public.terminais_pagamento (barbearia_id, ativa, apelido);
create index if not exists planos_mensais_barbearia_idx
  on public.planos_mensais (barbearia_id, ativo, nome);
create index if not exists assinaturas_clientes_cliente_idx
  on public.assinaturas_clientes (cliente_id, status, proxima_cobranca_em);
create index if not exists movimentacoes_financeiras_periodo_idx
  on public.movimentacoes_financeiras (barbearia_id, ocorrido_em desc, status)
  include (tipo, valor_bruto, taxa, metodo);
create unique index if not exists movimentacoes_agendamento_receita_unique_idx
  on public.movimentacoes_financeiras (agendamento_id)
  where agendamento_id is not null and tipo = 'receita' and status <> 'cancelado';
create index if not exists barbeiros_barbearia_ativo_idx
  on public.barbeiros (barbearia_id, ativo, nome);

alter table public.configuracoes_plataforma enable row level security;
alter table public.terminais_pagamento enable row level security;
alter table public.planos_mensais enable row level security;
alter table public.assinaturas_clientes enable row level security;
alter table public.movimentacoes_financeiras enable row level security;

create or replace function public.eh_proprietario_barbearia(p_barbearia_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.eh_admin_global() or exists (
    select 1
    from public.barbearias x
    join public.usuarios u on u.id = (select auth.uid())
    where x.id = p_barbearia_id
      and x.proprietario_id = u.id
      and u.tipo = 'proprietario'
  );
$$;

create or replace function public.eh_admin_barbearia(p_barbearia_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select p_barbearia_id is not null and public.eh_proprietario_barbearia(p_barbearia_id); $$;

create or replace function public.eh_membro_barbearia(p_barbearia_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.eh_proprietario_barbearia(p_barbearia_id) or exists (
    select 1
    from public.barbeiros b
    join public.usuarios u on u.id = b.usuario_id
    where b.barbearia_id = p_barbearia_id
      and b.usuario_id = (select auth.uid())
      and b.ativo
      and u.tipo = 'barbeiro'
  );
$$;

create or replace function public.pode_gerenciar_barbeiro(p_barbeiro_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.barbeiros b
    where b.id = p_barbeiro_id
      and (
        public.eh_proprietario_barbearia(b.barbearia_id)
        or (b.usuario_id = (select auth.uid()) and b.ativo)
      )
  );
$$;

create or replace function public.listar_minhas_barbearias()
returns setof public.barbearias
language sql stable security definer set search_path = ''
as $$
  select x.*
  from public.barbearias x
  join public.usuarios u on u.id = (select auth.uid())
  where
    u.tipo = 'admin'
    or (u.tipo = 'proprietario' and x.proprietario_id = u.id)
    or (
      u.tipo = 'barbeiro'
      and x.ativa
      and exists (
        select 1 from public.barbeiros b
        where b.barbearia_id = x.id and b.usuario_id = u.id and b.ativo
      )
    )
  order by x.ativa desc, x.created_at, x.nome;
$$;

drop policy if exists configuracoes_plataforma_admin_select on public.configuracoes_plataforma;
drop policy if exists configuracoes_plataforma_admin_update on public.configuracoes_plataforma;
create policy configuracoes_plataforma_admin_select on public.configuracoes_plataforma
  for select to authenticated using ((select public.eh_admin_global()));
create policy configuracoes_plataforma_admin_update on public.configuracoes_plataforma
  for update to authenticated using ((select public.eh_admin_global()))
  with check ((select public.eh_admin_global()));

drop policy if exists terminais_pagamento_owner_select on public.terminais_pagamento;
drop policy if exists terminais_pagamento_owner_insert on public.terminais_pagamento;
drop policy if exists terminais_pagamento_owner_update on public.terminais_pagamento;
drop policy if exists terminais_pagamento_owner_delete on public.terminais_pagamento;
create policy terminais_pagamento_owner_select on public.terminais_pagamento
  for select to authenticated using ((select public.eh_proprietario_barbearia(barbearia_id)));
create policy terminais_pagamento_owner_insert on public.terminais_pagamento
  for insert to authenticated with check ((select public.eh_proprietario_barbearia(barbearia_id)));
create policy terminais_pagamento_owner_update on public.terminais_pagamento
  for update to authenticated using ((select public.eh_proprietario_barbearia(barbearia_id)))
  with check ((select public.eh_proprietario_barbearia(barbearia_id)));
create policy terminais_pagamento_owner_delete on public.terminais_pagamento
  for delete to authenticated using ((select public.eh_proprietario_barbearia(barbearia_id)));

drop policy if exists planos_mensais_owner_select on public.planos_mensais;
drop policy if exists planos_mensais_owner_insert on public.planos_mensais;
drop policy if exists planos_mensais_owner_update on public.planos_mensais;
drop policy if exists planos_mensais_owner_delete on public.planos_mensais;
create policy planos_mensais_owner_select on public.planos_mensais
  for select to authenticated using ((select public.eh_proprietario_barbearia(barbearia_id)));
create policy planos_mensais_owner_insert on public.planos_mensais
  for insert to authenticated with check ((select public.eh_proprietario_barbearia(barbearia_id)));
create policy planos_mensais_owner_update on public.planos_mensais
  for update to authenticated using ((select public.eh_proprietario_barbearia(barbearia_id)))
  with check ((select public.eh_proprietario_barbearia(barbearia_id)));
create policy planos_mensais_owner_delete on public.planos_mensais
  for delete to authenticated using ((select public.eh_proprietario_barbearia(barbearia_id)));

drop policy if exists assinaturas_clientes_owner_select on public.assinaturas_clientes;
drop policy if exists assinaturas_clientes_owner_insert on public.assinaturas_clientes;
drop policy if exists assinaturas_clientes_owner_update on public.assinaturas_clientes;
drop policy if exists assinaturas_clientes_cliente_select on public.assinaturas_clientes;
create policy assinaturas_clientes_owner_select on public.assinaturas_clientes
  for select to authenticated using (exists (
    select 1 from public.planos_mensais p
    where p.id = plano_id and (select public.eh_proprietario_barbearia(p.barbearia_id))
  ));
create policy assinaturas_clientes_owner_insert on public.assinaturas_clientes
  for insert to authenticated with check (exists (
    select 1 from public.planos_mensais p
    where p.id = plano_id and (select public.eh_proprietario_barbearia(p.barbearia_id))
  ));
create policy assinaturas_clientes_owner_update on public.assinaturas_clientes
  for update to authenticated using (exists (
    select 1 from public.planos_mensais p
    where p.id = plano_id and (select public.eh_proprietario_barbearia(p.barbearia_id))
  )) with check (exists (
    select 1 from public.planos_mensais p
    where p.id = plano_id and (select public.eh_proprietario_barbearia(p.barbearia_id))
  ));
create policy assinaturas_clientes_cliente_select on public.assinaturas_clientes
  for select to authenticated using (exists (
    select 1 from public.clientes c
    where c.id = cliente_id and c.usuario_id = (select auth.uid())
  ));

drop policy if exists movimentacoes_financeiras_owner_select on public.movimentacoes_financeiras;
drop policy if exists movimentacoes_financeiras_owner_insert on public.movimentacoes_financeiras;
drop policy if exists movimentacoes_financeiras_owner_update on public.movimentacoes_financeiras;
create policy movimentacoes_financeiras_owner_select on public.movimentacoes_financeiras
  for select to authenticated using ((select public.eh_proprietario_barbearia(barbearia_id)));
create policy movimentacoes_financeiras_owner_insert on public.movimentacoes_financeiras
  for insert to authenticated with check (
    (select public.eh_proprietario_barbearia(barbearia_id))
    and criado_por = (select auth.uid())
  );
create policy movimentacoes_financeiras_owner_update on public.movimentacoes_financeiras
  for update to authenticated using ((select public.eh_proprietario_barbearia(barbearia_id)))
  with check ((select public.eh_proprietario_barbearia(barbearia_id)));

create or replace function public.obter_configuracao_publica()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'nome_site', c.nome_site,
    'subtitulo', c.subtitulo,
    'nome_direitos', c.nome_direitos,
    'email_suporte', c.email_suporte,
    'aviso_global', c.aviso_global,
    'modo_manutencao', c.modo_manutencao
  )
  from public.configuracoes_plataforma c
  where c.id = true;
$$;

create or replace function public.listar_estabelecimentos_publicos()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'nome', x.nome,
    'slug', x.slug,
    'endereco', x.endereco,
    'telefone', x.telefone,
    'logo_url', x.logo_url,
    'cor_primaria', x.cor_primaria,
    'cor_secundaria', x.cor_secundaria,
    'icone', x.icone,
    'profissionais', (select count(*) from public.barbeiros b where b.barbearia_id = x.id and b.ativo),
    'avaliacao_media', coalesce((
      select round(avg(a.nota)::numeric, 1)
      from public.avaliacoes a
      join public.barbeiros b on b.id = a.barbeiro_id
      where b.barbearia_id = x.id
    ), 0)
  ) order by x.nome), '[]'::jsonb)
  from public.barbearias x
  where x.ativa and x.agendamento_publico;
$$;

-- The pre-multi-establishment overload returned legacy global settings,
-- including the Pix key. All public clients must use the scoped catalog.
drop function if exists public.obter_catalogo_publico();

create or replace function public.obter_catalogo_publico(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'negocio', jsonb_build_object(
      'id', x.id,
      'nome', x.nome,
      'endereco', x.endereco,
      'telefone', x.telefone,
      'logo_url', x.logo_url,
      'slug', x.slug,
      'agendamento_publico', x.agendamento_publico,
      'cancelamento_horas', x.cancelamento_horas,
      'sinal_percentual', x.sinal_percentual,
      'pix_chave', null,
      'pix_beneficiario', null,
      'cor_primaria', x.cor_primaria,
      'cor_secundaria', x.cor_secundaria,
      'icone', x.icone,
      'antecedencia_minutos', x.antecedencia_minutos,
      'intervalo_grade_minutos', x.intervalo_grade_minutos,
      'horizonte_agendamento_dias', x.horizonte_agendamento_dias
    ),
    'barbeiros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'nome', b.nome,
        'horario_inicio', b.horario_inicio::text,
        'horario_fim', b.horario_fim::text,
        'dias_trabalho', b.dias_trabalho
      ) order by b.nome)
      from public.barbeiros b where b.barbearia_id = x.id and b.ativo
    ), '[]'::jsonb),
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'nome', s.nome,
        'preco', s.preco,
        'duracao', s.duracao,
        'barbeiro_id', s.barbeiro_id
      ) order by s.nome)
      from public.servicos s
      join public.barbeiros b on b.id = s.barbeiro_id
      where b.barbearia_id = x.id
    ), '[]'::jsonb),
    'feriados', coalesce((
      select jsonb_agg(jsonb_build_object('data', f.data, 'descricao', f.descricao) order by f.data)
      from public.feriados_negocio f
      where f.barbearia_id = x.id and f.data >= timezone('America/Sao_Paulo', now())::date
    ), '[]'::jsonb)
  )
  from public.barbearias x
  where x.slug = lower(trim(p_slug)) and x.ativa;
$$;

create or replace function public.listar_barbeiros_publicos(p_barbearia_id uuid)
returns table (id bigint, nome varchar, horario_inicio text, horario_fim text, dias_trabalho smallint[])
language sql stable security definer set search_path = ''
as $$
  select b.id, b.nome, b.horario_inicio::text, b.horario_fim::text, b.dias_trabalho
  from public.barbeiros b
  join public.barbearias x on x.id = b.barbearia_id
  where b.barbearia_id = p_barbearia_id and b.ativo and x.ativa
  order by b.nome;
$$;

drop function if exists public.buscar_horarios_disponiveis(bigint, bigint, date);
create function public.buscar_horarios_disponiveis(
  p_barbeiro_id bigint,
  p_servico_id bigint,
  p_data date
)
returns table (horario text, horario_fim text, duracao integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_barbeiro public.barbeiros;
  v_servico public.servicos;
  v_barbearia public.barbearias;
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
  v_inicio_minimo timestamp;
begin
  select * into v_barbeiro from public.barbeiros where id = p_barbeiro_id;
  if not found then raise exception 'Profissional inválido'; end if;
  if not v_barbeiro.ativo then raise exception 'Profissional indisponível'; end if;
  select * into v_barbearia from public.barbearias where id = v_barbeiro.barbearia_id and ativa;
  if not found then raise exception 'Estabelecimento indisponível'; end if;
  if (select auth.uid()) is null and not v_barbearia.agendamento_publico then
    raise exception 'Agendamento público está desativado';
  end if;
  if p_data < v_hoje then raise exception 'Não é possível consultar uma data passada'; end if;
  if p_data > v_hoje + v_barbearia.horizonte_agendamento_dias then
    raise exception 'A agenda ainda não foi aberta para esta data';
  end if;
  if exists (
    select 1 from public.feriados_negocio f
    where f.barbearia_id = v_barbeiro.barbearia_id and f.data = p_data
  ) then return; end if;
  select * into v_servico
  from public.servicos where id = p_servico_id and barbeiro_id = p_barbeiro_id;
  if not found then raise exception 'Serviço não pertence ao profissional selecionado'; end if;
  if not extract(dow from p_data)::smallint = any(v_barbeiro.dias_trabalho) then return; end if;

  v_inicio_minimo := timezone('America/Sao_Paulo', now())
    + make_interval(mins => v_barbearia.antecedencia_minutos);

  return query
  with slots as (
    select slot::time as inicio
    from generate_series(
      p_data + v_barbeiro.horario_inicio,
      p_data + v_barbeiro.horario_fim - make_interval(mins => v_servico.duracao),
      make_interval(mins => v_barbearia.intervalo_grade_minutos)
    ) as slot
  )
  select
    slots.inicio::text,
    (slots.inicio + make_interval(mins => v_servico.duracao))::text,
    v_servico.duracao
  from slots
  where p_data + slots.inicio >= v_inicio_minimo
    and (
      v_barbeiro.horario_almoco_inicio is null
      or slots.inicio + make_interval(mins => v_servico.duracao) <= v_barbeiro.horario_almoco_inicio
      or slots.inicio >= v_barbeiro.horario_almoco_fim
    )
    and not exists (
      select 1 from public.agendamentos a
      where a.barbeiro_id = p_barbeiro_id
        and a.data = p_data
        and a.status not in ('cancelado', 'nao_compareceu')
        and slots.inicio < a.horario + make_interval(mins => coalesce(a.servico_duracao, 15))
        and a.horario < slots.inicio + make_interval(mins => v_servico.duracao)
    )
    and not exists (
      select 1 from public.bloqueios_agenda b
      where b.barbeiro_id = p_barbeiro_id
        and p_data between b.data_inicio and b.data_fim
        and (
          b.hora_inicio is null
          or slots.inicio < b.hora_fim
            and slots.inicio + make_interval(mins => v_servico.duracao) > b.hora_inicio
        )
    )
  order by slots.inicio;
end;
$$;

create or replace function public.alterar_status_profissional(
  p_barbeiro_id bigint, p_ativo boolean
)
returns public.barbeiros
language plpgsql security definer set search_path = ''
as $$
declare
  v_barbeiro public.barbeiros;
  v_resultado public.barbeiros;
begin
  select * into v_barbeiro from public.barbeiros where id = p_barbeiro_id for update;
  if not found or not public.eh_proprietario_barbearia(v_barbeiro.barbearia_id) then
    raise exception 'Profissional não encontrado ou acesso não autorizado' using errcode = '42501';
  end if;
  if not p_ativo and exists (
    select 1 from public.agendamentos a
    where a.barbeiro_id = p_barbeiro_id
      and a.data >= timezone('America/Sao_Paulo', now())::date
      and a.status not in ('cancelado', 'concluido', 'nao_compareceu')
  ) then raise exception 'Reagende ou cancele os próximos horários antes de desativar o profissional'; end if;
  update public.barbeiros set ativo = p_ativo where id = p_barbeiro_id returning * into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.criar_agendamento(
  p_barbeiro_id bigint, p_servico_id bigint, p_data date, p_horario time
)
returns public.agendamentos
language plpgsql security definer set search_path = ''
as $$
declare
  v_cliente public.clientes;
  v_barbeiro public.barbeiros;
  v_servico public.servicos;
  v_barbearia public.barbearias;
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
  v_inicio_minimo timestamp;
  v_resultado public.agendamentos;
begin
  if (select auth.uid()) is null then raise exception 'Autenticação obrigatória'; end if;
  select * into v_cliente from public.clientes where usuario_id = (select auth.uid());
  if not found then raise exception 'Apenas clientes podem agendar'; end if;
  select * into v_barbeiro from public.barbeiros where id = p_barbeiro_id;
  if not found then raise exception 'Profissional inválido'; end if;
  if not v_barbeiro.ativo then raise exception 'Profissional indisponível'; end if;
  select * into v_barbearia from public.barbearias where id = v_barbeiro.barbearia_id and ativa;
  if not found then raise exception 'Estabelecimento indisponível'; end if;
  select * into v_servico from public.servicos where id = p_servico_id and barbeiro_id = p_barbeiro_id;
  if not found then raise exception 'Serviço não pertence ao profissional selecionado'; end if;
  v_inicio_minimo := timezone('America/Sao_Paulo', now())
    + make_interval(mins => v_barbearia.antecedencia_minutos);
  if p_data + p_horario < v_inicio_minimo then
    raise exception 'Escolha um horário com pelo menos % minutos de antecedência', v_barbearia.antecedencia_minutos;
  end if;
  if p_data > v_hoje + v_barbearia.horizonte_agendamento_dias then
    raise exception 'A agenda ainda não foi aberta para esta data';
  end if;
  if exists (
    select 1 from public.feriados_negocio f
    where f.barbearia_id = v_barbeiro.barbearia_id and f.data = p_data
  ) then raise exception 'O estabelecimento não abre nesta data'; end if;
  if not extract(dow from p_data)::smallint = any(v_barbeiro.dias_trabalho) then
    raise exception 'O profissional não atende neste dia';
  end if;
  if p_horario < v_barbeiro.horario_inicio
     or p_horario + make_interval(mins => v_servico.duracao) > v_barbeiro.horario_fim then
    raise exception 'O serviço completo não cabe no expediente';
  end if;
  if v_barbeiro.horario_almoco_inicio is not null
     and p_horario < v_barbeiro.horario_almoco_fim
     and p_horario + make_interval(mins => v_servico.duracao) > v_barbeiro.horario_almoco_inicio then
    raise exception 'Este serviço ultrapassa o intervalo do profissional';
  end if;
  if exists (
    select 1 from public.bloqueios_agenda b
    where b.barbeiro_id = p_barbeiro_id
      and p_data between b.data_inicio and b.data_fim
      and (b.hora_inicio is null or (
        p_horario < b.hora_fim
        and p_horario + make_interval(mins => v_servico.duracao) > b.hora_inicio
      ))
  ) then raise exception 'Este período está bloqueado pelo profissional'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_barbeiro_id::text || ':' || p_data::text, 0)
  );
  if exists (
    select 1 from public.agendamentos a
    where a.barbeiro_id = p_barbeiro_id
      and a.data = p_data
      and a.status not in ('cancelado', 'nao_compareceu')
      and p_horario < a.horario + make_interval(mins => coalesce(a.servico_duracao, 15))
      and a.horario < p_horario + make_interval(mins => v_servico.duracao)
  ) then raise exception 'Este período acabou de ser ocupado. Escolha outro horário'; end if;

  insert into public.agendamentos (
    cliente_id, barbeiro_id, servico_id, data, horario,
    servico_nome, servico_preco, servico_duracao,
    barbeiro_nome, cliente_nome, cliente_telefone
  ) values (
    v_cliente.id, v_barbeiro.id, v_servico.id, p_data, p_horario,
    v_servico.nome, v_servico.preco, v_servico.duracao,
    v_barbeiro.nome, v_cliente.nome, v_cliente.telefone
  ) returning * into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.admin_atualizar_tipo_usuario(p_usuario_id uuid, p_tipo text)
returns public.usuarios
language plpgsql security definer set search_path = ''
as $$
declare
  v_anterior public.usuarios;
  v_resultado public.usuarios;
begin
  if not public.eh_admin_global() then
    raise exception 'Acesso exclusivo de administrador' using errcode = '42501';
  end if;
  if p_tipo not in ('cliente', 'barbeiro', 'proprietario', 'admin') then
    raise exception 'Tipo de perfil inválido';
  end if;
  select * into v_anterior from public.usuarios where id = p_usuario_id for update;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if p_usuario_id = (select auth.uid()) and p_tipo <> 'admin' then
    raise exception 'Você não pode remover o próprio acesso administrativo';
  end if;
  if exists (select 1 from public.barbearias x where x.proprietario_id = p_usuario_id)
     and p_tipo not in ('proprietario', 'admin') then
    raise exception 'Transfira as unidades deste proprietário antes de alterar o perfil';
  end if;
  if exists (select 1 from public.barbeiros b where b.usuario_id = p_usuario_id)
     and p_tipo not in ('barbeiro', 'proprietario', 'admin') then
    raise exception 'Remova o vínculo profissional antes de alterar este perfil';
  end if;
  update public.usuarios set tipo = p_tipo where id = p_usuario_id returning * into v_resultado;
  insert into public.admin_audit_logs (admin_id, acao, entidade, entidade_id, detalhes)
  values ((select auth.uid()), 'alterar_perfil', 'usuario', p_usuario_id::text,
    jsonb_build_object('tipo_anterior', v_anterior.tipo, 'tipo_atual', p_tipo));
  return v_resultado;
end;
$$;

create or replace function public.admin_atribuir_proprietario_barbearia(
  p_barbearia_id uuid, p_proprietario_id uuid
)
returns public.barbearias
language plpgsql security definer set search_path = ''
as $$
declare
  v_anterior uuid;
  v_resultado public.barbearias;
begin
  if not public.eh_admin_global() then
    raise exception 'Acesso exclusivo de administrador' using errcode = '42501';
  end if;
  if not exists (select 1 from public.usuarios u where u.id = p_proprietario_id) then
    raise exception 'Usuário não encontrado';
  end if;
  select proprietario_id into v_anterior from public.barbearias where id = p_barbearia_id for update;
  if not found then raise exception 'Estabelecimento não encontrado'; end if;
  update public.barbearias set proprietario_id = p_proprietario_id, updated_at = now()
  where id = p_barbearia_id returning * into v_resultado;
  update public.usuarios set tipo = 'proprietario'
  where id = p_proprietario_id and tipo <> 'admin';
  insert into public.admin_audit_logs (admin_id, acao, entidade, entidade_id, detalhes)
  values ((select auth.uid()), 'atribuir_proprietario', 'barbearia', p_barbearia_id::text,
    jsonb_build_object('proprietario_anterior', v_anterior, 'proprietario_atual', p_proprietario_id));
  return v_resultado;
end;
$$;

create or replace function public.registrar_movimentacao_financeira(
  p_barbearia_id uuid,
  p_agendamento_id bigint,
  p_tipo text,
  p_categoria text,
  p_metodo text,
  p_valor_bruto numeric,
  p_taxa numeric,
  p_status text,
  p_descricao text
)
returns public.movimentacoes_financeiras
language plpgsql security definer set search_path = ''
as $$
declare v_resultado public.movimentacoes_financeiras;
begin
  if not public.eh_proprietario_barbearia(p_barbearia_id) then
    raise exception 'Acesso financeiro não autorizado' using errcode = '42501';
  end if;
  if p_tipo not in ('receita', 'despesa', 'estorno')
     or p_metodo not in ('dinheiro', 'pix', 'debito', 'credito', 'online', 'outro')
     or p_status not in ('pendente', 'pago', 'cancelado') then
    raise exception 'Dados financeiros inválidos';
  end if;
  if char_length(trim(coalesce(p_categoria, ''))) not between 2 and 80 then
    raise exception 'Informe uma categoria válida';
  end if;
  if p_valor_bruto is null or p_valor_bruto < 0
     or coalesce(p_taxa, 0) < 0 or coalesce(p_taxa, 0) > p_valor_bruto then
    raise exception 'Valor ou taxa inválidos';
  end if;
  if p_agendamento_id is not null and not exists (
    select 1 from public.agendamentos a
    join public.barbeiros b on b.id = a.barbeiro_id
    where a.id = p_agendamento_id and b.barbearia_id = p_barbearia_id
  ) then raise exception 'Agendamento não pertence ao estabelecimento'; end if;

  insert into public.movimentacoes_financeiras (
    barbearia_id, agendamento_id, tipo, categoria, metodo, status,
    valor_bruto, taxa, descricao, criado_por
  ) values (
    p_barbearia_id, p_agendamento_id, p_tipo, trim(p_categoria), p_metodo, p_status,
    p_valor_bruto, coalesce(p_taxa, 0), nullif(trim(coalesce(p_descricao, '')), ''), (select auth.uid())
  ) returning * into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.obter_resumo_financeiro(
  p_barbearia_id uuid,
  p_inicio date,
  p_fim date
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_resultado jsonb;
begin
  if not public.eh_proprietario_barbearia(p_barbearia_id) then
    raise exception 'Acesso financeiro não autorizado' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 370 then
    raise exception 'Período financeiro inválido';
  end if;
  select jsonb_build_object(
    'receitas', coalesce(sum(valor_bruto) filter (where tipo = 'receita' and status = 'pago'), 0),
    'despesas', coalesce(sum(valor_bruto) filter (where tipo = 'despesa' and status = 'pago'), 0),
    'estornos', coalesce(sum(valor_bruto) filter (where tipo = 'estorno' and status = 'pago'), 0),
    'taxas', coalesce(sum(taxa) filter (where status = 'pago'), 0),
    'saldo', coalesce(sum(case
      when tipo = 'receita' and status = 'pago' then valor_liquido
      when tipo in ('despesa', 'estorno') and status = 'pago' then -valor_bruto
      else 0 end), 0),
    'pendentes', coalesce(sum(valor_bruto) filter (where status = 'pendente'), 0),
    'movimentacoes', count(*)
  ) into v_resultado
  from public.movimentacoes_financeiras m
  where m.barbearia_id = p_barbearia_id
    and m.ocorrido_em >= p_inicio::timestamp
    and m.ocorrido_em < (p_fim + 1)::timestamp;
  return v_resultado;
end;
$$;

create or replace function public.listar_planos_publicos(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nome', p.nome,
    'descricao', p.descricao,
    'preco', p.preco,
    'atendimentos_inclusos', p.atendimentos_inclusos,
    'desconto_excedente', p.desconto_excedente
  ) order by p.preco, p.nome), '[]'::jsonb)
  from public.planos_mensais p
  join public.barbearias x on x.id = p.barbearia_id
  where x.slug = lower(trim(p_slug)) and x.ativa and x.agendamento_publico and p.ativo;
$$;

create or replace function public.listar_usuarios_admin(
  p_busca text default null,
  p_tipo text default null,
  p_limite integer default 100
)
returns table (
  id uuid, nome varchar, telefone varchar, email varchar, tipo varchar, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.eh_admin_global() then
    raise exception 'Acesso exclusivo de administrador' using errcode = '42501';
  end if;
  if p_tipo is not null and p_tipo not in ('admin', 'proprietario', 'barbeiro', 'cliente') then
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
  order by case u.tipo when 'admin' then 1 when 'proprietario' then 2 when 'barbeiro' then 3 else 4 end, u.nome
  limit least(greatest(coalesce(p_limite, 100), 1), 250);
end;
$$;

revoke all on public.configuracoes_plataforma, public.terminais_pagamento,
  public.planos_mensais, public.assinaturas_clientes,
  public.movimentacoes_financeiras from anon, authenticated;
grant select, update on public.configuracoes_plataforma to authenticated;
grant select, insert, update, delete on public.terminais_pagamento,
  public.planos_mensais to authenticated;
grant select, insert, update on public.assinaturas_clientes,
  public.movimentacoes_financeiras to authenticated;
grant usage, select on sequence public.terminais_pagamento_id_seq,
  public.planos_mensais_id_seq, public.assinaturas_clientes_id_seq,
  public.movimentacoes_financeiras_id_seq to authenticated;

grant update (cor_primaria, cor_secundaria, icone, antecedencia_minutos,
  intervalo_grade_minutos, horizonte_agendamento_dias) on public.barbearias to authenticated;

revoke all on function public.obter_configuracao_publica() from public, anon, authenticated;
revoke all on function public.listar_estabelecimentos_publicos() from public, anon, authenticated;
revoke all on function public.obter_catalogo_publico(text) from public, anon, authenticated;
revoke all on function public.listar_barbeiros_publicos(uuid) from public, anon, authenticated;
revoke all on function public.buscar_horarios_disponiveis(bigint, bigint, date) from public, anon, authenticated;
revoke all on function public.listar_planos_publicos(text) from public, anon, authenticated;
grant execute on function public.obter_configuracao_publica(),
  public.listar_estabelecimentos_publicos(),
  public.obter_catalogo_publico(text),
  public.listar_barbeiros_publicos(uuid),
  public.buscar_horarios_disponiveis(bigint, bigint, date),
  public.listar_planos_publicos(text)
to anon, authenticated;

revoke all on function public.admin_atualizar_tipo_usuario(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_atribuir_proprietario_barbearia(uuid, uuid) from public, anon, authenticated;
revoke all on function public.registrar_movimentacao_financeira(uuid, bigint, text, text, text, numeric, numeric, text, text) from public, anon, authenticated;
revoke all on function public.obter_resumo_financeiro(uuid, date, date) from public, anon, authenticated;
revoke all on function public.alterar_status_profissional(bigint, boolean) from public, anon, authenticated;
grant execute on function public.admin_atualizar_tipo_usuario(uuid, text),
  public.admin_atribuir_proprietario_barbearia(uuid, uuid),
  public.registrar_movimentacao_financeira(uuid, bigint, text, text, text, numeric, numeric, text, text),
  public.obter_resumo_financeiro(uuid, date, date),
  public.alterar_status_profissional(bigint, boolean)
to authenticated;

grant execute on function public.eh_admin_global(),
  public.eh_admin_barbearia(uuid), public.eh_proprietario_barbearia(uuid),
  public.eh_membro_barbearia(uuid), public.pode_gerenciar_barbeiro(bigint),
  public.listar_minhas_barbearias(), public.criar_agendamento(bigint, bigint, date, time),
  public.listar_usuarios_admin(text, text, integer)
to authenticated;

commit;
