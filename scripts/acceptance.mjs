import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const serialIndex = process.argv.indexOf('--serial');
const serial = process.argv[serialIndex + 1];
if (serialIndex === -1 || !/^emulator-\d+$/.test(serial ?? '')) {
  throw new Error('Pass --serial emulator-<port> for an Android emulator with the debug APK installed.');
}
function adb(...args) {
  return execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8', timeout: 15000 }).trim();
}
if (adb('shell', 'getprop', 'ro.kernel.qemu') !== '1') throw new Error('An emulator is required.');
const output = resolve('.tmp/acceptance');
await mkdir(output, { recursive: true });
adb('shell', 'am', 'force-stop', 'com.tervory.app');
adb('shell', 'am', 'start', '-n', 'com.tervory.app/.MainActivity');
console.log('Complete Trigger sign-in in the emulator system browser. Waiting up to five minutes for authenticated chats.');

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  return {
    close: () => socket.close(),
    call(method, params = {}) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { socket.removeEventListener('message', onMessage); reject(new Error('CDP timed out')); }, 10000);
        function onMessage(event) {
          const result = JSON.parse(event.data);
          if (result.id !== id) return;
          clearTimeout(timeout);
          socket.removeEventListener('message', onMessage);
          if (result.error) reject(new Error(result.error.message));
          else resolve(result.result);
        }
        socket.addEventListener('message', onMessage);
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

const deadline = Date.now() + 300000;
let accepted = false;
while (Date.now() < deadline && !accepted) {
  let connection;
  let port;
  try {
    const processId = adb('shell', 'pidof', 'com.tervory.app').split(/\s+/)[0];
    if (!/^\d+$/.test(processId)) throw new Error('App is not running');
    port = adb('forward', 'tcp:0', `localabstract:webview_devtools_remote_${processId}`);
    const pages = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(5000) })).json();
    const page = pages.find(value => value.url === 'https://app.tervory.com/chats' || value.url.startsWith('https://app.tervory.com/chats?'));
    if (page?.webSocketDebuggerUrl) {
      connection = await connect(page.webSocketDebuggerUrl);
      const result = await connection.call('Runtime.evaluate', {
        expression: `(async () => ({ path: location.pathname, passwords: document.querySelectorAll('input[type="password"]').length, status: (await fetch('/api/mobile/bootstrap', { credentials: 'same-origin', redirect: 'error' })).status }))()`,
        awaitPromise: true, returnByValue: true,
      });
      const proof = result.result?.value;
      if (proof?.path === '/chats' && proof.passwords === 0 && proof.status === 200) {
        const screenshot = await connection.call('Page.captureScreenshot', { format: 'png' });
        await writeFile(`${output}/chats.png`, Buffer.from(screenshot.data, 'base64'));
        await writeFile(`${output}/result.json`, JSON.stringify({
          accepted: true, tested_at: new Date().toISOString(), emulator: serial,
          origin: 'https://app.tervory.com', ...proof,
          limitation: 'Operator completes Trigger sign-in in the system browser; inspect callback verification separately.',
        }, null, 2));
        accepted = true;
      }
    }
  } catch {
    accepted = false;
  } finally {
    connection?.close();
    if (port) adb('forward', '--remove', `tcp:${port}`);
  }
  if (!accepted) await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!accepted) throw new Error('Authenticated /chats was not reached. Sign-in acceptance remains incomplete.');
console.log(`Authenticated chats verified. Local evidence: ${output}`);
