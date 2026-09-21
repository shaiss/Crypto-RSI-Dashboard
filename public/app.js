const ACCESS_STORAGE_KEY = 'cryptoRsiAppAccessToken';

const form = document.getElementById('session-form');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const fieldsEl = document.getElementById('session-fields');
const jsonEl = document.getElementById('session-json');
const accessTokenInput = document.getElementById('access-token');
const watchlistAddBtn = document.getElementById('watchlist-add');
const watchlistRemoveBtn = document.getElementById('watchlist-remove');

function getStoredAccessToken() {
  try {
    return sessionStorage.getItem(ACCESS_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setStoredAccessToken(value) {
  try {
    if (value) {
      sessionStorage.setItem(ACCESS_STORAGE_KEY, value);
    } else {
      sessionStorage.removeItem(ACCESS_STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

function mutationHeaders() {
  const token = getStoredAccessToken().trim();
  if (!token) {
    return {};
  }
  return { 'x-app-access-token': token };
}

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

  watchlistAddBtn.disabled = !session.token;
  watchlistRemoveBtn.disabled = !session.token;
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

if (accessTokenInput) {
  accessTokenInput.value = getStoredAccessToken();
  accessTokenInput.addEventListener('change', () => {
    setStoredAccessToken(accessTokenInput.value.trim());
  });
  accessTokenInput.addEventListener('blur', () => {
    setStoredAccessToken(accessTokenInput.value.trim());
  });
}

async function mutateWatchlist(method, tokenSymbol) {
  const headers = {
    'Content-Type': 'application/json',
    ...mutationHeaders(),
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
  try {
    await mutateWatchlist('DELETE', token);
    setStatus('Removed from watchlist.', '');
    await loadSessionFromForm();
  } catch (err) {
    setStatus(err.message || 'Watchlist update failed', 'error');
  }
});
