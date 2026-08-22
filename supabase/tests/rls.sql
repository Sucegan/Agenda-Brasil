begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'fila_espera', 'fila de espera existe');
select has_table('public', 'notificacoes', 'fila de notificações existe');
select has_table('public', 'push_subscriptions', 'assinaturas push existem');
select has_table('public', 'telemetria_eventos', 'telemetria existe');

select ok((select relrowsecurity from pg_class where oid = 'public.fila_espera'::regclass), 'RLS ativo na fila de espera');
select ok((select relrowsecurity from pg_class where oid = 'public.notificacoes'::regclass), 'RLS ativo nas notificações');
select ok((select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass), 'RLS ativo nas assinaturas push');
select ok((select relrowsecurity from pg_class where oid = 'public.telemetria_eventos'::regclass), 'RLS ativo na telemetria');

select ok(has_function_privilege('anon', 'public.obter_catalogo_publico()', 'execute'), 'anon pode consultar catálogo seguro');
select ok(has_function_privilege('anon', 'public.buscar_horarios_disponiveis(bigint,bigint,date)', 'execute'), 'anon pode consultar disponibilidade');
select ok(not has_function_privilege('anon', 'public.criar_agendamento_com_origem(bigint,bigint,date,time,text)', 'execute'), 'anon não cria agendamento sem autenticação');
select ok(not has_function_privilege('anon', 'public.atualizar_configuracoes_avancadas(text,boolean,smallint,numeric,text,text,boolean,boolean,boolean,smallint,smallint)', 'execute'), 'anon não altera regras do negócio');

select * from finish();
rollback;
