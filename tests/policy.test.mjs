import test from 'node:test';
import assert from 'node:assert/strict';
import { trustedURL, notificationPath, sessionBody, CALLBACK } from '../src/policy.mjs';

test('only the Workspace HTTPS origin is trusted', () => {
  for (const value of ['http://app.tervory.com', 'https://app.tervory.com.evil.test',
    'https://user@app.tervory.com', 'javascript:alert(1)', 'https://evil.test/chats']) {
    assert.equal(trustedURL(value), null);
  }
  assert.equal(trustedURL('https://app.tervory.com/chats').pathname, '/chats');
});

test('sign-in exchanges a code and PKCE proof, with a fixed return URI', () => {
  assert.deepEqual(sessionBody('a'.repeat(32), 'b'.repeat(43)), {
    code: 'a'.repeat(32), code_verifier: 'b'.repeat(43), redirect_uri: CALLBACK,
  });
  for (const code of ['', 'short', '<script>', null]) {
    assert.throws(() => sessionBody(code, 'b'.repeat(43)));
  }
  assert.throws(() => sessionBody('a'.repeat(32), 'short'));
});

test('general notification destinations cannot leave the Workspace', () => {
  assert.equal(notificationPath('/chats/123'), '/chats/123');
  assert.equal(notificationPath('https://evil.test/chats'), '/chats');
  assert.equal(notificationPath('//evil.test'), '/chats');
  assert.equal(notificationPath('/admin'), '/admin');
  assert.equal(notificationPath('/alerts?filter=ready#proof'), '/alerts?filter=ready#proof');
});
