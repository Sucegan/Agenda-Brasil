-- The repository already contained migrations timestamped later than the
-- current UTC clock. Reassert the global administrator helpers after those
-- historical migrations so fresh databases and production converge.

begin;

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

revoke all on function public.eh_admin_global() from public, anon, authenticated;
revoke all on function public.obter_resumo_admin() from public, anon, authenticated;
revoke all on function public.listar_usuarios_admin(text, text, integer) from public, anon, authenticated;
revoke all on function public.listar_clientes_admin(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.admin_alterar_status_barbearia(uuid, boolean) from public, anon, authenticated;

grant execute on function public.eh_admin_global(),
  public.eh_admin_barbearia(uuid),
  public.eh_proprietario_barbearia(uuid),
  public.eh_membro_barbearia(uuid),
  public.pode_gerenciar_barbeiro(bigint),
  public.listar_minhas_barbearias(),
  public.obter_resumo_admin(),
  public.listar_usuarios_admin(text, text, integer),
  public.listar_clientes_admin(uuid, text, integer),
  public.admin_alterar_status_barbearia(uuid, boolean)
to authenticated;

commit;
