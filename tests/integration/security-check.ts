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

  const { data: telemetry, error: telemetryError } = await anonymous.from('telemetria_eventos').select('id').limit(1);
  assert.equal(telemetryError, null, 'Telemetry probe should be filtered by RLS.');
  assert.equal(telemetry?.length, 0, 'Anonymous users must not see telemetry rows.');

  const { error: intentReadError } = await anonymous.from('booking_intents').select('token').limit(1);
  assert.ok(intentReadError, 'Anonymous users must not read temporary booking identity data.');

  const { error: rateLimitError } = await anonymous.rpc('consume_api_rate_limit', {
    p_key_hash: '0'.repeat(64),
    p_max_requests: 1,
    p_window_seconds: 60,
  });
  assert.ok(rateLimitError, 'Anonymous users must not manipulate server rate limits.');

  console.log('Integration security checks passed: public catalog/legal data allowed; mutations, intent PII, rate limits and telemetry denied.');
}

void main();
