import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSameSiteRequest } from '../lib/server/request-protection';

test('accepts same-origin and browser-navigation requests', () => {
  assert.equal(isSameSiteRequest(new Request('https://agenda.example/api/test', {
    headers: { origin: 'https://agenda.example', 'sec-fetch-site': 'same-origin' },
  })), true);
  assert.equal(isSameSiteRequest(new Request('https://agenda.example/api/test')), true);
});

test('rejects cross-site API requests even with a forged fetch destination', () => {
  assert.equal(isSameSiteRequest(new Request('https://agenda.example/api/test', {
    headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'same-site' },
  })), false);
  assert.equal(isSameSiteRequest(new Request('https://agenda.example/api/test', {
    headers: { 'sec-fetch-site': 'cross-site' },
  })), false);
});
