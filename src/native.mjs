import { registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { ORIGIN, sessionBody, notificationPath } from './policy.mjs';
import { shareForm } from './share.mjs';

const shell = registerPlugin('MobileShell');
let running = false;
let pushReady = false;
let pushListening = false;

function guardSignIn() {
  if (document.getElementById('tervory-trigger-sign-in')) return;
  if (!location.pathname.startsWith('/sign-in') && !document.querySelector('input[type="password"]')) return;
  const title = document.createElement('h1');
  title.textContent = 'Trigger sign-in';
  const button = document.createElement('button');
  button.id = 'tervory-trigger-sign-in';
  button.textContent = 'Continue in browser';
  button.onclick = () => void shell.beginSignIn();
  document.body.replaceChildren(title, button);
}

async function notifications() {
  if (pushReady) return;
  const bootstrap = await fetch('/api/mobile/bootstrap', { credentials: 'same-origin', redirect: 'error' });
  if (!bootstrap.ok || !(await bootstrap.json()).push_enabled) return;
  pushReady = true;
  if (!pushListening) {
    pushListening = true;
    await PushNotifications.addListener('registration', ({ value }) => {
      void fetch('/api/mobile/devices', {
        method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-Tervory-Mobile': '1' },
        body: JSON.stringify({ token: value, platform: window.Capacitor.getPlatform() }),
      }).then(response => { if (!response.ok) pushReady = false; })
        .catch(() => { pushReady = false; });
    });
    await PushNotifications.addListener('registrationError', () => { pushReady = false; });
    await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      location.assign(notificationPath(notification.data?.path));
    });
  }
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') permission = await PushNotifications.requestPermissions();
  if (permission.receive === 'granted') await PushNotifications.register();
  else pushReady = false;
}

async function resume() {
  if (running || location.origin !== ORIGIN) return;
  if (location.pathname === '/sign-in' || location.pathname.startsWith('/sign-in/')) return;
  running = true;
  let signInFailed = false;
  try {
    const pending = await shell.pending();
    signInFailed = Boolean(pending.auth);
    if (pending.auth) {
      const response = await fetch('/api/mobile/session', {
        method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-Tervory-Mobile': '1' },
        body: JSON.stringify(sessionBody(pending.auth.code, pending.auth.verifier)),
      });
      if (!response.ok) throw new Error('Trigger sign-in is unavailable. Please try again.');
      await shell.acknowledge({ kind: 'auth' });
      location.replace('/chats');
      return;
    }
    if (pending.share) {
      const response = await fetch('/api/mobile/shares', {
        method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: { 'X-Tervory-Mobile': '1' }, body: shareForm(pending.share),
      });
      if (response.status === 401) return;
      if (!response.ok) throw new Error('Your shared item is saved on this device. Please try again later.');
      const result = await response.json();
      if (typeof result.draft_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(result.draft_id)) {
        throw new Error('The shared item could not be opened. Please try again.');
      }
      await shell.acknowledge({ kind: 'share', id: pending.share.id });
      location.replace(`/chats?draft=${encodeURIComponent(result.draft_id)}`);
      return;
    }
    if (pending.push_available !== false) await notifications();
  } catch (error) {
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = error.message;
    document.body.prepend(message);
    if (signInFailed) {
      const retry = document.createElement('button');
      retry.textContent = 'Trigger sign-in';
      retry.onclick = () => void shell.beginSignIn();
      document.body.prepend(retry);
    }
  } finally {
    running = false;
  }
}

if (location.origin === ORIGIN && !window.__tervoryNativeStarted) {
  window.__tervoryNativeStarted = true;
  new MutationObserver(guardSignIn).observe(document.body, { childList: true, subtree: true });
  guardSignIn();
  App.addListener('appStateChange', ({ isActive }) => { if (isActive) void resume(); });
  window.addEventListener('tervory:resume', () => void resume());
  void resume();
}
