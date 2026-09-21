const form = document.getElementById('session-form');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const fieldsEl = document.getElementById('session-fields');
const jsonEl = document.getElementById('session-json');
const watchlistAddBtn = document.getElementById('watchlist-add');
const watchlistRemoveBtn = document.getElementById('watchlist-remove');
const authSignedOut = document.getElementById('auth-signed-out');
const authSignedIn = document.getElementById('auth-signed-in');
const authLocalOpen = document.getElementById('auth-local-open');
const clerkSignInBtn = document.getElementById('clerk-sign-in');
const clerkSignOutBtn = document.getElementById('clerk-sign-out');
const clerkUserEmailEl = document.getElementById('clerk-user-email');

/** @type {typeof window.Clerk | null} */
let clerk = null;
let clerkRequired = false;

function setStatus(message, kind) {
  statusEl.hidden = !message;
  statusEl.textContent = message || '';
  statusEl.className = kind ? `status ${kind}` : 'status';
}

function appendField(label, value, className) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  if (className) {
    dd.className = className;
  }
  fieldsEl.append(dt, dd);
}

function renderSession(session) {
  fieldsEl.replaceChildren();

  appendField('Token', session.token);
  appendField('Pair', session.pair);
  appendField('Exchange', session.exchange);
  appendField('Timeframe', session.timeframe);
  appendField('RSI', session.rsi != null ? String(session.rsi) : '—');
  appendField('RSI as of', session.rsiAsOf || '—');
  appendField('On watchlist', session.onWatchlist ? 'yes' : 'no');

  const alertStatus = session.alert?.status || 'none';
  let alertClass = '';
  if (alertStatus === 'active') {
    alertClass = 'alert-active';
  } else if (alertStatus === 'recent') {
    alertClass = 'alert-recent';
  }
  appendField('Alert', alertStatus, alertClass);

  if (session.alert?.summary) {
    appendField('Alert summary', session.alert.summary);
  }
  if (session.errors?.length) {
    appendField('Errors', session.errors.join('; '));
  }

  jsonEl.textContent = JSON.stringify(session, null, 2);
  resultEl.hidden = false;

  updateWatchlistButtons(session.token);
}

function updateWatchlistButtons(token) {
  const hasToken = Boolean(String(token || '').trim());
  const signedIn = clerk ? Boolean(clerk.user) : !clerkRequired;
  watchlistAddBtn.disabled = !hasToken || !signedIn;
  watchlistRemoveBtn.disabled = !hasToken || !signedIn;
}

function updateAuthUi() {
  if (authLocalOpen) {
    authLocalOpen.hidden = clerkRequired;
  }
  if (!clerkRequired) {
    if (authSignedOut) authSignedOut.hidden = true;
    if (authSignedIn) authSignedIn.hidden = true;
    return;
  }
  const user = clerk?.user;
  if (authSignedOut) authSignedOut.hidden = Boolean(user);
  if (authSignedIn) authSignedIn.hidden = !user;
  if (user && clerkUserEmailEl) {
    const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '—';
    clerkUserEmailEl.textContent = email;
  }
  updateWatchlistButtons(String(new FormData(form).get('token') || '').trim());
}

async function loadClerkScript(publishableKey) {
  if (!window.Clerk) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.clerkPublishableKey = publishableKey;
      script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Clerk'));
      document.head.appendChild(script);
    });
  }
  await window.Clerk.load({ publishableKey });
  return window.Clerk;
}

async function initClerkAuth() {
  try {
    const response = await fetch('/api/auth/config');
    const config = await response.json();
    if (!config.publishableKey) {
      clerkRequired = false;
      updateAuthUi();
      return;
    }
    clerkRequired = true;
    clerk = await loadClerkScript(config.publishableKey);
    clerk.addListener(() => updateAuthUi());
    updateAuthUi();
  } catch (err) {
    console.error(err);
    setStatus('Could not initialize Clerk sign-in.', 'error');
  }
}

async function mutationHeaders() {
  if (!clerkRequired || !clerk) {
    return {};
  }
  const token = await clerk.session?.getToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

async function loadSessionFromForm() {
  const data = new FormData(form);
  const token = String(data.get('token') || '').trim();
  const timeframe = String(data.get('timeframe') || '').trim();
  const exchange = String(data.get('exchange') || '').trim();

  const params = new URLSearchParams({ token, timeframe });
  if (exchange) {
    params.set('exchange', exchange);
  }

  setStatus('Loading session…', 'loading');
  resultEl.hidden = true;

  const response = await fetch(`/api/session?${params.toString()}`);
  const body = await response.json();
  if (!response.ok) {
    setStatus(body.error || `Request failed (${response.status})`, 'error');
    return null;
  }
  setStatus('');
  renderSession(body);
  return body;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await loadSessionFromForm();
  } catch (err) {
    setStatus(err.message || 'Network error', 'error');
  }
});

if (clerkSignInBtn) {
  clerkSignInBtn.addEventListener('click', () => {
    clerk?.openSignIn();
  });
}

if (clerkSignOutBtn) {
  clerkSignOutBtn.addEventListener('click', async () => {
    await clerk?.signOut();
    updateAuthUi();
  });
}

async function mutateWatchlist(method, tokenSymbol) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await mutationHeaders()),
  };
  const url = method === 'DELETE'
    ? `/api/watchlist/${encodeURIComponent(tokenSymbol)}`
    : '/api/watchlist';
  const init = { method, headers };
  if (method === 'POST') {
    init.body = JSON.stringify({ token: tokenSymbol });
  }
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

watchlistAddBtn.addEventListener('click', async () => {
  const token = String(new FormData(form).get('token') || '').trim();
  if (!token) {
    return;
  }
  if (clerkRequired && !clerk?.user) {
    clerk?.openSignIn();
    return;
  }
  try {
    await mutateWatchlist('POST', token);
    setStatus('Added to watchlist.', '');
    await loadSessionFromForm();
  } catch (err) {
    setStatus(err.message || 'Watchlist update failed', 'error');
  }
});

watchlistRemoveBtn.addEventListener('click', async () => {
  const token = String(new FormData(form).get('token') || '').trim();
  if (!token) {
    return;
  }
  if (clerkRequired && !clerk?.user) {
    clerk?.openSignIn();
    return;
  }
  try {
    await mutateWatchlist('DELETE', token);
    setStatus('Removed from watchlist.', '');
    await loadSessionFromForm();
  } catch (err) {
    setStatus(err.message || 'Watchlist update failed', 'error');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  initClerkAuth();
});
