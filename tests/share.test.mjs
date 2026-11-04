import test from 'node:test';
import assert from 'node:assert/strict';
import { shareForm, MAX_SHARE_BYTES } from '../src/share.mjs';

test('a shared link creates a draft payload without executing or navigating to it', () => {
  const form = shareForm({ id: 'draft-1', text: 'https://example.org/path?q=1' });
  assert.equal(form.get('text'), 'https://example.org/path?q=1');
  assert.equal(form.get('share_id'), 'draft-1');
});

test('shared files are inert binary attachments with sanitized names', async () => {
  const form = shareForm({ id: 'draft-1', files: [{ name: '../file.html', data: btoa('<html>hello</html>') }] });
  const file = form.get('files');
  assert.equal(file.name, '.._file.html');
  assert.equal(file.type, 'application/octet-stream');
  assert.equal(await file.text(), '<html>hello</html>');
});

test('empty, oversized, malformed and excessive shares are rejected', () => {
  assert.throws(() => shareForm({ id: 'draft-1' }));
  assert.throws(() => shareForm({ id: '../bad', text: 'hello' }));
  assert.throws(() => shareForm({ id: 'draft-1', text: 'x'.repeat(MAX_SHARE_BYTES + 1) }));
  assert.throws(() => shareForm({ id: 'draft-1', files: Array(6).fill({ data: 'eA==' }) }));
  assert.throws(() => shareForm({ id: 'draft-1', files: [{ data: '***' }] }));
});
