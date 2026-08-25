-- Multi-barbershop foundation. Existing data becomes the first Sucegan Tech unit.

begin;

create table public.barbearias (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid not null references public.usuarios(id) on delete restrict,
  nome varchar not null check (char_length(trim(nome)) between 2 and 120),
  slug varchar not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  endereco text,
  telefone varchar,
  logo_url text,
  agendamento_publico boolean not null default true,
  cancelamento_horas smallint not null default 2 check (cancelamento_horas between 0 and 168),
  sinal_percentual numeric(5,2) not null default 0 check (sinal_percentual between 0 and 100),
  pix_chave text,
  pix_beneficiario varchar,
  lembrete_email boolean not null default true,
  lembrete_whatsapp boolean not null default true,
  lembrete_push boolean not null default false,
  bloquear_apos_faltas smallint not null default 3 check (bloquear_apos_faltas between 0 and 20),
  dias_bloqueio smallint not null default 30 check (dias_bloqueio between 1 and 365),
  responsavel_legal varchar,
  documento_legal varchar,
  email_privacidade varchar,
  prazo_retencao_meses smallint not null default 24 check (prazo_retencao_meses between 1 and 120),
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sinal_percentual = 0 or (nullif(trim(pix_chave), '') is not null and nullif(trim(pix_beneficiario), '') is not null))
);

insert into public.barbearias (
  proprietario_id, nome, slug, endereco, telefone, logo_url,
  agendamento_publico, cancelamento_horas, sinal_percentual, pix_chave, pix_beneficiario,
  lembrete_email, lembrete_whatsapp, lembrete_push, bloquear_apos_faltas, dias_bloqueio,
  responsavel_legal, documento_legal, email_privacidade, prazo_retencao_meses, updated_at
)
select
  (select b.usuario_id from public.barbeiros b order by b.id limit 1),
  c.nome, c.slug, c.endereco, c.telefone, c.logo_url,
  c.agendamento_publico, c.cancelamento_horas, c.sinal_percentual, c.pix_chave, c.pix_beneficiario,
  c.lembrete_email, c.lembrete_whatsapp, c.lembrete_push, c.bloquear_apos_faltas, c.dias_bloqueio,
  c.responsavel_legal, c.documento_legal, c.email_privacidade, c.prazo_retencao_meses, c.updated_at
from public.configuracoes_negocio c
where c.id = true
  and not exists (select 1 from public.barbearias);

alter table public.barbeiros add column barbearia_id uuid references public.barbearias(id) on delete cascade;
update public.barbeiros set barbearia_id = (select id from public.barbearias order by created_at limit 1) where barbearia_id is null;
alter table public.barbeiros alter column barbearia_id set not null;
alter table public.barbeiros drop constraint if exists barbeiros_usuario_id_key;
alter table public.barbeiros add constraint barbeiros_barbearia_usuario_key unique (barbearia_id, usuario_id);
create index barbeiros_barbearia_idx on public.barbeiros (barbearia_id, id);

alter table public.feriados_negocio add column barbearia_id uuid references public.barbearias(id) on delete cascade;
update public.feriados_negocio set barbearia_id = (select id from public.barbearias order by created_at limit 1) where barbearia_id is null;
alter table public.feriados_negocio alter column barbearia_id set not null;
alter table public.feriados_negocio drop constraint if exists feriados_negocio_pkey;
alter table public.feriados_negocio add primary key (barbearia_id, data);

alter table public.convites_barbeiro add column barbearia_id uuid references public.barbearias(id) on delete cascade;
update public.convites_barbeiro set barbearia_id = (select id from public.barbearias order by created_at limit 1) where barbearia_id is null;
alter table public.convites_barbeiro alter column barbearia_id set not null;
create index convites_barbeiro_barbearia_idx on public.convites_barbeiro (barbearia_id, criado_em desc);

alter table public.barbearias enable row level security;

create or replace function public.eh_membro_barbearia(p_barbearia_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.barbearias x where x.id = p_barbearia_id and x.proprietario_id = auth.uid()
  ) or exists (
    select 1 from public.barbeiros b where b.barbearia_id = p_barbearia_id and b.usuario_id = auth.uid()
  );
$$;

