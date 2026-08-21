-- Keep each agenda private at the database boundary. The app also filters the
-- realtime channel, but RLS and the RPC below are the actual security control.

do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array['usuarios', 'clientes', 'barbeiros', 'servicos', 'agendamentos']
  loop
    execute format('alter table public.%I enable row level security', v_table);

    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy if exists %I on public.%I', v_policy.policyname, v_table);
    end loop;
  end loop;
end;
$$;

create policy "usuarios_select_own" on public.usuarios
  for select to authenticated
  using (id = auth.uid());

create policy "clientes_select_own" on public.clientes
  for select to authenticated
  using (usuario_id = auth.uid());

create policy "barbeiros_select_own" on public.barbeiros
  for select to authenticated
  using (usuario_id = auth.uid());

create policy "barbeiros_update_own" on public.barbeiros
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "servicos_select_authenticated" on public.servicos
  for select to authenticated
  using (true);

create policy "servicos_insert_own" on public.servicos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.barbeiros b
      where b.id = barbeiro_id and b.usuario_id = auth.uid()
    )
  );

create policy "servicos_update_own" on public.servicos
  for update to authenticated
  using (
    exists (
      select 1 from public.barbeiros b
      where b.id = barbeiro_id and b.usuario_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.barbeiros b
      where b.id = barbeiro_id and b.usuario_id = auth.uid()
    )
  );

create policy "servicos_delete_own" on public.servicos
  for delete to authenticated
  using (
    exists (
      select 1 from public.barbeiros b
      where b.id = barbeiro_id and b.usuario_id = auth.uid()
    )
  );

create policy "agendamentos_select_participants" on public.agendamentos
  for select to authenticated
  using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.usuario_id = auth.uid()
    )
    or exists (
      select 1 from public.barbeiros b
      where b.id = barbeiro_id and b.usuario_id = auth.uid()
    )
  );

grant usage on schema public to authenticated;
grant select on public.usuarios, public.clientes, public.barbeiros, public.servicos, public.agendamentos to authenticated;
grant update on public.barbeiros to authenticated;
grant insert, update, delete on public.servicos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- The dashboard receives only the appointments that belong to the signed-in
-- customer or professional. It is intentionally separate from an unrestricted
-- table query so future UI changes cannot accidentally show the whole agenda.
create or replace function public.listar_meus_agendamentos()
returns setof public.agendamentos
language sql
security definer
set search_path = ''
as $$
  select a.*
  from public.agendamentos a
  where auth.uid() is not null
    and (
      exists (
        select 1 from public.clientes c
        where c.id = a.cliente_id and c.usuario_id = auth.uid()
      )
      or exists (
        select 1 from public.barbeiros b
        where b.id = a.barbeiro_id and b.usuario_id = auth.uid()
      )
    )
  order by a.data, a.horario;
$$;

-- The booking function already serializes concurrent reservations. This trigger
-- protects the same rule for any future insert or update path as well.
create or replace function public.validar_sobreposicao_agendamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('cancelado', 'nao_compareceu') then
    return new;
  end if;

  if coalesce(new.servico_duracao, 0) not between 5 and 480 then
    raise exception 'Duração de serviço inválida';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.barbeiro_id::text || ':' || new.data::text, 0)
  );

  if exists (
    select 1
    from public.agendamentos a
    where a.barbeiro_id = new.barbeiro_id
      and a.data = new.data
      and a.status not in ('cancelado', 'nao_compareceu')
      and (tg_op = 'INSERT' or a.id <> new.id)
      and new.horario < a.horario + make_interval(mins => a.servico_duracao)
      and a.horario < new.horario + make_interval(mins => new.servico_duracao)
  ) then
    raise exception 'Este horário conflita com outro agendamento';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_sobreposicao_agendamento on public.agendamentos;
create trigger validar_sobreposicao_agendamento
before insert or update of barbeiro_id, data, horario, servico_duracao, status
on public.agendamentos
for each row execute function public.validar_sobreposicao_agendamento();

create index if not exists agendamentos_barbeiro_data_horario_idx
  on public.agendamentos (barbeiro_id, data, horario);

revoke all on function public.listar_meus_agendamentos() from public;
revoke all on function public.validar_sobreposicao_agendamento() from public;
grant execute on function public.listar_meus_agendamentos() to authenticated;

