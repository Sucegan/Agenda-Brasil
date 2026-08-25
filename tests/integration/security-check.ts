import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';

async function main() {
  const { loadEnvConfig } = nextEnv;
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(url && key, 'Supabase public environment variables are required.');

  const anonymous = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: businesses, error: businessesError } = await anonymous.rpc('listar_barbearias_publicas');
  assert.equal(businessesError, null, `Public barbershop list failed: ${businessesError?.message}`);
  assert.ok(businesses?.length, 'At least one public barbershop must be available.');

  const selectedBusiness = businesses[0];
  const { data: discovery, error: discoveryError } = await anonymous.rpc('listar_estabelecimentos_publicos');
  assert.equal(discoveryError, null, `Public establishment discovery failed: ${discoveryError?.message}`);
  assert.ok(discovery?.some((item) => item.id === selectedBusiness.id), 'Public establishment discovery must include the selected business.');
  const { data: catalog, error: catalogError } = await anonymous.rpc('obter_catalogo_publico', { p_slug: selectedBusiness.slug });
  assert.equal(catalogError, null, `Public catalog failed: ${catalogError?.message}`);
  assert.ok(catalog?.negocio, 'Public catalog must include business settings.');
  assert.equal(catalog?.negocio?.id, selectedBusiness.id, 'Public catalog must stay inside the selected barbershop.');

  const { data: legal, error: legalError } = await anonymous.rpc('obter_informacoes_legais_barbearia', { p_slug: selectedBusiness.slug });
  assert.equal(legalError, null, `Public legal information failed: ${legalError?.message}`);
  assert.ok(legal?.nome, 'Public legal information must identify the business.');

  const { error: protectedError } = await anonymous.rpc('criar_agendamento_com_origem', {
    p_barbeiro_id: -1,
    p_servico_id: -1,
    p_data: '2099-01-01',
    p_horario: '09:00:00',
    p_origem: 'link_publico',
  });
  assert.ok(protectedError, 'Anonymous users must not execute the booking mutation.');

  const { error: blockError } = await anonymous.rpc('criar_bloqueio_agenda', {
    p_barbeiro_id: -1,
    p_data_inicio: '2099-01-01',
    p_data_fim: '2099-01-01',
    p_hora_inicio: null,
    p_hora_fim: null,
    p_tipo: 'folga',
    p_motivo: 'Security probe',
  });
  assert.ok(blockError, 'Anonymous users must not create schedule blocks.');

  const { error: notificationReadError } = await anonymous.rpc('marcar_notificacoes_lidas', { p_ids: [] });
  assert.ok(notificationReadError, 'Anonymous users must not update in-app notifications.');

  const { error: createBusinessError } = await anonymous.rpc('criar_barbearia', {
    p_nome: 'Security probe',
    p_slug: 'security-probe',
  });
  assert.ok(createBusinessError, 'Anonymous users must not execute administrator mutations.');

  const { error: telemetryError } = await anonymous.from('telemetria_eventos').select('id').limit(1);
  assert.ok(telemetryError, 'Anonymous users must hold no direct telemetry table privilege.');

  const { error: profileReadError } = await anonymous.from('usuarios').select('id,tipo').limit(1);
  assert.ok(profileReadError, 'Anonymous users must hold no direct profile table privilege.');

  const { error: intentReadError } = await anonymous.from('booking_intents').select('token').limit(1);
  assert.ok(intentReadError, 'Anonymous users must not read temporary booking identity data.');

  const { error: financeReadError } = await anonymous.from('movimentacoes_financeiras').select('id').limit(1);
  assert.ok(financeReadError, 'Anonymous users must not read financial records.');

  const { error: checkoutReadError } = await anonymous.from('checkouts_pagamento').select('id').limit(1);
  assert.ok(checkoutReadError, 'Anonymous users must not read payment checkout records.');

  const { error: roleMutationError } = await anonymous.rpc('admin_atualizar_tipo_usuario', { p_usuario_id: '00000000-0000-0000-0000-000000000000', p_tipo: 'admin' });
  assert.ok(roleMutationError, 'Anonymous users must not manage platform roles.');

  const { error: rateLimitError } = await anonymous.rpc('consume_api_rate_limit', {
    p_key_hash: '0'.repeat(64),
    p_max_requests: 1,
    p_window_seconds: 60,
  });
  assert.ok(rateLimitError, 'Anonymous users must not manipulate server rate limits.');

  console.log('Integration security checks passed: public discovery allowed; profiles, admin, booking, checkout, finance, rate-limit and telemetry denied.');
}

void main();
