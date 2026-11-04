import { readFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
if (process.env.MOBILE_TAG !== `mobile-v${version}`) {
  throw new Error('The mobile tag must match package.json version.');
}
