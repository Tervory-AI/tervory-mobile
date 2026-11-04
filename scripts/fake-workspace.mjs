import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const callback = 'https://app.tervory.com/mobile/callback';
const challenges = new Map();
const codes = new Map();
const sessions = new Set();
const devices = new Set();
const proof = { browserSignIn: 0, approved: 0, exchanged: 0, authenticatedChats: 0, registered: 0, notified: 0 };
const html = content => `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body>${content}</body></html>`;

export function fakeWorkspace() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1:4100');
      let body = '';
      for await (const chunk of request) { body += chunk; if (body.length > 8192) throw new Error('Too large'); }
      const send = (status, data, headers = {}) => {
        response.writeHead(status, { 'Content-Type': typeof data === 'string' ? 'text/html' : 'application/json', 'Cache-Control': 'no-store', ...headers });
        response.end(typeof data === 'string' ? data : JSON.stringify(data));
      };
      const signedIn = sessions.has((request.headers.cookie ?? '').split(';').map(value => value.trim()).find(value => value.startsWith('fake_session='))?.slice(13));
      if (url.pathname === '/proof') return send(200, proof);
      if (url.pathname === '/mobile/sign-in') {
        const state = url.searchParams.get('state');
        const challenge = url.searchParams.get('code_challenge');
        if (!/^[A-Za-z0-9_-]{43}$/.test(state ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(challenge ?? '')
            || url.searchParams.get('redirect_uri') !== callback || url.searchParams.get('code_challenge_method') !== 'S256') return send(400, {});
        challenges.set(state, challenge); proof.browserSignIn++;
        return send(200, html(`<h1>Trigger sign-in</h1><form action="/approve" method="post"><input type="hidden" name="state" value="${state}"><button style="font-size:24px">Trigger sign-in</button></form>`));
      }
      if (url.pathname === '/approve' && request.method === 'POST') {
        const state = new URLSearchParams(body).get('state');
        if (!challenges.has(state)) return send(401, {});
        const code = randomBytes(32).toString('base64url');
        codes.set(code, challenges.get(state)); challenges.delete(state); proof.approved++;
        return send(303, '', { Location: `${callback}?${new URLSearchParams({ state, code })}` });
      }
      if (url.pathname === '/api/mobile/session' && request.method === 'POST') {
        const input = JSON.parse(body);
        const expected = codes.get(input.code);
        const challenge = createHash('sha256').update(input.code_verifier ?? '').digest('base64url');
        if (!expected || input.redirect_uri !== callback || !timingSafeEqual(Buffer.from(expected), Buffer.from(challenge))) return send(401, {});
        codes.delete(input.code); const session = randomBytes(32).toString('base64url'); sessions.add(session); proof.exchanged++;
        return send(200, { signed_in: true }, { 'Set-Cookie': `fake_session=${session}; HttpOnly; SameSite=Strict; Path=/` });
      }
      if (url.pathname === '/mobile/bridge') return send(200, html('<h1>Opening your workspace…</h1>'));
      if (url.pathname === '/api/mobile/bootstrap') return send(signedIn ? 200 : 401, { push_enabled: true });
      if (url.pathname === '/api/mobile/devices') {
        const input = JSON.parse(body);
        if (!signedIn) return send(401, {});
        if (input.platform !== 'android' || input.token !== 'fake-emulator-phone') return send(422, {});
        devices.add(input.token); proof.registered++;
        return send(200, { registered: true });
      }
      if (url.pathname === '/notify' && request.method === 'POST') {
        if (!signedIn) return send(401, {});
        if (!devices.has('fake-emulator-phone')) return send(409, {});
        proof.notified++; return send(200, { title: 'A general update', body: 'Ready', path: '/chats?notification=proof' });
      }
      if (url.pathname === '/chats' && signedIn) { proof.authenticatedChats++; return send(200, html('<h1>Your chats</h1>')); }
      if (url.pathname === '/sign-in') return send(200, html('<h1>Trigger sign-in</h1>'));
      return send(303, '', { Location: '/sign-in' });
    } catch { response.writeHead(400); response.end(); }
  });
}

if (process.argv[1]?.endsWith('/fake-workspace.mjs')) fakeWorkspace().listen(4100, '127.0.0.1', () => console.log('Fake Workspace ready on loopback:4100'));
