-- Repair client records that were created before the authentication trigger
-- was fixed. Without the matching row in public.clientes, the user has the
-- CLIENTE role but cannot create an appointment.
insert into public.clientes (nome, telefone, email, usuario_id)
select
  u.nome,
  u.telefone,
  au.email,
  u.id
from public.usuarios u
join auth.users au on au.id = u.id
where u.tipo = 'cliente'
  and nullif(trim(coalesce(u.telefone, '')), '') is not null
on conflict (usuario_id) do update
set
  nome = excluded.nome,
  telefone = excluded.telefone,
  email = coalesce(public.clientes.email, excluded.email);