create or replace function public.eh_proprietario_barbearia(p_barbearia_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.barbearias x where x.id = p_barbearia_id and x.proprietario_id = auth.uid()); $$;

revoke all on function public.eh_membro_barbearia(uuid) from public;
revoke all on function public.eh_proprietario_barbearia(uuid) from public;
grant execute on function public.eh_membro_barbearia(uuid), public.eh_proprietario_barbearia(uuid) to authenticated;

create policy barbearias_select_member on public.barbearias for select to authenticated
  using (public.eh_membro_barbearia(id));
create policy barbearias_update_owner on public.barbearias for update to authenticated
  using (public.eh_proprietario_barbearia(id)) with check (public.eh_proprietario_barbearia(id));
grant select, update on public.barbearias to authenticated;

drop policy if exists barbeiros_select_own on public.barbeiros;
create policy barbeiros_select_members on public.barbeiros for select to authenticated
  using (usuario_id = auth.uid() or public.eh_proprietario_barbearia(barbearia_id));

drop policy if exists "feriados visiveis" on public.feriados_negocio;
drop policy if exists "barbeiro gerencia feriados" on public.feriados_negocio;
create policy feriados_select_members on public.feriados_negocio for select to authenticated
  using (public.eh_membro_barbearia(barbearia_id));
create policy feriados_manage_members on public.feriados_negocio for all to authenticated
  using (public.eh_membro_barbearia(barbearia_id))
  with check (public.eh_membro_barbearia(barbearia_id) and criado_por = auth.uid());

drop policy if exists "barbeiro ve os proprios convites" on public.convites_barbeiro;
create policy convites_select_owner on public.convites_barbeiro for select to authenticated
  using (public.eh_proprietario_barbearia(barbearia_id));

create or replace function public.listar_minhas_barbearias()
returns setof public.barbearias
language sql stable security definer set search_path = ''
as $$
  select distinct x.*
  from public.barbearias x
  left join public.barbeiros b on b.barbearia_id = x.id and b.usuario_id = auth.uid()
  where x.ativa and (x.proprietario_id = auth.uid() or b.id is not null)
  order by x.created_at, x.nome;
$$;

create or replace function public.listar_barbearias_publicas()
returns table (id uuid, nome varchar, slug varchar, endereco text, telefone varchar, logo_url text)
language sql stable security definer set search_path = ''
as $$
  select x.id, x.nome, x.slug, x.endereco, x.telefone, x.logo_url
  from public.barbearias x where x.ativa and x.agendamento_publico order by x.nome;
$$;

create or replace function public.obter_barbearia_autenticada(p_barbearia_id uuid)
returns public.barbearias
language sql stable security definer set search_path = ''
as $$
  select x.* from public.barbearias x
  where x.id = p_barbearia_id and x.ativa and auth.uid() is not null
    and (x.agendamento_publico or public.eh_membro_barbearia(x.id));
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
  if not found then raise exception 'Apenas contas profissionais podem criar barbearias'; end if;
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then raise exception 'Nome inválido'; end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 80 then raise exception 'Identificador inválido'; end if;

  insert into public.barbearias (proprietario_id, nome, slug, responsavel_legal)
  values (auth.uid(), trim(p_nome), v_slug, v_perfil.nome)
  returning * into v_result;
  insert into public.barbeiros (nome, telefone, usuario_id, barbearia_id)
  values (v_perfil.nome, v_perfil.telefone, auth.uid(), v_result.id);
  return v_result;
exception when unique_violation then
  raise exception 'Este identificador já está em uso';
end;
$$;

