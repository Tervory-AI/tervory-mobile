import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { fakeWorkspace } from '../scripts/fake-workspace.mjs';

test('fake Trigger exchanges one-use PKCE and notifies only a registered fake phone', async () => {
  const server = fakeWorkspace().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const verifier = 'v'.repeat(43);
    const state = 's'.repeat(43);
    const redirect_uri = 'https://app.tervory.com/mobile/callback';
    const params = new URLSearchParams({ state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', redirect_uri });
    assert.equal((await fetch(`${origin}/api/mobile/bootstrap`)).status, 401);
    assert.equal((await fetch(`${origin}/mobile/sign-in?${params}`)).status, 200);
    const approval = await fetch(`${origin}/approve`, { method: 'POST', body: new URLSearchParams({ state }), redirect: 'manual' });
    assert.equal(approval.status, 303);
    const callback = new URL(approval.headers.get('location'));
    assert.equal(callback.origin + callback.pathname, redirect_uri);
    const body = JSON.stringify({ code: callback.searchParams.get('code'), code_verifier: verifier, redirect_uri });
    const session = await fetch(`${origin}/api/mobile/session`, { method: 'POST', body });
    assert.equal(session.status, 200);
    assert.equal((await fetch(`${origin}/api/mobile/session`, { method: 'POST', body })).status, 401);
    const cookie = session.headers.get('set-cookie').split(';')[0];
    assert.match(session.headers.get('set-cookie'), /HttpOnly/);
    const headers = { Cookie: cookie };
    assert.equal((await fetch(`${origin}/api/mobile/bootstrap`, { headers })).status, 200);
    assert.match(await (await fetch(`${origin}/chats`, { headers })).text(), /Your chats/);
    assert.equal((await fetch(`${origin}/notify`, { method: 'POST', headers })).status, 409);
    assert.equal((await fetch(`${origin}/api/mobile/devices`, { method: 'POST', headers, body: JSON.stringify({ platform: 'android', token: 'fake-emulator-phone' }) })).status, 200);
    assert.equal((await (await fetch(`${origin}/notify`, { method: 'POST', headers })).json()).path, '/chats?notification=proof');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
