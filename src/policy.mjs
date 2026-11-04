export const ORIGIN = typeof __MOBILE_TEST_ORIGIN__ === 'string' ? __MOBILE_TEST_ORIGIN__ : 'https://app.tervory.com';
export const CALLBACK = 'https://app.tervory.com/mobile/callback';

export function trustedURL(value) {
  try {
    const url = new URL(value);
    return url.origin === ORIGIN && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function sessionBody(code, verifier) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{16,512}$/.test(code)
    || typeof verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) {
    throw new Error('Trigger sign-in could not be verified. Please try again.');
  }
  return { code, code_verifier: verifier, redirect_uri: CALLBACK };
}

export function notificationPath(value) {
  let url;
  try {
    url = trustedURL(new URL(typeof value === 'string' ? value : '/chats', ORIGIN).href);
  } catch {
    return '/chats';
  }
  return url
    ? `${url.pathname}${url.search}${url.hash}` : '/chats';
}
