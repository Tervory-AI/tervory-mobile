import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const source = 'assets/brand/tervory-logo-reversed.png';
const digest = createHash('sha256').update(await readFile(source)).digest('hex');
assert.equal(digest, 'a7bd38a30cddb4faa64363471dcc956c0611e7f67ab5a59f12de62407adf1f75');
const navy = '#001840';

async function image(size, logoWidth, output, transparent = false) {
  await mkdir(output.slice(0, output.lastIndexOf('/')), { recursive: true });
  const logo = await sharp(source).resize({ width: logoWidth }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4,
    background: transparent ? '#00000000' : navy } })
    .composite([{ input: logo, gravity: 'centre' }]).png().toFile(output);
}

await image(1024, 850, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
for (const suffix of ['', '-1', '-2']) {
  await image(2732, 1200, `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${suffix}.png`);
}
for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    await image(size, Math.round(size * 0.82), `android/app/src/main/res/mipmap-${density}/${name}.png`);
  }
  await image(Math.round(size * 2.25), Math.round(size * 1.2),
    `android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`, true);
}
await image(480, 250, 'android/app/src/main/res/drawable/splash.png');
for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  for (const orientation of ['land', 'port']) {
    await image(1920, 800, `android/app/src/main/res/drawable-${orientation}-${density}/splash.png`);
  }
}
await writeFile('assets/brand/SOURCE.md', `# Brand source\n\nCopied unchanged from tervory-tank workspace/public/brand/tervory-logo-reversed.png.\nSHA-256: ${digest}\n\nGenerated assets scale and center the complete original logo on navy #001840.\nNo logo is redrawn, cropped, or placed on a white rectangle. Run npm run assets.\n`);