create or replace function public.obter_catalogo_publico(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'negocio', jsonb_build_object(
      'id', x.id, 'nome', x.nome, 'endereco', x.endereco, 'telefone', x.telefone,
      'logo_url', x.logo_url, 'slug', x.slug, 'agendamento_publico', x.agendamento_publico,
      'cancelamento_horas', x.cancelamento_horas, 'sinal_percentual', x.sinal_percentual,
      'pix_chave', null, 'pix_beneficiario', null
    ),
    'barbeiros', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'nome', b.nome, 'horario_inicio', b.horario_inicio::text,
        'horario_fim', b.horario_fim::text, 'dias_trabalho', b.dias_trabalho
      ) order by b.nome) from public.barbeiros b where b.barbearia_id = x.id
    ), '[]'::jsonb),
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'preco', s.preco, 'duracao', s.duracao, 'barbeiro_id', s.barbeiro_id) order by s.nome)
      from public.servicos s join public.barbeiros b on b.id = s.barbeiro_id where b.barbearia_id = x.id
    ), '[]'::jsonb),
    'feriados', coalesce((
      select jsonb_agg(jsonb_build_object('data', f.data, 'descricao', f.descricao) order by f.data)
      from public.feriados_negocio f where f.barbearia_id = x.id and f.data >= timezone('America/Sao_Paulo', now())::date
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
  from public.barbeiros b join public.barbearias x on x.id = b.barbearia_id
  where b.barbearia_id = p_barbearia_id and x.ativa order by b.nome;
$$;

create or replace function public.listar_meus_agendamentos_barbearia(p_barbearia_id uuid, p_barbeiro_id bigint)
returns setof public.agendamentos
language sql stable security definer set search_path = ''
as $$
  select a.* from public.agendamentos a
  join public.barbeiros selected_barber on selected_barber.id = a.barbeiro_id
  where selected_barber.barbearia_id = p_barbearia_id
    and ((exists (select 1 from public.clientes c where c.id = a.cliente_id and c.usuario_id = auth.uid()))
     or (a.barbeiro_id = p_barbeiro_id and exists (
       select 1 from public.barbeiros b where b.id = p_barbeiro_id and b.usuario_id = auth.uid()
     )))
  order by a.data desc, a.horario desc;
$$;

create or replace function public.listar_fila_profissional(p_barbeiro_id bigint)
returns table (id bigint, data date, periodo varchar, status varchar, cliente_nome varchar, cliente_telefone varchar, servico_nome varchar, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.data, f.periodo, f.status, c.nome, c.telefone, s.nome, f.created_at
  from public.fila_espera f
  join public.clientes c on c.id = f.cliente_id
  join public.servicos s on s.id = f.servico_id
  join public.barbeiros b on b.id = f.barbeiro_id
  where b.id = p_barbeiro_id and b.usuario_id = auth.uid() and f.status in ('aguardando', 'notificado')
  order by f.data, f.created_at;
$$;

create or replace function public.criar_convite_barbeiro(p_barbearia_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.eh_proprietario_barbearia(p_barbearia_id) then raise exception 'Apenas o proprietário pode criar convites'; end if;
  insert into public.convites_barbeiro (token, criado_por, barbearia_id) values (v_token, auth.uid(), p_barbearia_id);
  return v_token;
end;
$$;

create or replace function public.criar_perfil_usuario()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_tipo text := coalesce(new.raw_user_meta_data ->> 'tipo', '');
  v_nome text := trim(coalesce(new.raw_user_meta_data ->> 'nome', ''));
  v_telefone text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'telefone', '')), '');
  v_convite text := nullif(new.raw_user_meta_data ->> 'convite_barbeiro', '');
  v_termos boolean := coalesce((new.raw_user_meta_data ->> 'termos_aceitos')::boolean, false);
  v_barbearia_id uuid;
begin
  if v_tipo not in ('cliente', 'barbeiro') or char_length(v_nome) not between 2 and 120 then raise exception 'Dados de cadastro inválidos'; end if;
  if not v_termos then raise exception 'É necessário aceitar os termos de uso'; end if;
  if v_tipo = 'cliente' and v_telefone is null then raise exception 'Telefone é obrigatório para clientes'; end if;
  if v_tipo = 'barbeiro' then
    update public.convites_barbeiro set usado_por = new.id, usado_em = now()
    where token = v_convite and usado_por is null and expira_em > now()
    returning barbearia_id into v_barbearia_id;
    if not found then raise exception 'Convite de barbeiro inválido ou expirado'; end if;
  end if;
  insert into public.usuarios (id, nome, telefone, tipo, termos_aceitos_em)
  values (new.id, v_nome, v_telefone, v_tipo, now())
  on conflict (id) do update set nome = excluded.nome, telefone = excluded.telefone, tipo = excluded.tipo,
    termos_aceitos_em = coalesce(public.usuarios.termos_aceitos_em, excluded.termos_aceitos_em);
  if v_tipo = 'cliente' then
    insert into public.clientes (nome, telefone, email, usuario_id) values (v_nome, v_telefone, new.email, new.id)
    on conflict (usuario_id) do update set nome = excluded.nome, telefone = excluded.telefone, email = excluded.email;
  else
    insert into public.barbeiros (nome, telefone, usuario_id, barbearia_id) values (v_nome, v_telefone, new.id, v_barbearia_id);
  end if;
  return new;
end;
$$;

create or replace function public.buscar_horarios_disponiveis(
  p_barbeiro_id bigint, p_servico_id bigint, p_data date
)
returns table (horario text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_barbeiro public.barbeiros;
  v_servico public.servicos;
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
  v_agora time := timezone('America/Sao_Paulo', now())::time;
  v_publico boolean;
begin
  select * into v_barbeiro from public.barbeiros where id = p_barbeiro_id;
  if not found then raise exception 'Profissional inválido'; end if;
  select x.agendamento_publico into v_publico from public.barbearias x where x.id = v_barbeiro.barbearia_id and x.ativa;
  if auth.uid() is null and not coalesce(v_publico, false) then raise exception 'Agendamento público está desativado'; end if;
  if p_data < v_hoje then raise exception 'Não é possível consultar uma data passada'; end if;
  if exists (select 1 from public.feriados_negocio f where f.barbearia_id = v_barbeiro.barbearia_id and f.data = p_data) then return; end if;
  select * into v_servico from public.servicos where id = p_servico_id and barbeiro_id = p_barbeiro_id;
  if not found then raise exception 'Serviço não pertence ao profissional selecionado'; end if;
  if not extract(dow from p_data)::smallint = any(v_barbeiro.dias_trabalho) then return; end if;
  return query
  with slots as (
    select slot::time as inicio from generate_series(
      p_data::timestamp + v_barbeiro.horario_inicio,
      p_data::timestamp + v_barbeiro.horario_fim - make_interval(mins => v_servico.duracao),
      interval '15 minutes'
    ) slot
  )
  select slots.inicio::text from slots
  where (p_data > v_hoje or slots.inicio > v_agora)
    and (v_barbeiro.horario_almoco_inicio is null
      or slots.inicio + make_interval(mins => v_servico.duracao) <= v_barbeiro.horario_almoco_inicio
      or slots.inicio >= v_barbeiro.horario_almoco_fim)
    and not exists (
      select 1 from public.agendamentos a where a.barbeiro_id = p_barbeiro_id and a.data = p_data
        and a.status not in ('cancelado', 'nao_compareceu')
        and slots.inicio < a.horario + make_interval(mins => a.servico_duracao)
        and a.horario < slots.inicio + make_interval(mins => v_servico.duracao)
    )
    and not exists (
      select 1 from public.bloqueios_agenda b where b.barbeiro_id = p_barbeiro_id
        and p_data between b.data_inicio and b.data_fim
        and (b.hora_inicio is null or (slots.inicio < b.hora_fim and slots.inicio + make_interval(mins => v_servico.duracao) > b.hora_inicio))
    )
  order by slots.inicio;
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
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
  v_agora time := timezone('America/Sao_Paulo', now())::time;
  v_resultado public.agendamentos;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  select * into v_cliente from public.clientes where usuario_id = auth.uid();
  if not found then raise exception 'Apenas clientes podem agendar'; end if;
  select * into v_barbeiro from public.barbeiros where id = p_barbeiro_id;
  select * into v_servico from public.servicos where id = p_servico_id and barbeiro_id = p_barbeiro_id;
  if not found or v_barbeiro.id is null then raise exception 'Serviço não pertence ao profissional selecionado'; end if;
  if p_data < v_hoje or (p_data = v_hoje and p_horario <= v_agora) then raise exception 'Não é possível agendar em um horário passado'; end if;
  if exists (select 1 from public.feriados_negocio f where f.barbearia_id = v_barbeiro.barbearia_id and f.data = p_data) then raise exception 'A barbearia não abre neste feriado'; end if;
  if not extract(dow from p_data)::smallint = any(v_barbeiro.dias_trabalho) then raise exception 'O profissional não atende neste dia'; end if;
  if p_horario < v_barbeiro.horario_inicio or p_horario + make_interval(mins => v_servico.duracao) > v_barbeiro.horario_fim then raise exception 'Horário fora do expediente'; end if;
  if v_barbeiro.horario_almoco_inicio is not null and p_horario < v_barbeiro.horario_almoco_fim and p_horario + make_interval(mins => v_servico.duracao) > v_barbeiro.horario_almoco_inicio then raise exception 'Este horário coincide com o intervalo de almoço'; end if;
  if exists (select 1 from public.bloqueios_agenda b where b.barbeiro_id = p_barbeiro_id and p_data between b.data_inicio and b.data_fim and (b.hora_inicio is null or (p_horario < b.hora_fim and p_horario + make_interval(mins => v_servico.duracao) > b.hora_inicio))) then raise exception 'Este horário está bloqueado pelo profissional'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_barbeiro_id::text || ':' || p_data::text, 0));
  if exists (select 1 from public.agendamentos a where a.barbeiro_id = p_barbeiro_id and a.data = p_data and a.status not in ('cancelado', 'nao_compareceu') and p_horario < a.horario + make_interval(mins => a.servico_duracao) and a.horario < p_horario + make_interval(mins => v_servico.duracao)) then raise exception 'Este horário não está mais disponível'; end if;
  insert into public.agendamentos (cliente_id, barbeiro_id, servico_id, data, horario, servico_nome, servico_preco, servico_duracao, barbeiro_nome, cliente_nome, cliente_telefone)
  values (v_cliente.id, v_barbeiro.id, v_servico.id, p_data, p_horario, v_servico.nome, v_servico.preco, v_servico.duracao, v_barbeiro.nome, v_cliente.nome, v_cliente.telefone)
  returning * into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.preparar_agendamento_comercial()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_config public.barbearias; v_cliente public.clientes;
