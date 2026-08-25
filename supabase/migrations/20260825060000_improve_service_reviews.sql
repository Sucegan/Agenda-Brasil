-- Add structured service feedback while keeping historical reviews valid.
-- Customers may edit only feedback fields, never ownership or appointment links.

begin;

alter table public.avaliacoes
  add column if not exists qualidade smallint,
  add column if not exists atendimento smallint,
  add column if not exists pontualidade smallint,
  add column if not exists recomendaria boolean;

alter table public.avaliacoes
  drop constraint if exists avaliacoes_qualidade_check,
  drop constraint if exists avaliacoes_atendimento_check,
  drop constraint if exists avaliacoes_pontualidade_check;

alter table public.avaliacoes
  add constraint avaliacoes_qualidade_check
    check (qualidade is null or qualidade between 1 and 5),
  add constraint avaliacoes_atendimento_check
    check (atendimento is null or atendimento between 1 and 5),
  add constraint avaliacoes_pontualidade_check
    check (pontualidade is null or pontualidade between 1 and 5);

comment on column public.avaliacoes.qualidade is 'Resultado percebido do serviço, de 1 a 5.';
comment on column public.avaliacoes.atendimento is 'Qualidade do atendimento, de 1 a 5.';
comment on column public.avaliacoes.pontualidade is 'Pontualidade percebida, de 1 a 5.';
comment on column public.avaliacoes.recomendaria is 'Indica se o cliente recomendaria o atendimento.';

-- A later role migration restored table-level UPDATE. Return to least privilege.
revoke update on table public.avaliacoes from authenticated;
grant update (
  nota, comentario, qualidade, atendimento, pontualidade, recomendaria, updated_at
) on table public.avaliacoes to authenticated;

commit;
