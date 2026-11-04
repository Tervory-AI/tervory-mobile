import { registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ORIGIN, sessionBody } from './policy.mjs';

const shell = registerPlugin('MobileShell');
let running = false;

async function resume() {
  if (running || location.origin !== ORIGIN) return;
  running = true;
  try {
    const pending = await shell.pending();
    if (pending.auth) {
      const response = await fetch('/api/mobile/session', {
        method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-Tervory-Mobile': '1' },
        body: JSON.stringify(sessionBody(pending.auth.code, pending.auth.verifier)),
      });
      if (!response.ok) throw new Error('Trigger sign-in is unavailable. Please try again.');
      await shell.acknowledge({ kind: 'auth' });
      location.replace('/chats');
    }
  } catch (error) {
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = error.message;
    document.body.prepend(message);
  } finally {
    running = false;
  }
}

if (location.origin === ORIGIN) {
  App.addListener('appStateChange', ({ isActive }) => { if (isActive) void resume(); });
  window.addEventListener('tervory:resume', () => void resume());
  void resume();
}
