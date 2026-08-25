-- Make reminders, cancellation and no-show rules follow the appointment's barbershop.

begin;

create table public.clientes_barbearias (
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  faltas smallint not null default 0 check (faltas between 0 and 1000),
  bloqueado_ate date,
  pontos_fidelidade integer not null default 0 check (pontos_fidelidade between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (barbearia_id, cliente_id)
);

-- Preserve the current customer's history in the original barbershop.
insert into public.clientes_barbearias (barbearia_id, cliente_id, faltas, bloqueado_ate, pontos_fidelidade)
select x.id, c.id, c.faltas, c.bloqueado_ate, c.pontos_fidelidade
from public.barbearias x
cross join public.clientes c
where x.id = (select id from public.barbearias order by created_at limit 1)
on conflict (barbearia_id, cliente_id) do nothing;

alter table public.clientes_barbearias enable row level security;
create policy clientes_barbearias_select_own on public.clientes_barbearias
  for select to authenticated using (
    exists (select 1 from public.clientes c where c.id = cliente_id and c.usuario_id = auth.uid())
  );
create policy clientes_barbearias_select_members on public.clientes_barbearias
  for select to authenticated using (public.eh_membro_barbearia(barbearia_id));
grant select on public.clientes_barbearias to authenticated;

create or replace function public.obter_status_cliente_barbearia(p_barbearia_id uuid)
returns table (cliente_id bigint, faltas smallint, bloqueado_ate date, pontos_fidelidade integer)
language sql stable security definer set search_path = ''
as $$
  select c.id, coalesce(cb.faltas, 0)::smallint, cb.bloqueado_ate, coalesce(cb.pontos_fidelidade, 0)::integer
  from public.clientes c
  join public.barbearias x on x.id = p_barbearia_id and x.ativa
  left join public.clientes_barbearias cb on cb.barbearia_id = x.id and cb.cliente_id = c.id
  where c.usuario_id = auth.uid() and (x.agendamento_publico or public.eh_membro_barbearia(x.id));
$$;

create or replace function public.preparar_agendamento_comercial()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_config public.barbearias;
  v_status public.clientes_barbearias;
begin
  select x.* into v_config
  from public.barbearias x
  join public.barbeiros b on b.barbearia_id = x.id
  where b.id = new.barbeiro_id;
  if not found then raise exception 'Barbearia inválida'; end if;

  insert into public.clientes_barbearias (barbearia_id, cliente_id)
  values (v_config.id, new.cliente_id)
  on conflict (barbearia_id, cliente_id) do nothing;
  select * into v_status from public.clientes_barbearias
  where barbearia_id = v_config.id and cliente_id = new.cliente_id;
  if v_status.bloqueado_ate is not null and v_status.bloqueado_ate >= timezone('America/Sao_Paulo', now())::date then
    raise exception 'Novos agendamentos estão bloqueados até % por faltas anteriores', to_char(v_status.bloqueado_ate, 'DD/MM/YYYY');
  end if;
  new.public_token := coalesce(new.public_token, gen_random_uuid());
  new.sinal_valor := round(coalesce(new.servico_preco, 0) * coalesce(v_config.sinal_percentual, 0) / 100, 2);
  new.sinal_status := case when new.sinal_valor > 0 then 'pendente' else 'nao_exigido' end;
  return new;
end;
$$;

create or replace function public.agendar_notificacoes_agendamento()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_usuario public.usuarios;
  v_config public.barbearias;
  v_instante timestamptz;
  v_payload jsonb;
begin
  select u.* into v_usuario from public.usuarios u join public.clientes c on c.usuario_id = u.id where c.id = new.cliente_id;
  select x.* into v_config from public.barbearias x join public.barbeiros b on b.barbearia_id = x.id where b.id = new.barbeiro_id;
  v_instante := make_timestamptz(extract(year from new.data)::integer, extract(month from new.data)::integer, extract(day from new.data)::integer, extract(hour from new.horario)::integer, extract(minute from new.horario)::integer, 0, 'America/Sao_Paulo');
  v_payload := jsonb_build_object(
    'agendamento_id', new.id, 'barbearia_id', v_config.id, 'barbearia_nome', v_config.nome,
    'cliente_nome', new.cliente_nome, 'cliente_telefone', new.cliente_telefone,
    'barbeiro_nome', new.barbeiro_nome, 'servico_nome', new.servico_nome,
    'data', new.data, 'horario', new.horario, 'public_token', new.public_token
  );
  if v_config.lembrete_email and v_usuario.lembretes_email then
    insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, agendado_para, payload) values (v_usuario.id, new.id, 'email', 'confirmacao', now(), v_payload);
    if v_instante - interval '24 hours' > now() then
      insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, agendado_para, payload) values (v_usuario.id, new.id, 'email', 'lembrete_24h', v_instante - interval '24 hours', v_payload);
    end if;
  end if;
  if v_config.lembrete_whatsapp and v_usuario.lembretes_whatsapp then
    insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, agendado_para, payload) values (v_usuario.id, new.id, 'whatsapp', 'confirmacao', now(), v_payload);
    if v_instante - interval '24 hours' > now() then
      insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, agendado_para, payload) values (v_usuario.id, new.id, 'whatsapp', 'lembrete_24h', v_instante - interval '24 hours', v_payload);
    end if;
  end if;
  if v_config.lembrete_push and v_usuario.lembretes_push and v_instante - interval '2 hours' > now() then
    insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, agendado_para, payload) values (v_usuario.id, new.id, 'push', 'lembrete_2h', v_instante - interval '2 hours', v_payload);
  end if;
  return new;
