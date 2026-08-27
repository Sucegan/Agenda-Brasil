import test from 'node:test';
import assert from 'node:assert/strict';
import { signupErrorMessage, signupLooksLikeExistingAccount, validateSignupFields } from '../lib/signup-validation';

test('signup validation rejects a one-character name before Supabase', () => {
  const result = validateSignupFields({ name: 's', phone: '(18) 99658-2256', email: 'cliente@example.com', password: '12345678' });
  assert.equal(result.error, 'Informe seu nome completo com pelo menos 2 caracteres.');
  assert.equal(result.data, null);
});

test('signup validation rejects an incomplete WhatsApp number', () => {
  const result = validateSignupFields({ name: 'Sucegan', phone: '(18) 9999', email: 'cliente@example.com', password: '12345678' });
  assert.equal(result.error, 'Informe um WhatsApp válido com DDD.');
});

test('signup validation normalizes accepted identity fields', () => {
  const result = validateSignupFields({ name: '  Igor   Sucegan ', phone: '(18) 99658-2256', email: '  CLIENTE@EXAMPLE.COM ', password: '12345678' });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, { name: 'Igor Sucegan', phone: '(18) 99658-2256', email: 'cliente@example.com', password: '12345678' });
});

test('signup validation rejects passwords shorter than eight characters', () => {
  const result = validateSignupFields({ name: 'Igor Sucegan', phone: '(18) 99658-2256', email: 'cliente@example.com', password: '1234567' });
  assert.equal(result.error, 'A senha deve ter no mínimo 8 caracteres.');
});

test('database signup failures are translated into a useful message', () => {
  assert.equal(
    signupErrorMessage({ code: 'unexpected_failure', message: 'Database error saving new user' }),
    'Não foi possível criar o perfil. Confira o nome completo, o WhatsApp e tente novamente.',
  );
});

test('an obfuscated signup response is recognized as an existing account', () => {
  assert.equal(signupLooksLikeExistingAccount({ identities: [] }), true);
  assert.equal(signupLooksLikeExistingAccount({ identities: [{ id: 'identity-id' }] }), false);
  assert.equal(signupLooksLikeExistingAccount(null), false);
});