begin
  select x.* into v_config from public.barbearias x join public.barbeiros b on b.barbearia_id = x.id where b.id = new.barbeiro_id;
  select * into v_cliente from public.clientes where id = new.cliente_id;
  if v_cliente.bloqueado_ate is not null and v_cliente.bloqueado_ate >= timezone('America/Sao_Paulo', now())::date then
    raise exception 'Novos agendamentos estão bloqueados até % por faltas anteriores', to_char(v_cliente.bloqueado_ate, 'DD/MM/YYYY');
  end if;
  new.public_token := coalesce(new.public_token, gen_random_uuid());
  new.sinal_valor := round(coalesce(new.servico_preco, 0) * coalesce(v_config.sinal_percentual, 0) / 100, 2);
  new.sinal_status := case when new.sinal_valor > 0 then 'pendente' else 'nao_exigido' end;
  return new;
end;
$$;

revoke all on function public.listar_minhas_barbearias() from public;
revoke all on function public.listar_barbearias_publicas() from public;
revoke all on function public.obter_barbearia_autenticada(uuid) from public;
revoke all on function public.criar_barbearia(text, text) from public;
revoke all on function public.obter_catalogo_publico(text) from public;
revoke all on function public.listar_barbeiros_publicos(uuid) from public;
revoke all on function public.listar_meus_agendamentos_barbearia(uuid, bigint) from public;
revoke all on function public.listar_fila_profissional(bigint) from public;
revoke all on function public.criar_convite_barbeiro(uuid) from public;
revoke all on function public.criar_agendamento(bigint, bigint, date, time) from public;
revoke all on function public.buscar_horarios_disponiveis(bigint, bigint, date) from public;
grant execute on function public.listar_minhas_barbearias(), public.obter_barbearia_autenticada(uuid), public.criar_barbearia(text, text), public.listar_meus_agendamentos_barbearia(uuid, bigint), public.listar_fila_profissional(bigint), public.criar_convite_barbeiro(uuid) to authenticated;
grant execute on function public.listar_barbearias_publicas(), public.obter_catalogo_publico(text), public.listar_barbeiros_publicos(uuid) to anon, authenticated;
grant execute on function public.criar_agendamento(bigint, bigint, date, time) to authenticated;
grant execute on function public.buscar_horarios_disponiveis(bigint, bigint, date) to anon, authenticated;

commit;
