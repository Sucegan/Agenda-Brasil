-- Keep sensitive operational tables behind narrowly scoped RPCs and collapse
-- overlapping SELECT policies introduced by the global administrator role.

begin;

revoke all privileges on public.admin_audit_logs from public, anon, authenticated;
revoke select on public.telemetria_eventos, public.solicitacoes_exclusao from authenticated;

drop policy if exists usuarios_select_own on public.usuarios;
drop policy if exists usuarios_select_admin_global on public.usuarios;
create policy usuarios_select_role_scope on public.usuarios for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.eh_admin_global())
  );

drop policy if exists clientes_select_own on public.clientes;
drop policy if exists clientes_select_admin_global on public.clientes;
create policy clientes_select_role_scope on public.clientes for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.eh_admin_global())
  );

drop policy if exists notificacoes_select_own on public.notificacoes;
drop policy if exists notificacoes_select_admin_global on public.notificacoes;
create policy notificacoes_select_role_scope on public.notificacoes for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.eh_admin_global())
  );

drop policy if exists solicitacoes_exclusao_own on public.solicitacoes_exclusao;
drop policy if exists exclusoes_select_admin_global on public.solicitacoes_exclusao;
create policy solicitacoes_exclusao_role_scope on public.solicitacoes_exclusao for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.eh_admin_global())
  );

-- Telemetry is summarized by obter_resumo_admin() and remains inaccessible as
-- a raw browser table, including to administrators.
drop policy if exists telemetria_select_admin_global on public.telemetria_eventos;

commit;
