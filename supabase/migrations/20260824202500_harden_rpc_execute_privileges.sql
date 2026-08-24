-- Mutation RPCs must never be callable by the anonymous API role. Their
-- internal ownership checks remain as defense in depth for authenticated users.
revoke execute on function public.criar_agendamento_com_origem(
  bigint,
  bigint,
  date,
  time,
  text
) from public, anon;

grant execute on function public.criar_agendamento_com_origem(
  bigint,
  bigint,
  date,
  time,
  text
) to authenticated;

revoke execute on function public.atualizar_configuracoes_avancadas(
  text,
  boolean,
  smallint,
  numeric,
  text,
  text,
  boolean,
  boolean,
  boolean,
  smallint,
  smallint
) from public, anon;

grant execute on function public.atualizar_configuracoes_avancadas(
  text,
  boolean,
  smallint,
  numeric,
  text,
  text,
  boolean,
  boolean,
  boolean,
  smallint,
  smallint
) to authenticated;
