import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const config = JSON.parse(await readFile('capacitor.config.json', 'utf8'));
assert.equal(config.appId, 'com.tervory.app');
assert.equal(config.server.url, 'https://app.tervory.com');
assert.equal(config.server.cleartext, false);
assert.equal(config.server.allowNavigation, undefined);
assert.equal(config.android?.allowMixedContent, undefined);
console.log('Native origin and transport policy passed.');