end;
$$;

create or replace function public.processar_mudanca_agendamento()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_cliente public.clientes;
  v_usuario_id uuid;
  v_config public.barbearias;
  v_limite timestamptz;
  v_payload jsonb;
  v_fila public.fila_espera;
begin
  if new.status = old.status then return new; end if;
  select x.* into v_config from public.barbearias x join public.barbeiros b on b.barbearia_id = x.id where b.id = new.barbeiro_id;
  select c.* into v_cliente from public.clientes c where c.id = new.cliente_id;
  v_usuario_id := v_cliente.usuario_id;
  v_limite := make_timestamptz(extract(year from new.data)::integer, extract(month from new.data)::integer, extract(day from new.data)::integer, extract(hour from new.horario)::integer, extract(minute from new.horario)::integer, 0, 'America/Sao_Paulo') - make_interval(hours => v_config.cancelamento_horas);
  if new.status = 'cancelado' then
    new.cancelamento_tardio := now() > v_limite;
    update public.notificacoes set status = 'ignorada' where agendamento_id = new.id and status = 'pendente';
    for v_fila in select * from public.fila_espera f where f.barbeiro_id = new.barbeiro_id and f.servico_id = new.servico_id and f.data = new.data and f.status = 'aguardando'
    loop
      select c.usuario_id into v_usuario_id from public.clientes c where c.id = v_fila.cliente_id;
      insert into public.notificacoes (usuario_id, canal, tipo, agendado_para, payload)
      select v_usuario_id, canal, 'fila_espera', now(), jsonb_build_object('barbearia_id', v_config.id, 'barbearia_nome', v_config.nome, 'data', new.data, 'horario', new.horario, 'barbeiro_nome', new.barbeiro_nome, 'servico_nome', new.servico_nome)
      from (values ('email'::varchar), ('whatsapp'::varchar), ('push'::varchar)) canais(canal);
      update public.fila_espera set status = 'notificado', notificado_em = now() where id = v_fila.id;
    end loop;
  elsif new.status = 'nao_compareceu' and old.status <> 'nao_compareceu' then
    insert into public.clientes_barbearias (barbearia_id, cliente_id, faltas, bloqueado_ate)
    values (
      v_config.id,
      new.cliente_id,
      1,
      case when v_config.bloquear_apos_faltas = 1 then timezone('America/Sao_Paulo', now())::date + v_config.dias_bloqueio else null end
    )
    on conflict (barbearia_id, cliente_id) do update
    set faltas = public.clientes_barbearias.faltas + 1,
        bloqueado_ate = case
          when v_config.bloquear_apos_faltas > 0 and public.clientes_barbearias.faltas + 1 >= v_config.bloquear_apos_faltas
          then timezone('America/Sao_Paulo', now())::date + v_config.dias_bloqueio
          else public.clientes_barbearias.bloqueado_ate
        end,
        updated_at = now();
  end if;
  select c.usuario_id into v_usuario_id from public.clientes c where c.id = new.cliente_id;
  v_payload := jsonb_build_object('agendamento_id', new.id, 'barbearia_id', v_config.id, 'barbearia_nome', v_config.nome, 'status', new.status, 'data', new.data, 'horario', new.horario, 'barbeiro_nome', new.barbeiro_nome, 'servico_nome', new.servico_nome);
  insert into public.notificacoes (usuario_id, agendamento_id, canal, tipo, payload) values (v_usuario_id, new.id, 'push', 'status', v_payload);
  return new;
end;
$$;

create or replace function public.creditar_pontos_fidelidade()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_barbearia_id uuid;
begin
  if new.status = 'concluido' and old.status <> 'concluido' and not new.pontos_creditados then
    select b.barbearia_id into v_barbearia_id from public.barbeiros b where b.id = new.barbeiro_id;
    insert into public.clientes_barbearias (barbearia_id, cliente_id, pontos_fidelidade)
    values (v_barbearia_id, new.cliente_id, 10)
    on conflict (barbearia_id, cliente_id) do update
    set pontos_fidelidade = public.clientes_barbearias.pontos_fidelidade + 10,
        updated_at = now();
    update public.agendamentos set pontos_creditados = true where id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.obter_informacoes_legais_barbearia(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('nome', x.nome, 'responsavel_legal', x.responsavel_legal, 'documento_legal', x.documento_legal, 'email_privacidade', x.email_privacidade, 'telefone', x.telefone, 'endereco', x.endereco, 'prazo_retencao_meses', x.prazo_retencao_meses)
  from public.barbearias x where x.slug = lower(trim(p_slug)) and x.ativa;
$$;

revoke all on function public.agendar_notificacoes_agendamento() from public;
revoke all on function public.processar_mudanca_agendamento() from public;
revoke all on function public.preparar_agendamento_comercial() from public;
revoke all on function public.creditar_pontos_fidelidade() from public;
revoke all on function public.obter_status_cliente_barbearia(uuid) from public;
revoke all on function public.obter_informacoes_legais_barbearia(text) from public;
grant execute on function public.obter_status_cliente_barbearia(uuid) to authenticated;
grant execute on function public.obter_informacoes_legais_barbearia(text) to anon, authenticated;

commit;
