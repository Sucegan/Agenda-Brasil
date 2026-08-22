import assert from 'node:assert/strict';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(url && key, 'Supabase public environment variables are required.');

  const anonymous = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: catalog, error: catalogError } = await anonymous.rpc('obter_catalogo_publico');
  assert.equal(catalogError, null, `Public catalog failed: ${catalogError?.message}`);
  assert.ok(catalog?.negocio, 'Public catalog must include business settings.');

  const { error: protectedError } = await anonymous.rpc('criar_agendamento_com_origem', {
    p_barbeiro_id: -1,
    p_servico_id: -1,
    p_data: '2099-01-01',
    p_horario: '09:00:00',
    p_origem: 'link_publico',
  });
  assert.ok(protectedError, 'Anonymous users must not execute the booking mutation.');

  const { data: telemetry, error: telemetryError } = await anonymous.from('telemetria_eventos').select('id').limit(1);
  assert.equal(telemetryError, null, 'Telemetry probe should be filtered by RLS.');
  assert.equal(telemetry?.length, 0, 'Anonymous users must not see telemetry rows.');

  console.log('Integration security checks passed: public catalog allowed; booking mutation and telemetry denied.');
}

void main();
