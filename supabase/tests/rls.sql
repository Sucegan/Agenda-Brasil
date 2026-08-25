begin;

create extension if not exists pgtap with schema extensions;
select plan(30);

select has_table('public', 'fila_espera', 'fila de espera existe');
select has_table('public', 'notificacoes', 'fila de notificações existe');
select has_table('public', 'push_subscriptions', 'assinaturas push existem');
select has_table('public', 'telemetria_eventos', 'telemetria existe');
select has_table('public', 'booking_intents', 'intenções temporárias existem');
select has_table('public', 'api_rate_limits', 'limites de API existem');
select has_table('public', 'avaliacoes', 'avaliações existem');
select has_table('public', 'admin_audit_logs', 'auditoria administrativa existe');

select ok((select relrowsecurity from pg_class where oid = 'public.fila_espera'::regclass), 'RLS ativo na fila de espera');
select ok((select relrowsecurity from pg_class where oid = 'public.notificacoes'::regclass), 'RLS ativo nas notificações');
select ok((select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass), 'RLS ativo nas assinaturas push');
select ok((select relrowsecurity from pg_class where oid = 'public.telemetria_eventos'::regclass), 'RLS ativo na telemetria');
select ok((select relrowsecurity from pg_class where oid = 'public.booking_intents'::regclass), 'RLS ativo nas intenções temporárias');
select ok((select relrowsecurity from pg_class where oid = 'public.api_rate_limits'::regclass), 'RLS ativo nos limites de API');
select ok((select relrowsecurity from pg_class where oid = 'public.avaliacoes'::regclass), 'RLS ativo nas avaliações');
select ok((select relrowsecurity from pg_class where oid = 'public.admin_audit_logs'::regclass), 'RLS ativo na auditoria administrativa');

select has_function('public', 'eh_admin_global', array[]::text[], 'verificação administrativa global existe');
select has_function('public', 'obter_resumo_admin', array[]::text[], 'resumo administrativo existe');
select has_function('public', 'listar_usuarios_admin', array['text', 'text', 'integer'], 'diretório administrativo existe');

select ok(has_function_privilege('anon', 'public.obter_catalogo_publico()', 'execute'), 'anon pode consultar catálogo seguro');
select ok(has_function_privilege('anon', 'public.buscar_horarios_disponiveis(bigint,bigint,date)', 'execute'), 'anon pode consultar disponibilidade');
select ok(not has_function_privilege('anon', 'public.criar_agendamento_com_origem(bigint,bigint,date,time,text)', 'execute'), 'anon não cria agendamento sem autenticação');
select ok(not has_function_privilege('anon', 'public.atualizar_configuracoes_avancadas(text,boolean,smallint,numeric,text,text,boolean,boolean,boolean,smallint,smallint)', 'execute'), 'anon não altera regras do negócio');
select ok(not has_table_privilege('anon', 'public.booking_intents', 'select'), 'anon não lê intenções com dados pessoais');
select ok(not has_function_privilege('anon', 'public.consume_api_rate_limit(text,integer,integer)', 'execute'), 'anon não manipula limites da API');
select ok(not has_function_privilege('anon', 'public.claim_due_notifications(integer,uuid,integer)', 'execute'), 'anon não reivindica a fila de mensagens');
select ok(not has_function_privilege('anon', 'public.cleanup_operational_data()', 'execute'), 'anon não executa limpeza operacional');
select ok(not has_function_privilege('anon', 'public.atualizar_informacoes_legais(text,text,text,smallint)', 'execute'), 'anon não altera informações legais');
select ok(has_function_privilege('anon', 'public.obter_informacoes_legais_publicas()', 'execute'), 'anon consulta identificação legal pública');
select ok(has_function_privilege('authenticated', 'public.atualizar_informacoes_legais(text,text,text,smallint)', 'execute'), 'usuário autenticado pode solicitar atualização legal validada pela função');

select * from finish();
rollback;
