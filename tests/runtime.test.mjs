import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

const bundle = await build({
  entryPoints: ['src/native.mjs'], bundle: true, write: false, format: 'iife',
  plugins: [{
    name: 'native-test-adapter',
    setup(builder) {
      builder.onResolve({ filter: /^@capacitor\// }, args => ({ path: args.path, namespace: 'native-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'native-test' }, () => ({ contents: `
        export const registerPlugin = () => globalThis.testShell;
        export const App = { addListener() {} };
        export const PushNotifications = {};
      ` }));
    },
  }],
});

async function run(pending, status = 204) {
  const calls = [];
  const errors = [];
  const destinations = [];
  let finish;
  const finished = new Promise(resolve => { finish = resolve; });
  const context = {
    FormData, Blob, Uint8Array, TextEncoder, atob, URL,
    location: { origin: 'https://app.tervory.com', pathname: '/mobile/bridge',
      replace(value) { destinations.push(value); finish(); } },
    testShell: {
      async pending() { return pending; },
      async acknowledge(value) { calls.push({ acknowledge: value }); },
    },
    async fetch(path, options) {
      calls.push({ path, options });
      if (status === 401) setTimeout(finish, 0);
      return { ok: status >= 200 && status < 300, status, async json() { return { draft_id: 'draft-123' }; } };
    },
    document: {
      getElementById() { return null; }, querySelector() { return null; },
      createElement() { return { setAttribute() {}, textContent: '' }; },
      body: { prepend(element) { errors.push(element.textContent); finish(); } },
    },
    MutationObserver: class { observe() {} },
    addEventListener() {},
  };
  context.window = context;
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  const timeout = setTimeout(finish, 1000);
  await finished;
  clearTimeout(timeout);
  return { calls, errors, destinations };
}

test('verified native proof is exchanged with same-origin cookies before opening chats', async () => {
  const result = await run({ auth: { code: 'a'.repeat(32), verifier: 'b'.repeat(43) } });
  assert.equal(result.calls[0].path, '/api/mobile/session');
  assert.equal(result.calls[0].options.credentials, 'same-origin');
  assert.equal(result.calls[0].options.redirect, 'error');
  assert.equal(JSON.parse(result.calls[0].options.body).code_verifier, 'b'.repeat(43));
  assert.equal(result.calls[1].acknowledge.kind, 'auth');
  assert.deepEqual(result.destinations, ['/chats']);
  assert.deepEqual(result.errors, []);
});

test('a refused session does not consume the proof or claim authenticated chats', async () => {
  const result = await run({ auth: { code: 'a'.repeat(32), verifier: 'b'.repeat(43) } }, 403);
  assert.equal(result.calls.length, 1);
  assert.deepEqual(result.destinations, []);
  assert.match(result.errors[0], /Trigger sign-in is unavailable/);
});

test('signed-out sharing retains the native inbox without sending a message', async () => {
  const result = await run({ share: { id: 'share-1', text: 'https://example.org' } }, 401);
  assert.equal(result.calls[0].path, '/api/mobile/shares');
  assert.equal(result.calls.length, 1);
  assert.deepEqual(result.destinations, []);
});

test('a successful shared draft is acknowledged before opening its chats preview', async () => {
  const result = await run({ share: { id: 'share-1', text: 'https://example.org' } }, 201);
  assert.equal(result.calls[1].acknowledge.kind, 'share');
  assert.equal(result.calls[1].acknowledge.id, 'share-1');
  assert.deepEqual(result.destinations, ['/chats?draft=draft-123']);
});
