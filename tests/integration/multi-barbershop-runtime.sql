begin;

do $test$
declare
  v_admin uuid;
  v_employee uuid;
  v_created public.barbearias;
  v_slug text := 'validacao-' || replace(gen_random_uuid()::text, '-', '');
  v_denied boolean := false;
  v_barber public.barbeiros;
  v_service public.servicos;
  v_client_id bigint;
  v_appointment_id bigint;
begin
  select x.proprietario_id into v_admin from public.barbearias x order by x.created_at limit 1;
  if v_admin is null then raise exception 'Administrador de teste não encontrado'; end if;
  if not exists (select 1 from public.usuarios u where u.id = v_admin and u.tipo = 'admin') then
    raise exception 'Proprietário existente não foi migrado para o perfil admin';
  end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  select * into v_created from public.criar_barbearia('Unidade de validação', v_slug);
  if v_created.id is null or v_created.agendamento_publico then
    raise exception 'Cadastro administrativo não criou uma unidade privada válida';
  end if;
  if not exists (
    select 1 from public.barbeiros b
    where b.barbearia_id = v_created.id and b.usuario_id = v_admin
  ) then raise exception 'Administrador não foi vinculado à nova unidade'; end if;
  if exists (
    select 1 from public.listar_minhas_barbearias() x where x.proprietario_id <> v_admin
  ) then raise exception 'Administrador recebeu unidade de outro proprietário'; end if;

  select b.usuario_id into v_employee
  from public.barbeiros b
  where b.usuario_id <> v_admin
  order by b.id
  limit 1;
  if v_employee is not null then
    update public.usuarios set tipo = 'barbeiro' where id = v_employee;
    perform set_config('request.jwt.claim.sub', v_employee::text, true);
    if exists (
      select 1 from public.listar_minhas_barbearias() x
      where not exists (
        select 1 from public.barbeiros b where b.barbearia_id = x.id and b.usuario_id = v_employee
      )
    ) then raise exception 'Barbeiro comum recebeu acesso a outra barbearia'; end if;
    begin
      perform public.criar_barbearia('Não autorizada', 'negada-' || replace(gen_random_uuid()::text, '-', ''));
    exception when others then
      if sqlerrm like 'Apenas administradores%' then v_denied := true; else raise; end if;
    end;
    if not v_denied then raise exception 'Barbeiro comum conseguiu criar barbearia'; end if;
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select b.* into v_barber
  from public.barbeiros b
  join public.barbearias x on x.id = b.barbearia_id and x.proprietario_id = v_admin
  join public.servicos s on s.barbeiro_id = b.id
  order by b.id limit 1;
  select s.* into v_service from public.servicos s where s.barbeiro_id = v_barber.id order by s.id limit 1;
  if v_barber.id is null or v_service.id is null then raise exception 'Catálogo de teste indisponível'; end if;

  insert into public.clientes (nome, telefone, email, usuario_id)
  values ('Cliente de validação', '11999999999', null, v_admin)
  returning id into v_client_id;
  insert into public.agendamentos (
    cliente_id, barbeiro_id, servico_id, data, horario,
    servico_nome, servico_preco, servico_duracao,
    barbeiro_nome, cliente_nome, cliente_telefone
  ) values (
    v_client_id, v_barber.id, v_service.id, current_date + 30, '12:00',
    v_service.nome, v_service.preco, v_service.duracao,
    v_barber.nome, 'Cliente de validação', '11999999999'
  ) returning id into v_appointment_id;
  if not exists (
    select 1 from public.notificacoes n
    where n.agendamento_id = v_appointment_id and n.canal = 'in_app' and n.tipo = 'confirmacao'
  ) then raise exception 'Notificação interna de confirmação não foi criada'; end if;
  if not exists (
    select 1 from public.listar_meus_agendamentos_barbearia(v_barber.barbearia_id, v_barber.id) a
    where a.id = v_appointment_id
  ) then raise exception 'Administrador não recebeu a agenda completa da própria unidade'; end if;
  perform public.atualizar_status_agendamento(v_appointment_id, 'confirmado');
  if not exists (
    select 1 from public.notificacoes n
    where n.agendamento_id = v_appointment_id and n.canal = 'in_app' and n.tipo = 'status'
  ) then raise exception 'Notificação interna de status não foi criada'; end if;
end;
$test$;

rollback;
